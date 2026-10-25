<?php

namespace App\Services;

use App\Support\Js;
use RuntimeException;

/**
 * Lector y escritor mínimo de .xlsx sin librerías externas (solo zlib, incluido en PHP).
 * Copia fiel de utils/xlsx.js del backend Node: genera exactamente el mismo archivo.
 */
final class Xlsx
{
    // ---------- ZIP ----------
    private static function u16(string $b, int $p): int { return unpack('v', substr($b, $p, 2))[1]; }
    private static function u32(string $b, int $p): int { return unpack('V', substr($b, $p, 4))[1]; }

    private static function readZip(string $buf): array
    {
        $len = strlen($buf);
        $eocd = -1;
        for ($i = $len - 22; $i >= max(0, $len - 65557); $i--) {
            if ($i + 4 <= $len && self::u32($buf, $i) === 0x06054b50) { $eocd = $i; break; }
        }
        if ($eocd < 0) throw new RuntimeException('El archivo no es un Excel (.xlsx) válido');
        $total = self::u16($buf, $eocd + 10);
        $p = self::u32($buf, $eocd + 16);
        $files = [];
        for ($i = 0; $i < $total; $i++) {
            if (self::u32($buf, $p) !== 0x02014b50) break;
            $method = self::u16($buf, $p + 10);
            $csize = self::u32($buf, $p + 20);
            $nlen = self::u16($buf, $p + 28);
            $xlen = self::u16($buf, $p + 30);
            $clen = self::u16($buf, $p + 32);
            $lho = self::u32($buf, $p + 42);
            $name = substr($buf, $p + 46, $nlen);
            $lnlen = self::u16($buf, $lho + 26);
            $lxlen = self::u16($buf, $lho + 28);
            $start = $lho + 30 + $lnlen + $lxlen;
            $raw = substr($buf, $start, $csize);
            $files[$name] = function () use ($method, $raw) {
                if ($method === 0) return $raw;
                $out = @gzinflate($raw);
                if ($out === false) throw new RuntimeException('El archivo no es un Excel (.xlsx) válido');
                return $out;
            };
            $p += 46 + $nlen + $xlen + $clen;
        }
        return $files;
    }

    private static function writeZip(array $entries): string
    {
        $locals = '';
        $centrals = '';
        $offset = 0;
        foreach ($entries as $e) {
            $name = $e['name'];
            $raw = $e['data'];
            $comp = gzdeflate($raw, -1, ZLIB_ENCODING_RAW);
            $crc = crc32($raw);
            $locals .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, 8, 0, 0, $crc, strlen($comp), strlen($raw), strlen($name), 0) . $name . $comp;
            $centrals .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, 8, 0, 0, $crc, strlen($comp), strlen($raw), strlen($name), 0, 0, 0, 0, 0, $offset) . $name;
            $offset += 30 + strlen($name) + strlen($comp);
        }
        $end = pack('VvvvvVVv', 0x06054b50, 0, 0, count($entries), count($entries), strlen($centrals), $offset, 0);
        return $locals . $centrals . $end;
    }

    // ---------- XML ----------
    public static function unxml($s): string
    {
        $s = (string) $s;
        $s = str_replace(['&lt;', '&gt;', '&quot;', '&apos;'], ['<', '>', '"', "'"], $s);
        $s = preg_replace_callback('/&#x([0-9a-fA-F]+);/', fn ($m) => mb_chr(hexdec($m[1]), 'UTF-8'), $s);
        $s = preg_replace_callback('/&#(\d+);/', fn ($m) => mb_chr((int) $m[1], 'UTF-8'), $s);
        return str_replace('&amp;', '&', $s);
    }

    public static function xml($s): string
    {
        $s = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}]/u', '', Js::str($s));
        return str_replace(['&', '<', '>', '"'], ['&amp;', '&lt;', '&gt;', '&quot;'], $s);
    }

    public static function colName(int $i): string
    {
        $s = '';
        $i += 1;
        while ($i > 0) {
            $m = ($i - 1) % 26;
            $s = chr(65 + $m) . $s;
            $i = intdiv($i - 1, 26);
        }
        return $s;
    }

    private static function colIndex(string $ref): int
    {
        preg_match('/^([A-Z]+)/', $ref, $m);
        $n = 0;
        foreach (str_split($m[1]) as $ch) $n = $n * 26 + (ord($ch) - 64);
        return $n - 1;
    }

    // ---------- Lectura ----------
    /** Devuelve [nombreHoja => [[celda, ...], ...]] con textos y números */
    public static function read(string $buffer): array
    {
        $files = self::readZip($buffer);
        $get = fn ($n) => isset($files[$n]) ? $files[$n]() : null;
        $wb = $get('xl/workbook.xml');
        if (!$wb) throw new RuntimeException('El archivo no parece ser un libro de Excel (.xlsx)');
        $rels = $get('xl/_rels/workbook.xml.rels') ?: '';
        $relMap = [];
        preg_match_all('/<Relationship\b[^>]*>/', $rels, $ms);
        foreach ($ms[0] as $tag) {
            if (preg_match('/Id="([^"]+)"/', $tag, $id) && preg_match('/Target="([^"]+)"/', $tag, $tg)) $relMap[$id[1]] = $tg[1];
        }
        $shared = [];
        $sst = $get('xl/sharedStrings.xml');
        if ($sst) {
            preg_match_all('/<si\b[^>]*>([\s\S]*?)<\/si>/', $sst, $sis);
            foreach ($sis[1] as $si) {
                preg_match_all('/<t\b[^>]*>([\s\S]*?)<\/t>/', $si, $ts);
                $shared[] = self::unxml(implode('', $ts[1]));
            }
        }
        $out = [];
        $idx = 0;
        preg_match_all('/<sheet\b[^>]*>/', $wb, $sheets);
        foreach ($sheets[0] as $tag) {
            $idx++;
            $name = self::unxml(preg_match('/name="([^"]*)"/', $tag, $nm) && $nm[1] !== '' ? $nm[1] : "Hoja{$idx}");
            $rid = preg_match('/r:id="([^"]+)"/', $tag, $r) ? $r[1] : null;
            $target = ($rid !== null && isset($relMap[$rid])) ? $relMap[$rid] : "worksheets/sheet{$idx}.xml";
            $target = preg_replace('#^xl/#', '', preg_replace('#^/#', '', $target));
            $sx = $get("xl/{$target}");
            if (!$sx) continue;
            $rows = [];
            preg_match_all('/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/', $sx, $rms, PREG_SET_ORDER);
            foreach ($rms as $rm) {
                $rowNum = (preg_match('/ r="(\d+)"/', $rm[0], $rn) ? (int) $rn[1] : 0) ?: (count($rows) ? max(array_keys($rows)) + 1 : 0) + 1;
                $cells = [];
                preg_match_all('/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/', $rm[1] ?? '', $cms, PREG_SET_ORDER);
                foreach ($cms as $cm) {
                    $attrs = $cm[1];
                    $inner = $cm[2] ?? '';
                    $ref = preg_match('/ r="([A-Z]+\d+)"/', ' ' . $attrs, $rf) ? $rf[1] : null;
                    $type = preg_match('/ t="([^"]+)"/', ' ' . $attrs, $tp) ? $tp[1] : null;
                    $ci = $ref ? self::colIndex($ref) : count($cells);
                    $val = '';
                    if ($type === 'inlineStr') {
                        preg_match_all('/<t\b[^>]*>([\s\S]*?)<\/t>/', $inner, $ts);
                        $val = self::unxml(implode('', $ts[1]));
                    } elseif (preg_match('/<v>([\s\S]*?)<\/v>/', $inner, $v)) {
                        if ($type === 's') $val = $shared[(int) $v[1]] ?? '';
                        elseif ($type === 'str') $val = self::unxml($v[1]);
                        elseif ($type === 'b') $val = $v[1] === '1' ? 'SI' : 'NO';
                        elseif ($type === 'e') $val = '';
                        else $val = Js::num($v[1]);
                    }
                    $cells[$ci] = $val;
                }
                $max = count($cells) ? max(array_keys($cells)) + 1 : 0;
                $full = [];
                for ($i = 0; $i < $max; $i++) $full[] = $cells[$i] ?? '';
                $rows[$rowNum - 1] = $full;
            }
            $maxR = count($rows) ? max(array_keys($rows)) + 1 : 0;
            $list = [];
            for ($i = 0; $i < $maxR; $i++) $list[] = $rows[$i] ?? [];
            $out[$name] = $list;
        }
        return $out;
    }

    // ---------- Escritura ----------
    /**
     * sheets: [['name', 'rows' => [[...]], 'widths' => [n], 'header' => true]]
     * Estilos: 0 normal, 1 encabezado, 2 envuelto, 3 título, 4 ejemplo. Celda con estilo: ['v' => valor, 's' => estilo]
     */
    public static function build(array $sheets): string
    {
        $styles = <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1F5F4A"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF6B7280"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F8F6B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs></styleSheet>
XML;
        $sheetXml = function (array $s) {
            $widths = $s['widths'] ?? [];
            $cols = count($widths) ? '<cols>' . implode('', array_map(fn ($w, $i) => '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . Js::str($w) . '" customWidth="1"/>', $widths, array_keys($widths))) . '</cols>' : '';
            $header = !empty($s['header']);
            $rowsXml = '';
            foreach ($s['rows'] as $r => $row) {
                $cells = '';
                foreach ($row as $c => $v) {
                    if ($v === null || $v === '' || $v instanceof \App\Support\Undef) continue;
                    $isObj = is_array($v) && array_key_exists('v', $v);
                    $style = $isObj ? ($v['s'] ?? null) : ($header && $r === 0 ? 1 : 0);
                    $val = $isObj ? $v['v'] : $v;
                    $ref = self::colName($c) . ($r + 1);
                    $st = Js::t($style) ? ' s="' . Js::str($style) . '"' : '';
                    if ((is_int($val) || is_float($val)) && is_finite((float) $val)) {
                        $cells .= "<c r=\"{$ref}\"{$st}><v>" . Js::numToString($val) . '</v></c>';
                    } else {
                        $cells .= "<c r=\"{$ref}\"{$st} t=\"inlineStr\"><is><t xml:space=\"preserve\">" . self::xml($val) . '</t></is></c>';
                    }
                }
                $ht = ($header && $r === 0) ? ' ht="32" customHeight="1"' : '';
                $rowsXml .= '<row r="' . ($r + 1) . "\"{$ht}>{$cells}</row>";
            }
            $pane = $header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
            return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">{$pane}{$cols}<sheetData>{$rowsXml}</sheetData></worksheet>";
        };
        $n = count($sheets);
        $over = '';
        $rels = '';
        $wbs = '';
        foreach ($sheets as $i => $s) {
            $k = $i + 1;
            $over .= "<Override PartName=\"/xl/worksheets/sheet{$k}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
            $wbs .= '<sheet name="' . self::xml($s['name']) . "\" sheetId=\"{$k}\" r:id=\"rId{$k}\"/>";
            $rels .= "<Relationship Id=\"rId{$k}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{$k}.xml\"/>";
        }
        $entries = [
            ['name' => '[Content_Types].xml', 'data' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' . $over . '</Types>'],
            ['name' => '_rels/.rels', 'data' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
            ['name' => 'xl/workbook.xml', 'data' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' . $wbs . '</sheets></workbook>'],
            ['name' => 'xl/_rels/workbook.xml.rels', 'data' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $rels . '<Relationship Id="rId' . ($n + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
            ['name' => 'xl/styles.xml', 'data' => $styles],
        ];
        foreach ($sheets as $i => $s) $entries[] = ['name' => 'xl/worksheets/sheet' . ($i + 1) . '.xml', 'data' => $sheetXml($s)];
        return self::writeZip($entries);
    }
}

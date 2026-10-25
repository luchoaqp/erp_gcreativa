<?php

namespace App\Http\Controllers;

use App\Services\Xlsx;
use App\Support\Db;
use App\Support\Js;

/** Exportar / importar productos en Excel (precios por cantidad y packs incluidos) */
class ProductExcelController extends Controller
{
    private const UNIDADES_NOMBRE = ['NIU' => 'Unidad', 'KGM' => 'Kilogramo', 'MTR' => 'Metro', 'LTR' => 'Litro', 'BX' => 'Caja', 'DZN' => 'Docena', 'PK' => 'Paquete', 'SET' => 'Juego'];
    private const UNIDAD_ALIAS = [
        'niu' => 'NIU', 'unidad' => 'NIU', 'und' => 'NIU', 'unid' => 'NIU', 'u' => 'NIU', 'kgm' => 'KGM', 'kg' => 'KGM', 'kilo' => 'KGM', 'kilogramo' => 'KGM',
        'mtr' => 'MTR', 'm' => 'MTR', 'metro' => 'MTR', 'ltr' => 'LTR', 'l' => 'LTR', 'lt' => 'LTR', 'litro' => 'LTR', 'bx' => 'BX', 'caja' => 'BX',
        'dzn' => 'DZN', 'docena' => 'DZN', 'pk' => 'PK', 'paquete' => 'PK', 'set' => 'SET', 'juego' => 'SET',
    ];

    private const COLS_PROD = [
        ['tipo', 'Tipo', ['tipo']], ['codigo', 'Código', ['codigo', 'cod', 'codigointerno']], ['nombre', 'Nombre', ['nombre', 'producto', 'descripcioncorta']],
        ['descripcion', 'Descripción', ['descripcion', 'detalle']], ['categorias', 'Categorías', ['categorias', 'categoria']],
        ['ocasion', 'Ocasión', ['ocasion', 'ocasiones']], ['marca', 'Marca', ['marca']], ['unidad', 'Unidad', ['unidad', 'unidaddemedida', 'um']],
        ['precio_costo', 'Precio compra', ['preciocompra', 'costo', 'preciocosto', 'pcompra']], ['precio_venta', 'Precio venta', ['precioventa', 'precio', 'pventa']],
        ['stock', 'Stock', ['stock', 'stockactual', 'cantidad']], ['stock_minimo', 'Stock mínimo', ['stockminimo', 'minimo']],
        ['codigo_barras', 'Código de barras', ['codigodebarras', 'codigobarras', 'barras', 'ean']],
        ['es_personalizable', 'Personalizable', ['personalizable', 'espersonalizable']], ['destacado', 'Destacado', ['destacado']],
        ['activo', 'Activo', ['activo', 'habilitado']], ['es_insumo', 'Es insumo', ['esinsumo', 'insumo']], ['precio_insumo', 'Precio insumo', ['precioinsumo']],
        ['imagen_url', 'Imagen (URL)', ['imagenurl', 'imagen', 'foto', 'urlimagen']],
    ];
    private const COLS_PRES = [['codigo', 'Código', ['codigo', 'cod']], ['factor', 'Desde (cantidad)', ['desdecantidad', 'desde', 'cantidad', 'cantidaddesde']],
        ['etiqueta', 'Etiqueta', ['etiqueta', 'nombre']], ['precio', 'Precio unitario', ['preciounitario', 'precio']]];
    private const COLS_PACK = [['pack', 'Código del pack', ['codigodelpack', 'codigopack', 'pack']], ['componente', 'Código del producto', ['codigodelproducto', 'codigoproducto', 'producto', 'componente']],
        ['cantidad', 'Cantidad', ['cantidad']], ['precio_unit', 'Precio unit. (opcional)', ['preciounitopcional', 'preciounit', 'precio']]];
    private const SHEET_ALIAS = ['productos' => 'productos', 'preciosporcantidad' => 'precios', 'precios' => 'precios', 'presentaciones' => 'precios', 'packs' => 'packs', 'boxesypacks' => 'packs', 'packsboxes' => 'packs'];

    /** Quita tildes, pasa a minúsculas y deja solo letras y números */
    public static function norm($s): string
    {
        $s = Js::str($s ?? '');
        if (class_exists(\Normalizer::class)) {
            $s = \Normalizer::normalize($s, \Normalizer::FORM_D) ?: $s;
            $s = preg_replace('/[\x{0300}-\x{036F}]/u', '', $s);
        } else {
            $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', 'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N', 'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u', 'ç' => 'c', 'Ç' => 'C']);
        }
        return preg_replace('/[^a-z0-9]/', '', mb_strtolower($s));
    }

    private static function clean($s): string { return Js::trim($s ?? ''); }
    private static function isEmpty($v): bool { return $v === '' || $v === null || $v instanceof \App\Support\Undef; }

    private static function toNum($v)
    {
        if (self::isEmpty($v)) return null;
        if (is_int($v) || is_float($v)) return $v;
        $s = preg_replace('/\s/u', '', preg_replace('#[Ss]/\.?\s*#u', '', Js::trim($v), 1));
        if (str_contains($s, ',') && !str_contains($s, '.')) $s = preg_replace('/,/', '.', $s, 1);
        else $s = str_replace(',', '', $s);
        return Js::num($s);
    }

    private static function toBool($v)
    {
        if (self::isEmpty($v)) return null;
        $s = self::norm($v);
        if (in_array($s, ['si', 's', '1', 'true', 'x', 'yes', 'verdadero'], true)) return 1;
        if (in_array($s, ['no', 'n', '0', 'false', 'falso'], true)) return 0;
        return NAN;
    }

    private static function codeStr($v): string
    {
        if (self::isEmpty($v)) return '';
        if (is_int($v) || is_float($v)) return Js::numToString($v);
        return Js::trim($v);
    }

    private static function slugify($s): string
    {
        $n = Js::slice(self::norm($s), 0, 70);
        return $n !== '' ? $n : 'cat';
    }

    private static function mapRows(?array $rows, array $defs): array
    {
        if (!$rows || !count($rows)) return ['items' => [], 'missing' => array_column($defs, 1)];
        $hi = 0;
        $best = -1;
        for ($i = 0; $i < min(count($rows), 5); $i++) {
            $hit = 0;
            foreach ($rows[$i] ?? [] as $c) { foreach ($defs as $d) { if (in_array(self::norm($c), $d[2], true)) { $hit++; break; } } }
            if ($hit > $best) { $best = $hit; $hi = $i; }
        }
        $idx = [];
        foreach ($rows[$hi] ?? [] as $i => $c) {
            $n = self::norm($c);
            foreach ($defs as $d) { if (in_array($n, $d[2], true)) { if (!array_key_exists($d[0], $idx)) $idx[$d[0]] = $i; break; } }
        }
        $items = [];
        for ($r = $hi + 1; $r < count($rows); $r++) {
            $row = $rows[$r] ?? [];
            $allEmpty = true;
            foreach ($row as $c) if (!self::isEmpty($c)) { $allEmpty = false; break; }
            if ($allEmpty) continue;
            $o = ['_fila' => $r + 1];
            foreach ($idx as $k => $col) $o[$k] = array_key_exists($col, $row) ? $row[$col] : '';
            $items[] = $o;
        }
        return ['items' => $items, 'idx' => $idx];
    }

    // ---- Exportar / plantilla ----
    private static function instrucciones(): array
    {
        $t = fn ($v) => ['v' => $v, 's' => 3];
        return [
            [$t('Carga masiva de productos – ERP Genia Creativa')], [''], [$t('CÓMO FUNCIONA')],
            ['0. Borra las filas de ejemplo de la plantilla antes de cargar tus productos.'],
            ['1. Llena la hoja "Productos": una fila por producto o pack. Solo Nombre y Precio venta son obligatorios.'],
            ['2. Si el Código ya existe en el sistema, el producto se ACTUALIZA (las celdas vacías conservan el valor actual). Si el Código no existe o está vacío, se CREA uno nuevo (con código automático si lo dejas vacío).'],
            ['3. Importante: si dejas el Código vacío en un producto que ya existe, se creará un duplicado. Para modificar productos existentes, exporta primero y edita el archivo exportado.'],
            ['4. Categorías: puedes poner varias separadas por ; (ejemplo: Cumpleaños; Peluches). Las categorías, ocasiones y marcas que no existan se crean automáticamente.'],
            ['5. Unidad: Unidad, Kilogramo, Metro, Litro, Caja, Docena, Paquete o Juego (también sirven los códigos NIU, KGM, MTR, LTR, BX, DZN, PK, SET). Vacío = Unidad.'],
            ['6. Personalizable / Destacado / Activo / Es insumo: escribe SI o NO. Activo vacío = SI.'],
            ['7. Stock: en productos nuevos genera un movimiento de Kardex "Stock inicial"; en productos existentes, si cambia, genera un "Ajuste de stock". Los packs no llevan stock: se calcula con sus componentes.'],
            [''], [$t('PRECIOS DINÁMICOS (POR CANTIDAD)')],
            ['El "Precio venta" de la hoja Productos es el precio base (1 unidad). Si el producto baja de precio al llevar más unidades, agrega filas en la hoja "Precios por cantidad":'],
            ['   Código = el del producto · Desde (cantidad) = a partir de cuántas unidades aplica · Precio unitario = precio de CADA unidad desde esa cantidad.'],
            ['   Ejemplo: 1 → S/ 10.00, 12 → S/ 9.00, 50 → S/ 8.00. Quien compre 20 unidades paga S/ 9.00 cada una.'],
            ['   Si un producto tiene filas en esa hoja, el sistema activa automáticamente "precio por cantidad". Al reimportar, las escalas del producto se reemplazan por las del archivo.'],
            [''], [$t('BOXES Y PACKS')],
            ['En la hoja Productos pon Tipo = PACK (precio venta del pack). En la hoja "Packs" lista su contenido: Código del pack, Código del producto, Cantidad y, opcionalmente, el precio unitario de ese producto dentro del pack.'],
            ['Los productos que forman el pack deben existir (en el sistema o en este mismo archivo). Un pack no puede contener otro pack.'],
            [''], [$t('ANTES DE GUARDAR')],
            ['El sistema primero hace una REVISIÓN (sin guardar nada) y te muestra los errores fila por fila. Solo se guarda cuando el archivo no tiene errores: todo o nada.'],
        ];
    }

    private const EJEMPLO_PROD = [
        ['PRODUCTO', 'TAZ-001', 'Taza personalizada cerámica 11oz', 'Taza blanca con diseño a elección', 'Tazas; Cumpleaños', 'Cumpleaños', 'Genia', 'Unidad', 4.5, 12, 40, 10, '', 'SI', 'NO', 'SI', 'NO', '', ''],
        ['PRODUCTO', 'PEL-010', 'Peluche oso 30cm', '', 'Peluches', 'San Valentín', '', 'Unidad', 14, 29.9, 15, 3, '', 'NO', 'SI', 'SI', 'NO', '', ''],
        ['PRODUCTO', 'INS-001', 'Caja de cartón pequeña', 'Insumo para armar boxes', 'Insumos', '', '', 'Unidad', 0.8, 1.5, 200, 50, '', 'NO', 'NO', 'SI', 'SI', 1.5, ''],
        ['PACK', 'BOX-001', 'Box Cumpleaños Clásico', 'Taza + peluche + caja', 'Boxes', 'Cumpleaños', '', 'Unidad', '', 49.9, '', '', '', 'SI', 'SI', 'SI', 'NO', '', ''],
    ];
    private const EJEMPLO_PRES = [['TAZ-001', 1, 'UNIDAD', 12], ['TAZ-001', 12, 'DOCENA', 10], ['TAZ-001', 50, 'AL POR MAYOR', 8.5]];
    private const EJEMPLO_PACK = [['BOX-001', 'TAZ-001', 1, ''], ['BOX-001', 'PEL-010', 1, ''], ['BOX-001', 'INS-001', 1, '']];
    private const WIDTHS_PROD = [11, 14, 36, 34, 26, 16, 14, 11, 13, 13, 9, 12, 18, 14, 11, 9, 11, 13, 40];

    private static function buildWorkbook(array $prod, array $pres, array $pack): string
    {
        return Xlsx::build([
            ['name' => 'Instrucciones', 'rows' => self::instrucciones(), 'widths' => [150]],
            ['name' => 'Productos', 'header' => true, 'widths' => self::WIDTHS_PROD, 'rows' => [array_column(self::COLS_PROD, 1), ...$prod]],
            ['name' => 'Precios por cantidad', 'header' => true, 'widths' => [14, 18, 22, 16], 'rows' => [array_column(self::COLS_PRES, 1), ...$pres]],
            ['name' => 'Packs', 'header' => true, 'widths' => [16, 20, 10, 22], 'rows' => [array_column(self::COLS_PACK, 1), ...$pack]],
        ]);
    }

    private static function xlsxResponse(string $buf, string $filename)
    {
        return response($buf, 200, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition' => "attachment; filename=\"{$filename}\""]);
    }

    public function downloadTemplate()
    {
        try {
            return self::xlsxResponse(self::buildWorkbook(self::EJEMPLO_PROD, self::EJEMPLO_PRES, self::EJEMPLO_PACK), 'plantilla_productos.xlsx');
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'No se pudo generar la plantilla'], 500);
        }
    }

    public function exportProducts()
    {
        try {
            $estado = $this->q('estado') ?? 'todos';
            $prods = Db::query("\n      SELECT p.*, o.nombre AS ocasion_nombre, m.nombre AS marca_nombre,\n        (SELECT GROUP_CONCAT(c2.nombre ORDER BY c2.nombre SEPARATOR '; ') FROM producto_categorias pc3 JOIN categorias c2 ON c2.id = pc3.categoria_id WHERE pc3.producto_id = p.id) AS cats,\n        c.nombre AS cat1\n      FROM productos p LEFT JOIN ocasiones o ON o.id = p.ocasion_id LEFT JOIN marcas m ON m.id = p.marca_id LEFT JOIN categorias c ON c.id = p.categoria_id\n      " . ($estado === 'habilitados' ? 'WHERE p.activo = 1' : '') . ' ORDER BY p.es_pack, p.codigo');
            $pres = Db::query('SELECT pr.*, p.codigo FROM producto_presentaciones pr JOIN productos p ON p.id = pr.producto_id ORDER BY p.codigo, pr.factor');
            $comps = Db::query('SELECT pc.*, p.codigo AS pack_codigo, c.codigo AS comp_codigo FROM producto_componentes pc JOIN productos p ON p.id = pc.producto_id JOIN productos c ON c.id = pc.componente_id WHERE p.es_pack = 1 ORDER BY p.codigo, pc.id');
            Db::query('SELECT p.id, p.stock FROM productos p WHERE p.es_pack = 0');
            $sn = fn ($v) => Js::t($v) ? 'SI' : 'NO';
            $ids = array_flip(array_map('strval', array_column($prods, 'codigo')));
            $prod = array_map(function ($p) use ($sn) {
                $img = $p['imagen_url'];
                $esPack = Js::t($p['es_pack']);
                return [
                    $esPack ? 'PACK' : 'PRODUCTO', $p['codigo'], $p['nombre'], Js::or($p['descripcion'], ''), Js::or($p['cats'], $p['cat1'], ''), Js::or($p['ocasion_nombre'], ''), Js::or($p['marca_nombre'], ''),
                    self::UNIDADES_NOMBRE[$p['unidad']] ?? 'Unidad', $esPack ? '' : Js::num($p['precio_costo']), Js::num($p['precio_venta']), $esPack ? '' : Js::num($p['stock']), Js::num($p['stock_minimo']),
                    Js::or($p['codigo_barras'], ''), $sn($p['es_personalizable']), $sn($p['destacado']), $sn($p['activo']), $sn($p['es_insumo']), $p['precio_insumo'] === null ? '' : Js::num($p['precio_insumo']),
                    (Js::t($img) && !preg_match('/unsplash\.com/', (string) $img) && !str_starts_with((string) $img, 'data:') && !str_starts_with((string) $img, '/uploads/')) ? $img : '',
                ];
            }, $prods);
            $presRows = [];
            foreach ($pres as $x) if ($x['codigo'] !== null && isset($ids[(string) $x['codigo']])) $presRows[] = [$x['codigo'], Js::num($x['factor']), Js::or($x['etiqueta'], ''), Js::num($x['precio'])];
            $packRows = [];
            foreach ($comps as $x) if ($x['pack_codigo'] !== null && isset($ids[(string) $x['pack_codigo']])) $packRows[] = [$x['pack_codigo'], $x['comp_codigo'], Js::num($x['cantidad']), Js::num($x['precio_unit'])];
            return self::xlsxResponse(self::buildWorkbook($prod, $presRows, $packRows), 'productos_' . gmdate('Y-m-d') . '.xlsx');
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'No se pudo exportar los productos'], 500);
        }
    }

    // ---- Importar ----
    public function importProducts()
    {
        $b = $this->body();
        $dr = $b['dry_run'] ?? null;
        $dry = $dr === true || $dr === 'true';
        try {
            if (!Js::t($b['archivo'] ?? null)) return $this->json(['success' => false, 'message' => 'Falta el archivo'], 400);
            $b64 = preg_replace('/^data:[^,]*,/', '', Js::str($b['archivo']));
            $book = Xlsx::read((string) base64_decode($b64));
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => Js::or($e->getMessage(), 'No se pudo leer el archivo Excel')], 400);
        }

        $sheets = [];
        foreach ($book as $name => $rows) { $k = self::SHEET_ALIAS[self::norm($name)] ?? null; if ($k && !isset($sheets[$k])) $sheets[$k] = $rows; }
        if (!isset($sheets['productos'])) return $this->json(['success' => false, 'message' => 'No se encontró la hoja "Productos". Usa la plantilla descargable.'], 400);

        $P = self::mapRows($sheets['productos'], self::COLS_PROD);
        $missing = array_values(array_filter(['nombre', 'precio_venta'], fn ($k) => isset($P['idx']) && !array_key_exists($k, $P['idx'])));
        if (count($missing)) {
            $labels = array_map(function ($k) { foreach (self::COLS_PROD as $c) if ($c[0] === $k) return $c[1]; return $k; }, $missing);
            return $this->json(['success' => false, 'message' => 'En la hoja Productos faltan las columnas: ' . implode(', ', $labels)], 400);
        }
        $PR = isset($sheets['precios']) ? self::mapRows($sheets['precios'], self::COLS_PRES)['items'] : [];
        $PK = isset($sheets['packs']) ? self::mapRows($sheets['packs'], self::COLS_PACK)['items'] : [];

        $errores = [];
        $err = function ($hoja, $fila, $codigo, $mensaje) use (&$errores) { $errores[] = ['hoja' => $hoja, 'fila' => $fila, 'codigo' => Js::or($codigo, ''), 'mensaje' => $mensaje]; };
        $vistas = [];
        $resumen = ['creados' => 0, 'actualizados' => 0, 'packs' => 0, 'categorias_nuevas' => [], 'ocasiones_nuevas' => [], 'marcas_nuevas' => [], 'escalas' => 0];

        try {
            Db::begin();
            $cache = ['cat' => [], 'oca' => [], 'marca' => []];
            foreach ([['categorias', 'cat'], ['ocasiones', 'oca'], ['marcas', 'marca']] as [$tabla, $key]) {
                foreach (Db::query("SELECT id, nombre FROM {$tabla}") as $x) $cache[$key][self::norm($x['nombre'])] = $x['id'];
            }
            $getCat = function ($nombre) use (&$cache, &$resumen) {
                $k = self::norm($nombre);
                if ($k === '') return null;
                if (Js::t($cache['cat'][$k] ?? null)) return $cache['cat'][$k];
                $slug = self::slugify($nombre);
                if (count(Db::query('SELECT id FROM categorias WHERE slug = ?', [$slug]))) $slug = $slug . '-' . Js::base36(Js::now());
                $r = Db::query('INSERT INTO categorias (nombre, slug, estado) VALUES (?, ?, 1)', [Js::slice(self::clean($nombre), 0, 80), $slug]);
                $cache['cat'][$k] = $r['insertId'];
                $resumen['categorias_nuevas'][] = self::clean($nombre);
                return $r['insertId'];
            };
            $getOca = function ($nombre) use (&$cache, &$resumen) {
                $k = self::norm($nombre);
                if ($k === '') return null;
                if (Js::t($cache['oca'][$k] ?? null)) return $cache['oca'][$k];
                $r = Db::query('INSERT INTO ocasiones (nombre) VALUES (?)', [Js::slice(self::clean($nombre), 0, 60)]);
                $cache['oca'][$k] = $r['insertId'];
                $resumen['ocasiones_nuevas'][] = self::clean($nombre);
                return $r['insertId'];
            };
            $getMarca = function ($nombre) use (&$cache, &$resumen) {
                $k = self::norm($nombre);
                if ($k === '') return null;
                if (Js::t($cache['marca'][$k] ?? null)) return $cache['marca'][$k];
                $r = Db::query('INSERT INTO marcas (nombre) VALUES (?)', [Js::slice(self::clean($nombre), 0, 80)]);
                $cache['marca'][$k] = $r['insertId'];
                $resumen['marcas_nuevas'][] = self::clean($nombre);
                return $r['insertId'];
            };

            // Escalas y componentes agrupados por código
            $escalas = [];
            $comps = [];
            foreach ($PR as $x) {
                $cod = self::codeStr($x['codigo'] ?? null);
                if ($cod === '') { $err('Precios por cantidad', $x['_fila'], '', 'Falta el código del producto'); continue; }
                $factor = self::toNum($x['factor'] ?? null);
                $precio = self::toNum($x['precio'] ?? null);
                $isInt = (is_int($factor)) || (is_float($factor) && is_finite($factor) && floor($factor) == $factor);
                if ($factor === null || !($factor >= 1) || Js::isNaN($factor) || !$isInt) { $err('Precios por cantidad', $x['_fila'], $cod, 'La cantidad "Desde" debe ser un número entero de 1 o más'); continue; }
                // En JS `null >= 0` es verdadero: un precio vacío no es error aquí
                if ($precio !== null && (Js::isNaN($precio) || $precio < 0)) { $err('Precios por cantidad', $x['_fila'], $cod, 'El precio unitario es inválido'); continue; }
                $escalas[$cod][] = ['factor' => $factor, 'precio' => $precio, 'etiqueta' => self::clean($x['etiqueta'] ?? null), '_fila' => $x['_fila']];
            }
            foreach ($PK as $x) {
                $pack = self::codeStr($x['pack'] ?? null);
                $comp = self::codeStr($x['componente'] ?? null);
                if ($pack === '' || $comp === '') { $err('Packs', $x['_fila'], $pack, 'Falta el código del pack o del producto'); continue; }
                $cant = self::toNum($x['cantidad'] ?? null);
                $pu = self::toNum($x['precio_unit'] ?? null);
                if ($cant === null || !($cant > 0) || Js::isNaN($cant)) { $err('Packs', $x['_fila'], $pack, 'La cantidad debe ser mayor a 0'); continue; }
                if (Js::isNaN($pu)) { $err('Packs', $x['_fila'], $pack, 'El precio unitario es inválido'); continue; }
                $comps[$pack][] = ['componente' => $comp, 'cantidad' => $cant, 'precio_unit' => $pu, '_fila' => $x['_fila']];
            }

            $filas = array_map(function ($x) { $t = self::norm($x['tipo'] ?? null); $x['_tipo'] = ($t === 'pack' || $t === 'box') ? 'PACK' : 'PRODUCTO'; return $x; }, $P['items']);
            $orden = array_merge(array_values(array_filter($filas, fn ($f) => $f['_tipo'] === 'PRODUCTO')), array_values(array_filter($filas, fn ($f) => $f['_tipo'] === 'PACK')));
            $usados = [];

            foreach ($orden as $f) {
                $hoja = 'Productos';
                $fila = $f['_fila'];
                $cod = self::codeStr($f['codigo'] ?? null);
                Db::query('SAVEPOINT fila');
                try {
                    $nombre = self::clean($f['nombre'] ?? null);
                    if ($nombre === '') throw new \RuntimeException('El nombre es obligatorio');
                    if ($cod !== '') {
                        if (isset($usados[mb_strtolower($cod)])) throw new \RuntimeException("El código {$cod} está repetido en el archivo");
                        $usados[mb_strtolower($cod)] = true;
                    }
                    $pv = self::toNum($f['precio_venta'] ?? null);
                    $ex = $cod !== '' ? Db::query('SELECT * FROM productos WHERE codigo = ?', [$cod]) : [];
                    $old = $ex[0] ?? null;
                    if (($pv === null || Js::isNaN($pv) || $pv < 0) && !($old && $pv === null)) throw new \RuntimeException('El precio de venta es obligatorio y debe ser un número válido');
                    $num = function ($k, $label) use ($f) {
                        $v = self::toNum($f[$k] ?? null);
                        if (Js::isNaN($v) || ($v !== null && $v < 0)) throw new \RuntimeException("{$label} no es un número válido");
                        return $v;
                    };
                    $boo = function ($k, $label) use ($f) {
                        $v = self::toBool($f[$k] ?? null);
                        if (Js::isNaN($v)) throw new \RuntimeException("{$label}: escribe SI o NO");
                        return $v;
                    };
                    $esPack = $f['_tipo'] === 'PACK' ? 1 : 0;
                    $bb = [];
                    if ($old) { // las celdas vacías conservan lo actual
                        $bb = $old;
                        $bb['categorias_ids'] = array_column(Db::query('SELECT categoria_id FROM producto_categorias WHERE producto_id = ?', [$old['id']]), 'categoria_id');
                        if ($esPack !== Js::num($old['es_pack'])) throw new \RuntimeException('No se puede convertir un producto en pack (ni al revés) por Excel');
                        unset($bb['stock']);
                    }
                    if ($cod !== '') $bb['codigo'] = $cod; else unset($bb['codigo']);
                    $bb['nombre'] = $nombre;
                    $bb['es_pack'] = $esPack;
                    $bb['precio_venta'] = $pv === null ? $old['precio_venta'] : $pv;
                    if (!self::isEmpty($f['descripcion'] ?? null)) $bb['descripcion'] = self::clean($f['descripcion']);
                    $costo = $num('precio_costo', 'Precio compra'); if ($costo !== null) $bb['precio_costo'] = $costo;
                    $smin = $num('stock_minimo', 'Stock mínimo'); if ($smin !== null) $bb['stock_minimo'] = $smin;
                    $pins = $num('precio_insumo', 'Precio insumo'); if ($pins !== null) $bb['precio_insumo'] = $pins;
                    $stock = $num('stock', 'Stock'); if ($stock !== null && !$esPack) $bb['stock'] = $stock;
                    if (!self::isEmpty($f['codigo_barras'] ?? null)) $bb['codigo_barras'] = self::codeStr($f['codigo_barras']);
                    if (!self::isEmpty($f['imagen_url'] ?? null)) $bb['imagen_url'] = self::clean($f['imagen_url']);
                    foreach ([['es_personalizable', 'Personalizable'], ['destacado', 'Destacado'], ['activo', 'Activo'], ['es_insumo', 'Es insumo']] as [$k, $l]) {
                        $vv = $boo($k, $l);
                        if ($vv !== null) $bb[$k] = $vv;
                    }
                    if (!$old && !array_key_exists('activo', $bb)) $bb['activo'] = 1;
                    if (!self::isEmpty($f['unidad'] ?? null)) {
                        $u = self::UNIDAD_ALIAS[self::norm($f['unidad'])] ?? null;
                        if (!$u) throw new \RuntimeException('Unidad "' . Js::str($f['unidad']) . '" no reconocida');
                        $bb['unidad'] = $u;
                    }
                    if (!self::isEmpty($f['categorias'] ?? null)) {
                        $names = array_values(array_filter(array_map(fn ($x) => self::clean($x), preg_split('/[;|\n]|,(?!\d)/u', Js::str($f['categorias']))), fn ($x) => $x !== ''));
                        $bb['categorias_ids'] = [];
                        foreach ($names as $nm) $bb['categorias_ids'][] = $getCat($nm);
                    }
                    if (!self::isEmpty($f['ocasion'] ?? null)) $bb['ocasion_id'] = $getOca(self::clean($f['ocasion']));
                    if (!self::isEmpty($f['marca'] ?? null)) $bb['marca_id'] = $getMarca(self::clean($f['marca']));

                    // Precios por cantidad
                    $esc = $cod !== '' ? ($escalas[$cod] ?? null) : null;
                    if ($esc && !$esPack) {
                        $seen = [];
                        foreach ($esc as $e) {
                            $fk = Js::numToString($e['factor']);
                            if (isset($seen[$fk])) throw new \RuntimeException("En \"Precios por cantidad\" (fila {$e['_fila']}) la cantidad {$fk} está repetida");
                            $seen[$fk] = true;
                        }
                        $bb['presentaciones'] = array_map(fn ($e) => ['factor' => $e['factor'], 'precio' => $e['precio'], 'etiqueta' => $e['etiqueta']], $esc);
                        $bb['precio_por_cantidad'] = 1;
                        $resumen['escalas'] += count($esc);
                    } elseif ($esc && $esPack) {
                        throw new \RuntimeException('Un pack no usa precios por cantidad');
                    }

                    // Componentes del pack
                    if ($esPack) {
                        $lista = $cod !== '' ? ($comps[$cod] ?? null) : null;
                        if ($lista) {
                            $bb['componentes'] = [];
                            foreach ($lista as $c) {
                                $cp = Db::query('SELECT id FROM productos WHERE codigo = ?', [$c['componente']]);
                                if (!count($cp)) throw new \RuntimeException("Packs (fila {$c['_fila']}): el producto {$c['componente']} no existe");
                                $bb['componentes'][] = ['componente_id' => $cp[0]['id'], 'cantidad' => $c['cantidad'], 'precio_unit' => $c['precio_unit']];
                            }
                        } elseif (!$old) {
                            throw new \RuntimeException('El pack no tiene productos en la hoja "Packs"');
                        }
                    }

                    ProductController::validateAndSave($bb, $old ? $old['id'] : null);
                    $old ? $resumen['actualizados']++ : $resumen['creados']++;
                    if ($esPack) $resumen['packs']++;
                    $vistas[] = ['fila' => $fila, 'codigo' => $cod !== '' ? $cod : '(automático)', 'nombre' => $nombre, 'accion' => $old ? 'Actualizar' : 'Crear', 'tipo' => $f['_tipo'],
                        'precio' => $bb['precio_venta'], 'stock' => $esPack ? '—' : ($stock === null ? ($old ? Js::num($old['stock']) : 0) : $stock), 'escalas' => $esc ? count($esc) : 0];
                    Db::query('RELEASE SAVEPOINT fila');
                } catch (\Throwable $e) {
                    $err($hoja, $fila, $cod, Js::or($e->getMessage(), 'Error desconocido'));
                    try { Db::query('ROLLBACK TO SAVEPOINT fila'); Db::query('RELEASE SAVEPOINT fila'); } catch (\Throwable $x) {
                    }
                }
            }

            // Escalas o packs que apuntan a códigos que no están en la hoja Productos
            foreach ($escalas as $cod => $list) if (!isset($usados[mb_strtolower((string) $cod)])) $err('Precios por cantidad', $list[0]['_fila'], (string) $cod, 'El código no aparece en la hoja Productos');
            foreach ($comps as $cod => $list) if (!isset($usados[mb_strtolower((string) $cod)])) $err('Packs', $list[0]['_fila'], (string) $cod, 'El código del pack no aparece en la hoja Productos');

            if ($dry || count($errores)) Db::rollback(); else Db::commit();
            usort($errores, fn ($a, $b) => $a['hoja'] === $b['hoja'] ? $a['fila'] <=> $b['fila'] : strcmp($a['hoja'], $b['hoja']));
            usort($vistas, fn ($a, $b) => $a['fila'] <=> $b['fila']);
            return $this->json([
                'success' => true, 'dry_run' => $dry, 'guardado' => !$dry && count($errores) === 0, 'total_filas' => count($filas),
                'resumen' => $resumen, 'errores' => $errores, 'vista' => array_slice($vistas, 0, 500),
                'message' => count($errores) ? 'Se encontraron ' . count($errores) . ' error(es). No se guardó nada.' : ($dry ? 'Revisión correcta. Puedes confirmar la importación.' : "Importación completa: {$resumen['creados']} creados, {$resumen['actualizados']} actualizados."),
            ]);
        } catch (\Throwable $e) {
            Db::rollback();
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al importar: ' . Js::or($e->getMessage(), 'desconocido')], 500);
        }
    }
}

<?php

namespace App\Support;

/**
 * Utilidades para reproducir en PHP el comportamiento de JavaScript del backend original
 * (truthiness, Number(), String(), Math.round...). Así las respuestas son idénticas.
 */
final class Js
{
    /** Valor "undefined": las claves con este valor se omiten al responder JSON (como JSON.stringify). */
    public static function undef(): Undef
    {
        static $u = null;
        return $u ??= new Undef();
    }

    public static function isUndef($v): bool
    {
        return $v instanceof Undef;
    }

    /** Truthiness de JavaScript: '0' y [] son verdaderos; 0, '', null, NaN, false son falsos. */
    public static function t($v): bool
    {
        if ($v === null || $v === false || $v instanceof Undef) return false;
        if (is_string($v)) return $v !== '';
        if (is_int($v)) return $v !== 0;
        if (is_float($v)) return !($v == 0.0 || is_nan($v));
        return true; // arrays y objetos (incluso vacíos)
    }

    /** a || b */
    public static function or(...$vals)
    {
        $last = null;
        foreach ($vals as $v) {
            if (self::t($v)) return $v;
            $last = $v;
        }
        return $last;
    }

    /** Number(v) */
    public static function num($v): float|int
    {
        if ($v === null || $v === false) return 0;
        if ($v === true) return 1;
        if ($v instanceof Undef) return NAN;
        if (is_int($v) || is_float($v)) return $v;
        if (is_array($v)) {
            if (count($v) === 0) return 0;
            if (count($v) === 1 && array_is_list($v)) return self::num(is_array($v[0]) ? self::str($v[0]) : self::str($v[0]));
            return NAN;
        }
        $s = trim((string) $v, " \t\n\r\v\f\u{00A0}\u{FEFF}");
        if ($s === '') return 0;
        if (preg_match('/^[+-]?0x[0-9a-f]+$/i', $s)) return hexdec($s);
        if (preg_match('/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i', $s)) return self::normNum((float) $s);
        if (preg_match('/^[+-]?Infinity$/', $s)) return $s[0] === '-' ? -INF : INF;
        return NAN;
    }

    /** parseFloat(v) */
    public static function parseFloat($v): float|int
    {
        $s = ltrim(self::str($v));
        if (preg_match('/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i', $s, $m)) return self::normNum((float) $m[0]);
        if (preg_match('/^[+-]?Infinity/', $s)) return $s[0] === '-' ? -INF : INF;
        return NAN;
    }

    /** parseInt(v, 10) */
    public static function parseInt($v): float|int
    {
        $s = ltrim(self::str($v));
        if (preg_match('/^[+-]?\d+/', $s, $m)) return (int) $m[0];
        return NAN;
    }

    private static function normNum(float $f): float|int
    {
        if (is_finite($f) && floor($f) == $f && abs($f) < 9.007199254740992E15) return (int) $f;
        return $f;
    }

    /** Number.isNaN / isNaN sobre números */
    public static function isNaN($v): bool
    {
        return is_float($v) && is_nan($v);
    }

    /** Number.isFinite */
    public static function isFinite($v): bool
    {
        return (is_int($v) || is_float($v)) && is_finite((float) $v);
    }

    /** Math.round de JS (mitades hacia +infinito) */
    public static function round($v): float|int
    {
        $v = self::num($v);
        if (is_float($v) && !is_finite($v)) return $v;
        return self::normNum(floor($v + 0.5));
    }

    /** Math.round((n + EPSILON) * 10^d) / 10^d */
    public static function roundTo($n, int $d): float|int
    {
        $p = 10 ** $d;
        return self::normNum(self::round((self::num($n) + PHP_FLOAT_EPSILON) * $p) / $p);
    }

    /** (n).toFixed(d) */
    public static function toFixed($n, int $d = 0): string
    {
        $n = self::num($n);
        if (is_float($n) && is_nan($n)) return 'NaN';
        // JS usa redondeo del valor binario exacto; number_format coincide en la práctica para importes
        $s = number_format((float) $n, $d, '.', '');
        if ($s === '-0' || preg_match('/^-0\.0*$/', $s)) $s = ltrim($s, '-');
        return $s;
    }

    /** String(v) */
    public static function str($v): string
    {
        if ($v === null) return 'null';
        if ($v instanceof Undef) return 'undefined';
        if ($v === true) return 'true';
        if ($v === false) return 'false';
        if (is_int($v)) return (string) $v;
        if (is_float($v)) return self::numToString($v);
        if (is_array($v)) {
            if (array_is_list($v)) return implode(',', array_map(fn ($x) => ($x === null || $x instanceof Undef) ? '' : self::str($x), $v));
            return '[object Object]';
        }
        if (is_object($v) && method_exists($v, '__toString')) return (string) $v;
        if (is_object($v)) return '[object Object]';
        return (string) $v;
    }

    public static function numToString(float|int $f): string
    {
        if (is_int($f)) return (string) $f;
        if (is_nan($f)) return 'NaN';
        if (is_infinite($f)) return $f > 0 ? 'Infinity' : '-Infinity';
        if (floor($f) == $f && abs($f) < 1e21) return sprintf('%.0f', $f);
        $s = json_encode($f);
        if (str_contains($s, 'e')) {
            [$m, $e] = explode('e', $s);
            $m = preg_replace('/\.0$/', '', $m);
            $e = (int) $e;
            $s = $m . 'e' . ($e >= 0 ? '+' : '') . $e;
        }
        return $s;
    }

    /** s.slice(a, b) sobre cadenas (por caracteres UTF-16 aproximado a caracteres Unicode) */
    public static function slice(string $s, int $start, ?int $end = null): string
    {
        $len = mb_strlen($s);
        if ($start < 0) $start = max(0, $len + $start);
        if ($end === null) $end = $len;
        elseif ($end < 0) $end = max(0, $len + $end);
        if ($end <= $start) return '';
        return mb_substr($s, $start, $end - $start);
    }

    /** String(v ?? '').trim() */
    public static function trim($v): string
    {
        return preg_replace('/^[\s\x{FEFF}\x{00A0}]+|[\s\x{FEFF}\x{00A0}]+$/u', '', self::str($v));
    }

    /** Date.now() */
    public static function now(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    /** n.toString(36) para enteros positivos */
    public static function base36(int $n): string
    {
        return base_convert((string) $n, 10, 36);
    }

    /** new Date().toISOString() */
    public static function iso(?float $ms = null): string
    {
        $ms ??= microtime(true) * 1000;
        $sec = (int) floor($ms / 1000);
        $milli = (int) round($ms - $sec * 1000);
        if ($milli === 1000) { $sec++; $milli = 0; }
        return gmdate('Y-m-d\TH:i:s', $sec) . sprintf('.%03dZ', $milli);
    }

    /** JSON.parse tolerante: devuelve null si falla (para usar en try/catch al estilo JS) */
    public static function parse($s, &$ok = null)
    {
        $ok = true;
        if (!is_string($s)) { $ok = false; return null; }
        try {
            return json_decode($s, true, 512, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
        } catch (\JsonException $e) {
            $ok = false;
            return null;
        }
    }

    /** JSON.stringify */
    public static function stringify($v): string
    {
        return Http::encode($v);
    }

    /** Array.isArray: lista JSON (arreglo con índices 0..n-1) */
    public static function isArray($v): bool
    {
        return is_array($v) && array_is_list($v);
    }

    /** Objeto plano (asociativo) */
    public static function isObject($v): bool
    {
        return is_array($v) && !array_is_list($v);
    }

    /** Quita las claves con valor undefined (como al construir un objeto JS con propiedades undefined) */
    public static function compact(array $a): array
    {
        return array_filter($a, fn ($v) => !($v instanceof Undef));
    }

    /** Valor de un array o undefined si la clave no existe */
    public static function get(?array $a, string $k)
    {
        return ($a !== null && array_key_exists($k, $a)) ? $a[$k] : self::undef();
    }

    /** s || null (cadena vacía → null) */
    public static function orNull($s)
    {
        return self::t($s) ? $s : null;
    }

    public static function clamp($v, $min, $max)
    {
        return min(max($v, $min), $max);
    }
}

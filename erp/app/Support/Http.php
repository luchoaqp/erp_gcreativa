<?php

namespace App\Support;

use Illuminate\Http\Response;

/**
 * Respuestas JSON idénticas a `res.json()` de Express:
 * números enteros sin ".0", Unicode sin escapar, claves `undefined` omitidas, NaN → null.
 */
final class Http
{
    public static function json($data, int $status = 200, array $headers = []): Response
    {
        return new Response(self::encode($data), $status, array_merge(['Content-Type' => 'application/json; charset=utf-8'], $headers));
    }

    public static function encode($data): string
    {
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS
            | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION;
        $norm = self::normalize($data, true);
        if ($norm instanceof Undef) return 'undefined';
        return json_encode($norm, $flags);
    }

    /** Normaliza valores al estilo JSON.stringify */
    private static function normalize($v, bool $top = false)
    {
        if ($v instanceof Undef) return $v;
        if (is_float($v)) {
            if (!is_finite($v)) return null;
            if (floor($v) == $v && abs($v) < 1e21) {
                return abs($v) < PHP_INT_MAX ? (int) $v : $v;
            }
            return $v;
        }
        if ($v instanceof \stdClass) $v = (array) $v + ['__obj' => true];
        if ($v instanceof \JsonSerializable) $v = $v->jsonSerialize();
        if (is_array($v)) {
            $isObj = array_key_exists('__obj', $v) && $v['__obj'] === true;
            if ($isObj) unset($v['__obj']);
            $list = !$isObj && array_is_list($v);
            $out = [];
            foreach ($v as $k => $item) {
                $n = self::normalize($item);
                if ($n instanceof Undef || $item instanceof \Closure) {
                    if ($list) $out[] = null; // en arrays, undefined → null
                    continue;
                }
                if ($list) $out[] = $n;
                else $out[(string) $k] = $n;
            }
            if ($list) return $out;
            return (object) $out; // siempre objeto (incluido {} vacío)
        }
        return $v;
    }

    /** Objeto JSON vacío o asociativo forzado ({} en vez de []) */
    public static function obj(array $a = []): \stdClass
    {
        return (object) $a;
    }
}

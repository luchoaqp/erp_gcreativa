<?php

namespace App\Services;

use App\Support\HttpError;
use App\Support\Js;

/** Utilidades compartidas por Clientes y Proveedores */
final class Party
{
    public const DOC_TIPOS = ['DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO'];

    public static function str($v, int $max = 255): string
    {
        if ($v === null || $v instanceof \App\Support\Undef) return '';
        return Js::slice(Js::trim($v), 0, $max);
    }

    /** Valida el número según el tipo de documento (el documento es opcional) */
    public static function validateDocument($tipo, $numero): array
    {
        $t = mb_strtoupper(Js::str(Js::or($tipo, 'DNI')));
        $n = self::str($numero, 30);
        if (!in_array($t, self::DOC_TIPOS, true)) throw new HttpError(400, 'Tipo de documento no válido');
        if ($n === '') return ['tipo' => $t, 'numero' => ''];
        if ($t === 'DNI' && !preg_match('/^\d{8}$/', $n)) throw new HttpError(400, 'El DNI debe tener 8 dígitos');
        if ($t === 'RUC' && !preg_match('/^\d{11}$/', $n)) throw new HttpError(400, 'El RUC debe tener 11 dígitos');
        if ($t === 'CE' && !preg_match('/^[A-Za-z0-9]{9,12}$/', $n)) throw new HttpError(400, 'El carnet de extranjería debe tener entre 9 y 12 caracteres');
        if ($t === 'PASAPORTE' && !preg_match('/^[A-Za-z0-9]{6,12}$/', $n)) throw new HttpError(400, 'El pasaporte debe tener entre 6 y 12 caracteres');
        if ($t === 'OTRO' && mb_strlen($n) > 20) throw new HttpError(400, 'El documento no puede superar 20 caracteres');
        return ['tipo' => $t, 'numero' => $n];
    }

    /** Lista de textos (direcciones/teléfonos adicionales) → texto JSON */
    public static function cleanList($arr, int $max = 6): string
    {
        $list = $arr;
        if (is_string($list)) {
            $list = Js::parse($list, $ok);
            if (!$ok) $list = [];
        }
        if (!Js::isArray($list)) return '[]';
        $out = [];
        foreach ($list as $x) {
            $s = self::str($x, 255);
            if ($s !== '') $out[] = $s;
        }
        return Js::stringify(array_slice($out, 0, $max));
    }

    public static function parseList($v): array
    {
        if (!Js::t($v)) return [];
        $a = is_string($v) ? Js::parse($v, $ok) : $v;
        if (is_string($v) && !$ok) return [];
        return Js::isArray($a) ? $a : [];
    }
}

<?php

namespace App\Services;

use App\Support\Db;
use App\Support\Js;

final class Productos
{
    /** Siguiente código interno numérico de 5 dígitos libre (00001, 00002...) */
    public static function nextInternalCode(): string
    {
        $rows = Db::query("SELECT MAX(CAST(codigo AS UNSIGNED)) AS m FROM productos WHERE codigo REGEXP '^[0-9]+$'");
        $n = Js::num(Js::or($rows[0]['m'], 0)) + 1;
        for ($i = 0; $i < 1000; $i++, $n++) {
            $code = str_pad(Js::str($n), 5, '0', STR_PAD_LEFT);
            $d = Db::query('SELECT id FROM productos WHERE codigo = ?', [$code]);
            if (!count($d)) return $code;
        }
        return substr((string) Js::now(), -8);
    }
}

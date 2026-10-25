<?php

namespace App\Services;

use App\Support\Db;
use App\Support\Js;

/** Registro de movimientos de stock (Kardex). Se llama DESPUÉS de actualizar productos.stock. */
final class Kardex
{
    public static function logMovement(array $m): void
    {
        $cantidad = Js::round(Js::num($m['cantidad'] ?? null));
        if (!Js::t($m['producto_id'] ?? null) || !($cantidad > 0)) return;
        $rows = Db::query('SELECT stock, precio_costo FROM productos WHERE id = ?', [$m['producto_id']]);
        if (!count($rows)) return;
        $doc = $m['documento'] ?? null;
        Db::query(
            "INSERT INTO kardex_movimientos (producto_id, fecha, tipo, motivo, documento, cantidad, costo_unit, stock_despues, ref_tipo, ref_id, usuario_id)\n     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $m['producto_id'], ($m['tipo'] ?? null) === 'salida' ? 'salida' : 'ingreso',
                Js::slice(Js::str(Js::or($m['motivo'] ?? null, 'Ajuste')), 0, 40),
                Js::t($doc) ? Js::slice(Js::str($doc), 0, 40) : null,
                $cantidad, Js::or(Js::num($rows[0]['precio_costo']), 0), Js::or(Js::num($rows[0]['stock']), 0),
                Js::or($m['ref_tipo'] ?? null, null), Js::or($m['ref_id'] ?? null, null), Js::or($m['usuario_id'] ?? null, null),
            ]
        );
    }
}

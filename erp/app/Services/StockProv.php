<?php

namespace App\Services;

use App\Support\Db;
use App\Support\Js;

/**
 * Stock por LOTES. productos.stock sigue siendo el total; aquí se reparte por lote de compra.
 * Las ventas descuentan FIFO (lote más antiguo primero), salvo que se elija lote o proveedor.
 * proveedor_id = 0 significa "Sin proveedor".
 */
final class StockProv
{
    public static function toDay($d): ?string
    {
        if (!Js::t($d)) return null;
        return Js::slice(Js::str($d), 0, 10);
    }

    public static function r4($n)
    {
        return Js::roundTo($n, 4);
    }

    /** Recalcula el resumen por proveedor a partir de los lotes */
    public static function syncAgg($productoId): void
    {
        $rows = Db::query(
            "SELECT proveedor_id, SUM(stock) AS s, SUM(stock * costo_unit) AS v,\n            SUBSTRING_INDEX(GROUP_CONCAT(costo_unit ORDER BY fecha_compra DESC, id DESC), ',', 1) AS ult\n     FROM producto_lotes WHERE producto_id = ? AND estado = 1 GROUP BY proveedor_id",
            [$productoId]
        );
        $provs = [];
        foreach ($rows as $r) {
            $s = Js::or(Js::num($r['s']), 0);
            $costo = $s > 0 ? self::r4(Js::num($r['v']) / $s) : self::r4(Js::or(Js::num($r['ult']), 0));
            $provs[] = Js::num($r['proveedor_id']);
            Db::query(
                "INSERT INTO producto_proveedor_stock (producto_id, proveedor_id, stock, costo_unit) VALUES (?,?,?,?)\n       ON DUPLICATE KEY UPDATE stock = VALUES(stock), costo_unit = VALUES(costo_unit)",
                [$productoId, $r['proveedor_id'], $s, $costo]
            );
        }
        if (count($provs)) Db::query('UPDATE producto_proveedor_stock SET stock = 0 WHERE producto_id = ? AND proveedor_id NOT IN (?)', [$productoId, $provs]);
        else Db::query('UPDATE producto_proveedor_stock SET stock = 0 WHERE producto_id = ?', [$productoId]);
    }

    /**
     * Ingreso de stock.
     *  opts.loteId → devuelve unidades a un lote existente (anulación de venta)
     *  opts.compraId/codigo/fecha → crea un lote nuevo por compra
     *  sin opciones → se acumula en el lote "AJUSTE" del proveedor
     */
    public static function addProv($productoId, $proveedorId, $qty, $costo, array $opts = []): void
    {
        $qty = Js::round(Js::num($qty));
        if (!Js::t($productoId) || !($qty > 0)) return;
        $prov = Js::or(Js::num($proveedorId), 0);
        $c = Js::num($costo);
        $costoOk = $c >= 0 && !Js::isNaN($c);

        if (Js::t($opts['loteId'] ?? null)) {
            $l = Db::query('SELECT id FROM producto_lotes WHERE id = ? AND producto_id = ?', [$opts['loteId'], $productoId]);
            if (count($l)) {
                Db::query('UPDATE producto_lotes SET stock = stock + ?, cantidad_inicial = GREATEST(cantidad_inicial, stock + ?) WHERE id = ?', [$qty, $qty, $opts['loteId']]);
                self::syncAgg($productoId);
                return;
            }
        }
        if (Js::t($opts['compraId'] ?? null)) {
            $codigo = Js::slice(Js::str(Js::or($opts['codigo'] ?? null, '')), 0, 60);
            Db::query(
                "INSERT INTO producto_lotes (producto_id, proveedor_id, compra_id, codigo, fecha_compra, cantidad_inicial, stock, costo_unit)\n       VALUES (?,?,?,?,?,?,?,?)",
                [$productoId, $prov, $opts['compraId'], $codigo !== '' ? $codigo : null, self::toDay($opts['fecha'] ?? null), $qty, $qty, self::r4($costoOk ? $c : 0)]
            );
        } else {
            $r = Db::query("SELECT id, stock, costo_unit FROM producto_lotes WHERE producto_id = ? AND proveedor_id = ? AND codigo = 'AJUSTE' AND estado = 1 LIMIT 1", [$productoId, $prov]);
            if (count($r)) {
                $s0 = Js::num($r[0]['stock']);
                $c0 = Js::num($r[0]['costo_unit']);
                $nuevo = $costoOk ? self::r4(($s0 * $c0 + $qty * $c) / ($s0 + $qty)) : $c0;
                Db::query('UPDATE producto_lotes SET stock = stock + ?, cantidad_inicial = cantidad_inicial + ?, costo_unit = ? WHERE id = ?', [$qty, $qty, $nuevo, $r[0]['id']]);
            } else {
                Db::query(
                    "INSERT INTO producto_lotes (producto_id, proveedor_id, codigo, fecha_compra, cantidad_inicial, stock, costo_unit, nota)\n         VALUES (?,?, 'AJUSTE', NULL, ?, ?, ?, 'Stock inicial / ajuste manual')",
                    [$productoId, $prov, $qty, $qty, self::r4($costoOk ? $c : 0)]
                );
            }
        }
        self::syncAgg($productoId);
    }

    /**
     * Descuenta stock: lote elegido → lotes del proveedor preferido → el resto, del más antiguo al más nuevo.
     * Si no alcanza, el resto se costea con productos.precio_costo.
     */
    public static function takeProv($productoId, $qty, array $o = []): array
    {
        $qty = Js::round(Js::num($qty));
        if (!Js::t($productoId) || !($qty > 0)) return ['costo_unit' => 0, 'allocations' => []];
        $pref = Js::or(Js::num($o['proveedorId'] ?? null), -1);
        $lot = Js::or(Js::num($o['loteId'] ?? null), -1);
        $pedidoId = $o['pedidoId'] ?? null;
        $detalleId = $o['detalleId'] ?? null;
        $rows = Db::query(
            "SELECT id, proveedor_id, stock, costo_unit FROM producto_lotes WHERE producto_id = ? AND estado = 1 AND stock > 0\n     ORDER BY (id = ?) DESC, (proveedor_id = ?) DESC, (fecha_compra IS NULL) DESC, fecha_compra ASC, id ASC",
            [$productoId, $lot, $pref]
        );
        $left = $qty;
        $allocations = [];
        foreach ($rows as $r) {
            if ($left <= 0) break;
            $take = min($left, Js::num($r['stock']));
            Db::query('UPDATE producto_lotes SET stock = stock - ? WHERE id = ?', [$take, $r['id']]);
            $allocations[] = ['proveedor_id' => $r['proveedor_id'], 'lote_id' => $r['id'], 'cantidad' => $take, 'costo_unit' => Js::num($r['costo_unit'])];
            $left -= $take;
        }
        if ($left > 0) {
            $p = Db::query('SELECT precio_costo FROM productos WHERE id = ?', [$productoId])[0] ?? null;
            $allocations[] = ['proveedor_id' => 0, 'lote_id' => null, 'cantidad' => $left, 'costo_unit' => Js::or(Js::num($p['precio_costo'] ?? null), 0), 'sin_desglose' => true];
        }
        if (Js::t($pedidoId)) {
            foreach ($allocations as $a) {
                Db::query(
                    'INSERT INTO venta_asignaciones (pedido_id, detalle_id, producto_id, proveedor_id, lote_id, cantidad, costo_unit) VALUES (?,?,?,?,?,?,?)',
                    [$pedidoId, Js::or($detalleId, null), $productoId, $a['proveedor_id'], $a['lote_id'], $a['cantidad'], $a['costo_unit']]
                );
            }
        }
        self::syncAgg($productoId);
        $total = 0;
        foreach ($allocations as $a) $total += $a['cantidad'] * $a['costo_unit'];
        return ['costo_unit' => self::r4($total / $qty), 'allocations' => $allocations];
    }

    /** Devuelve el stock a los lotes de los que salió (anulación / edición de la venta) */
    public static function returnProv($pedidoId, array $fallbackMoves = []): void
    {
        $asig = Db::query('SELECT producto_id, proveedor_id, lote_id, cantidad, costo_unit FROM venta_asignaciones WHERE pedido_id = ?', [$pedidoId]);
        if (count($asig)) {
            foreach ($asig as $a) self::addProv($a['producto_id'], $a['proveedor_id'], $a['cantidad'], Js::num($a['costo_unit']), ['loteId' => Js::or($a['lote_id'], null)]);
            Db::query('DELETE FROM venta_asignaciones WHERE pedido_id = ?', [$pedidoId]);
        } else {
            foreach ($fallbackMoves as $m) self::addProv($m['producto_id'], 0, $m['cantidad'], null);
        }
    }

    /** Ajuste manual del stock total: suma al lote "AJUSTE"; resta por orden de antigüedad */
    public static function adjustProv($productoId, $delta, $costo): void
    {
        $delta = Js::round(Js::num($delta));
        if (!Js::t($delta)) return;
        if ($delta > 0) self::addProv($productoId, 0, $delta, $costo);
        else self::takeProv($productoId, -$delta);
    }

    /** Anulación de compra: se resta de los lotes de esa compra (quedan inactivos); lo que falte, de otros lotes */
    public static function takeFromCompra($productoId, $compraId, $qty): void
    {
        $qty = Js::round(Js::num($qty));
        if (!($qty > 0)) return;
        $lots = Db::query('SELECT id, stock FROM producto_lotes WHERE producto_id = ? AND compra_id = ? AND estado = 1 ORDER BY id', [$productoId, $compraId]);
        $left = $qty;
        foreach ($lots as $l) {
            $take = min($left, Js::num($l['stock']));
            Db::query("UPDATE producto_lotes SET stock = stock - ?, estado = 0, nota = 'Compra anulada' WHERE id = ?", [$take, $l['id']]);
            $left -= $take;
        }
        self::syncAgg($productoId);
        if ($left > 0) self::takeProv($productoId, $left);
    }
}

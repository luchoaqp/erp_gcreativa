<?php

namespace App\Services;

use App\Support\Db;
use App\Support\Js;

/**
 * El stock se descuenta al generar el comprobante y se devuelve al anularlo (pedidos.stock_descontado).
 * Un pack/box mueve el stock de los productos que lleva dentro.
 */
final class SalesStock
{
    public static function r2($n) { return Js::roundTo($n, 2); }

    public static function stockMovements($pedidoId): array
    {
        $items = Db::query('SELECT pd.id AS detalle_id, pd.proveedor_id, pd.lote_id, pd.producto_id, pd.cantidad, COALESCE(p.es_pack, 0) AS es_pack FROM pedido_detalles pd LEFT JOIN productos p ON p.id = pd.producto_id WHERE pd.pedido_id = ?', [$pedidoId]);
        $moves = [];
        foreach ($items as $it) {
            if (!Js::t($it['producto_id'])) continue;
            if (Js::t($it['es_pack'])) {
                foreach (Db::query('SELECT componente_id, cantidad FROM producto_componentes WHERE producto_id = ?', [$it['producto_id']]) as $c) {
                    $moves[] = ['producto_id' => $c['componente_id'], 'cantidad' => Js::num($c['cantidad']) * Js::num($it['cantidad']), 'detalle_id' => $it['detalle_id']];
                }
            } else {
                $moves[] = ['producto_id' => $it['producto_id'], 'cantidad' => Js::num($it['cantidad']), 'detalle_id' => $it['detalle_id'], 'proveedor_id' => $it['proveedor_id'], 'lote_id' => $it['lote_id']];
            }
        }
        return $moves;
    }

    public static function docRef($pedidoId): string
    {
        $c = Db::query('SELECT serie, numero FROM comprobantes WHERE pedido_id = ? ORDER BY id DESC LIMIT 1', [$pedidoId]);
        if (count($c)) return $c[0]['serie'] . '-' . str_pad(Js::str($c[0]['numero']), 6, '0', STR_PAD_LEFT);
        return 'PD-' . str_pad(Js::str($pedidoId), 6, '0', STR_PAD_LEFT);
    }

    public static function deductStock($pedidoId): void
    {
        $documento = self::docRef($pedidoId);
        foreach (self::stockMovements($pedidoId) as $it) {
            Db::query('UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?', [Js::round($it['cantidad']), $it['producto_id']]);
            StockProv::takeProv($it['producto_id'], $it['cantidad'], ['proveedorId' => $it['proveedor_id'] ?? null, 'loteId' => $it['lote_id'] ?? null, 'pedidoId' => $pedidoId, 'detalleId' => $it['detalle_id']]);
            Kardex::logMovement(['producto_id' => $it['producto_id'], 'tipo' => 'salida', 'cantidad' => $it['cantidad'], 'motivo' => 'Venta', 'documento' => $documento, 'ref_tipo' => 'pedido', 'ref_id' => $pedidoId]);
        }
        Db::query('UPDATE pedidos SET stock_descontado = 1 WHERE id = ?', [$pedidoId]);
    }

    public static function restoreStock($pedidoId, string $motivo = 'Anulación de venta'): void
    {
        $documento = self::docRef($pedidoId);
        $moves = self::stockMovements($pedidoId);
        StockProv::returnProv($pedidoId, $moves);
        foreach ($moves as $it) {
            Db::query('UPDATE productos SET stock = stock + ? WHERE id = ?', [Js::round($it['cantidad']), $it['producto_id']]);
            Kardex::logMovement(['producto_id' => $it['producto_id'], 'tipo' => 'ingreso', 'cantidad' => $it['cantidad'], 'motivo' => $motivo, 'documento' => $documento, 'ref_tipo' => 'pedido', 'ref_id' => $pedidoId]);
        }
        Db::query('UPDATE pedidos SET stock_descontado = 0 WHERE id = ?', [$pedidoId]);
    }

    public static function syncEstadoPago($pedidoId): array
    {
        $rows = Db::query('SELECT total, (SELECT COALESCE(SUM(monto),0) FROM pagos WHERE pedido_id = ?) AS pagado FROM pedidos WHERE id = ?', [$pedidoId, $pedidoId]);
        if (!count($rows)) return ['total' => 0, 'pagado' => 0, 'saldo' => 0];
        $total = Js::num($rows[0]['total']);
        $pagado = self::r2($rows[0]['pagado']);
        $estado = $pagado >= $total - 0.009 ? 'pagado' : ($pagado > 0 ? 'adelanto' : 'pendiente');
        Db::query('UPDATE pedidos SET estado_pago = ? WHERE id = ?', [$estado, $pedidoId]);
        return ['total' => $total, 'pagado' => $pagado, 'saldo' => self::r2(max(0, $total - $pagado))];
    }
}

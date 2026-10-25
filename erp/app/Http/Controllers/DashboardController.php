<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class DashboardController extends Controller
{
    private const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

    public function getStats()
    {
        try {
            // "Hoy" en hora de Perú. (El backend Node usaba la fecha UTC, que después de las 7 p. m.
            // ya era "mañana" y dejaba las ventas del día en cero; se corrige aquí.)
            $hoy = config('erp.compat_hoy_utc') ? gmdate('Y-m-d') : date('Y-m-d');

            // 1. Ventas y pedidos de hoy (los ingresos cuentan solo con comprobante emitido)
            $pedidosHoy = Db::query("\n      SELECT COUNT(id) as total_pedidos_hoy FROM pedidos WHERE DATE(fecha_pedido) = ? AND estado_pedido != 'cancelado'\n    ", [$hoy]);
            $ventasHoyRows = Db::query("\n      SELECT COALESCE(SUM(p.total), 0) as total_ventas_hoy\n      FROM pedidos p\n      JOIN comprobantes cp ON cp.pedido_id = p.id AND cp.estado = 'emitido'\n      WHERE DATE(cp.fecha) = ? AND p.estado_pedido != 'cancelado'\n    ", [$hoy]);
            $ventasTotales = Db::query("\n      SELECT COALESCE(SUM(p.total), 0) as total_ingresos\n      FROM pedidos p\n      JOIN comprobantes cp ON cp.pedido_id = p.id AND cp.estado = 'emitido'\n      WHERE p.estado_pedido != 'cancelado'\n    ");
            // 2. Entregas programadas para hoy
            $entregasHoy = Db::query("\n      SELECT \n        COUNT(id) as total_entregas_hoy,\n        SUM(CASE WHEN estado_pedido IN ('pendiente_diseno', 'pendiente_aprobacion', 'en_produccion', 'listo', 'en_ruta') THEN 1 ELSE 0 END) as entregas_pendientes_hoy,\n        SUM(CASE WHEN estado_pedido = 'entregado' THEN 1 ELSE 0 END) as entregas_completadas_hoy\n      FROM pedidos\n      WHERE fecha_entrega = ?\n    ", [$hoy]);
            // 3-5
            $enTaller = Db::query("\n      SELECT COUNT(id) as count FROM pedidos WHERE estado_pedido IN ('pendiente_diseno', 'pendiente_aprobacion', 'en_produccion')\n    ");
            $stockBajo = Db::query("\n      SELECT COUNT(id) as count FROM productos WHERE stock <= stock_minimo AND activo = 1\n    ");
            $totalClientes = Db::query('SELECT COUNT(id) as count FROM clientes');

            // 6. Entregas de la semana (lunes a domingo, aún no entregadas)
            $dow = (int) date('w'); // 0 = domingo
            $lunes = date('Y-m-d', strtotime('-' . (($dow + 6) % 7) . ' days', strtotime('today')));
            $domingo = date('Y-m-d', strtotime($lunes . ' +6 days'));
            $entregasDetalle = Db::query("\n      SELECT \n        p.id,\n        p.numero_pedido,\n        p.nombre_destinatario,\n        p.telefono_destinatario,\n        p.direccion_entrega,\n        p.franja_horaria,\n        p.fecha_entrega,\n        p.tipo_entrega,\n        p.mensaje_dedicatoria,\n        p.de_parte_de,\n        p.total,\n        p.metodo_pago,\n        p.estado_pedido,\n        p.notas_taller,\n        COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') as nombre_cliente,\n        c.telefono as telefono_cliente,\n        (SELECT pr.nombre FROM pedido_detalles pd JOIN productos pr ON pd.producto_id = pr.id WHERE pd.pedido_id = p.id LIMIT 1) as producto_principal,\n        (SELECT pr.imagen_url FROM pedido_detalles pd JOIN productos pr ON pd.producto_id = pr.id WHERE pd.pedido_id = p.id LIMIT 1) as imagen_producto\n      FROM pedidos p\n      LEFT JOIN clientes c ON p.cliente_id = c.id\n      WHERE p.fecha_entrega BETWEEN ? AND ?\n        AND p.estado_pedido NOT IN ('entregado', 'cancelado')\n      ORDER BY p.fecha_entrega ASC, p.franja_horaria ASC, p.id ASC\n      LIMIT 40\n    ", [$lunes, $domingo]);
            // 7. Ventas por categoría
            $ventasPorCategoria = Db::query("\n      SELECT \n        cat.nombre as categoria,\n        cat.color_badge,\n        COALESCE(SUM(pd.subtotal), 0) as total,\n        COUNT(pd.id) as cantidad_items\n      FROM categorias cat\n      LEFT JOIN productos pr ON cat.id = pr.categoria_id\n      LEFT JOIN pedido_detalles pd ON pr.id = pd.producto_id\n        AND pd.pedido_id IN (SELECT pedido_id FROM comprobantes WHERE estado = 'emitido')\n      GROUP BY cat.id, cat.nombre, cat.color_badge\n      ORDER BY total DESC\n    ");
            // 8. Últimos 7 días
            $ventasSemana = Db::query("\n      SELECT \n        DATE(cp.fecha) as fecha,\n        DAYNAME(cp.fecha) as dia,\n        COALESCE(SUM(p.total), 0) as total,\n        COUNT(p.id) as pedidos\n      FROM pedidos p\n      JOIN comprobantes cp ON cp.pedido_id = p.id AND cp.estado = 'emitido'\n      WHERE cp.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND p.estado_pedido != 'cancelado'\n      GROUP BY DATE(cp.fecha), DAYNAME(cp.fecha)\n      ORDER BY fecha ASC\n    ");
            // 9. Stock crítico
            $productosCriticos = Db::query("\n      SELECT p.id, p.nombre, p.stock, p.stock_minimo, p.imagen_url, c.nombre as categoria\n      FROM productos p\n      LEFT JOIN categorias c ON p.categoria_id = c.id\n      WHERE p.stock <= p.stock_minimo AND p.activo = 1\n      ORDER BY p.stock ASC\n      LIMIT 5\n    ");
            // 10. Por método de pago
            $ventasPorMetodo = Db::query("\n      SELECT \n        p.metodo_pago,\n        COUNT(p.id) as total_pedidos,\n        COALESCE(SUM(p.total), 0) as total_monto\n      FROM pedidos p\n      JOIN comprobantes cp ON cp.pedido_id = p.id AND cp.estado = 'emitido'\n      WHERE p.estado_pedido != 'cancelado'\n      GROUP BY p.metodo_pago\n      ORDER BY total_monto DESC\n    ");
            // 11. Por mes (últimos 6 meses)
            $ventasMesRows = Db::query("\n      SELECT DATE_FORMAT(cp.fecha, '%Y-%m') AS ym, COALESCE(SUM(p.total), 0) AS total, COUNT(p.id) AS pedidos\n      FROM pedidos p\n      JOIN comprobantes cp ON cp.pedido_id = p.id AND cp.estado = 'emitido'\n      WHERE cp.fecha >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01') AND p.estado_pedido != 'cancelado'\n      GROUP BY ym\n    ");
            $ventasMes = [];
            $base = new \DateTimeImmutable('first day of this month');
            for ($i = 5; $i >= 0; $i--) {
                $d = $base->modify("-{$i} month");
                $ym = $d->format('Y-m');
                $f = null;
                foreach ($ventasMesRows as $r) if ($r['ym'] === $ym) { $f = $r; break; }
                $ventasMes[] = ['ym' => $ym, 'mes' => self::MESES[(int) $d->format('n') - 1], 'total' => Js::num(Js::or($f['total'] ?? null, 0)), 'pedidos' => Js::num(Js::or($f['pedidos'] ?? null, 0))];
            }
            // 12. Por ocasión
            $ventasPorOcasion = Db::query("\n      SELECT o.nombre AS ocasion, COALESCE(SUM(pd.subtotal), 0) AS total, COALESCE(SUM(pd.cantidad), 0) AS unidades, COUNT(DISTINCT pd.pedido_id) AS pedidos\n      FROM pedido_detalles pd\n      JOIN productos pr ON pr.id = pd.producto_id\n      JOIN ocasiones o ON o.id = pr.ocasion_id\n      WHERE pd.pedido_id IN (SELECT pedido_id FROM comprobantes WHERE estado = 'emitido')\n      GROUP BY o.id, o.nombre\n      HAVING total > 0\n      ORDER BY total DESC\n    ");
            // 13. Pendientes de diseño
            $pendientesDiseno = Db::query("\n      SELECT p.id, p.numero_pedido, p.fecha_entrega_diseno, p.fecha_entrega, p.estado_pedido,\n             COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') AS cliente_nombre,\n             (SELECT pr.nombre FROM pedido_detalles pd JOIN productos pr ON pd.producto_id = pr.id WHERE pd.pedido_id = p.id LIMIT 1) AS producto_principal\n      FROM pedidos p\n      LEFT JOIN clientes c ON c.id = p.cliente_id\n      WHERE p.estado_pedido = 'pendiente_diseno'\n      ORDER BY p.fecha_entrega_diseno IS NULL, p.fecha_entrega_diseno ASC, p.fecha_entrega ASC, p.id ASC\n      LIMIT 30\n    ");
            // 14. Gastos del mes y máquinas que requieren atención
            $gastosMes = 0;
            try {
                $g = Db::query("SELECT COALESCE(SUM(total), 0) AS t FROM gastos WHERE estado != 'anulado' AND fecha_emision >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
                $gastosMes = Js::num(Js::or($g[0]['t'] ?? null, 0));
            } catch (\Throwable $e) {
            }
            $taller = ['total' => 0, 'alertas' => []];
            try {
                $ms = Db::query("\n        SELECT id, nombre, categoria, marca, modelo, estado, fecha_ultimo_mantenimiento, mantenimiento_cada_dias,\n               CASE WHEN mantenimiento_cada_dias IS NOT NULL\n                    THEN DATEDIFF(DATE_ADD(COALESCE(fecha_ultimo_mantenimiento, fecha_compra, CURDATE()), INTERVAL mantenimiento_cada_dias DAY), CURDATE())\n                    ELSE NULL END AS dias_para_mantenimiento\n        FROM taller_maquinas WHERE activo = 1");
                $al = array_values(array_filter($ms, fn ($m) => $m['estado'] !== 'operativa' || ($m['dias_para_mantenimiento'] !== null && Js::num($m['dias_para_mantenimiento']) <= 7)));
                usort($al, fn ($a, $b) => Js::num($a['dias_para_mantenimiento'] ?? 999) <=> Js::num($b['dias_para_mantenimiento'] ?? 999));
                $taller = ['total' => count($ms), 'alertas' => array_slice($al, 0, 5)];
            } catch (\Throwable $e) {
            }
            $activos = Db::query("SELECT COUNT(id) AS n FROM pedidos WHERE estado_pedido NOT IN ('entregado', 'cancelado')");
            $n = fn ($v) => Js::num(Js::or($v, 0));
            return $this->json([
                'success' => true,
                'stats' => [
                    'ventas_hoy' => $n($ventasHoyRows[0]['total_ventas_hoy'] ?? null),
                    'total_ingresos' => $n($ventasTotales[0]['total_ingresos'] ?? null),
                    'pedidos_hoy' => $n($pedidosHoy[0]['total_pedidos_hoy'] ?? null),
                    'entregas_hoy' => $n($entregasHoy[0]['total_entregas_hoy'] ?? null),
                    'entregas_pendientes' => $n($entregasHoy[0]['entregas_pendientes_hoy'] ?? null),
                    'entregas_completadas' => $n($entregasHoy[0]['entregas_completadas_hoy'] ?? null),
                    'regalos_en_taller' => $n($enTaller[0]['count'] ?? null),
                    'stock_bajo_alertas' => $n($stockBajo[0]['count'] ?? null),
                    'total_clientes' => $n($totalClientes[0]['count'] ?? null),
                    'pedidos_activos' => $n($activos[0]['n'] ?? null),
                    'gastos_mes' => $gastosMes,
                ],
                'entregas_hoy' => $entregasDetalle,
                'ventas_por_categoria' => $ventasPorCategoria,
                'ventas_por_metodo' => $ventasPorMetodo,
                'ventas_semana' => $ventasSemana,
                'productos_criticos' => $productosCriticos,
                'ventas_mes' => $ventasMes,
                'ventas_por_ocasion' => $ventasPorOcasion,
                'pendientes_diseno' => $pendientesDiseno,
                'taller' => $taller,
            ]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener métricas del dashboard'], 500);
        }
    }
}

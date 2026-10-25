<?php

namespace App\Http\Controllers;

use App\Services\Orders;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class OrderController extends Controller
{
    public function getOrders()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $sql = "\n      SELECT \n        p.*,\n        COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') as cliente_nombre,\n        c.telefono as cliente_telefono,\n        u.nombre as vendedor_nombre,\n        rep.nombre as repartidor_nombre,\n        (SELECT COALESCE(SUM(pg.monto), 0) FROM pagos pg WHERE pg.pedido_id = p.id) as pagado,\n        (SELECT COUNT(*) FROM comprobantes cp WHERE cp.pedido_id = p.id AND cp.estado = 'emitido') as comprobantes_emitidos,\n        (SELECT d.link FROM pedido_diseno d WHERE d.pedido_id = p.id) as diseno_link,\n        (SELECT d.links_json FROM pedido_diseno d WHERE d.pedido_id = p.id) as diseno_links,\n        (SELECT IF(d.foto IS NOT NULL AND d.foto <> '', 1, 0) FROM pedido_diseno d WHERE d.pedido_id = p.id) as diseno_tiene_foto,\n        (SELECT COUNT(*) FROM pedido_detalles WHERE pedido_id = p.id) as total_items,\n        (SELECT GROUP_CONCAT(CONCAT(pd.cantidad, ' × ', COALESCE(pr.nombre, 'Producto')) ORDER BY pd.id SEPARATOR '||') FROM pedido_detalles pd LEFT JOIN productos pr ON pr.id = pd.producto_id WHERE pd.pedido_id = p.id) as productos_resumen\n      FROM pedidos p\n      LEFT JOIN clientes c ON p.cliente_id = c.id\n      LEFT JOIN usuarios u ON p.usuario_id = u.id\n      LEFT JOIN usuarios rep ON p.repartidor_id = rep.id\n      WHERE 1=1\n    ";
            $params = [];
            if (Js::t($g('estado')) && $g('estado') !== 'todos') { $sql .= ' AND p.estado_pedido = ?'; $params[] = $g('estado'); }
            if (Js::t($g('fecha_entrega'))) { $sql .= ' AND p.fecha_entrega = ?'; $params[] = $g('fecha_entrega'); }
            if (Js::t($g('fecha_desde'))) { $sql .= ' AND DATE(p.fecha_pedido) >= ?'; $params[] = $g('fecha_desde'); }
            if (Js::t($g('search'))) {
                $s = '%' . Js::str($g('search')) . '%';
                $sql .= ' AND (p.numero_pedido LIKE ? OR p.nombre_destinatario LIKE ? OR c.nombre LIKE ? OR p.direccion_entrega LIKE ?)';
                array_push($params, $s, $s, $s, $s);
            }
            $sql .= ' ORDER BY p.fecha_entrega ASC, p.id DESC';
            return $this->json(['success' => true, 'orders' => Db::query($sql, $params)]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener pedidos'], 500);
        }
    }

    public function getOrderById($id)
    {
        try {
            $orders = Db::query("\n      SELECT \n        p.*,\n        COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') as cliente_nombre,\n        c.telefono as cliente_telefono,\n        c.email as cliente_email,\n        u.nombre as vendedor_nombre,\n        rep.nombre as repartidor_nombre\n      FROM pedidos p\n      LEFT JOIN clientes c ON p.cliente_id = c.id\n      LEFT JOIN usuarios u ON p.usuario_id = u.id\n      LEFT JOIN usuarios rep ON p.repartidor_id = rep.id\n      WHERE p.id = ?\n    ", [$id]);
            if (count($orders) === 0) return $this->json(['success' => false, 'message' => 'Pedido no encontrado'], 404);
            $order = $orders[0];
            $order['items'] = Db::query("\n      SELECT \n        pd.*,\n        pr.nombre as producto_nombre,\n        pr.codigo as producto_codigo,\n        pr.imagen_url as producto_imagen,\n        cat.nombre as categoria_nombre\n      FROM pedido_detalles pd\n      JOIN productos pr ON pd.producto_id = pr.id\n      LEFT JOIN categorias cat ON pr.categoria_id = cat.id\n      WHERE pd.pedido_id = ?\n    ", [$order['id']]);
            return $this->json(['success' => true, 'order' => $order]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener detalle del pedido'], 500);
        }
    }

    public function getDiseno($id)
    {
        try {
            $r = Db::query('SELECT link, foto, links_json FROM pedido_diseno WHERE pedido_id = ?', [$id]);
            return $this->json(['success' => true, 'link' => Js::or($r[0]['link'] ?? null, ''), 'foto' => Js::or($r[0]['foto'] ?? null, ''), 'links' => Orders::parseLinks($r[0] ?? null)]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al obtener el diseño'], 500);
        }
    }

    public function saveDiseno($id)
    {
        try {
            Db::query('START TRANSACTION');
            $p = Db::query('SELECT id FROM pedidos WHERE id = ?', [$id]);
            if (!count($p)) throw new HttpError(404, 'Pedido no encontrado');
            $b = $this->body();
            Orders::saveDisenoCore($id, Orders::opt($b, 'link'), Orders::opt($b, 'foto'), Orders::opt($b, 'links'));
            Db::query('COMMIT');
            return $this->json(['success' => true, 'message' => 'Diseño guardado']);
        } catch (\Throwable $e) {
            Db::try('ROLLBACK');
            if (!$e instanceof HttpError) report($e);
            return $this->json(['success' => false, 'message' => $e instanceof HttpError ? $e->getMessage() : 'Error al guardar el diseño'], $e instanceof HttpError ? $e->status : 500);
        }
    }

    public function createOrder()
    {
        try {
            Db::begin();
            $body = $this->body();
            $u = $this->user();
            if (($u['rol'] ?? null) !== 'admin' && Js::isArray($body['items'] ?? null)) Orders::enforceCatalogPrices($body['items']);
            $result = Orders::createOrderCore($body, $u['id'] ?? null);
            Db::commit();
            return $this->json(array_merge(['success' => true, 'message' => '¡Pedido y venta de regalo registrada con éxito!'], $result), 201);
        } catch (\Throwable $e) {
            Db::rollback();
            if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al registrar el pedido'], 500);
        }
    }

    public function updateOrderStatus($id)
    {
        try {
            $b = $this->body();
            $has = fn ($k) => array_key_exists($k, $b);
            $estado = $has('estado_pedido') ? $b['estado_pedido'] : Js::undef();
            if ($has('estado_pedido') && !in_array($estado, Orders::ESTADOS_PEDIDO, true)) {
                return $this->json(['success' => false, 'message' => 'Estado de pedido no válido'], 400);
            }
            if ($estado === 'cancelado') {
                return $this->json(['success' => false, 'message' => 'Para anular un pedido usa "Anular venta" en el módulo Ventas.'], 400);
            }
            $cur = Db::query('SELECT estado_pedido, total, (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE pedido_id = ?) AS pagado FROM pedidos WHERE id = ?', [$id, $id]);
            if (!count($cur)) return $this->json(['success' => false, 'message' => 'Pedido no encontrado'], 404);
            if ($cur[0]['estado_pedido'] === 'cancelado' && $has('estado_pedido')) {
                return $this->json(['success' => false, 'message' => 'La venta está anulada; no se puede cambiar su estado.'], 400);
            }
            if ($estado === 'en_ruta' || $estado === 'entregado') {
                $saldo = Js::round((Js::num($cur[0]['total']) - Js::num($cur[0]['pagado'])) * 100) / 100;
                if ($saldo > 0.009) {
                    return $this->json(['success' => false, 'message' => 'El cliente aún tiene un saldo pendiente de S/ ' . Js::toFixed($saldo, 2) . '. Registra el pago en el módulo Ventas antes de enviar el pedido a ruta.'], 400);
                }
            }
            $sets = [];
            $vals = [];
            foreach (['estado_pedido', 'repartidor_id', 'notas_taller', 'foto_entrega_url'] as $k) {
                if ($has($k)) { $sets[] = "{$k} = ?"; $vals[] = $b[$k]; }
            }
            if (count($sets) === 0) return $this->json(['success' => false, 'message' => 'No hay datos para actualizar'], 400);
            $r = Db::query('UPDATE pedidos SET ' . implode(', ', $sets) . ' WHERE id = ?', [...$vals, $id]);
            if ($r['affectedRows'] === 0) return $this->json(['success' => false, 'message' => 'Pedido no encontrado'], 404);
            return $this->json(['success' => true, 'message' => 'Estado de pedido actualizado a: ' . Js::str($estado)]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al actualizar pedido: ' . $e->getMessage()], 500);
        }
    }
}

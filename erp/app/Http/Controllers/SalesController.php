<?php

namespace App\Http\Controllers;

use App\Services\Orders;
use App\Services\SalesStock;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class SalesController extends Controller
{
    private const SERIES = ['nota_venta' => 'NV01', 'boleta' => 'B001', 'factura' => 'F001'];
    private const METODOS = ['efectivo', 'tarjeta', 'yape', 'plin', 'transferencia'];

    private static function r2($n) { return Js::roundTo($n, 2); }

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback . ': ' . $e->getMessage()], 500);
    }

    private static function serie($tipo): ?string
    {
        return is_string($tipo) ? (self::SERIES[$tipo] ?? null) : null;
    }

    public function getDocConfig()
    {
        try {
            Db::query("INSERT IGNORE INTO cotizacion_config (id, pie_pagina) VALUES (1, 'Gracias por su preferencia')");
            $rows = Db::query('SELECT * FROM cotizacion_config WHERE id = 1');
            return $this->json(['success' => true, 'config' => $rows[0] ?? Js::undef()]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la configuración');
        }
    }

    public function listSales()
    {
        try {
            $q = $this->query();
            $search = $q['search'] ?? null;
            $tab = $q['tab'] ?? 'todas';
            $periodo = $q['periodo'] ?? 'todo';
            $etapa = $q['etapa'] ?? null;
            $sql = "\n      SELECT p.id, p.numero_pedido, p.fecha_pedido, p.fecha_entrega, p.fecha_entrega_diseno, p.total, p.subtotal, p.costo_envio,\n             p.estado_pedido, p.tipo_entrega, p.ciudad_envio, p.nombre_destinatario, p.aplica_igv, p.igv_monto, p.cliente_documento,\n             COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') AS cliente_nombre,\n             COALESCE(c.telefono, p.telefono_destinatario, '') AS cliente_telefono,\n             (SELECT COALESCE(SUM(pg.monto),0) FROM pagos pg WHERE pg.pedido_id = p.id) AS pagado,\n             (SELECT q.numero FROM cotizaciones q WHERE q.pedido_id = p.id LIMIT 1) AS cotizacion_numero\n      FROM pedidos p\n      LEFT JOIN clientes c ON c.id = p.cliente_id\n      WHERE 1=1";
            $params = [];
            if ($periodo === 'hoy') $sql .= ' AND DATE(p.fecha_pedido) = CURDATE()';
            elseif ($periodo === 'semana') $sql .= ' AND DATE(p.fecha_pedido) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
            elseif ($periodo === 'mes') $sql .= " AND DATE(p.fecha_pedido) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            elseif ($periodo === 'mes_anterior') $sql .= " AND DATE(p.fecha_pedido) >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND DATE(p.fecha_pedido) < DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            if (Js::t($etapa) && $etapa !== 'todas') { $sql .= ' AND p.estado_pedido = ?'; $params[] = $etapa; }
            if (Js::t($search)) {
                $sql .= " AND (p.numero_pedido LIKE ? OR CONCAT('PD-', LPAD(p.id, 6, '0')) LIKE ? OR COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') LIKE ? OR p.cliente_documento LIKE ? OR p.nombre_destinatario LIKE ?\n        OR REPLACE(REPLACE(REPLACE(COALESCE(c.telefono, ''), ' ', ''), '-', ''), '+', '') LIKE ? OR REPLACE(REPLACE(REPLACE(COALESCE(p.telefono_destinatario, ''), ' ', ''), '-', ''), '+', '') LIKE ?)";
                $s = '%' . Js::str($search) . '%';
                $tel = '%' . preg_replace('/[\s+-]/u', '', Js::str($search)) . '%';
                array_push($params, $s, $s, $s, $s, $s, $tel, $tel);
            }
            $sql .= ' ORDER BY p.id DESC LIMIT 1000';
            $rows = Db::query($sql, $params);
            $ids = array_column($rows, 'id');
            $comps = count($ids) ? Db::query("SELECT id, pedido_id, tipo, serie, numero FROM comprobantes WHERE estado = 'emitido' AND pedido_id IN (?)", [$ids]) : [];
            $sales = array_map(function ($r) use ($comps) {
                $total = Js::num($r['total']);
                $pagado = self::r2($r['pagado']);
                $r['total'] = $total;
                $r['pagado'] = $pagado;
                $r['saldo'] = self::r2(max(0, $total - $pagado));
                $r['comprobantes'] = array_values(array_filter($comps, fn ($c) => $c['pedido_id'] === $r['id']));
                return $r;
            }, $rows);
            $activas = array_values(array_filter($sales, fn ($s) => $s['estado_pedido'] !== 'cancelado'));
            $counts = [
                'todas' => count($sales),
                'pendientes' => count(array_filter($activas, fn ($s) => $s['saldo'] > 0.009)),
                'pagadas' => count(array_filter($activas, fn ($s) => $s['saldo'] <= 0.009)),
                'anuladas' => count($sales) - count($activas),
            ];
            $list = $sales;
            if ($tab === 'pendientes') $list = array_values(array_filter($activas, fn ($s) => $s['saldo'] > 0.009));
            elseif ($tab === 'pagadas') $list = array_values(array_filter($activas, fn ($s) => $s['saldo'] <= 0.009));
            elseif ($tab === 'anuladas') $list = array_values(array_filter($sales, fn ($s) => $s['estado_pedido'] === 'cancelado'));
            // Contabilidad: solo cuenta lo que tiene comprobante emitido
            $base = array_values(array_filter($list, fn ($s) => $s['estado_pedido'] !== 'cancelado'));
            $sum = function (array $arr, callable $f) { $a = 0; foreach ($arr as $s) $a = $a + $f($s); return $a; };
            $conComp = array_filter($base, fn ($s) => count($s['comprobantes']) > 0);
            $sinComp = array_filter($base, fn ($s) => count($s['comprobantes']) === 0);
            $totals = [
                'total' => self::r2($sum($base, fn ($s) => $s['total'])),
                'contabilizado' => self::r2($sum($conComp, fn ($s) => $s['total'])),
                'adelantos' => self::r2($sum($sinComp, fn ($s) => min($s['pagado'], $s['total']))),
                'por_cobrar' => self::r2($sum($base, fn ($s) => $s['saldo'])),
            ];
            return $this->json(['success' => true, 'sales' => $list, 'counts' => $counts, 'totals' => $totals]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al listar ventas');
        }
    }

    public function getSale($id)
    {
        try {
            $rows = Db::query("\n      SELECT p.*, COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') AS cliente_nombre,\n             c.telefono AS cliente_telefono, c.email AS cliente_email, u.nombre AS vendedor_nombre,\n             (SELECT q.numero FROM cotizaciones q WHERE q.pedido_id = p.id LIMIT 1) AS cotizacion_numero\n      FROM pedidos p\n      LEFT JOIN clientes c ON c.id = p.cliente_id\n      LEFT JOIN usuarios u ON u.id = p.usuario_id\n      WHERE p.id = ?", [$id]);
            if (!count($rows)) return $this->json(['success' => false, 'message' => 'Venta no encontrada'], 404);
            $items = Db::query("\n      SELECT pd.*, COALESCE(pr.nombre, 'Producto') AS descripcion, pr.codigo\n      FROM pedido_detalles pd LEFT JOIN productos pr ON pr.id = pd.producto_id\n      WHERE pd.pedido_id = ? ORDER BY pd.id", [$id]);
            $pagos = Db::query('SELECT * FROM pagos WHERE pedido_id = ? ORDER BY fecha ASC, id ASC', [$id]);
            $comprobantes = Db::query('SELECT * FROM comprobantes WHERE pedido_id = ? ORDER BY id ASC', [$id]);
            $acc = 0;
            foreach ($pagos as $p) $acc = $acc + Js::num($p['monto']);
            $pagado = self::r2($acc);
            $total = Js::num($rows[0]['total']);
            $sale = $rows[0];
            $sale['total'] = $total;
            $sale['items'] = $items;
            $sale['pagos'] = $pagos;
            $sale['comprobantes'] = $comprobantes;
            $sale['pagado'] = $pagado;
            $sale['saldo'] = self::r2(max(0, $total - $pagado));
            return $this->json(['success' => true, 'sale' => $sale]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la venta');
        }
    }

    public function addPayment($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT id, total, estado_pedido FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            if ($rows[0]['estado_pedido'] === 'cancelado') throw new HttpError(400, 'La venta está anulada; no admite pagos');
            $b = $this->body();
            $monto = self::r2($b['monto'] ?? Js::undef());
            if (!($monto > 0) || Js::isNaN($monto)) throw new HttpError(400, 'Ingresa un monto mayor a 0');
            if (!in_array($b['metodo'] ?? null, self::METODOS, true)) throw new HttpError(400, 'Elige un método de pago');
            $fecha = preg_match('/^\d{4}-\d{2}-\d{2}$/', Js::str(Js::or($b['fecha'] ?? null, ''))) ? $b['fecha'] : date('Y-m-d');
            $cu = $b['comprobante_url'] ?? null;
            if (Js::t($cu) && (!preg_match('#^data:(image/|application/pdf)#', Js::str($cu)) || mb_strlen(Js::str($cu)) > 4000000)) {
                throw new HttpError(400, 'El comprobante debe ser una imagen o PDF de hasta 3 MB');
            }
            $sum = Db::query('SELECT COALESCE(SUM(monto),0) AS pagado FROM pagos WHERE pedido_id = ?', [$id])[0];
            $total = Js::num($rows[0]['total']);
            $saldo = self::r2($total - Js::num($sum['pagado']));
            if ($monto > $saldo + 0.009) throw new HttpError(400, 'El monto supera el saldo pendiente (S/ ' . Js::toFixed($saldo, 2) . ')');
            $concepto = $monto >= $saldo - 0.009 ? 'saldo' : 'abono';
            $dest = Js::slice(Js::str(Js::or($b['destino'] ?? null, '')), 0, 80);
            $ref = Js::slice(Js::str(Js::or($b['referencia'] ?? null, '')), 0, 80);
            $r = Db::query("INSERT INTO pagos (pedido_id, fecha, metodo, destino, referencia, monto, concepto, comprobante_url, usuario_id)\n       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                $id, $fecha, $b['metodo'], $dest !== '' ? $dest : null, $ref !== '' ? $ref : null, $monto, $concepto, Js::or($cu, null), $this->userId(),
            ]);
            $resumen = SalesStock::syncEstadoPago($id);
            Db::commit();
            return $this->json(array_merge(['success' => true, 'message' => 'Pago registrado', 'pagoId' => $r['insertId']], $resumen), 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al registrar el pago');
        }
    }

    public function deletePayment($id, $pagoId)
    {
        try {
            Db::begin();
            $pg = Db::query('SELECT id, monto FROM pagos WHERE id = ? AND pedido_id = ? FOR UPDATE', [$pagoId, $id]);
            if (!count($pg)) throw new HttpError(404, 'Pago no encontrado');
            $ped = Db::query('SELECT total, estado_pedido FROM pedidos WHERE id = ?', [$id])[0];
            $sum = Db::query('SELECT COALESCE(SUM(monto),0) AS pagado FROM pagos WHERE pedido_id = ?', [$id])[0];
            $nuevoSaldo = self::r2(Js::num($ped['total']) - (Js::num($sum['pagado']) - Js::num($pg[0]['monto'])));
            if ($nuevoSaldo > 0.009 && in_array($ped['estado_pedido'], ['en_ruta', 'entregado'], true)) {
                throw new HttpError(400, 'El pedido ya salió a ruta o fue entregado. Devuélvelo a una etapa anterior antes de eliminar este pago.');
            }
            Db::query('DELETE FROM pagos WHERE id = ?', [$pagoId]);
            $resumen = SalesStock::syncEstadoPago($id);
            Db::commit();
            return $this->json(array_merge(['success' => true, 'message' => 'Pago eliminado'], $resumen));
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al eliminar el pago');
        }
    }

    public function saveComprobanteBorrador($id)
    {
        try {
            $b = $this->body();
            $rows = Db::query('SELECT id, estado_pedido FROM pedidos WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            if (Js::t($b['borrar'] ?? null)) {
                Db::query('UPDATE pedidos SET comprobante_borrador = NULL WHERE id = ?', [$id]);
                return $this->json(['success' => true, 'message' => 'Borrador eliminado']);
            }
            if (!self::serie($b['tipo'] ?? null)) throw new HttpError(400, 'Tipo de comprobante no válido');
            if ($rows[0]['estado_pedido'] === 'cancelado') throw new HttpError(400, 'La venta está anulada');
            $s = fn ($k, $n) => Js::slice(Js::str(Js::or($b[$k] ?? null, '')), 0, $n);
            $data = ['tipo' => $b['tipo'], 'doc_numero' => $s('doc_numero', 20), 'razon_social' => $s('razon_social', 150), 'direccion' => $s('direccion', 255), 'cliente_telefono' => $s('cliente_telefono', 30)];
            Db::query('UPDATE pedidos SET comprobante_borrador = ? WHERE id = ?', [Js::stringify($data), $id]);
            return $this->json(['success' => true, 'message' => 'Borrador guardado']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar el borrador');
        }
    }

    public function createComprobante($id)
    {
        try {
            Db::begin();
            $b = $this->body();
            $tipo = $b['tipo'] ?? null;
            $serie = self::serie($tipo);
            if (!$serie) throw new HttpError(400, 'Tipo de comprobante no válido');
            $rows = Db::query('SELECT id, estado_pedido, total, stock_descontado, cliente_id, cliente_nombre, telefono_destinatario FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            $p = $rows[0];
            if ($p['estado_pedido'] === 'cancelado') throw new HttpError(400, 'La venta está anulada');
            // Para emitir debe existir un nombre real o un teléfono del cliente
            $nomReal = Js::or(Js::trim(Js::or($b['razon_social'] ?? null, '')), Js::trim(Js::or($p['cliente_nombre'], '')));
            $tel = Js::or(Js::trim(Js::or($b['cliente_telefono'] ?? null, '')), Js::trim(Js::or($p['telefono_destinatario'], '')));
            if (Js::t($p['cliente_id'])) {
                $cl = Db::query('SELECT nombre, telefono FROM clientes WHERE id = ?', [$p['cliente_id']])[0] ?? null;
                if ($cl) {
                    if ($nomReal === '' || preg_match('/^cliente varios$/iu', $nomReal)) $nomReal = Js::trim(Js::or($cl['nombre'], ''));
                    if ($tel === '') $tel = Js::trim(Js::or($cl['telefono'], ''));
                }
            }
            if (preg_match('/^cliente varios$/iu', $nomReal)) $nomReal = '';
            if ($nomReal === '' && $tel === '') throw new HttpError(400, 'Para emitir el comprobante indica al menos el nombre o el teléfono del cliente.');
            $pg = Db::query('SELECT COALESCE(SUM(monto),0) AS pagado FROM pagos WHERE pedido_id = ?', [$id])[0];
            $saldoPend = self::r2(Js::num($p['total']) - Js::num($pg['pagado']));
            if ($saldoPend > 0.009) {
                throw new HttpError(400, 'El pedido debe estar cancelado (pagado en su totalidad) para generar un comprobante. Saldo pendiente: S/ ' . Js::toFixed($saldoPend, 2) . '.');
            }
            if (count(Db::query("SELECT id FROM comprobantes WHERE pedido_id = ? AND estado = 'emitido'", [$id]))) throw new HttpError(400, 'Esta venta ya tiene un comprobante emitido. Anúlalo para emitir otro.');

            $docNum = Js::trim(Js::or($b['doc_numero'] ?? null, ''));
            $razon = Js::slice(Js::trim(Js::or($b['razon_social'] ?? null, '')), 0, 150);
            $docTipo = null;
            if ($tipo === 'factura') {
                if (!preg_match('/^\d{11}$/', $docNum)) throw new HttpError(400, 'La factura requiere un RUC de 11 dígitos');
                if ($razon === '') throw new HttpError(400, 'La factura requiere la razón social');
                $docTipo = 'RUC';
            } elseif ($docNum !== '') {
                if (preg_match('/^\d{8}$/', $docNum)) $docTipo = 'DNI';
                elseif (preg_match('/^\d{11}$/', $docNum)) $docTipo = 'RUC';
                else throw new HttpError(400, 'El documento debe ser un DNI (8 dígitos) o RUC (11 dígitos)');
            }
            // Correlativo por serie, bloqueado para que dos usuarios no tomen el mismo número
            $nx = Db::query('SELECT COALESCE(MAX(numero),0) + 1 AS n FROM comprobantes WHERE serie = ? FOR UPDATE', [$serie])[0];
            $dir = Js::slice(Js::str(Js::or($b['direccion'] ?? null, '')), 0, 255);
            $r = Db::query("INSERT INTO comprobantes (pedido_id, tipo, serie, numero, doc_tipo, doc_numero, razon_social, direccion, usuario_id)\n       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                $id, $tipo, $serie, $nx['n'], $docTipo, $docNum !== '' ? $docNum : null, $razon !== '' ? $razon : null, $dir !== '' ? $dir : null, $this->userId(),
            ]);
            Db::query('UPDATE pedidos SET comprobante_borrador = NULL WHERE id = ?', [$id]);
            if ($docNum !== '') Db::query('UPDATE pedidos SET cliente_documento = ? WHERE id = ?', [$docNum, $id]);
            if (!Js::t($p['cliente_id'])) {
                if ($nomReal !== '') Db::query('UPDATE pedidos SET cliente_nombre = ? WHERE id = ?', [Js::slice($nomReal, 0, 120), $id]);
                if ($tel !== '' && !Js::t($p['telefono_destinatario'])) Db::query('UPDATE pedidos SET telefono_destinatario = ? WHERE id = ?', [Js::slice($tel, 0, 30), $id]);
            }
            // Al generar el comprobante la venta se contabiliza y se descuenta el stock
            if (!Js::t($p['stock_descontado'])) SalesStock::deductStock($id);
            Db::commit();
            return $this->json(['success' => true, 'message' => "Comprobante {$serie}-" . str_pad(Js::str($nx['n']), 6, '0', STR_PAD_LEFT) . ' generado', 'comprobanteId' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al generar el comprobante');
        }
    }

    public function annulComprobante($id, $cid)
    {
        try {
            Db::begin();
            $c = Db::query("SELECT id FROM comprobantes WHERE id = ? AND pedido_id = ? AND estado = 'emitido' FOR UPDATE", [$cid, $id]);
            if (!count($c)) throw new HttpError(400, 'El comprobante no existe o ya está anulado');
            Db::query("UPDATE comprobantes SET estado = 'anulado' WHERE id = ?", [$cid]);
            $ped = Db::query('SELECT stock_descontado FROM pedidos WHERE id = ?', [$id])[0] ?? null;
            if ($ped && Js::t($ped['stock_descontado'])) SalesStock::restoreStock($id);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Comprobante anulado; el pedido vuelve a editarse sin afectar el stock.']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al anular el comprobante');
        }
    }

    public function annulSale($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT id, estado_pedido, stock_descontado FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            $st = $rows[0]['estado_pedido'];
            if ($st === 'cancelado') throw new HttpError(400, 'La venta ya está anulada');
            if (in_array($st, ['en_ruta', 'entregado'], true)) throw new HttpError(400, 'El pedido ya salió a ruta o fue entregado; no se puede anular.');
            if (Js::t($rows[0]['stock_descontado'])) SalesStock::restoreStock($id);
            Db::query("UPDATE pedidos SET estado_pedido = 'cancelado' WHERE id = ?", [$id]);
            Db::query("UPDATE comprobantes SET estado = 'anulado' WHERE pedido_id = ? AND estado = 'emitido'", [$id]);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Venta anulada']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al anular la venta');
        }
    }

    public function updateSale($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT id, estado_pedido, stock_descontado FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            if ($rows[0]['estado_pedido'] === 'cancelado') throw new HttpError(400, 'La venta está anulada');
            if (count(Db::query("SELECT id FROM comprobantes WHERE pedido_id = ? AND estado = 'emitido'", [$id]))) throw new HttpError(400, 'Esta venta ya tiene un comprobante emitido y no se puede editar. Usa "Duplicar venta".');
            $b = $this->body();
            if (!Js::isArray($b['items'] ?? null) || count($b['items']) === 0) throw new HttpError(400, 'Agrega al menos un producto');
            $ids = [];
            foreach ($b['items'] as $i) { $n = Js::num(is_array($i) ? ($i['producto_id'] ?? null) : null); if (Js::t($n) && !in_array($n, $ids, true)) $ids[] = $n; }
            $prods = count($ids) ? Db::query('SELECT id FROM productos WHERE id IN (?)', [$ids]) : [];
            $prodIds = array_column($prods, 'id');
            $items = [];
            foreach ($b['items'] as $i) {
                if (!in_array(Js::num($i['producto_id'] ?? null), $prodIds, true)) throw new HttpError(400, 'Un producto ya no existe en el catálogo');
                $cn = Js::num($i['cantidad'] ?? null);
                $cantidad = Js::isNaN($cn) ? NAN : (is_float($cn) ? (int) floor($cn) : $cn);
                $precio = Js::num($i['precio_unitario'] ?? null);
                if (!($cantidad >= 1) || Js::isNaN($cantidad)) throw new HttpError(400, 'La cantidad debe ser al menos 1');
                if (!($precio >= 0) || Js::isNaN($precio)) throw new HttpError(400, 'El precio no puede ser negativo');
                $items[] = [
                    'producto_id' => Js::num($i['producto_id']), 'cantidad' => $cantidad, 'precio_unitario' => self::r2($precio),
                    'descuento' => max(0, Js::or(Js::num($i['descuento'] ?? null), 0)),
                    'detalles' => Js::slice(Js::str(Js::or($i['detalles_personalizacion'] ?? null, '')), 0, 255),
                    'proveedor_id' => Js::num($i['proveedor_id'] ?? null) > 0 ? Js::num($i['proveedor_id']) : null,
                    'lote_id' => Js::num($i['lote_id'] ?? null) > 0 ? Js::num($i['lote_id']) : null,
                ];
            }
            $d = Orders::normalizeDelivery($b);
            $ai = $b['aplicar_igv'] ?? null;
            $aplica = $ai === true || $ai === 1 || $ai === '1';
            $pct = 0;
            if ($aplica) {
                $cfg = Db::query('SELECT igv_porcentaje FROM cotizacion_config WHERE id = 1')[0] ?? null;
                $pct = Js::or(Js::num($cfg['igv_porcentaje'] ?? Js::undef()), 0);
            }
            $calc = Orders::calcLines($items, $b['descuento_global'] ?? null);
            $subtotal = $calc['subtotal'];
            $igv = $aplica ? self::r2($subtotal * $pct / 100) : 0;
            $total = self::r2($subtotal + $d['costo_envio'] + $igv);
            $pg = Db::query('SELECT COALESCE(SUM(monto),0) AS pagado FROM pagos WHERE pedido_id = ?', [$id])[0];
            if ($total < Js::num($pg['pagado']) - 0.009) {
                throw new HttpError(400, 'El nuevo total (S/ ' . Js::toFixed($total, 2) . ') es menor a lo ya pagado (S/ ' . Js::toFixed(Js::num($pg['pagado']), 2) . '). Ajusta los pagos primero.');
            }
            if (Js::t($rows[0]['stock_descontado'])) SalesStock::restoreStock($id, 'Ajuste por edición de venta');
            $nombre = Js::slice(Js::or(Js::trim(Js::or($b['cliente_nombre'] ?? null, '')), 'Cliente Varios'), 0, 120);
            $cdoc = Js::slice(Js::trim(Js::or($b['cliente_documento'] ?? null, '')), 0, 20);
            Db::query("\n      UPDATE pedidos SET\n        cliente_id = ?, cliente_nombre = ?, nombre_destinatario = ?, telefono_destinatario = ?, cliente_documento = ?,\n        tipo_entrega = ?, ciudad_envio = ?, fecha_entrega = ?, franja_horaria = ?, direccion_entrega = ?,\n        costo_envio = ?, cargos_json = ?, subtotal = ?, aplica_igv = ?, igv_porcentaje = ?, igv_monto = ?, total = ?,\n        notas_taller = ?, fecha_entrega_diseno = ?, descuento_global = ?\n      WHERE id = ?", [
                Js::t($b['cliente_id'] ?? null) ? Js::num($b['cliente_id']) : null, $nombre, $nombre,
                Js::slice(Js::str(Js::or($b['cliente_telefono'] ?? null, '')), 0, 30), $cdoc !== '' ? $cdoc : null,
                $d['tipo'], $d['ciudad'], $d['fecha'], $d['franja'], $d['direccion'],
                $d['costo_envio'], $d['cargos'] !== null ? Js::stringify($d['cargos']) : null, $subtotal, $aplica ? 1 : 0, $pct, $igv, $total,
                Js::slice(Js::str(Js::or($b['notas_taller'] ?? null, '')), 0, 2000),
                preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str(Js::or($b['fecha_entrega_diseno'] ?? null, ''))) ? Js::slice(Js::str($b['fecha_entrega_diseno']), 0, 10) : null,
                $calc['descGlobal'], $id,
            ]);
            Db::query('DELETE FROM pedido_detalles WHERE pedido_id = ?', [$id]);
            foreach ($calc['lines'] as $it) {
                Db::query("INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal, descuento, detalles_personalizacion, proveedor_id, lote_id)\n         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                    $id, $it['producto_id'], $it['cantidad'], $it['precio_unitario'], $it['neto'], $it['descuento'], $it['detalles'], $it['proveedor_id'], $it['lote_id'],
                ]);
            }
            $resumen = SalesStock::syncEstadoPago($id);
            Db::commit();
            return $this->json(array_merge(['success' => true, 'message' => 'Venta actualizada'], $resumen));
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al editar la venta');
        }
    }

    public function duplicateSale($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT * FROM pedidos WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Venta no encontrada');
            $p = $rows[0];
            $items = Db::query('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [$id]);
            $body = [
                'cliente' => Js::t($p['cliente_id']) ? ['id' => $p['cliente_id']] : null,
                'permitir_sin_cliente' => true,
                'cliente_nombre' => $p['cliente_nombre'],
                'cliente_documento' => $p['cliente_documento'],
                'telefono_destinatario' => $p['telefono_destinatario'],
                'tipo_entrega' => $p['tipo_entrega'],
                'ciudad_envio' => $p['ciudad_envio'],
                'fecha_entrega' => $p['fecha_entrega'],
                'fecha_entrega_diseno' => Js::t($p['fecha_entrega_diseno']) ? Js::slice(Js::str($p['fecha_entrega_diseno']), 0, 10) : null,
                'franja_horaria' => $p['franja_horaria'],
                'fecha_por_confirmar' => !Js::t($p['fecha_entrega']),
            ];
            if ($p['tipo_entrega'] === 'delivery') $body['direccion_entrega'] = $p['direccion_entrega'];
            if (Js::t($p['cargos_json'])) $body['cargos'] = Orders::parseCargos($p['cargos_json']);
            $body += [
                'costo_envio' => $p['costo_envio'],
                'metodo_pago' => $p['metodo_pago'],
                'notas_taller' => $p['notas_taller'],
                'aplicar_igv' => Js::t($p['aplica_igv']),
                'igv_porcentaje' => $p['igv_porcentaje'],
                'adelanto_tipo' => 'monto',
                'adelanto_valor' => 0,
                'descuento_global' => $p['descuento_global'],
                'items' => array_map(fn ($i) => ['producto_id' => $i['producto_id'], 'cantidad' => $i['cantidad'], 'precio_unitario' => $i['precio_unitario'], 'descuento' => $i['descuento'], 'detalles_personalizacion' => $i['detalles_personalizacion']], $items),
            ];
            $result = Orders::createOrderCore($body, $this->userId());
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Venta duplicada como un nuevo pedido', 'id' => $result['pedidoId'], 'numero_pedido' => $result['numero_pedido']], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al duplicar la venta');
        }
    }
}

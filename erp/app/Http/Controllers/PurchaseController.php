<?php

namespace App\Http\Controllers;

use App\Services\Kardex;
use App\Services\StockProv;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class PurchaseController extends Controller
{
    private const TIPOS = ['sin_comprobante', 'factura', 'boleta', 'nota_venta'];
    private const MOTIVOS = ['abastecimiento', 'regular', 'extraordinaria'];
    private const AFECTACIONES = ['gravado', 'exonerado', 'inafecto'];

    private static function r2($n) { return Js::roundTo($n, 2); }

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    private static function isDate($v): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str(Js::or($v, '')));
    }

    private static function estadoPago(array $c): string
    {
        if ($c['estado'] === 'anulada') return 'anulada';
        $mp = Js::num($c['monto_pagado']);
        return $mp >= Js::num($c['total']) - 0.009 ? 'pagado' : ($mp > 0 ? 'parcial' : 'pendiente');
    }

    public static function igvPct(): float|int
    {
        try {
            $cfg = Db::query('SELECT igv_porcentaje FROM cotizacion_config WHERE id = 1')[0] ?? null;
            $n = Js::num($cfg['igv_porcentaje'] ?? Js::undef());
            return $n > 0 ? $n : 18;
        } catch (\Throwable $e) {
            return 18;
        }
    }

    /** Líneas y totales (precio base antes de IGV; el IGV solo afecta a líneas "gravado") */
    private static function calc(array $items, $descuentoGlobal, $pct): array
    {
        $lines = [];
        foreach ($items as $i) {
            $cantidad = Js::num($i['cantidad']);
            $base = Js::num($i['precio_base']);
            $desc = self::r2(max(0, Js::or(Js::num($i['descuento'] ?? null), 0)));
            $neto = self::r2(max(0, $cantidad * $base - $desc));
            $igv = ($i['afectacion'] ?? null) === 'gravado' ? self::r2($neto * $pct / 100) : 0;
            $i['cantidad'] = $cantidad;
            $i['precio_base'] = $base;
            $i['descuento'] = $desc;
            $i['neto'] = $neto;
            $i['igv'] = $igv;
            $i['total'] = self::r2($neto + $igv);
            $lines[] = $i;
        }
        $acc = 0;
        foreach ($lines as $l) $acc = $acc + $l['neto'];
        $bruto = self::r2($acc);
        $dg = self::r2(min(max(0, Js::or(Js::num($descuentoGlobal), 0)), $bruto));
        $factor = $bruto > 0 ? ($bruto - $dg) / $bruto : 1;
        $subtotal = self::r2($bruto - $dg);
        $ig = 0;
        foreach ($lines as $l) $ig = $ig + $l['igv'];
        $igv = self::r2($ig * $factor);
        return ['lines' => $lines, 'descuento_global' => $dg, 'subtotal' => $subtotal, 'igv' => $igv, 'total' => self::r2($subtotal + $igv)];
    }

    /** Costo real por unidad: factura → sin IGV; boleta/nota/sin comprobante → lo pagado */
    private static function costoRealUnit($tipo, array $it, $cantidad)
    {
        return $cantidad > 0 ? self::r2(($tipo === 'factura' ? Js::num($it['neto_calc']) : Js::num($it['total'])) / $cantidad) : 0;
    }

    private static function applyStock($compraId, int $sign, $userId = null): void
    {
        $items = Db::query('SELECT producto_id, cantidad, neto_calc, igv, total, lote_codigo FROM (SELECT producto_id, cantidad, (total - igv) AS neto_calc, igv, total, lote_codigo FROM compra_detalles WHERE compra_id = ? AND producto_id IS NOT NULL) t', [$compraId]);
        $c = Db::query('SELECT codigo, serie, correlativo, proveedor_id, tipo_comprobante, fecha_emision FROM compras WHERE id = ?', [$compraId])[0] ?? null;
        $doc = ($c && Js::t($c['serie']) && Js::t($c['correlativo'])) ? "{$c['serie']}-{$c['correlativo']}" : ($c ? $c['codigo'] : null);
        $documento = Js::or($doc, 'COM-' . str_pad(Js::str($compraId), 6, '0', STR_PAD_LEFT));
        foreach ($items as $it) {
            $qty = Js::round(Js::num($it['cantidad']));
            if ($sign > 0) Db::query('UPDATE productos SET stock = stock + ? WHERE id = ?', [$qty, $it['producto_id']]);
            else Db::query('UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$qty, $it['producto_id']]);
            $costoReal = self::costoRealUnit($c ? $c['tipo_comprobante'] : null, $it, Js::num($it['cantidad']));
            if ($sign > 0) StockProv::addProv($it['producto_id'], $c ? $c['proveedor_id'] : null, $qty, $costoReal, ['compraId' => $compraId, 'codigo' => Js::or($it['lote_codigo'], $documento), 'fecha' => $c ? $c['fecha_emision'] : null]);
            else StockProv::takeFromCompra($it['producto_id'], $compraId, $qty);
            Kardex::logMovement(['producto_id' => $it['producto_id'], 'tipo' => $sign > 0 ? 'ingreso' : 'salida', 'cantidad' => $qty, 'motivo' => $sign > 0 ? 'Compra' : 'Anulación de compra', 'documento' => $documento, 'ref_tipo' => 'compra', 'ref_id' => $compraId]);
        }
    }

    public function searchSuppliers()
    {
        try {
            $s = '%' . Js::trim(Js::or($this->q('search'), '')) . '%';
            $rows = Db::query("SELECT id, nombre, tipo_documento, numero_documento, codigo FROM proveedores\n       WHERE estado = 1 AND (nombre LIKE ? OR numero_documento LIKE ? OR codigo LIKE ?) ORDER BY nombre LIMIT 15", [$s, $s, $s]);
            return $this->json(['success' => true, 'suppliers' => $rows]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al buscar proveedores');
        }
    }

    /** Alta rápida de proveedor desde Compras / Gastos */
    public function quickSupplier()
    {
        try {
            $b = $this->body();
            $nombre = Js::slice(Js::trim(Js::or($b['nombre'] ?? null, '')), 0, 120);
            if ($nombre === '') throw new HttpError(400, 'El nombre o razón social es obligatorio');
            $tipo = ($b['tipo_documento'] ?? null) === 'DNI' ? 'DNI' : 'RUC';
            $doc = preg_replace('/\s/u', '', Js::str(Js::or($b['numero_documento'] ?? null, '')));
            if ($doc !== '' && (($tipo === 'RUC' && !preg_match('/^\d{11}$/', $doc)) || ($tipo === 'DNI' && !preg_match('/^\d{8}$/', $doc)))) {
                throw new HttpError(400, $tipo === 'RUC' ? 'El RUC debe tener 11 dígitos' : 'El DNI debe tener 8 dígitos');
            }
            if ($doc !== '' && count(Db::query('SELECT id FROM proveedores WHERE numero_documento = ? LIMIT 1', [$doc]))) throw new HttpError(409, 'Ya existe un proveedor con ese documento');
            $num = Js::num(Db::query('SELECT COALESCE(MAX(id),0)+1 AS n FROM proveedores')[0]['n']);
            $codigo = '';
            for ($i = 0; $i < 1000; $i++, $num++) {
                $codigo = 'PRV-' . str_pad(Js::str($num), 6, '0', STR_PAD_LEFT);
                if (!count(Db::query('SELECT id FROM proveedores WHERE codigo = ?', [$codigo]))) break;
            }
            $r = Db::query('INSERT INTO proveedores (tipo_documento, numero_documento, nombre, codigo, estado) VALUES (?,?,?,?,1)', [$tipo, $doc !== '' ? $doc : null, $nombre, $codigo]);
            return $this->json(['success' => true, 'supplier' => ['id' => $r['insertId'], 'nombre' => $nombre, 'tipo_documento' => $tipo, 'numero_documento' => $doc !== '' ? $doc : null, 'codigo' => $codigo]], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al crear el proveedor');
        }
    }

    public function list()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $where = ['1=1'];
            $params = [];
            if (self::isDate($g('desde'))) { $where[] = 'DATE(c.created_at) >= ?'; $params[] = Js::slice(Js::str($g('desde')), 0, 10); }
            if (self::isDate($g('hasta'))) { $where[] = 'DATE(c.created_at) <= ?'; $params[] = Js::slice(Js::str($g('hasta')), 0, 10); }
            if (Js::t($g('search'))) {
                $s = '%' . Js::str($g('search')) . '%';
                $where[] = "(c.codigo LIKE ? OR c.serie LIKE ? OR c.correlativo LIKE ? OR CONCAT(c.serie, '-', c.correlativo) LIKE ? OR c.proveedor_nombre LIKE ? OR c.proveedor_documento LIKE ?)";
                array_push($params, $s, $s, $s, $s, $s, $s);
            }
            if (in_array($g('tipo'), self::TIPOS, true)) { $where[] = 'c.tipo_comprobante = ?'; $params[] = $g('tipo'); }
            if (in_array($g('motivo'), self::MOTIVOS, true)) { $where[] = 'c.motivo = ?'; $params[] = $g('motivo'); }
            if ($g('estado') === 'anulada') $where[] = "c.estado = 'anulada'";
            elseif ($g('estado') === 'registrada') $where[] = "c.estado = 'registrada'";
            $rows = Db::query('SELECT c.*, (SELECT COUNT(*) FROM compra_detalles d WHERE d.compra_id = c.id) AS items_count FROM compras c WHERE ' . implode(' AND ', $where) . ' ORDER BY c.id DESC LIMIT 1000', $params);
            $hoy = date('Y-m-d');
            $purchases = array_map(function ($c) use ($hoy) {
                $ep = self::estadoPago($c);
                $usd = $c['moneda'] === 'USD' && Js::num($c['tipo_cambio']) > 0;
                $pend = max(0, Js::num($c['total']) - Js::num($c['monto_pagado']));
                $c['total'] = Js::num($c['total']);
                $c['monto_pagado'] = Js::num($c['monto_pagado']);
                $c['estado_pago'] = $ep;
                $c['pendiente_moneda'] = self::r2($usd ? $pend / Js::num($c['tipo_cambio']) : $pend);
                $c['vencida'] = ($ep === 'pendiente' || $ep === 'parcial') && Js::t($c['fecha_vencimiento']) && strcmp(Js::slice(Js::str($c['fecha_vencimiento']), 0, 10), $hoy) < 0;
                return $c;
            }, $rows);
            if ($g('pago') === 'pagado' || $g('pago') === 'pendiente') {
                $purchases = array_values(array_filter($purchases, fn ($c) => $g('pago') === 'pagado' ? $c['estado_pago'] === 'pagado' : in_array($c['estado_pago'], ['pendiente', 'parcial'], true)));
            }
            $vivas = array_values(array_filter($purchases, fn ($c) => $c['estado'] !== 'anulada'));
            $counts = [
                'total' => count($purchases),
                'abastecimiento' => count(array_filter($vivas, fn ($c) => $c['motivo'] === 'abastecimiento')),
                'regular' => count(array_filter($vivas, fn ($c) => $c['motivo'] === 'regular')),
                'extraordinaria' => count(array_filter($vivas, fn ($c) => $c['motivo'] === 'extraordinaria')),
            ];
            $soles = array_filter($vivas, fn ($c) => $c['moneda'] !== 'USD');
            $dolares = array_filter($vivas, fn ($c) => $c['moneda'] === 'USD');
            $sum = function ($arr, $f) { $a = 0; foreach ($arr as $c) $a = $a + $f($c); return $a; };
            $totals = [
                'monto' => self::r2($sum($vivas, fn ($c) => $c['total'])),
                'por_pagar' => self::r2($sum($vivas, fn ($c) => max(0, $c['total'] - $c['monto_pagado']))),
                'monto_pen' => self::r2($sum($soles, fn ($c) => $c['total'])),
                'por_pagar_pen' => self::r2($sum($soles, fn ($c) => max(0, $c['total'] - $c['monto_pagado']))),
                'monto_usd' => self::r2($sum($dolares, fn ($c) => Js::num(Js::or($c['total_moneda'], 0)))),
                'por_pagar_usd' => self::r2($sum($dolares, fn ($c) => $c['pendiente_moneda'])),
            ];
            return $this->json(['success' => true, 'purchases' => $purchases, 'counts' => $counts, 'totals' => $totals]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener compras');
        }
    }

    public function getOne($id)
    {
        try {
            $rows = Db::query('SELECT * FROM compras WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Compra no encontrada');
            $p = $rows[0];
            $p['estado_pago'] = self::estadoPago($p);
            $p['items'] = Db::query('SELECT * FROM compra_detalles WHERE compra_id = ? ORDER BY id', [$id]);
            return $this->json(['success' => true, 'purchase' => $p]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la compra');
        }
    }

    public function create()
    {
        try {
            $b = $this->body();
            $v = fn ($k) => $b[$k] ?? null;
            $tipo = in_array($v('tipo_comprobante'), self::TIPOS, true) ? $b['tipo_comprobante'] : 'sin_comprobante';
            $motivo = in_array($v('motivo'), self::MOTIVOS, true) ? $b['motivo'] : 'abastecimiento';
            $serie = Js::slice(mb_strtoupper(Js::trim(Js::or($v('serie'), ''))), 0, 10);
            $correlativo = Js::slice(Js::trim(Js::or($v('correlativo'), '')), 0, 20);
            if ($tipo !== 'sin_comprobante' && ($serie === '' || $correlativo === '')) throw new HttpError(400, 'Ingresa la serie y el correlativo del comprobante');
            if (!self::isDate($v('fecha_emision'))) throw new HttpError(400, 'Indica la fecha de emisión de la compra');
            if (!Js::isArray($v('items')) || !count($b['items'])) throw new HttpError(400, 'Agrega al menos un producto a la compra');

            Db::begin();
            $pct = self::igvPct();
            $pn = Js::slice(Js::trim(Js::or($v('proveedor_nombre'), '')), 0, 150);
            $prov = ['id' => null, 'nombre' => $pn !== '' ? $pn : null, 'doc' => null];
            if (Js::t($v('proveedor_id'))) {
                $p = Db::query('SELECT id, nombre, numero_documento FROM proveedores WHERE id = ?', [Js::num($b['proveedor_id'])]);
                if (!count($p)) throw new HttpError(400, 'El proveedor seleccionado ya no existe');
                $prov = ['id' => $p[0]['id'], 'nombre' => $p[0]['nombre'], 'doc' => Js::or($p[0]['numero_documento'], null)];
            }
            if ($tipo !== 'sin_comprobante' && Js::t($prov['id'])) {
                $dup = Db::query("SELECT codigo FROM compras WHERE tipo_comprobante = ? AND serie = ? AND correlativo = ? AND proveedor_id = ? AND estado != 'anulada' LIMIT 1", [$tipo, $serie, $correlativo, $prov['id']]);
                if (count($dup)) throw new HttpError(409, "Ya registraste ese comprobante de este proveedor ({$dup[0]['codigo']})");
            }
            $items = [];
            foreach ($b['items'] as $raw) {
                $cantidad = Js::num($raw['cantidad'] ?? null);
                $precio = Js::num($raw['precio_base'] ?? null);
                $nombre = Js::slice(Js::trim(Js::or($raw['nombre'] ?? null, '')), 0, 150);
                if ($nombre === '') throw new HttpError(400, 'Todos los ítems deben tener nombre');
                if (!($cantidad > 0) || Js::isNaN($cantidad)) throw new HttpError(400, "La cantidad de \"{$nombre}\" debe ser mayor a 0");
                if (!($precio >= 0) || Js::isNaN($precio)) throw new HttpError(400, "El precio de \"{$nombre}\" no es válido");
                $productoId = null;
                $codigo = Js::orNull(Js::slice(Js::trim(Js::or($raw['codigo'] ?? null, '')), 0, 40));
                if (Js::t($raw['producto_id'] ?? null)) {
                    $pr = Db::query('SELECT id, codigo FROM productos WHERE id = ?', [Js::num($raw['producto_id'])]);
                    if (!count($pr)) throw new HttpError(400, "El producto \"{$nombre}\" ya no existe en el catálogo");
                    $productoId = $pr[0]['id'];
                    $codigo = Js::or($pr[0]['codigo'], $codigo);
                }
                $items[] = [
                    'producto_id' => $productoId, 'codigo' => $codigo, 'nombre' => $nombre, 'cantidad' => $cantidad, 'precio_base' => $precio,
                    'lote_codigo' => Js::orNull(Js::slice(Js::trim(Js::or($raw['lote'] ?? null, '')), 0, 40)),
                    'afectacion' => in_array($raw['afectacion'] ?? null, self::AFECTACIONES, true) ? $raw['afectacion'] : 'gravado',
                    'descuento' => $raw['descuento'] ?? null,
                ];
            }
            // Dólares: los precios se capturan en USD y se guardan convertidos a soles
            $moneda = $v('moneda') === 'USD' ? 'USD' : 'PEN';
            $tc = $moneda === 'USD' ? Js::num($v('tipo_cambio')) : null;
            if ($moneda === 'USD' && (!($tc > 0) || Js::isNaN($tc))) throw new HttpError(400, 'Indica el tipo de cambio de la compra en dólares');
            $totalMoneda = null;
            $dgInput = $v('descuento_global');
            if ($moneda === 'USD') {
                $totalMoneda = self::calc($items, $v('descuento_global'), $pct)['total'];
                foreach ($items as &$i) {
                    $i['precio_base'] = Js::num($i['precio_base']) * $tc;
                    $i['descuento'] = Js::or(Js::num($i['descuento']), 0) * $tc;
                }
                unset($i);
                $dgInput = Js::or(Js::num($v('descuento_global')), 0) * $tc;
            }
            $t = self::calc($items, $dgInput, $pct);
            $condicion = $v('condicion_pago') === 'pagado' ? 'pagado' : 'por_pagar';
            $ia = $b['ingreso_almacen'] ?? Js::undef();
            $ingreso = ($ia === false || $ia === 0 || $ia === '0') ? 0 : 1;
            $obs = Js::slice(Js::str(Js::or($v('observaciones'), '')), 0, 2000);
            $ref = Js::slice(Js::str(Js::or($v('referencia'), '')), 0, 80);
            $guia = Js::slice(Js::str(Js::or($v('guia_remision'), '')), 0, 40);
            $r = Db::query("INSERT INTO compras (tipo_comprobante, serie, correlativo, fecha_emision, proveedor_id, proveedor_nombre, proveedor_documento,\n         almacen, motivo, ingreso_almacen, observaciones, referencia, guia_remision, fecha_vencimiento,\n         descuento_global, subtotal, igv, total, monto_pagado, usuario_id, moneda, tipo_cambio, total_moneda)\n       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                $tipo, $serie !== '' ? $serie : null, $correlativo !== '' ? $correlativo : null, Js::slice(Js::str($v('fecha_emision')), 0, 10), $prov['id'], $prov['nombre'], $prov['doc'],
                Js::slice(Js::str(Js::or($v('almacen'), 'ALMACÉN PRINCIPAL')), 0, 60), $motivo, $ingreso,
                $obs !== '' ? $obs : null, $ref !== '' ? $ref : null, $guia !== '' ? $guia : null,
                self::isDate($v('fecha_vencimiento')) ? Js::slice(Js::str($v('fecha_vencimiento')), 0, 10) : null,
                $t['descuento_global'], $t['subtotal'], $t['igv'], $t['total'], $condicion === 'pagado' ? $t['total'] : 0, $this->userId(), $moneda, $tc, $totalMoneda,
            ]);
            $id = $r['insertId'];
            $codigo = 'COM-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
            Db::query('UPDATE compras SET codigo = ? WHERE id = ?', [$codigo, $id]);
            foreach ($t['lines'] as $l) {
                Db::query("INSERT INTO compra_detalles (compra_id, producto_id, codigo, nombre, cantidad, precio_base, afectacion, descuento, igv, total, lote_codigo)\n         VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
                    $id, $l['producto_id'], $l['codigo'], $l['nombre'], $l['cantidad'], $l['precio_base'], $l['afectacion'], $l['descuento'], $l['igv'], $l['total'], Js::or($l['lote_codigo'], null),
                ]);
            }
            // La última compra actualiza el costo del producto
            if (Js::t($v('actualizar_costo'))) {
                foreach ($t['lines'] as $l) {
                    if (!Js::t($l['producto_id']) || !($l['cantidad'] > 0)) continue;
                    $cu = $tipo === 'factura' ? self::r2($l['neto'] / $l['cantidad']) : self::r2($l['total'] / $l['cantidad']);
                    Db::query('UPDATE productos SET precio_costo = ? WHERE id = ?', [$cu, $l['producto_id']]);
                }
            }
            if ($ingreso) {
                self::applyStock($id, 1);
                Db::query('UPDATE compras SET stock_ingresado = 1 WHERE id = ?', [$id]);
            }
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Compra registrada', 'id' => $id, 'codigo' => $codigo, 'total' => $t['total']], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al registrar la compra');
        }
    }

    public function addPayment($id)
    {
        try {
            $rows = Db::query('SELECT * FROM compras WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Compra no encontrada');
            $c = $rows[0];
            if ($c['estado'] === 'anulada') throw new HttpError(400, 'La compra está anulada');
            $saldo = self::r2(Js::num($c['total']) - Js::num($c['monto_pagado']));
            $tc = ($c['moneda'] === 'USD' && Js::num($c['tipo_cambio']) > 0) ? Js::num($c['tipo_cambio']) : 1;
            $b = $this->body();
            $monto = (!array_key_exists('monto', $b) || $b['monto'] === '') ? $saldo : self::r2(Js::num($b['monto']) * $tc);
            if (!($monto > 0) || Js::isNaN($monto)) throw new HttpError(400, 'Ingresa un monto válido');
            if ($monto > $saldo + 0.009) throw new HttpError(400, 'El monto supera el saldo pendiente (' . ($tc === 1 ? 'S/ ' . Js::toFixed($saldo, 2) : '$ ' . Js::toFixed($saldo / $tc, 2)) . ')');
            Db::query('UPDATE compras SET monto_pagado = monto_pagado + ? WHERE id = ?', [$monto, $id]);
            return $this->json(['success' => true, 'message' => 'Pago registrado']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al registrar el pago');
        }
    }

    public function annul($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT * FROM compras WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Compra no encontrada');
            if ($rows[0]['estado'] === 'anulada') throw new HttpError(400, 'La compra ya está anulada');
            if (Js::t($rows[0]['stock_ingresado'])) self::applyStock($id, -1);
            Db::query("UPDATE compras SET estado = 'anulada', stock_ingresado = 0 WHERE id = ?", [$id]);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Compra anulada' . (Js::t($rows[0]['stock_ingresado']) ? ' y stock revertido' : '')]);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al anular la compra');
        }
    }
}

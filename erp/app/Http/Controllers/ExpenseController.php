<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class ExpenseController extends Controller
{
    private const TIPOS = ['sin_comprobante', 'recibo', 'boleta', 'factura', 'ticket', 'planilla', 'recibo_honorarios'];
    private const METODOS = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'caja_general'];
    private const PREFIJO = 'EG10';

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

    public function nextCode()
    {
        try {
            $r = Db::query('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM gastos')[0];
            return $this->json(['success' => true, 'codigo' => self::PREFIJO . '-' . $r['n']]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener el código');
        }
    }

    public function list()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $where = ['1=1'];
            $params = [];
            if (self::isDate($g('desde'))) { $where[] = 'g.fecha_emision >= ?'; $params[] = Js::slice(Js::str($g('desde')), 0, 10); }
            if (self::isDate($g('hasta'))) { $where[] = 'g.fecha_emision <= ?'; $params[] = Js::slice(Js::str($g('hasta')), 0, 10); }
            if (Js::t($g('motivo'))) { $where[] = 'g.motivo = ?'; $params[] = Js::slice(Js::str($g('motivo')), 0, 40); }
            if ($g('estado') === 'anulado' || $g('estado') === 'registrado') { $where[] = 'g.estado = ?'; $params[] = $g('estado'); }
            if (Js::t($g('search'))) {
                $s = '%' . Js::str($g('search')) . '%';
                $where[] = '(g.codigo LIKE ? OR g.proveedor_nombre LIKE ? OR g.proveedor_documento LIKE ? OR g.serie LIKE ? OR g.correlativo LIKE ? OR EXISTS (SELECT 1 FROM gasto_detalles d WHERE d.gasto_id = g.id AND d.descripcion LIKE ?))';
                array_push($params, $s, $s, $s, $s, $s, $s);
            }
            $rows = Db::query("SELECT g.*, (SELECT COUNT(*) FROM gasto_detalles d WHERE d.gasto_id = g.id) AS detalles_count,\n              (SELECT GROUP_CONCAT(DISTINCT p.metodo SEPARATOR ',') FROM gasto_pagos p WHERE p.gasto_id = g.id) AS metodos\n       FROM gastos g WHERE " . implode(' AND ', $where) . ' ORDER BY g.fecha_emision DESC, g.id DESC LIMIT 1000', $params);
            $vivos = array_values(array_filter($rows, fn ($x) => $x['estado'] !== 'anulado'));
            $porMotivo = new \stdClass();
            foreach ($vivos as $x) {
                $k = (string) $x['motivo'];
                $porMotivo->$k = self::r2(($porMotivo->$k ?? 0) + Js::num($x['total']));
            }
            $tot = 0;
            $usd = 0;
            foreach ($vivos as $x) {
                $tot = $tot + Js::num($x['total']);
                if ($x['moneda'] === 'USD') $usd = $usd + Js::num(Js::or($x['total_moneda'], 0));
            }
            return $this->json([
                'success' => true,
                'expenses' => array_map(function ($x) { $x['total'] = Js::num($x['total']); return $x; }, $rows),
                'totals' => ['total' => self::r2($tot), 'total_usd' => self::r2($usd), 'cantidad' => count($vivos), 'por_motivo' => $porMotivo],
            ]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener los gastos');
        }
    }

    public function getOne($id)
    {
        try {
            $rows = Db::query('SELECT * FROM gastos WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Gasto no encontrado');
            $x = $rows[0];
            $x['detalles'] = Db::query('SELECT * FROM gasto_detalles WHERE gasto_id = ? ORDER BY id', [$id]);
            $x['pagos'] = Db::query('SELECT * FROM gasto_pagos WHERE gasto_id = ? ORDER BY id', [$id]);
            return $this->json(['success' => true, 'expense' => $x]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener el gasto');
        }
    }

    private function persist($editId)
    {
        try {
            $b = $this->body();
            $v = fn ($k) => $b[$k] ?? null;
            if (!self::isDate($v('fecha_emision'))) throw new HttpError(400, 'Indica la fecha de emisión del gasto');
            $detalles = [];
            foreach ((Js::isArray($v('detalles')) ? $b['detalles'] : []) as $d) {
                $x = ['descripcion' => Js::slice(Js::trim(Js::or(is_array($d) ? ($d['descripcion'] ?? null) : null, '')), 0, 200), 'importe' => Js::num(is_array($d) ? ($d['importe'] ?? null) : Js::undef())];
                if ($x['descripcion'] !== '' || Js::t($x['importe'])) $detalles[] = $x;
            }
            if (!count($detalles)) throw new HttpError(400, 'Agrega al menos un detalle del gasto');
            foreach ($detalles as $d) {
                if ($d['descripcion'] === '' || !($d['importe'] > 0) || Js::isNaN($d['importe'])) throw new HttpError(400, 'Cada detalle necesita una descripción y un importe mayor a 0');
            }
            $moneda = $v('moneda') === 'USD' ? 'USD' : 'PEN';
            $tc = $moneda === 'USD' ? Js::num($v('tipo_cambio')) : null;
            if ($moneda === 'USD' && (!($tc > 0) || Js::isNaN($tc))) throw new HttpError(400, 'Indica el tipo de cambio');
            $acc = 0;
            foreach ($detalles as $d) $acc = $acc + $d['importe'];
            $totalMoneda = self::r2($acc);
            $total = $moneda === 'USD' ? self::r2($totalMoneda * $tc) : $totalMoneda;
            $tipo = in_array($v('tipo_comprobante'), self::TIPOS, true) ? $b['tipo_comprobante'] : 'sin_comprobante';
            $serie = Js::orNull(Js::slice(mb_strtoupper(Js::trim(Js::or($v('serie'), ''))), 0, 10));
            $correlativo = Js::orNull(Js::slice(Js::trim(Js::or($v('correlativo'), '')), 0, 20));
            $pagos = [];
            foreach ((Js::isArray($v('pagos')) ? $b['pagos'] : []) as $p) {
                $p = is_array($p) ? $p : [];
                $x = [
                    'metodo' => in_array($p['metodo'] ?? null, self::METODOS, true) ? $p['metodo'] : 'efectivo',
                    'origen' => Js::orNull(Js::slice(Js::trim(Js::or($p['origen'] ?? null, '')), 0, 60)),
                    'referencia' => Js::orNull(Js::slice(Js::trim(Js::or($p['referencia'] ?? null, '')), 0, 80)),
                    'monto' => Js::num($p['monto'] ?? Js::undef()),
                ];
                if ($x['monto'] > 0) $pagos[] = $x;
            }
            $pg = 0;
            foreach ($pagos as $p) $pg = $pg + ($moneda === 'USD' ? $p['monto'] * $tc : $p['monto']);
            $pagado = self::r2($pg);
            if (count($pagos) && $pagado > $total + 0.01) throw new HttpError(400, 'Los pagos superan el total del gasto');

            Db::begin();
            $pn = Js::slice(Js::trim(Js::or($v('proveedor_nombre'), '')), 0, 150);
            $prov = ['id' => null, 'nombre' => $pn !== '' ? $pn : null, 'doc' => null];
            if (Js::t($v('proveedor_id'))) {
                $p = Db::query('SELECT id, nombre, numero_documento FROM proveedores WHERE id = ?', [Js::num($b['proveedor_id'])]);
                if (!count($p)) throw new HttpError(400, 'El proveedor seleccionado ya no existe');
                $prov = ['id' => $p[0]['id'], 'nombre' => $p[0]['nombre'], 'doc' => Js::or($p[0]['numero_documento'], null)];
            }
            $motivo = Js::or(Js::slice(Js::trim(Js::or($v('motivo'), 'varios')), 0, 40), 'varios');
            $obs = Js::orNull(Js::slice(Js::str(Js::or($v('observaciones'), '')), 0, 2000));
            if (Js::t($editId)) {
                $ex = Db::query('SELECT id, codigo, estado FROM gastos WHERE id = ? FOR UPDATE', [$editId]);
                if (!count($ex)) throw new HttpError(404, 'Gasto no encontrado');
                if ($ex[0]['estado'] === 'anulado') throw new HttpError(400, 'No se puede editar un gasto anulado');
                $id = $ex[0]['id'];
                $codigo = $ex[0]['codigo'];
                Db::query("UPDATE gastos SET proveedor_id=?, proveedor_nombre=?, proveedor_documento=?, motivo=?, tipo_comprobante=?, serie=?, correlativo=?, fecha_emision=?,\n           moneda=?, tipo_cambio=?, total=?, total_moneda=?, observaciones=? WHERE id = ?", [
                    $prov['id'], $prov['nombre'], $prov['doc'], $motivo, $tipo, $serie, $correlativo, Js::slice(Js::str($v('fecha_emision')), 0, 10),
                    $moneda, $tc, $total, $moneda === 'USD' ? $totalMoneda : null, $obs, $id,
                ]);
                Db::query('DELETE FROM gasto_detalles WHERE gasto_id = ?', [$id]);
                Db::query('DELETE FROM gasto_pagos WHERE gasto_id = ?', [$id]);
            } else {
                $r = Db::query("INSERT INTO gastos (proveedor_id, proveedor_nombre, proveedor_documento, motivo, tipo_comprobante, serie, correlativo, fecha_emision,\n           moneda, tipo_cambio, total, total_moneda, observaciones, usuario_id)\n         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                    $prov['id'], $prov['nombre'], $prov['doc'], $motivo, $tipo, $serie, $correlativo, Js::slice(Js::str($v('fecha_emision')), 0, 10),
                    $moneda, $tc, $total, $moneda === 'USD' ? $totalMoneda : null, $obs, $this->userId(),
                ]);
                $id = $r['insertId'];
                $codigo = self::PREFIJO . '-' . $id;
                Db::query('UPDATE gastos SET codigo = ? WHERE id = ?', [$codigo, $id]);
            }
            foreach ($detalles as $d) Db::query('INSERT INTO gasto_detalles (gasto_id, descripcion, importe) VALUES (?,?,?)', [$id, $d['descripcion'], $d['importe']]);
            foreach ($pagos as $p) Db::query('INSERT INTO gasto_pagos (gasto_id, metodo, origen, referencia, monto) VALUES (?,?,?,?,?)', [$id, $p['metodo'], $p['origen'], $p['referencia'], $p['monto']]);
            Db::commit();
            return $this->json(['success' => true, 'message' => Js::t($editId) ? 'Gasto actualizado' : 'Gasto registrado', 'id' => $id, 'codigo' => $codigo, 'total' => $total], Js::t($editId) ? 200 : 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al registrar el gasto');
        }
    }

    public function create() { return $this->persist(null); }

    public function update($id) { return $this->persist(Js::num($id)); }

    public function annul($id)
    {
        try {
            $rows = Db::query('SELECT estado FROM gastos WHERE id = ?', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Gasto no encontrado');
            if ($rows[0]['estado'] === 'anulado') throw new HttpError(400, 'El gasto ya está anulado');
            Db::query("UPDATE gastos SET estado = 'anulado' WHERE id = ?", [$id]);
            return $this->json(['success' => true, 'message' => 'Gasto anulado']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al anular el gasto');
        }
    }
}

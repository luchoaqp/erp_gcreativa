<?php

namespace App\Http\Controllers;

use App\Services\Kardex;
use App\Services\StockProv;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * Salidas de inventario (merma, fallados, errores de producción, muestras…).
 * Descuentan stock de los lotes (FIFO), quedan en el Kardex con su motivo y guardan el costo perdido.
 * No se editan: si algo salió mal se anula (el stock vuelve a sus lotes) y se registra de nuevo.
 */
class InventoryExitController extends Controller
{
    public const MOTIVOS = [
        'merma' => 'Merma',
        'fallado' => 'Producto fallado',
        'produccion' => 'Error de producción',
        'muestra' => 'Muestra / uso interno',
        'vencido' => 'Dañado / vencido',
        'otro' => 'Otro',
    ];
    private const PREFIJO = 'SI';

    private static function r2($n) { return Js::roundTo($n, 2); }

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    private static function isDate($v): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', Js::slice(Js::str(Js::or($v, '')), 0, 10));
    }

    /** Costo perdido en salidas de inventario en un rango de fechas (para la utilidad neta) */
    public static function costoEntre(string $desde, string $hasta): float
    {
        try {
            $r = Db::query("SELECT COALESCE(SUM(total_costo), 0) AS t FROM inventario_salidas WHERE estado != 'anulado' AND fecha BETWEEN ? AND ?", [$desde, $hasta]);
            return (float) Js::num($r[0]['t'] ?? 0);
        } catch (\Throwable $e) {
            return 0.0; // la tabla aún no existe
        }
    }

    public function nextCode()
    {
        try {
            $r = Db::query('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM inventario_salidas')[0];
            return $this->json(['success' => true, 'codigo' => self::PREFIJO . '-' . str_pad((string) $r['n'], 4, '0', STR_PAD_LEFT), 'motivos' => self::MOTIVOS]);
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
            if (self::isDate($g('desde'))) { $where[] = 's.fecha >= ?'; $params[] = Js::slice(Js::str($g('desde')), 0, 10); }
            if (self::isDate($g('hasta'))) { $where[] = 's.fecha <= ?'; $params[] = Js::slice(Js::str($g('hasta')), 0, 10); }
            if (Js::t($g('motivo'))) { $where[] = 's.motivo = ?'; $params[] = Js::slice(Js::str($g('motivo')), 0, 30); }
            if (Js::t($g('search'))) {
                $s = '%' . Js::str($g('search')) . '%';
                $where[] = '(s.codigo LIKE ? OR s.nota LIKE ? OR EXISTS (SELECT 1 FROM inventario_salida_items i JOIN productos p ON p.id = i.producto_id WHERE i.salida_id = s.id AND (p.nombre LIKE ? OR p.codigo LIKE ?)))';
                array_push($params, $s, $s, $s, $s);
            }
            $rows = Db::query("SELECT s.*, u.nombre AS usuario_nombre,
                    (SELECT GROUP_CONCAT(CONCAT(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM i.cantidad)), ' × ', p.nombre) ORDER BY i.id SEPARATOR ' · ')
                       FROM inventario_salida_items i JOIN productos p ON p.id = i.producto_id WHERE i.salida_id = s.id) AS resumen
                FROM inventario_salidas s LEFT JOIN usuarios u ON u.id = s.usuario_id
                WHERE " . implode(' AND ', $where) . ' ORDER BY s.fecha DESC, s.id DESC LIMIT 1000', $params);
            $porMotivo = new \stdClass();
            $tot = 0;
            $n = 0;
            foreach ($rows as &$x) {
                $x['total_costo'] = Js::num($x['total_costo']);
                if ($x['estado'] === 'anulado') continue;
                $k = (string) $x['motivo'];
                $porMotivo->$k = self::r2(($porMotivo->$k ?? 0) + $x['total_costo']);
                $tot += $x['total_costo'];
                $n++;
            }
            unset($x);
            return $this->json(['success' => true, 'salidas' => $rows, 'motivos' => self::MOTIVOS,
                'totals' => ['total' => self::r2($tot), 'cantidad' => $n, 'por_motivo' => $porMotivo]]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener las salidas');
        }
    }

    public function getOne($id)
    {
        try {
            $s = Db::first('SELECT s.*, u.nombre AS usuario_nombre FROM inventario_salidas s LEFT JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ?', [$id]);
            if (!$s) throw new HttpError(404, 'Salida no encontrada');
            $s['items'] = Db::query('SELECT i.id, i.producto_id, i.cantidad, i.costo_unit, p.codigo, p.nombre, p.unidad
                FROM inventario_salida_items i JOIN productos p ON p.id = i.producto_id WHERE i.salida_id = ? ORDER BY i.id', [$id]);
            return $this->json(['success' => true, 'salida' => $s]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la salida');
        }
    }

    public function create()
    {
        try {
            $b = $this->body();
            $fecha = Js::slice(Js::str($b['fecha'] ?? ''), 0, 10);
            if (!self::isDate($fecha)) throw new HttpError(400, 'Indica la fecha de la salida');
            if ($fecha > date('Y-m-d')) throw new HttpError(400, 'La fecha no puede ser futura');
            $motivo = (string) ($b['motivo'] ?? '');
            if (!array_key_exists($motivo, self::MOTIVOS)) throw new HttpError(400, 'Elige el motivo de la salida');
            $nota = Js::orNull(Js::slice(Js::trim(Js::or($b['nota'] ?? null, '')), 0, 1000));
            if ($motivo === 'otro' && !$nota) throw new HttpError(400, 'Con el motivo «Otro», explica en el detalle qué pasó');

            // Junta las líneas del mismo producto
            $items = [];
            foreach ((is_array($b['items'] ?? null) ? $b['items'] : []) as $it) {
                $pid = (int) ($it['producto_id'] ?? 0);
                $cant = Js::num($it['cantidad'] ?? null);
                if (!$pid) continue;
                if (!($cant > 0) || Js::isNaN($cant) || floor($cant) != $cant) throw new HttpError(400, 'Cada producto necesita una cantidad entera mayor a 0');
                $items[$pid] = ($items[$pid] ?? 0) + $cant;
            }
            if (!$items) throw new HttpError(400, 'Agrega al menos un producto');

            Db::begin();
            $prods = [];
            foreach ($items as $pid => $cant) {
                $p = Db::first('SELECT id, nombre, stock, es_pack, activo FROM productos WHERE id = ? FOR UPDATE', [$pid]);
                if (!$p) throw new HttpError(400, 'Uno de los productos ya no existe');
                if ((int) $p['es_pack']) throw new HttpError(400, "«{$p['nombre']}» es un pack: registra la salida de los productos que lleva");
                if ($cant > Js::num($p['stock']) + 0.0001) throw new HttpError(400, "«{$p['nombre']}» solo tiene " . (0 + Js::num($p['stock'])) . ' en stock');
                $prods[$pid] = $p;
            }
            $codigo = self::PREFIJO . '-' . str_pad((string) ((int) Db::query('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM inventario_salidas')[0]['n']), 4, '0', STR_PAD_LEFT);
            $r = Db::query('INSERT INTO inventario_salidas (codigo, fecha, motivo, nota, usuario_id) VALUES (?,?,?,?,?)', [$codigo, $fecha, $motivo, $nota, $this->userId()]);
            $sid = $r['insertId'];
            $total = 0;
            foreach ($items as $pid => $cant) {
                Db::query('UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ?', [$cant, $pid]);
                $t = StockProv::takeProv($pid, $cant);
                $lotes = array_values(array_filter(array_map(fn ($a) => $a['lote_id'] ? ['lote_id' => $a['lote_id'], 'proveedor_id' => $a['proveedor_id'], 'cantidad' => $a['cantidad'], 'costo_unit' => $a['costo_unit']] : null, $t['allocations'])));
                Db::query('INSERT INTO inventario_salida_items (salida_id, producto_id, cantidad, costo_unit, lotes_json) VALUES (?,?,?,?,?)', [$sid, $pid, $cant, $t['costo_unit'], json_encode($lotes)]);
                $total += $cant * $t['costo_unit'];
                Kardex::logMovement(['producto_id' => $pid, 'tipo' => 'salida', 'cantidad' => $cant, 'motivo' => self::MOTIVOS[$motivo], 'documento' => $codigo, 'ref_tipo' => 'salida_inv', 'ref_id' => $sid, 'usuario_id' => $this->userId()]);
            }
            Db::query('UPDATE inventario_salidas SET total_costo = ? WHERE id = ?', [self::r2($total), $sid]);
            Db::commit();
            return $this->json(['success' => true, 'message' => "Salida {$codigo} registrada", 'codigo' => $codigo, 'id' => $sid], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al registrar la salida');
        }
    }

    /** Anula la salida: el stock vuelve a los lotes de los que salió */
    public function annul($id)
    {
        try {
            Db::begin();
            $s = Db::first('SELECT id, codigo, estado FROM inventario_salidas WHERE id = ? FOR UPDATE', [$id]);
            if (!$s) throw new HttpError(404, 'Salida no encontrada');
            if ($s['estado'] === 'anulado') throw new HttpError(400, 'La salida ya está anulada');
            foreach (Db::query('SELECT producto_id, cantidad, costo_unit, lotes_json FROM inventario_salida_items WHERE salida_id = ?', [$id]) as $it) {
                $cant = Js::num($it['cantidad']);
                Db::query('UPDATE productos SET stock = stock + ? WHERE id = ?', [$cant, $it['producto_id']]);
                $lotes = json_decode((string) $it['lotes_json'], true) ?: [];
                $devuelto = 0;
                foreach ($lotes as $l) {
                    StockProv::addProv($it['producto_id'], $l['proveedor_id'], $l['cantidad'], $l['costo_unit'], ['loteId' => $l['lote_id']]);
                    $devuelto += Js::num($l['cantidad']);
                }
                if ($cant - $devuelto > 0.0001) StockProv::addProv($it['producto_id'], 0, $cant - $devuelto, Js::num($it['costo_unit']));
                Kardex::logMovement(['producto_id' => $it['producto_id'], 'tipo' => 'ingreso', 'cantidad' => $cant, 'motivo' => 'Anulación de salida', 'documento' => $s['codigo'], 'ref_tipo' => 'salida_inv', 'ref_id' => $id, 'usuario_id' => $this->userId()]);
            }
            Db::query("UPDATE inventario_salidas SET estado = 'anulado' WHERE id = ?", [$id]);
            Db::commit();
            return $this->json(['success' => true, 'message' => "Salida {$s['codigo']} anulada: el stock volvió a sus lotes"]);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al anular la salida');
        }
    }
}

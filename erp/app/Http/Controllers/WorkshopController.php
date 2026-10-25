<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/** Máquinas del taller (impresoras, plotter, sublimadoras...) y su historial de mantenimiento */
class WorkshopController extends Controller
{
    private const CATS = ['impresora', 'plotter_corte', 'sublimadora_tazas', 'plancha_calor', 'enmicadora', 'computadora', 'otro'];
    private const ESTADOS = ['operativa', 'mantenimiento', 'fuera_servicio'];
    private const TIPOS = ['mantenimiento', 'reparacion', 'repuesto', 'insumo'];

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    private static function isDate($v): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str(Js::or($v, ''))); }
    private static function dateOrNull($v): ?string { return self::isDate($v) ? Js::slice(Js::str($v), 0, 10) : null; }
    private static function txt($v, int $n): ?string { return Js::orNull(Js::slice(Js::trim($v === null ? '' : $v), 0, $n)); }

    /** JSON.parse conservando objetos ({} sigue siendo objeto) */
    private static function parseJson($raw, $fallback)
    {
        if (!is_string($raw)) $raw = Js::str($raw);
        try {
            $j = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            return $fallback;
        }
        return $j === null ? $fallback : $j;
    }

    private static function shape(array $m): array
    {
        $m['caracteristicas'] = self::parseJson($m['caracteristicas'], new \stdClass());
        $m['insumos'] = self::parseJson($m['insumos_json'], []);
        return $m;
    }

    public function list()
    {
        try {
            $rows = Db::query("\n      SELECT m.*, (SELECT COUNT(*) FROM taller_registros r WHERE r.maquina_id = m.id) AS registros_count,\n             (SELECT COALESCE(SUM(r.costo),0) FROM taller_registros r WHERE r.maquina_id = m.id) AS gasto_total\n      FROM taller_maquinas m WHERE m.activo = 1 ORDER BY m.categoria, m.nombre");
            return $this->json(['success' => true, 'machines' => array_map(fn ($m) => self::shape($m), $rows)]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener las máquinas');
        }
    }

    public function getOne($id)
    {
        try {
            $rows = Db::query('SELECT * FROM taller_maquinas WHERE id = ? AND activo = 1', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Máquina no encontrada');
            $m = self::shape($rows[0]);
            $m['registros'] = Db::query('SELECT * FROM taller_registros WHERE maquina_id = ? ORDER BY fecha DESC, id DESC', [$id]);
            return $this->json(['success' => true, 'machine' => $m]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la máquina');
        }
    }

    private static function values(array $b): array
    {
        $nombre = self::txt($b['nombre'] ?? null, 120);
        if ($nombre === null) throw new HttpError(400, 'Escribe el nombre de la máquina');
        $cat = in_array($b['categoria'] ?? null, self::CATS, true) ? $b['categoria'] : 'otro';
        $estado = in_array($b['estado'] ?? null, self::ESTADOS, true) ? $b['estado'] : 'operativa';
        $car = new \stdClass();
        if (is_array($b['caracteristicas'] ?? null)) {
            foreach (array_slice($b['caracteristicas'], 0, 40, true) as $k => $v) {
                $kk = Js::slice(Js::trim((string) $k), 0, 60);
                $vv = Js::slice(Js::trim($v === null ? '' : $v), 0, 200);
                if ($kk !== '' && $vv !== '') $car->$kk = $vv;
            }
        }
        $insumos = [];
        foreach (array_slice(Js::isArray($b['insumos'] ?? null) ? $b['insumos'] : [], 0, 40) as $i) {
            $isObj = is_array($i);
            $x = ['nombre' => Js::slice(Js::trim(Js::or($isObj ? ($i['nombre'] ?? null) : null, '')), 0, 100), 'detalle' => Js::slice(Js::trim(Js::or($isObj ? ($i['detalle'] ?? null) : null, '')), 0, 200)];
            if ($x['nombre'] !== '') $insumos[] = $x;
        }
        $cada = Js::num($b['mantenimiento_cada_dias'] ?? Js::undef());
        $precio = Js::num($b['precio_compra'] ?? Js::undef());
        return [
            $nombre, $cat, self::txt($b['marca'] ?? null, 60), self::txt($b['modelo'] ?? null, 80), self::txt($b['serie'] ?? null, 80),
            self::dateOrNull($b['fecha_compra'] ?? null), $precio > 0 ? $precio : null, self::txt($b['proveedor'] ?? null, 120),
            self::dateOrNull($b['fecha_ultimo_mantenimiento'] ?? null), $cada > 0 ? Js::round($cada) : null, $estado,
            Js::stringify($car), Js::stringify($insumos), self::txt($b['notas'] ?? null, 2000),
        ];
    }

    public function create()
    {
        try {
            $r = Db::query("INSERT INTO taller_maquinas (nombre, categoria, marca, modelo, serie, fecha_compra, precio_compra, proveedor,\n      fecha_ultimo_mantenimiento, mantenimiento_cada_dias, estado, caracteristicas, insumos_json, notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", self::values($this->body()));
            return $this->json(['success' => true, 'id' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar la máquina');
        }
    }

    public function update($id)
    {
        try {
            $r = Db::query("UPDATE taller_maquinas SET nombre=?, categoria=?, marca=?, modelo=?, serie=?, fecha_compra=?, precio_compra=?, proveedor=?,\n      fecha_ultimo_mantenimiento=?, mantenimiento_cada_dias=?, estado=?, caracteristicas=?, insumos_json=?, notas=? WHERE id = ? AND activo = 1", [...self::values($this->body()), $id]);
            if (!$r['affectedRows']) throw new HttpError(404, 'Máquina no encontrada');
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al actualizar la máquina');
        }
    }

    public function remove($id)
    {
        try {
            Db::query('UPDATE taller_maquinas SET activo = 0 WHERE id = ?', [$id]);
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al eliminar la máquina');
        }
    }

    public function addRecord($id)
    {
        try {
            $b = $this->body();
            $m = Db::query('SELECT id, fecha_ultimo_mantenimiento FROM taller_maquinas WHERE id = ? AND activo = 1', [$id]);
            if (!count($m)) throw new HttpError(404, 'Máquina no encontrada');
            $descripcion = self::txt($b['descripcion'] ?? null, 300);
            if ($descripcion === null) throw new HttpError(400, 'Describe el registro');
            if (!self::isDate($b['fecha'] ?? null)) throw new HttpError(400, 'Indica la fecha');
            $tipo = in_array($b['tipo'] ?? null, self::TIPOS, true) ? $b['tipo'] : 'mantenimiento';
            $costo = Js::num($b['costo'] ?? Js::undef());
            $fecha = Js::slice(Js::str($b['fecha']), 0, 10);
            $r = Db::query('INSERT INTO taller_registros (maquina_id, tipo, fecha, descripcion, costo, responsable) VALUES (?,?,?,?,?,?)', [
                $id, $tipo, $fecha, $descripcion, $costo > 0 ? $costo : null, self::txt($b['responsable'] ?? null, 100),
            ]);
            $ult = $m[0]['fecha_ultimo_mantenimiento'];
            if ($tipo === 'mantenimiento' && (!Js::t($ult) || strcmp(Js::slice(Js::str($ult), 0, 10), $fecha) < 0)) {
                Db::query('UPDATE taller_maquinas SET fecha_ultimo_mantenimiento = ? WHERE id = ?', [$fecha, $id]);
            }
            return $this->json(['success' => true, 'id' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar el registro');
        }
    }

    public function removeRecord($id, $rid)
    {
        try {
            Db::query('DELETE FROM taller_registros WHERE id = ? AND maquina_id = ?', [$rid, $id]);
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al eliminar el registro');
        }
    }
}

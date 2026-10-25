<?php

namespace App\Http\Controllers;

use App\Services\Party;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * Controlador genérico para Clientes y Proveedores (misma estructura de datos y vista).
 */
abstract class PartyController extends Controller
{
    protected string $table;
    protected string $prefix;
    protected string $plural;
    protected string $label;
    protected string $addressCol;
    /** @var array<int, array{col:string, type?:string, max?:int}> */
    protected array $extraFields = [];
    protected string $selectExtra = '';
    protected string $joinExtra = '';

    /** Devuelve un mensaje si no se puede eliminar */
    protected function deleteGuard(int|float $id): ?string
    {
        return null;
    }

    protected function fail(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    private function nextCode(): string
    {
        $r = Db::query("SELECT COALESCE(MAX(id),0)+1 AS n FROM `{$this->table}`");
        $n = Js::num($r[0]['n']);
        for ($i = 0; $i < 1000; $i++, $n++) {
            $code = $this->prefix . '-' . str_pad(Js::str($n), 6, '0', STR_PAD_LEFT);
            $d = Db::query("SELECT id FROM `{$this->table}` WHERE codigo = ?", [$code]);
            if (!count($d)) return $code;
        }
        throw new HttpError(500, 'No se pudo generar el código');
    }

    private function buildData(array $b): array
    {
        $nombre = Party::str($b['nombre'] ?? null, 120);
        if ($nombre === '') throw new HttpError(400, 'El nombre o razón social es obligatorio');
        $doc = Party::validateDocument($b['tipo_documento'] ?? null, $b['numero_documento'] ?? null);
        $e = $b['estado'] ?? Js::undef();
        $d = [
            'tipo_documento' => $doc['tipo'],
            'numero_documento' => $doc['numero'],
            'nombre' => $nombre,
            'telefono' => Party::str($b['telefono'] ?? null, 30),
            'email' => Party::str($b['email'] ?? null, 100),
            'departamento' => Party::str($b['departamento'] ?? null, 60),
            'provincia' => Party::str($b['provincia'] ?? null, 60),
            'estado' => ($e === 0 || $e === '0' || $e === false) ? 0 : 1,
            'direcciones_extra' => Party::cleanList($b['direcciones_extra'] ?? null),
            'telefonos_extra' => Party::cleanList($b['telefonos_extra'] ?? null),
        ];
        $d[$this->addressCol] = Party::str(array_key_exists('direccion', $b) ? $b['direccion'] : ($b[$this->addressCol] ?? null), 255);
        foreach ($this->extraFields as $f) {
            $v = $b[$f['col']] ?? null;
            $type = $f['type'] ?? null;
            if ($type === 'int') $d[$f['col']] = Js::t($v) ? Js::or(Js::num($v), null) : null;
            elseif ($type === 'date') $d[$f['col']] = Js::t($v) ? Party::str($v, 10) : null;
            else $d[$f['col']] = Party::str($v, $f['max'] ?? 255);
        }
        return $d;
    }

    private function checkDuplicate(array $d, $ignoreId): void
    {
        if ($d['numero_documento'] === '') return;
        $dup = Db::query("SELECT id, nombre FROM `{$this->table}` WHERE tipo_documento = ? AND numero_documento = ? AND id != ? LIMIT 1", [$d['tipo_documento'], $d['numero_documento'], Js::or($ignoreId, 0)]);
        if (count($dup)) throw new HttpError(409, 'Ya existe un registro con ese documento: ' . $dup[0]['nombre']);
    }

    private function shape(array $row): array
    {
        $row['direccion'] = Js::or($row[$this->addressCol] ?? null, '');
        $row['direcciones_extra'] = Party::parseList($row['direcciones_extra']);
        $row['telefonos_extra'] = Party::parseList($row['telefonos_extra']);
        return $row;
    }

    public function partyList()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $where = ['1=1'];
            $params = [];
            if (Js::t($g('search'))) {
                $s = '%' . Js::str($g('search')) . '%';
                $where[] = '(x.nombre LIKE ? OR x.numero_documento LIKE ? OR x.codigo LIKE ? OR x.telefono LIKE ? OR x.email LIKE ? OR x.telefonos_extra LIKE ?)';
                array_push($params, $s, $s, $s, $s, $s, $s);
            }
            if ($g('estado') === 'activo') $where[] = 'x.estado = 1';
            if ($g('estado') === 'inactivo') $where[] = 'x.estado = 0';
            if (Js::t($g('tipo_cliente_id')) && $this->table === 'clientes') { $where[] = 'x.tipo_cliente_id = ?'; $params[] = Js::num($g('tipo_cliente_id')); }
            if (Js::t($g('tipo_documento'))) { $where[] = 'x.tipo_documento = ?'; $params[] = $g('tipo_documento'); }
            if (Js::t($g('departamento'))) { $where[] = 'x.departamento LIKE ?'; $params[] = '%' . Js::str($g('departamento')) . '%'; }
            if (Js::t($g('provincia'))) { $where[] = 'x.provincia LIKE ?'; $params[] = '%' . Js::str($g('provincia')) . '%'; }
            $rows = Db::query("SELECT x.*{$this->selectExtra} FROM `{$this->table}` x {$this->joinExtra} WHERE " . implode(' AND ', $where) . ' ORDER BY x.id DESC', $params);
            $st = Db::query("\n          SELECT COUNT(*) AS total,\n                 COALESCE(SUM(estado = 1),0) AS activos,\n                 COALESCE(SUM(estado = 0),0) AS inactivos,\n                 COALESCE(SUM(YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())),0) AS nuevos_mes,\n                 COALESCE(SUM(created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)\n                              AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')),0) AS nuevos_mes_anterior\n          FROM `{$this->table}`")[0];
            $stats = [
                'total' => Js::num($st['total']), 'activos' => Js::num($st['activos']), 'inactivos' => Js::num($st['inactivos']),
                'nuevos_mes' => Js::num($st['nuevos_mes']), 'nuevos_mes_anterior' => Js::num($st['nuevos_mes_anterior']),
            ];
            return $this->json(['success' => true, $this->plural => array_map(fn ($r) => $this->shape($r), $rows), 'stats' => $stats]);
        } catch (\Throwable $e) {
            return $this->fail($e, "Error al obtener {$this->label}");
        }
    }

    public function partyCreate()
    {
        try {
            $b = $this->body();
            $d = $this->buildData($b);
            $this->checkDuplicate($d, 0);
            $manual = ($b['codigo_modo'] ?? null) === 'manual' && Party::str($b['codigo'] ?? null, 30) !== '';
            if ($manual) {
                $codigo = mb_strtoupper(Party::str($b['codigo'], 30));
                if (count(Db::query("SELECT id FROM `{$this->table}` WHERE codigo = ?", [$codigo]))) throw new HttpError(409, 'Ese código ya está en uso');
            } else {
                $codigo = $this->nextCode();
            }
            $d['codigo'] = $codigo;
            $cols = array_keys($d);
            $r = Db::query("INSERT INTO `{$this->table}` (" . implode(',', array_map(fn ($c) => "`{$c}`", $cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($d));
            return $this->json(['success' => true, 'message' => 'Registro creado correctamente', 'id' => $r['insertId'], 'codigo' => $codigo], 201);
        } catch (\Throwable $e) {
            return $this->fail($e, "Error al crear {$this->label}");
        }
    }

    public function partyUpdate($id)
    {
        try {
            $id = Js::num($id);
            $b = $this->body();
            $cur = Db::query("SELECT * FROM `{$this->table}` WHERE id = ?", [$id]);
            if (!count($cur)) throw new HttpError(404, 'Registro no encontrado');
            $d = $this->buildData($b);
            $this->checkDuplicate($d, $id);
            if (array_key_exists('codigo', $b) && Party::str($b['codigo'], 30) !== '' && mb_strtoupper(Party::str($b['codigo'], 30)) !== $cur[0]['codigo']) {
                $codigo = mb_strtoupper(Party::str($b['codigo'], 30));
                if (count(Db::query("SELECT id FROM `{$this->table}` WHERE codigo = ? AND id != ?", [$codigo, $id]))) throw new HttpError(409, 'Ese código ya está en uso');
                $d['codigo'] = $codigo;
            }
            $cols = array_keys($d);
            Db::query("UPDATE `{$this->table}` SET " . implode(', ', array_map(fn ($c) => "`{$c}` = ?", $cols)) . ' WHERE id = ?', [...array_values($d), $id]);
            return $this->json(['success' => true, 'message' => 'Registro actualizado']);
        } catch (\Throwable $e) {
            return $this->fail($e, "Error al actualizar {$this->label}");
        }
    }

    public function partyRemove($id)
    {
        try {
            $id = Js::num($id);
            $msg = $this->deleteGuard($id);
            if ($msg) throw new HttpError(409, $msg);
            Db::query("DELETE FROM `{$this->table}` WHERE id = ?", [$id]);
            return $this->json(['success' => true, 'message' => 'Registro eliminado']);
        } catch (\Throwable $e) {
            return $this->fail($e, "Error al eliminar {$this->label}");
        }
    }

    public function bulkEstado()
    {
        try {
            $b = $this->body();
            $ids = [];
            foreach ((Js::isArray($b['ids'] ?? null) ? $b['ids'] : []) as $x) { $n = Js::num($x); if (Js::t($n)) $ids[] = $n; }
            if (!count($ids)) throw new HttpError(400, 'Selecciona al menos un registro');
            $e = $b['estado'] ?? Js::undef();
            $estado = ($e === 0 || $e === '0' || $e === false) ? 0 : 1;
            Db::query("UPDATE `{$this->table}` SET estado = ? WHERE id IN (" . implode(',', array_fill(0, count($ids), '?')) . ')', [$estado, ...$ids]);
            return $this->json(['success' => true, 'message' => 'Estado actualizado']);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al actualizar estado');
        }
    }
}

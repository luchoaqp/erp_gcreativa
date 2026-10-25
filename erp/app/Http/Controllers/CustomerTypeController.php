<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class CustomerTypeController extends Controller
{
    public function list()
    {
        try {
            $rows = Db::query("\n      SELECT t.*, (SELECT COUNT(*) FROM clientes c WHERE c.tipo_cliente_id = t.id) AS total_clientes\n      FROM tipos_cliente t ORDER BY t.nombre ASC");
            return $this->json(['success' => true, 'types' => $rows]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al obtener tipos de cliente'], 500);
        }
    }

    private static function estado(array $b): int
    {
        $e = $b['estado'] ?? Js::undef();
        return ($e === 0 || $e === '0') ? 0 : 1;
    }

    public function create()
    {
        try {
            $b = $this->body();
            $nombre = Js::slice(Js::trim(Js::or($b['nombre'] ?? null, '')), 0, 80);
            if ($nombre === '') return $this->json(['success' => false, 'message' => 'El nombre es obligatorio'], 400);
            if (count(Db::query('SELECT id FROM tipos_cliente WHERE nombre = ?', [$nombre]))) return $this->json(['success' => false, 'message' => 'Ya existe un tipo con ese nombre'], 409);
            $r = Db::query('INSERT INTO tipos_cliente (nombre, descripcion, estado) VALUES (?,?,?)', [$nombre, Js::slice(Js::trim(Js::or($b['descripcion'] ?? null, '')), 0, 255), self::estado($b)]);
            return $this->json(['success' => true, 'id' => $r['insertId'], 'message' => 'Tipo de cliente creado'], 201);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al crear tipo de cliente'], 500);
        }
    }

    public function update($id)
    {
        try {
            $id = Js::num($id);
            $b = $this->body();
            $nombre = Js::slice(Js::trim(Js::or($b['nombre'] ?? null, '')), 0, 80);
            if ($nombre === '') return $this->json(['success' => false, 'message' => 'El nombre es obligatorio'], 400);
            if (count(Db::query('SELECT id FROM tipos_cliente WHERE nombre = ? AND id != ?', [$nombre, $id]))) return $this->json(['success' => false, 'message' => 'Ya existe un tipo con ese nombre'], 409);
            Db::query('UPDATE tipos_cliente SET nombre = ?, descripcion = ?, estado = ? WHERE id = ?', [$nombre, Js::slice(Js::trim(Js::or($b['descripcion'] ?? null, '')), 0, 255), self::estado($b), $id]);
            return $this->json(['success' => true, 'message' => 'Tipo de cliente actualizado']);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al actualizar tipo de cliente'], 500);
        }
    }

    public function remove($id)
    {
        try {
            $id = Js::num($id);
            $u = Db::query('SELECT COUNT(*) n FROM clientes WHERE tipo_cliente_id = ?', [$id])[0];
            if ($u['n']) return $this->json(['success' => false, 'message' => "No se puede eliminar: {$u['n']} cliente(s) usan este tipo. Márcalo como Inactivo."], 409);
            Db::query('DELETE FROM tipos_cliente WHERE id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Tipo de cliente eliminado']);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al eliminar tipo de cliente'], 500);
        }
    }
}

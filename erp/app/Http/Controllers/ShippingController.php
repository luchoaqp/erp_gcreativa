<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class ShippingController extends Controller
{
    private static function t($v, int $n): ?string
    {
        return Js::orNull(Js::slice(Js::trim($v ?? ''), 0, $n));
    }

    private function fail(\Throwable $e, string $msg)
    {
        if (!$e instanceof HttpError) report($e);
        return $this->json(['success' => false, 'message' => $e instanceof HttpError ? $e->getMessage() : $msg], $e instanceof HttpError ? $e->status : 500);
    }

    private static function estado(array $b): int
    {
        $e = $b['estado'] ?? Js::undef();
        return ($e === 0 || $e === '0' || $e === false) ? 0 : 1;
    }

    /** Pedidos para envío (tipo "Envío" o con datos de envío activados) */
    public function list()
    {
        try {
            $search = $this->q('search');
            $guia = $this->q('guia');
            $sql = "\n      SELECT p.id, p.numero_pedido, p.fecha_entrega, p.franja_horaria, p.estado_pedido, p.estado_pago, p.tipo_entrega, p.ciudad_envio, p.total,\n             COALESCE(c.nombre, p.cliente_nombre, 'Cliente Varios') AS cliente_nombre,\n             p.envio_datos, p.envio_origen, p.envio_destino, p.envio_dest_nombre, p.envio_dest_doc, p.envio_dest_doc_tipo, p.envio_dest_telefono,\n             p.nombre_destinatario, p.telefono_destinatario, p.cliente_documento, c.telefono AS cliente_telefono,\n             g.numero AS guia_numero, (g.foto IS NOT NULL AND g.foto <> '') AS tiene_foto\n      FROM pedidos p\n      LEFT JOIN clientes c ON c.id = p.cliente_id\n      LEFT JOIN pedido_guias g ON g.pedido_id = p.id\n      WHERE (p.tipo_entrega = 'envio' OR p.envio_datos = 1) AND p.estado_pedido <> 'cancelado'";
            $params = [];
            if ($guia === 'con') $sql .= " AND g.foto IS NOT NULL AND g.foto <> ''";
            elseif ($guia === 'sin') $sql .= " AND (g.foto IS NULL OR g.foto = '')";
            if (Js::t($search)) {
                $sql .= ' AND (p.numero_pedido LIKE ? OR c.nombre LIKE ? OR p.cliente_nombre LIKE ? OR p.ciudad_envio LIKE ? OR p.envio_dest_nombre LIKE ? OR g.numero LIKE ?)';
                $s = '%' . Js::str($search) . '%';
                array_push($params, $s, $s, $s, $s, $s, $s);
            }
            $sql .= ' ORDER BY p.fecha_entrega ASC, p.id DESC LIMIT 500';
            $rows = array_map(function ($r) { $r['tiene_foto'] = Js::t(Js::num($r['tiene_foto'])); return $r; }, Db::query($sql, $params));
            return $this->json(['success' => true, 'envios' => $rows]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al obtener los envíos');
        }
    }

    public function saveData($id)
    {
        try {
            $b = $this->body();
            $ped = Db::query('SELECT id, tipo_entrega, ciudad_envio FROM pedidos WHERE id = ?', [$id]);
            if (!count($ped)) throw new HttpError(404, 'Pedido no encontrado');
            $activo = Js::t($b['envio_datos'] ?? null) ? 1 : 0;
            $docTipo = $b['envio_dest_doc_tipo'] ?? null;
            $doc = preg_replace('/\s/u', '', Js::str(Js::or($b['envio_dest_doc'] ?? null, '')));
            if ($activo) {
                if (!self::t($b['envio_dest_nombre'] ?? null, 150)) throw new HttpError(400, 'Escribe el nombre completo del destinatario');
                if ($doc !== '' && $docTipo === 'DNI' && !preg_match('/^\d{8}$/', $doc)) throw new HttpError(400, 'El DNI debe tener 8 dígitos');
                if ($doc !== '' && $docTipo === 'RUC' && !preg_match('/^\d{11}$/', $doc)) throw new HttpError(400, 'El RUC debe tener 11 dígitos');
                if ($doc !== '' && !preg_match('/^\d{8}$|^\d{11}$/', $doc)) throw new HttpError(400, 'El DNI debe tener 8 dígitos o el RUC 11 dígitos');
            }
            Db::query('UPDATE pedidos SET envio_datos = ?, envio_origen = ?, envio_destino = ?, envio_dest_nombre = ?, envio_dest_doc = ?, envio_dest_telefono = ?, envio_dest_doc_tipo = ? WHERE id = ?', [
                $activo, Js::or(self::t($b['envio_origen'] ?? null, 100), 'Arequipa'), Js::or(self::t($b['envio_destino'] ?? null, 150), $ped[0]['ciudad_envio'], null),
                self::t($b['envio_dest_nombre'] ?? null, 150), self::t($doc, 20), self::t($b['envio_dest_telefono'] ?? null, 30),
                $docTipo === 'RUC' ? 'RUC' : 'DNI', $id,
            ]);
            return $this->json(['success' => true, 'message' => 'Datos de envío guardados']);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar los datos de envío');
        }
    }

    public function getGuide($id)
    {
        try {
            $r = Db::query('SELECT numero, foto FROM pedido_guias WHERE pedido_id = ?', [$id]);
            return $this->json(['success' => true, 'guia' => $r[0] ?? ['numero' => null, 'foto' => null]]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al obtener la guía');
        }
    }

    public function saveGuide($id)
    {
        try {
            $b = $this->body();
            $foto = $b['foto'] ?? null;
            if (Js::t($foto) && !preg_match('#^data:image/(png|jpe?g|webp);base64,#', Js::str($foto))) throw new HttpError(400, 'La foto de la guía debe ser una imagen');
            if (!count(Db::query('SELECT id FROM pedidos WHERE id = ?', [$id]))) throw new HttpError(404, 'Pedido no encontrado');
            Db::query("INSERT INTO pedido_guias (pedido_id, numero, foto) VALUES (?, ?, ?)\n       ON DUPLICATE KEY UPDATE numero = VALUES(numero), foto = VALUES(foto)", [$id, self::t($b['numero'] ?? null, 60), Js::t($foto) ? Js::str($foto) : null]);
            return $this->json(['success' => true, 'message' => 'Guía guardada']);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar la guía');
        }
    }

    // ---------------- Couriers y agencias ----------------
    public function listCouriers()
    {
        try {
            $rows = Db::query("\n      SELECT c.id, c.nombre, c.notas, c.estado, (SELECT COUNT(*) FROM agencias_envio a WHERE a.courier_id = c.id) AS agencias\n      FROM couriers c ORDER BY c.nombre");
            return $this->json(['success' => true, 'couriers' => $rows]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al obtener los couriers');
        }
    }

    public function saveCourier($id = null)
    {
        try {
            $b = $this->body();
            $nombre = self::t($b['nombre'] ?? null, 80);
            if (!$nombre) throw new HttpError(400, 'El nombre del courier es obligatorio');
            $estado = self::estado($b);
            if (count(Db::query('SELECT id FROM couriers WHERE nombre = ? AND id <> ?', [$nombre, Js::or(Js::num($id), 0)]))) throw new HttpError(409, 'Ya existe un courier con ese nombre');
            if (Js::t($id)) {
                Db::query('UPDATE couriers SET nombre = ?, notas = ?, estado = ? WHERE id = ?', [$nombre, self::t($b['notas'] ?? null, 255), $estado, $id]);
                return $this->json(['success' => true, 'message' => 'Courier actualizado']);
            }
            $r = Db::query('INSERT INTO couriers (nombre, notas, estado) VALUES (?,?,?)', [$nombre, self::t($b['notas'] ?? null, 255), $estado]);
            return $this->json(['success' => true, 'message' => 'Courier creado', 'id' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar el courier');
        }
    }

    public function listAgencies()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $sql = 'SELECT a.*, c.nombre AS courier FROM agencias_envio a JOIN couriers c ON c.id = a.courier_id WHERE 1 = 1';
            $params = [];
            if (Js::t($g('courier_id'))) { $sql .= ' AND a.courier_id = ?'; $params[] = Js::num($g('courier_id')); }
            if (Js::t($g('departamento'))) { $sql .= ' AND a.departamento = ?'; $params[] = $g('departamento'); }
            if ($g('estado') === 'activas') $sql .= ' AND a.estado = 1';
            elseif ($g('estado') === 'inactivas') $sql .= ' AND a.estado = 0';
            if (Js::t($g('search'))) {
                $sql .= ' AND (a.nombre LIKE ? OR a.direccion LIKE ? OR a.distrito LIKE ? OR a.provincia LIKE ? OR a.contacto LIKE ? OR a.telefono LIKE ?)';
                $s = '%' . Js::str($g('search')) . '%';
                array_push($params, $s, $s, $s, $s, $s, $s);
            }
            $sql .= ' ORDER BY c.nombre, a.departamento, a.provincia, a.nombre LIMIT 3000';
            return $this->json(['success' => true, 'agencias' => Db::query($sql, $params)]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al obtener las agencias');
        }
    }

    private static function agencyData(array $b): array
    {
        $nombre = self::t($b['nombre'] ?? null, 150);
        if (!$nombre) throw new HttpError(400, 'El nombre de la agencia es obligatorio');
        return [
            'nombre' => $nombre, 'departamento' => self::t($b['departamento'] ?? null, 60), 'provincia' => self::t($b['provincia'] ?? null, 80),
            'distrito' => self::t($b['distrito'] ?? null, 80), 'direccion' => self::t($b['direccion'] ?? null, 255),
            'referencia' => self::t($b['referencia'] ?? null, 255), 'telefono' => self::t($b['telefono'] ?? null, 60),
            'contacto' => self::t($b['contacto'] ?? null, 120), 'horario' => self::t($b['horario'] ?? null, 160), 'notas' => self::t($b['notas'] ?? null, 255),
            'estado' => self::estado($b),
        ];
    }

    public function saveAgency($id = null)
    {
        try {
            $b = $this->body();
            $courierId = Js::num($b['courier_id'] ?? Js::undef());
            if (!count(Db::query('SELECT id FROM couriers WHERE id = ?', [$courierId]))) throw new HttpError(400, 'Elige el courier de la agencia');
            $d = self::agencyData($b);
            $cols = array_keys($d);
            if (Js::t($id)) {
                Db::query('UPDATE agencias_envio SET courier_id = ?, ' . implode(', ', array_map(fn ($k) => "`{$k}` = ?", $cols)) . ' WHERE id = ?', [$courierId, ...array_values($d), $id]);
                return $this->json(['success' => true, 'message' => 'Agencia actualizada']);
            }
            $r = Db::query('INSERT INTO agencias_envio (courier_id, ' . implode(', ', array_map(fn ($k) => "`{$k}`", $cols)) . ') VALUES (?, ' . implode(', ', array_fill(0, count($cols), '?')) . ')', [$courierId, ...array_values($d)]);
            return $this->json(['success' => true, 'message' => 'Agencia creada', 'id' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar la agencia');
        }
    }

    public function deleteAgency($id)
    {
        try {
            Db::query('DELETE FROM agencias_envio WHERE id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Agencia eliminada']);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al eliminar la agencia');
        }
    }

    /** Importación masiva (filas ya leídas del CSV): se actualiza si ya existe courier + nombre + distrito */
    public function importAgencies()
    {
        try {
            $b = $this->body();
            $filas = Js::isArray($b['filas'] ?? null) ? array_slice($b['filas'], 0, 5000) : [];
            if (!count($filas)) throw new HttpError(400, 'El archivo no tiene filas para importar');
            $porNombre = [];
            foreach (Db::query('SELECT id, nombre FROM couriers') as $c) $porNombre[mb_strtolower((string) $c['nombre'])] = $c['id'];
            $def = Js::or(Js::num($b['courier_id'] ?? null), null);
            $creadas = $actualizadas = $omitidas = 0;
            Db::begin();
            foreach ($filas as $f) {
                $f = is_array($f) ? $f : [];
                $courierId = Js::t($f['courier'] ?? null) ? ($porNombre[mb_strtolower(Js::trim($f['courier']))] ?? null) : null;
                if (!Js::t($courierId)) $courierId = $def;
                $nombre = self::t($f['nombre'] ?? ($f['agencia'] ?? null), 150);
                if (!Js::t($courierId) || !$nombre) { $omitidas++; continue; }
                $d = self::agencyData(array_merge($f, ['nombre' => $nombre]));
                $ex = Db::query("SELECT id FROM agencias_envio WHERE courier_id = ? AND nombre = ? AND COALESCE(distrito, '') = ? LIMIT 1", [$courierId, $d['nombre'], Js::or($d['distrito'], '')]);
                $cols = array_keys($d);
                if (count($ex)) {
                    Db::query('UPDATE agencias_envio SET ' . implode(', ', array_map(fn ($k) => "`{$k}` = ?", $cols)) . ' WHERE id = ?', [...array_values($d), $ex[0]['id']]);
                    $actualizadas++;
                } else {
                    Db::query('INSERT INTO agencias_envio (courier_id, ' . implode(', ', array_map(fn ($k) => "`{$k}`", $cols)) . ') VALUES (?, ' . implode(', ', array_fill(0, count($cols), '?')) . ')', [$courierId, ...array_values($d)]);
                    $creadas++;
                }
            }
            Db::commit();
            return $this->json(['success' => true, 'message' => "Importación lista: {$creadas} nuevas, {$actualizadas} actualizadas, {$omitidas} omitidas", 'creadas' => $creadas, 'actualizadas' => $actualizadas, 'omitidas' => $omitidas]);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->fail($e, 'Error al importar las agencias');
        }
    }
}

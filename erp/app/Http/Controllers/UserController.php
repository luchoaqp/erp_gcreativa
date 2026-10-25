<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class UserController extends Controller
{
    private const P_ADMIN = ['pos' => true, 'quotes' => true, 'orders' => true, 'inventory' => true, 'categories' => true, 'customers' => true, 'suppliers' => true, 'purchases' => true, 'reports' => true, 'settings' => true, 'backup' => true, 'users' => true];
    private const P_VENDEDOR = ['pos' => true, 'quotes' => true, 'orders' => true, 'inventory' => true, 'categories' => true, 'customers' => true, 'suppliers' => false, 'purchases' => false, 'reports' => false, 'settings' => false, 'backup' => false, 'users' => false];
    private const P_TALLER = ['pos' => false, 'quotes' => false, 'orders' => true, 'inventory' => true, 'categories' => false, 'customers' => false, 'suppliers' => false, 'purchases' => false, 'reports' => false, 'settings' => false, 'backup' => false, 'users' => false];
    private const P_REPARTIDOR = ['pos' => false, 'quotes' => false, 'orders' => true, 'inventory' => false, 'categories' => false, 'customers' => false, 'suppliers' => false, 'purchases' => false, 'reports' => false, 'settings' => false, 'backup' => false, 'users' => false];

    public static function rolesConfig(): array
    {
        return [
            ['id' => 'admin', 'nombre' => 'Administrador', 'badgeColor' => '#8B5CF6', 'descripcion' => 'Acceso irrestricto a todos los módulos, reportes y configuraciones del sistema.', 'permisos' => self::P_ADMIN],
            ['id' => 'vendedor', 'nombre' => 'Vendedor / Asesor', 'badgeColor' => '#3B82F6', 'descripcion' => 'Atención en caja / POS, consulta de catálogo, gestión de clientes y pedidos.', 'permisos' => self::P_VENDEDOR],
            ['id' => 'taller', 'nombre' => 'Taller & Preparación', 'badgeColor' => '#F59E0B', 'descripcion' => 'Visualización de pedidos, dedicatorias, lazos y preparación de regalos.', 'permisos' => self::P_TALLER],
            ['id' => 'repartidor', 'nombre' => 'Repartidor / Logística', 'badgeColor' => '#10B981', 'descripcion' => 'Acceso a rutas de despacho, direcciones de entrega y confirmación de entrega.', 'permisos' => self::P_REPARTIDOR],
        ];
    }

    private static function roleFor($rol): ?array
    {
        foreach (self::rolesConfig() as $r) if ($r['id'] === $rol) return $r;
        return null;
    }

    // Avatares ilustrados: código corto "av:<rol>-<n>"
    private static function avatarFor($v, $rol): string
    {
        if (is_string($v) && preg_match('/^av:[a-z]+-[0-3]$/', $v)) return $v;
        return 'av:' . (in_array($rol, ['admin', 'vendedor', 'taller', 'repartidor'], true) ? $rol : 'vendedor') . '-0';
    }

    public function getRoles()
    {
        return $this->json([
            'success' => true,
            'roles' => self::rolesConfig(),
            'modules' => [
                ['id' => 'pos', 'nombre' => 'Punto de Venta (POS)', 'icon' => 'ShoppingBag', 'desc' => 'Ventas en directo, carrito y cobros'],
                ['id' => 'quotes', 'nombre' => 'Cotizaciones', 'icon' => 'FileText', 'desc' => 'Presupuestos para clientes con vigencia, IGV y PDF'],
                ['id' => 'orders', 'nombre' => 'Pedidos', 'icon' => 'Truck', 'desc' => 'Tablero Kanban, estados y preparación'],
                ['id' => 'inventory', 'nombre' => 'Productos', 'icon' => 'Gift', 'desc' => 'Productos, packs, precios, insumos y stock'],
                ['id' => 'categories', 'nombre' => 'Categorías & Ocasiones', 'icon' => 'Layers', 'desc' => 'Líneas de producto y fechas clave'],
                ['id' => 'customers', 'nombre' => 'Clientes', 'icon' => 'Users', 'desc' => 'Gestión de clientes y tipos de cliente'],
                ['id' => 'suppliers', 'nombre' => 'Proveedores', 'icon' => 'Truck', 'desc' => 'Gestión de proveedores'],
                ['id' => 'purchases', 'nombre' => 'Compras', 'icon' => 'ShoppingCart', 'desc' => 'Compras a proveedores e ingreso a almacén'],
                ['id' => 'reports', 'nombre' => 'Ventas', 'icon' => 'BarChart3', 'desc' => 'Métricas financieras y exportaciones'],
                ['id' => 'users', 'nombre' => 'Usuarios & Permisos', 'icon' => 'ShieldCheck', 'desc' => 'Gestión de personal y accesos'],
                ['id' => 'settings', 'nombre' => 'Configuración Empresa', 'icon' => 'Settings', 'desc' => 'Datos de tienda, RUC, logo y delivery'],
                ['id' => 'backup', 'nombre' => 'Copia de Seguridad', 'icon' => 'Database', 'desc' => 'Exportación y restauración de datos'],
            ],
        ]);
    }

    public function getUsers()
    {
        try {
            $users = Db::query("\n      SELECT id, nombre, email, rol, permisos, telefono, avatar, estado, created_at \n      FROM usuarios \n      ORDER BY id ASC\n    ");
            $out = array_map(function ($u) {
                if (Js::t($u['permisos'])) {
                    $p = is_string($u['permisos']) ? Js::parse($u['permisos'], $ok) : $u['permisos'];
                    $parsed = (is_string($u['permisos']) && !$ok) ? (object) [] : $p;
                } else {
                    $role = self::roleFor($u['rol']);
                    $parsed = $role ? $role['permisos'] : (object) [];
                }
                if (is_array($parsed) && count($parsed) === 0) $parsed = (object) [];
                $u['permisos'] = $parsed;
                return $u;
            }, $users);
            return $this->json(['success' => true, 'users' => $out]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener lista de usuarios'], 500);
        }
    }

    public function createUser()
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null; $email = $b['email'] ?? null; $password = $b['password'] ?? null;
            $rol = $b['rol'] ?? null; $telefono = $b['telefono'] ?? null; $permisos = $b['permisos'] ?? null;
            if (!Js::t($nombre) || !Js::t($email) || !Js::t($password)) {
                return $this->json(['success' => false, 'message' => 'Nombre, email y contraseña son obligatorios'], 400);
            }
            if (mb_strlen((string) $password) < 6) {
                return $this->json(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres'], 400);
            }
            $emailN = mb_strtolower(Js::trim($email));
            if (count(Db::query('SELECT id FROM usuarios WHERE email = ?', [$emailN])) > 0) {
                return $this->json(['success' => false, 'message' => 'El correo electrónico ya está registrado en el sistema'], 400);
            }
            $hashed = self::hash((string) $password);
            $final = $permisos;
            if (!Js::t($final) || (is_array($final) && count($final) === 0)) {
                $role = self::roleFor($rol);
                $final = $role ? $role['permisos'] : self::rolesConfig()[1]['permisos'];
            }
            $avatar = self::avatarFor($b['avatar'] ?? null, $rol);
            $estado = array_key_exists('estado', $b) ? (Js::t($b['estado']) ? 1 : 0) : 1;
            $res = Db::query("\n      INSERT INTO usuarios (nombre, email, password, rol, permisos, telefono, avatar, estado)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n    ", [
                Js::trim($nombre), $emailN, $hashed, Js::or($rol, 'vendedor'), Js::stringify($final), Js::or($telefono, ''), $avatar, $estado,
            ]);
            return $this->json([
                'success' => true,
                'message' => 'Usuario registrado exitosamente',
                'user' => [
                    'id' => $res['insertId'], 'nombre' => Js::trim($nombre), 'email' => $emailN, 'rol' => Js::or($rol, 'vendedor'),
                    'permisos' => $final, 'telefono' => Js::or($telefono, ''), 'avatar' => $avatar, 'estado' => $estado,
                ],
            ], 201);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al registrar el usuario'], 500);
        }
    }

    /** bcrypt con 10 rondas; se guarda con prefijo $2a$ (compatible con bcryptjs si algún día se vuelve a Node) */
    public static function hash(string $password): string
    {
        $h = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        return '$2a$' . substr($h, 4);
    }

    public function updateUser($id)
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null; $email = $b['email'] ?? null; $password = $b['password'] ?? null;
            $rol = $b['rol'] ?? null; $telefono = $b['telefono'] ?? null; $permisos = $b['permisos'] ?? null;
            if (!Js::t($nombre) || !Js::t($email)) {
                return $this->json(['success' => false, 'message' => 'Nombre y email son requeridos'], 400);
            }
            $existing = Db::query('SELECT * FROM usuarios WHERE id = ?', [$id]);
            if (count($existing) === 0) {
                return $this->json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
            }
            $emailN = mb_strtolower(Js::trim($email));
            if (count(Db::query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [$emailN, $id])) > 0) {
                return $this->json(['success' => false, 'message' => 'El correo electrónico ya le pertenece a otro usuario'], 400);
            }
            if (Js::t($password) && mb_strlen(Js::trim($password)) >= 6) {
                Db::query('UPDATE usuarios SET password = ? WHERE id = ?', [self::hash(Js::trim($password)), $id]);
            }
            $final = $permisos;
            if (!Js::t($final)) {
                $role = self::roleFor($rol);
                $final = $role ? $role['permisos'] : (object) [];
            }
            $av = $b['avatar'] ?? null;
            $newAvatar = (is_string($av) && preg_match('/^av:[a-z]+-[0-3]$/', $av)) ? $av : $existing[0]['avatar'];
            $estado = array_key_exists('estado', $b) ? (Js::t($b['estado']) ? 1 : 0) : 1;
            Db::query("\n      UPDATE usuarios \n      SET nombre = ?, email = ?, rol = ?, permisos = ?, telefono = ?, estado = ?, avatar = ?\n      WHERE id = ?\n    ", [
                Js::trim($nombre), $emailN, Js::or($rol, 'vendedor'), Js::stringify($final), Js::or($telefono, ''), $estado, $newAvatar, $id,
            ]);
            return $this->json([
                'success' => true,
                'message' => 'Usuario actualizado exitosamente',
                'user' => [
                    'id' => Js::num($id), 'nombre' => Js::trim($nombre), 'email' => $emailN, 'rol' => Js::or($rol, 'vendedor'),
                    'permisos' => $final, 'telefono' => Js::or($telefono, ''), 'avatar' => $newAvatar, 'estado' => $estado,
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al actualizar el usuario'], 500);
        }
    }

    public function toggleStatus($id)
    {
        try {
            $estado = $this->body()['estado'] ?? null;
            $u = $this->user();
            if ($u && ($u['id'] ?? null) === Js::num($id)) {
                return $this->json(['success' => false, 'message' => 'No puedes desactivar tu propia cuenta activa'], 400);
            }
            Db::query('UPDATE usuarios SET estado = ? WHERE id = ?', [Js::t($estado) ? 1 : 0, $id]);
            return $this->json(['success' => true, 'message' => 'Usuario ' . (Js::t($estado) ? 'activado' : 'desactivado') . ' correctamente']);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al cambiar estado del usuario'], 500);
        }
    }

    public function deleteUser($id)
    {
        try {
            $u = $this->user();
            if ($u && ($u['id'] ?? null) === Js::num($id)) {
                return $this->json(['success' => false, 'message' => 'No puedes eliminar tu propia cuenta en sesión'], 400);
            }
            if (Js::num($id) === 1) {
                return $this->json(['success' => false, 'message' => 'El administrador principal del sistema no puede ser eliminado'], 400);
            }
            $res = Db::query('DELETE FROM usuarios WHERE id = ?', [$id]);
            if ($res['affectedRows'] === 0) {
                return $this->json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
            }
            return $this->json(['success' => true, 'message' => 'Usuario eliminado exitosamente']);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error en el servidor al eliminar usuario'], 500);
        }
    }
}

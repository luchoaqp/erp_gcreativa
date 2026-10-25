<?php

namespace App\Http\Controllers;

use App\Http\Middleware\JwtAuth;
use App\Support\Db;
use App\Support\Js;
use Firebase\JWT\JWT;

class AuthController extends Controller
{
    /** Interpreta la columna permisos (texto JSON) como lo hacía el backend Node */
    public static function parsePermisos($v)
    {
        if (!Js::t($v)) return Js::undef();
        if (!is_string($v)) return $v;
        $p = Js::parse($v, $ok);
        return $ok ? $p : Js::undef();
    }

    public static function sign(array $user): string
    {
        $now = time();
        $payload = [
            'id' => $user['id'], 'nombre' => $user['nombre'], 'email' => $user['email'],
            'rol' => $user['rol'], 'avatar' => $user['avatar'],
            'iat' => $now, 'exp' => $now + (int) config('erp.jwt_ttl_hours', 12) * 3600,
        ];
        return JWT::encode($payload, JwtAuth::secret(), 'HS256');
    }

    public function login()
    {
        try {
            $b = $this->body();
            $email = $b['email'] ?? null;
            $password = $b['password'] ?? null;
            if (!Js::t($email) || !Js::t($password)) {
                return $this->json(['success' => false, 'message' => 'Por favor ingrese email y contraseña'], 400);
            }
            $users = Db::query('SELECT * FROM usuarios WHERE email = ? AND estado = 1', [$email]);
            if (count($users) === 0) {
                return $this->json(['success' => false, 'message' => 'Credenciales incorrectas o usuario inactivo'], 401);
            }
            $user = $users[0];
            // bcryptjs genera hashes $2a$/$2b$; PHP los verifica igual
            $hash = (string) $user['password'];
            if (str_starts_with($hash, '$2b$')) $hash = '$2y$' . substr($hash, 4);
            if (!password_verify(Js::str($password), $hash)) {
                return $this->json(['success' => false, 'message' => 'Credenciales incorrectas'], 401);
            }
            $token = self::sign($user);
            return $this->json([
                'success' => true,
                'message' => 'Bienvenido(a) a Tienda de Regalos',
                'token' => $token,
                'user' => [
                    'id' => $user['id'], 'nombre' => $user['nombre'], 'email' => $user['email'], 'rol' => $user['rol'],
                    'avatar' => $user['avatar'], 'telefono' => $user['telefono'],
                    'permisos' => self::parsePermisos($user['permisos'] ?? null),
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al iniciar sesión'], 500);
        }
    }

    public function me()
    {
        try {
            $users = Db::query('SELECT id, nombre, email, rol, telefono, avatar, estado, permisos FROM usuarios WHERE id = ?', [$this->userId()]);
            if (count($users) === 0) {
                return $this->json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
            }
            $u = $users[0];
            $u['permisos'] = self::parsePermisos($u['permisos']);
            return $this->json(['success' => true, 'user' => $u]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al consultar perfil'], 500);
        }
    }

    public function getUsers()
    {
        try {
            $users = Db::query('SELECT id, nombre, email, rol, telefono, avatar, estado FROM usuarios ORDER BY nombre ASC');
            return $this->json(['success' => true, 'users' => $users]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'Error al obtener usuarios'], 500);
        }
    }
}

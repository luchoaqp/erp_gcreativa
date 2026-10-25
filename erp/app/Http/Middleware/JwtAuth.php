<?php

namespace App\Http\Middleware;

use App\Support\Http;
use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;

/** Verifica el token JWT (Authorization: Bearer ...) igual que authMiddleware del backend Node. */
class JwtAuth
{
    public static function secret(): string
    {
        $s = (string) config('erp.jwt_secret');
        // Sin JWT_SECRET en el .env se deriva una clave propia de esta instalación (nunca una fija en el código)
        return $s !== '' ? $s : hash_hmac('sha256', 'erp-jwt', (string) config('app.key'));
    }

    public function handle(Request $request, Closure $next)
    {
        $header = (string) $request->header('Authorization', '');
        $parts = explode(' ', $header);
        $token = $parts[1] ?? '';
        if ($header === '' || $token === '') {
            return Http::json(['success' => false, 'message' => 'Acceso no autorizado: Token no proporcionado'], 401);
        }
        try {
            JWT::$leeway = 0;
            $decoded = JWT::decode($token, new Key(self::secret(), 'HS256'));
            $request->attributes->set('user', json_decode(json_encode($decoded), true));
        } catch (\Throwable $e) {
            return Http::json(['success' => false, 'message' => 'Token inválido o expirado'], 403);
        }
        return $next($request);
    }
}

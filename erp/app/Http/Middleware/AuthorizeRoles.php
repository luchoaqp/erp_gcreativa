<?php

namespace App\Http\Middleware;

use App\Support\Http;
use Closure;
use Illuminate\Http\Request;

/** Solo deja pasar a los roles indicados: ->middleware('roles:admin,vendedor') */
class AuthorizeRoles
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->attributes->get('user');
        if (!$user || !in_array($user['rol'] ?? null, $roles, true)) {
            return Http::json(['success' => false, 'message' => 'Permiso denegado para su rol de usuario'], 403);
        }
        return $next($request);
    }
}

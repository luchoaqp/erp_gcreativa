<?php

namespace App\Http\Middleware;

use App\Support\Db;
use App\Support\Http;
use App\Support\Js;
use Closure;
use Illuminate\Http\Request;

/**
 * Permisos por módulo validados en el servidor (requirePurchasesAccess, requireQuotesAccess, etc.).
 * Uso: ->middleware('acceso:purchases')
 */
class ModuleAccess
{
    public function handle(Request $request, Closure $next, string $modulo)
    {
        try {
            $uid = $request->attributes->get('user')['id'] ?? null;
            $u = Db::query('SELECT * FROM usuarios WHERE id = ?', [$uid])[0] ?? null;
            if (!$u || $u['estado'] === 0) return Http::json(['success' => false, 'message' => 'Usuario inactivo'], 403);
            if ($u['rol'] === 'admin') return $next($request);
            $p = null;
            if (Js::t($u['permisos'])) {
                $p = is_string($u['permisos']) ? Js::parse($u['permisos'], $ok) : $u['permisos'];
                if (is_string($u['permisos']) && !$ok) $p = null;
            }
            $hasP = $p !== null && Js::t($p);
            $get = fn ($k) => is_array($p) ? ($p[$k] ?? null) : null;
            switch ($modulo) {
                case 'purchases':
                    if (!($hasP && Js::t($get('purchases')))) return Http::json(['success' => false, 'message' => 'No tienes permiso para el módulo de Compras'], 403);
                    break;
                case 'suppliers':
                    if (!($hasP && Js::t($get('suppliers')))) return Http::json(['success' => false, 'message' => 'No tienes permiso para el módulo de Proveedores'], 403);
                    break;
                case 'quotes':
                    $allowed = ($hasP && is_array($p) && array_key_exists('quotes', $p)) ? Js::t($p['quotes']) : $u['rol'] === 'vendedor';
                    if (!$allowed) return Http::json(['success' => false, 'message' => 'No tienes permiso para el módulo de Cotizaciones'], 403);
                    break;
                case 'sales':
                    $allowed = $hasP ? (Js::t($get('reports')) || Js::t($get('pos'))) : $u['rol'] === 'vendedor';
                    if (!$allowed) return Http::json(['success' => false, 'message' => 'No tienes permiso para el módulo de Ventas'], 403);
                    break;
            }
            return $next($request);
        } catch (\Throwable $e) {
            report($e);
            $msg = $modulo === 'sales' ? 'Error validando permisos: ' . $e->getMessage() : 'Error validando permisos';
            return Http::json(['success' => false, 'message' => $msg], 500);
        }
    }
}

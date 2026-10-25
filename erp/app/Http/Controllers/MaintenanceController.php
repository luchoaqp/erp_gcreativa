<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * Mantenimiento SIN SSH (cPanel compartido):
 *  - POST /api/sistema/actualizar  (admin con sesión)  → aplica migraciones pendientes y limpia cachés
 *  - GET  /instalar?token=XXXX     (solo si SETUP_TOKEN está en el .env) → crea tablas + datos iniciales
 */
class MaintenanceController extends Controller
{
    private function run(bool $seed): array
    {
        @set_time_limit(300);
        $out = [];
        Artisan::call('migrate', ['--force' => true]);
        $out[] = trim(Artisan::output());
        if ($seed) {
            Artisan::call('db:seed', ['--force' => true]);
            $out[] = trim(Artisan::output());
        }
        Artisan::call('optimize:clear');
        $out[] = trim(Artisan::output());
        return array_values(array_filter($out, fn ($s) => $s !== ''));
    }

    public function update()
    {
        try {
            return $this->json(['success' => true, 'message' => 'Sistema actualizado', 'log' => $this->run(false)]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'No se pudo actualizar: ' . $e->getMessage()], 500);
        }
    }

    public function status()
    {
        Artisan::call('migrate:status');
        return $this->json(['success' => true, 'version' => config('erp.version'), 'php' => PHP_VERSION, 'migraciones' => trim(Artisan::output())]);
    }

    public function install(Request $request)
    {
        $token = (string) env('SETUP_TOKEN', '');
        if ($token === '' || !hash_equals($token, (string) $request->query('token', ''))) {
            abort(404);
        }
        try {
            $log = $this->run(true);
            return response("<pre>Instalación completada.\n\n" . e(implode("\n\n", $log)) . "\n\nIMPORTANTE: borra SETUP_TOKEN del archivo .env ahora.</pre>");
        } catch (\Throwable $e) {
            return response('<pre>Error: ' . e($e->getMessage()) . '</pre>', 500);
        }
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * Aplica sola las migraciones nuevas después de subir una actualización (cPanel sin SSH).
 * - Cada conjunto de migraciones tiene una "firma"; si ya se aplicó, solo cuesta revisar que exista un archivo.
 * - Un candado de archivo evita que dos peticiones a la vez la ejecuten.
 * - Si algo falla, se registra en storage/logs y el ERP sigue respondiendo (se reintenta en la siguiente petición).
 */
class AutoMigrate
{
    public function handle(Request $request, Closure $next)
    {
        try {
            self::run();
        } catch (\Throwable $e) {
            report($e);
        }
        return $next($request);
    }

    public static function run(): void
    {
        $files = glob(database_path('migrations/*.php')) ?: [];
        sort($files);
        $sig = substr(md5(implode('|', array_map('basename', $files))), 0, 12);
        $dir = storage_path('app');
        $flag = "{$dir}/esquema-{$sig}.ok";
        if (is_file($flag)) return;

        $lock = fopen("{$dir}/migrar.lock", 'c');
        if (!$lock) return;
        try {
            if (!flock($lock, LOCK_EX)) return;
            clearstatcache(true, $flag);
            if (is_file($flag)) return;
            @set_time_limit(120);
            $code = Artisan::call('migrate', ['--force' => true]);
            if ($code !== 0) throw new \RuntimeException('migrate terminó con código ' . $code . ': ' . Artisan::output());
            foreach (glob("{$dir}/esquema-*.ok") ?: [] as $old) @unlink($old);
            file_put_contents($flag, date('c') . "\n" . trim(Artisan::output()) . "\n");
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}

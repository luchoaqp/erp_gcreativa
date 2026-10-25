<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Http;
use App\Support\Js;

/** Copias de seguridad en JSON (mismo formato que el backend Node: se pueden restaurar entre ambos) */
class BackupController extends Controller
{
    private const TABLES = [
        'configuracion', 'usuarios', 'categorias', 'ocasiones', 'marcas', 'productos', 'producto_presentaciones', 'producto_componentes',
        'producto_categorias', 'kardex_movimientos', 'producto_proveedor_stock', 'producto_lotes', 'venta_asignaciones', 'tipos_cliente',
        'clientes', 'proveedores', 'compras', 'compra_detalles', 'gastos', 'gasto_detalles', 'gasto_pagos', 'catalogos', 'taller_maquinas',
        'taller_registros', 'pedidos', 'pedido_guias', 'pedido_diseno', 'couriers', 'agencias_envio', 'pedido_detalles', 'cotizacion_config',
        'cotizaciones', 'cotizacion_detalles', 'pagos', 'comprobantes', 'migraciones_aplicadas',
    ];

    private const RESTORE_ORDER = [
        'comprobantes', 'pagos', 'cotizacion_detalles', 'cotizaciones', 'cotizacion_config', 'agencias_envio', 'couriers', 'pedido_diseno',
        'pedido_guias', 'pedido_detalles', 'pedidos', 'venta_asignaciones', 'producto_proveedor_stock', 'producto_lotes', 'kardex_movimientos',
        'producto_categorias', 'producto_componentes', 'producto_presentaciones', 'productos', 'marcas', 'taller_registros', 'taller_maquinas',
        'catalogos', 'gasto_pagos', 'gasto_detalles', 'gastos', 'compra_detalles', 'compras', 'proveedores', 'clientes', 'tipos_cliente',
        'ocasiones', 'categorias', 'usuarios', 'configuracion', 'migraciones_aplicadas',
    ];

    public static function dir(): string
    {
        $d = (string) config('erp.backups_dir');
        if (!is_dir($d)) @mkdir($d, 0775, true);
        return $d;
    }

    /** JSON.stringify(data, null, 2) */
    public static function pretty($data): string
    {
        $json = Http::encode($data);
        $pretty = json_encode(json_decode($json, false, 4096, JSON_BIGINT_AS_STRING), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS | JSON_PRESERVE_ZERO_FRACTION);
        // PHP indenta con 4 espacios; JavaScript con 2
        return preg_replace_callback('/^(?: {4})+/m', fn ($m) => str_repeat(' ', strlen($m[0]) / 2), $pretty);
    }

    /** Genera el archivo de respaldo completo y devuelve su contenido */
    public static function writeBackupFile(): array
    {
        $iso = Js::iso();
        $filename = 'backup_tienda_regalos_' . str_replace([':', '.'], '-', $iso) . '.json';
        $filepath = self::dir() . '/' . $filename;
        $data = ['system' => 'Tienda de Regalos & Gift Studio ERP', 'version' => '1.2', 'created_at' => $iso, 'metadata' => new \stdClass(), 'tables' => new \stdClass()];
        foreach (self::TABLES as $t) {
            $rows = Db::query("SELECT * FROM `{$t}`");
            $data['tables']->$t = $rows;
            $k = "total_{$t}";
            $data['metadata']->$k = count($rows);
        }
        $json = self::pretty($data);
        file_put_contents($filepath, $json);
        return ['filename' => $filename, 'filepath' => $filepath, 'jsonString' => $json, 'backupData' => $data];
    }

    public function createBackup()
    {
        try {
            $r = self::writeBackupFile();
            if ($this->q('download') === 'file') {
                return response($r['jsonString'], 200, ['Content-Type' => 'application/json', 'Content-Disposition' => 'attachment; filename="' . $r['filename'] . '"']);
            }
            return $this->json([
                'success' => true, 'message' => 'Copia de seguridad generada y guardada con éxito', 'filename' => $r['filename'],
                'sizeBytes' => strlen($r['jsonString']), 'created_at' => $r['backupData']['created_at'], 'metadata' => $r['backupData']['metadata'], 'backupData' => $r['backupData'],
            ]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error interno al generar respaldo: ' . $e->getMessage()], 500);
        }
    }

    public function listBackups()
    {
        try {
            $files = [];
            foreach (scandir(self::dir()) ?: [] as $f) {
                if (!str_ends_with($f, '.json')) continue;
                $p = self::dir() . '/' . $f;
                // PHP no expone milisegundos en filemtime: se toman del nombre del archivo cuando lo generó el ERP
                $ms = filemtime($p) * 1000;
                if (preg_match('/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/', $f, $m)) {
                    $t = strtotime("{$m[1]}T{$m[2]}:{$m[3]}:{$m[4]}Z");
                    if ($t !== false && abs($t * 1000 - $ms) < 120000) $ms = $t * 1000 + (int) $m[5];
                }
                $files[] = ['filename' => $f, 'sizeBytes' => filesize($p), 'created_at' => Js::iso($ms)];
            }
            usort($files, fn ($a, $b) => strcmp($b['created_at'], $a['created_at']));
            return $this->json(['success' => true, 'backups' => $files]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al listar copias de seguridad'], 500);
        }
    }

    public function restoreBackup()
    {
        try {
            $b = $this->body();
            $data = $b['backupData'] ?? null;
            $filename = $b['filename'] ?? null;
            if (!Js::t($data) && Js::t($filename)) {
                $fp = self::dir() . '/' . basename(Js::str($filename));
                if (is_file($fp)) $data = json_decode(file_get_contents($fp), true, 4096, JSON_BIGINT_AS_STRING);
            }
            if (!Js::t($data) || !is_array($data) || !Js::t($data['tables'] ?? null)) {
                return $this->json(['success' => false, 'message' => 'El archivo de copia de seguridad no es válido o está corrupto.'], 400);
            }
            Db::begin();
            Db::query('SET FOREIGN_KEY_CHECKS = 0');
            $counts = [];
            foreach (self::RESTORE_ORDER as $table) {
                Db::query("DELETE FROM `{$table}`");
                $rows = $data['tables'][$table] ?? [];
                if (is_array($rows) && count($rows) > 0) {
                    $columns = array_keys($rows[0]);
                    $sql = "INSERT INTO `{$table}` (" . implode(', ', array_map(fn ($c) => "`{$c}`", $columns)) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')';
                    foreach ($rows as $row) {
                        if ($table === 'pedidos') {
                            // Respaldos antiguos: estados anteriores → nuevo flujo
                            if (($row['estado_pedido'] ?? null) === 'pendiente') $row['estado_pedido'] = 'pendiente_diseno';
                            if (($row['estado_pedido'] ?? null) === 'en_preparacion') $row['estado_pedido'] = 'en_produccion';
                        }
                        Db::query($sql, array_map(fn ($c) => array_key_exists($c, $row) ? $row[$c] : null, $columns));
                    }
                }
                $counts[$table] = is_array($rows) ? count($rows) : 0;
            }
            // Respaldos anteriores a los lotes: el stock por proveedor pasa a un lote por proveedor
            Db::try("INSERT INTO producto_lotes (producto_id, proveedor_id, codigo, fecha_compra, cantidad_inicial, stock, costo_unit, nota)\n      SELECT s.producto_id, s.proveedor_id, 'INICIAL', NULL, s.stock, s.stock, s.costo_unit, 'Restaurado desde respaldo'\n      FROM producto_proveedor_stock s WHERE s.stock > 0 AND NOT EXISTS (SELECT 1 FROM producto_lotes l WHERE l.producto_id = s.producto_id)");
            Db::query('SET FOREIGN_KEY_CHECKS = 1');
            Db::commit();
            return $this->json([
                'success' => true,
                'message' => '¡Copia de seguridad restaurada exitosamente! Reinicia el servidor (cierra y vuelve a abrir el backend) para que se apliquen las actualizaciones de estructura si la copia es antigua.',
                'restoredCounts' => $counts, 'timestamp' => Js::iso(),
            ]);
        } catch (\Throwable $e) {
            Db::try('SET FOREIGN_KEY_CHECKS = 1');
            Db::rollback();
            report($e);
            return $this->json(['success' => false, 'message' => 'Fallo al restaurar: ' . $e->getMessage()], 500);
        }
    }

    private static function wipe(string $t): void
    {
        try {
            Db::query("DELETE FROM `{$t}`");
        } catch (\Throwable $e) {
            if (\App\Support\DbError::codeOf($e) !== 'ER_NO_SUCH_TABLE') throw $e;
        }
    }

    public function resetSystem()
    {
        try {
            $b = $this->body();
            if (($b['safetyCode'] ?? null) !== 'RESET-EMPRESA') {
                return $this->json(['success' => false, 'message' => 'Código de seguridad incorrecto. Escriba "RESET-EMPRESA" exactamente para confirmar esta acción.'], 400);
            }
            $mode = $b['mode'] ?? null;
            // Modo "nuevo_inicio": sistema en cero para empezar a operar (conserva productos, usuarios, configuración...)
            if ($mode === 'nuevo_inicio') {
                $stockOpt = in_array($b['stockMode'] ?? null, ['mantener', 'saldo_inicial', 'cero'], true) ? $b['stockMode'] : 'saldo_inicial';
                $respaldo = self::writeBackupFile();
                Db::begin();
                Db::query('SET FOREIGN_KEY_CHECKS = 0');
                foreach (['comprobantes', 'pagos', 'pedido_guias', 'pedido_diseno', 'venta_asignaciones', 'cotizacion_detalles', 'cotizaciones',
                    'pedido_detalles', 'pedidos', 'compra_detalles', 'compras', 'gasto_pagos', 'gasto_detalles', 'gastos', 'clientes', 'proveedores'] as $t) self::wipe($t);
                Db::query('UPDATE productos SET proveedor_id = NULL');
                Db::query('ALTER TABLE cotizaciones AUTO_INCREMENT = 100');
                Db::query('ALTER TABLE pedidos AUTO_INCREMENT = 100');
                foreach (['pedido_detalles', 'cotizacion_detalles', 'compras', 'compra_detalles', 'gastos', 'gasto_detalles', 'gasto_pagos', 'clientes', 'proveedores', 'comprobantes', 'pagos'] as $t) {
                    Db::try("ALTER TABLE `{$t}` AUTO_INCREMENT = 1");
                }
                if ($stockOpt !== 'mantener') {
                    self::wipe('kardex_movimientos');
                    self::wipe('producto_proveedor_stock');
                    self::wipe('producto_lotes');
                    if ($stockOpt === 'cero') {
                        Db::query('UPDATE productos SET stock = 0');
                    } else {
                        Db::query("INSERT INTO producto_proveedor_stock (producto_id, proveedor_id, stock, costo_unit)\n            SELECT id, 0, stock, precio_costo FROM productos WHERE es_pack = 0 AND stock > 0");
                        Db::query("INSERT INTO producto_lotes (producto_id, proveedor_id, codigo, fecha_compra, cantidad_inicial, stock, costo_unit, nota)\n            SELECT id, 0, 'AJUSTE', NULL, stock, stock, precio_costo, 'Saldo inicial' FROM productos WHERE es_pack = 0 AND stock > 0");
                        Db::query("INSERT INTO kardex_movimientos (producto_id, fecha, tipo, motivo, cantidad, costo_unit, stock_despues)\n            SELECT id, NOW(), 'ingreso', 'Saldo inicial', stock, precio_costo, stock FROM productos WHERE es_pack = 0 AND stock > 0");
                    }
                }
                Db::query('SET FOREIGN_KEY_CHECKS = 1');
                Db::commit();
                return $this->json(['success' => true, 'mode' => 'nuevo_inicio', 'backup' => $respaldo['filename'],
                    'message' => "Sistema en cero. Antes de borrar se guardó un respaldo ({$respaldo['filename']}) en la carpeta backups. Cotizaciones y pedidos empiezan en 100."]);
            }

            Db::begin();
            Db::query('SET FOREIGN_KEY_CHECKS = 0');
            if ($mode === 'transactions_only') {
                Db::query('DELETE FROM comprobantes');
                Db::try('DELETE FROM pedido_guias');
                Db::try('DELETE FROM pedido_diseno');
                Db::try('DELETE FROM venta_asignaciones');
                Db::query('DELETE FROM pagos');
                Db::query('DELETE FROM cotizacion_detalles');
                Db::query('DELETE FROM cotizaciones');
                Db::query('ALTER TABLE cotizaciones AUTO_INCREMENT = 100');
                Db::query('DELETE FROM pedido_detalles');
                Db::query('DELETE FROM pedidos');
                Db::query('ALTER TABLE pedidos AUTO_INCREMENT = 100');
                Db::query('ALTER TABLE pedido_detalles AUTO_INCREMENT = 1');
                Db::query('SET FOREIGN_KEY_CHECKS = 1');
                Db::commit();
                return $this->json(['success' => true, 'message' => 'Limpieza operativa completada: Se eliminaron todas las ventas y pedidos. El catálogo y clientes se mantienen intactos.', 'mode' => 'transactions_only']);
            }

            // Modo "full_factory": reinicio completo para nueva empresa
            Db::query('DELETE FROM comprobantes');
            Db::try('DELETE FROM pedido_guias');
            Db::try('DELETE FROM pedido_diseno');
            Db::try('DELETE FROM venta_asignaciones');
            Db::query('DELETE FROM pagos');
            Db::query('DELETE FROM cotizacion_detalles');
            Db::query('DELETE FROM cotizaciones');
            Db::query('ALTER TABLE cotizaciones AUTO_INCREMENT = 100');
            Db::query('DELETE FROM pedido_detalles');
            Db::query('DELETE FROM pedidos');
            Db::query('DELETE FROM clientes');
            Db::try('DELETE FROM gasto_pagos');
            Db::try('DELETE FROM gasto_detalles');
            Db::try('DELETE FROM gastos');
            Db::query('DELETE FROM compra_detalles');
            Db::query('DELETE FROM compras');
            Db::query('DELETE FROM proveedores');
            Db::query('DELETE FROM tipos_cliente');
            Db::query('ALTER TABLE pedidos AUTO_INCREMENT = 100');
            Db::query('ALTER TABLE pedido_detalles AUTO_INCREMENT = 1');
            Db::query('ALTER TABLE clientes AUTO_INCREMENT = 1');
            $nc = is_array($b['newCompany'] ?? null) ? $b['newCompany'] : [];
            $nombreNueva = Js::or($nc['nombre_tienda'] ?? null, 'Mi Nueva Tienda de Regalos');
            Db::query("\n      UPDATE configuracion SET\n        nombre_tienda = ?,\n        slogan = ?,\n        ruc = ?,\n        telefono_whatsapp = ?,\n        direccion = 'Dirección Principal del Nuevo Local',\n        costo_delivery_base = 10.00\n      WHERE id = 1\n    ", [
                $nombreNueva, Js::or($nc['slogan'] ?? null, 'Detalles especiales hechos con amor'), Js::or($nc['ruc'] ?? null, '20000000001'), Js::or($nc['telefono_whatsapp'] ?? null, '+51 900 000 000'),
            ]);
            Db::query('SET FOREIGN_KEY_CHECKS = 1');
            Db::commit();
            return $this->json(['success' => true, 'message' => "¡Sistema reiniciado con éxito para la empresa \"{$nombreNueva}\"! Listo para iniciar operaciones desde cero.", 'mode' => 'full_factory']);
        } catch (\Throwable $e) {
            Db::try('SET FOREIGN_KEY_CHECKS = 1');
            Db::rollback();
            report($e);
            return $this->json(['success' => false, 'message' => 'Fallo al resetear sistema: ' . $e->getMessage()], 500);
        }
    }

    /** Resumen para las tarjetas de la pantalla de Copias de Seguridad */
    public function getSummary()
    {
        try {
            $one = function (string $sql) {
                try {
                    return Js::num(Js::or(Db::query($sql)[0]['n'] ?? null, 0));
                } catch (\Throwable $e) {
                    return 0;
                }
            };
            $database = '';
            try { $database = Js::or(Db::query('SELECT DATABASE() AS n')[0]['n'] ?? null, ''); } catch (\Throwable $e) {
            }
            return $this->json(['success' => true, 'summary' => [
                'database' => $database,
                'productos' => $one('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND COALESCE(es_pack,0) = 0'),
                'packs' => $one('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND es_pack = 1'),
                'insumos' => $one('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND es_insumo = 1'),
                'ventas' => $one("SELECT COUNT(*) AS n FROM pedidos WHERE estado_pedido <> 'cancelado'"),
                'ventasPendientes' => $one("SELECT COUNT(*) AS n FROM pedidos WHERE estado_pedido NOT IN ('entregado','cancelado')"),
                'clientes' => $one('SELECT COUNT(*) AS n FROM clientes'),
                'cotizaciones' => $one('SELECT COUNT(*) AS n FROM cotizaciones'),
            ]]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener el resumen'], 500);
        }
    }
}

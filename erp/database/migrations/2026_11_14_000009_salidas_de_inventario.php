<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Salidas de inventario: merma, productos fallados, errores de producción, muestras o uso interno.
 * Cada salida descuenta stock de los lotes (del más antiguo al más nuevo), queda en el Kardex con su motivo
 * y guarda el costo perdido. lotes_json recuerda de qué lotes salió cada línea para devolverlo si se anula.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('inventario_salidas')) {
            DB::statement("CREATE TABLE inventario_salidas (
                id INT NOT NULL AUTO_INCREMENT,
                codigo VARCHAR(20) NOT NULL,
                fecha DATE NOT NULL,
                motivo VARCHAR(30) NOT NULL,
                nota TEXT NULL,
                total_costo DECIMAL(12,2) NOT NULL DEFAULT 0,
                estado VARCHAR(12) NOT NULL DEFAULT 'registrado',
                usuario_id INT NULL,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_salinv_fecha (fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
        if (!Schema::hasTable('inventario_salida_items')) {
            DB::statement("CREATE TABLE inventario_salida_items (
                id INT NOT NULL AUTO_INCREMENT,
                salida_id INT NOT NULL,
                producto_id INT NOT NULL,
                cantidad DECIMAL(10,2) NOT NULL,
                costo_unit DECIMAL(12,4) NOT NULL DEFAULT 0,
                lotes_json TEXT NULL,
                PRIMARY KEY (id),
                KEY idx_salinvit_salida (salida_id),
                KEY idx_salinvit_producto (producto_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS inventario_salida_items');
        DB::statement('DROP TABLE IF EXISTS inventario_salidas');
    }
};

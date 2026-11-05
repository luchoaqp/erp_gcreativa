<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Contenido personalizado de un box en cada línea (ej. se quitó el lapicero y se agregó otro producto):
 *  - cotizacion_detalles.contenido_json y pedido_detalles.contenido_json: [{producto_id, nombre, cantidad, precio}]
 *  - NULL = el box va con su contenido de siempre (el de su ficha).
 * Al vender, el stock se descuenta de este contenido.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['cotizacion_detalles', 'pedido_detalles'] as $t) {
            if (!Schema::hasColumn($t, 'contenido_json')) DB::statement("ALTER TABLE {$t} ADD COLUMN contenido_json TEXT NULL");
        }
    }

    public function down(): void
    {
        foreach (['cotizacion_detalles', 'pedido_detalles'] as $t) {
            if (Schema::hasColumn($t, 'contenido_json')) DB::statement("ALTER TABLE {$t} DROP COLUMN contenido_json");
        }
    }
};

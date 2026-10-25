<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Descripción para clientes (ej. "Incluye: • 2 tazas… • Caja decorada…").
 *  - productos.web_descripcion pasa a TEXTO largo: es LA descripción para clientes (la interna sigue en "descripcion").
 *  - productos.desc_cotizacion / desc_documentos / desc_web: dónde se muestra (por defecto en todos).
 *  - cotizacion_detalles.detalle: copia editable en cada línea de la cotización (subtítulo bajo el producto).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE productos MODIFY web_descripcion TEXT NULL');
        foreach (['desc_cotizacion', 'desc_documentos', 'desc_web'] as $col) {
            if (!Schema::hasColumn('productos', $col)) {
                DB::statement("ALTER TABLE productos ADD COLUMN {$col} TINYINT(1) NOT NULL DEFAULT 1");
            }
        }
        if (!Schema::hasColumn('cotizacion_detalles', 'detalle')) {
            DB::statement('ALTER TABLE cotizacion_detalles ADD COLUMN detalle TEXT NULL AFTER descripcion');
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cotizacion_detalles', 'detalle')) DB::statement('ALTER TABLE cotizacion_detalles DROP COLUMN detalle');
        foreach (['desc_cotizacion', 'desc_documentos', 'desc_web'] as $col) {
            if (Schema::hasColumn('productos', $col)) DB::statement("ALTER TABLE productos DROP COLUMN {$col}");
        }
    }
};

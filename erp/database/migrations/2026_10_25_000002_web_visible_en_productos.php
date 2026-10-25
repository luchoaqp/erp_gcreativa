<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * NUEVO (web gcreativa.com, botón "Publicar catálogo"):
 *  - productos.web_visible     → el producto se muestra en la web
 *  - productos.web_descripcion → texto para clientes (la descripción interna del ERP NO se publica)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('productos', 'web_visible')) {
            DB::statement('ALTER TABLE productos ADD COLUMN web_visible TINYINT(1) NOT NULL DEFAULT 0');
        }
        if (!Schema::hasColumn('productos', 'web_descripcion')) {
            DB::statement('ALTER TABLE productos ADD COLUMN web_descripcion VARCHAR(300) NULL DEFAULT NULL');
        }
    }

    public function down(): void
    {
        foreach (['web_descripcion', 'web_visible'] as $col) {
            if (Schema::hasColumn('productos', $col)) DB::statement("ALTER TABLE productos DROP COLUMN {$col}");
        }
    }
};

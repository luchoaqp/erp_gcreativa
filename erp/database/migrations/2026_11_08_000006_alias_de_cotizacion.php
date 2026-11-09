<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Alias interno de la cotización (ej. el @ de Instagram/WhatsApp del cliente cuando se cotiza como «Cliente Varios").
 * Solo se ve dentro del ERP (lista de cotizaciones y al convertir en venta); nunca sale en documentos.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('cotizaciones', 'alias')) DB::statement('ALTER TABLE cotizaciones ADD COLUMN alias VARCHAR(80) NULL');
    }

    public function down(): void
    {
        if (Schema::hasColumn('cotizaciones', 'alias')) DB::statement('ALTER TABLE cotizaciones DROP COLUMN alias');
    }
};

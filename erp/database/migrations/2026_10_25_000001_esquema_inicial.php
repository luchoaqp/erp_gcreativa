<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Crea las tablas del ERP (mismo esquema que el backend Node).
 * Si la base ya tiene datos (importada desde XAMPP / phpMyAdmin), no toca nada.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('usuarios')) return; // base existente: se respeta tal cual
        DB::unprepared(file_get_contents(database_path('schema/erp_schema.sql')));
    }

    public function down(): void
    {
        // No se eliminan tablas con datos del negocio
    }
};

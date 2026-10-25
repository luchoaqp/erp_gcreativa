<?php

namespace Database\Seeders;

use App\Http\Controllers\UserController;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Datos mínimos para una instalación NUEVA (sin base importada):
 * configuración de la empresa, plantilla de documentos y un usuario administrador.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::statement("INSERT IGNORE INTO configuracion (id, nombre_tienda, ruc, slogan, telefono_whatsapp, email_contacto, direccion, moneda_simbolo, moneda_codigo, separador_decimales, separador_miles, costo_delivery_base, zonas_reparto)
            VALUES (1, 'Genia Creativa', '', 'Detalles personalizados', '+51 921 663 818', '', '', 'S/', 'PEN', '.', ',', 10.00, '[]')");
        DB::statement("INSERT IGNORE INTO cotizacion_config (id, pie_pagina) VALUES (1, 'Precios sujetos a disponibilidad de stock. ¡Gracias por su preferencia!')");

        if ((int) DB::table('usuarios')->count() === 0) {
            $email = env('ADMIN_EMAIL', 'admin@gcreativa.com');
            $pass = env('ADMIN_PASSWORD') ?: bin2hex(random_bytes(5));
            DB::table('usuarios')->insert([
                'nombre' => 'Administrador', 'email' => $email, 'password' => UserController::hash($pass),
                'rol' => 'admin', 'telefono' => '', 'avatar' => 'av:admin-0', 'estado' => 1,
                'permisos' => json_encode(UserController::rolesConfig()[0]['permisos']),
            ]);
            if ($this->command) $this->command->warn("Usuario administrador creado: {$email} / {$pass}  (cámbiala al ingresar)");
        }
    }
}

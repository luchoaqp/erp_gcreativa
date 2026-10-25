<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gestión de la web desde el ERP:
 *  - web_ajustes: textos de la página (portada, secciones, pie y datos de contacto), guardados como JSON.
 *  - web_campanas: portada general + campañas por ocasión (Navidad, Día de la Madre…), con 3 fotos,
 *    encabezado, texto y botón al catálogo. Solo una activa a la vez (si ninguna, se usa la portada general).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('web_ajustes')) {
            DB::statement("CREATE TABLE web_ajustes (
                clave VARCHAR(60) NOT NULL PRIMARY KEY,
                valor MEDIUMTEXT NULL,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
        if (!Schema::hasTable('web_campanas')) {
            DB::statement("CREATE TABLE web_campanas (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(80) NOT NULL,
                es_portada TINYINT(1) NOT NULL DEFAULT 0,
                ocasion_id INT NULL,
                titulo VARCHAR(160) NOT NULL DEFAULT '',
                texto VARCHAR(600) NOT NULL DEFAULT '',
                boton_texto VARCHAR(60) NOT NULL DEFAULT 'Ver catálogo',
                boton_destino VARCHAR(80) NOT NULL DEFAULT '',
                imagen1 VARCHAR(255) NULL, imagen2 VARCHAR(255) NULL, imagen3 VARCHAR(255) NULL,
                activa TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            DB::table('web_campanas')->insert([
                'nombre' => 'Portada general', 'es_portada' => 1,
                'titulo' => 'Detalles que se quedan en la memoria',
                'texto' => 'Regalos personalizados para ellas, para ellos, padrinos, graduados y empresas. Armamos cada caja a mano, con tu dedicatoria, y la llevamos hasta la puerta.',
                'boton_texto' => 'Ver catálogo', 'boton_destino' => '',
                'imagen1' => '/img/productos/caja-rose.svg', 'imagen2' => '/img/productos/desayuno.svg', 'imagen3' => '/img/productos/canasta-navidad.svg',
            ]);
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS web_campanas');
        DB::statement('DROP TABLE IF EXISTS web_ajustes');
    }
};

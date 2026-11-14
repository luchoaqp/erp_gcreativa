<?php

use App\Http\Controllers\WebCatalogController;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de la web con productos propios por ocasión (independientes de los productos del ERP):
 * un mismo producto se vende en varias ocasiones con otra foto, otro diseño y otro precio.
 *
 *  - web_productos: ocasión, nombre, precio "desde", lo que incluye, hasta 3 fotos, favorito, publicado y orden.
 *    producto_id solo recuerda de qué producto del ERP se copiaron los datos (opcional).
 *  - ocasiones.orden: orden de los catálogos en la web.
 *  - Los productos que hoy están publicados pasan al nuevo catálogo, uno por cada ocasión en la que se veían
 *    (su ocasión, o una categoría que se llama igual que una ocasión).
 *  - Las ocasiones dejan de usarse en el ERP: se borra la ocasión asignada a cada producto.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('ocasiones', 'orden')) {
            DB::statement('ALTER TABLE ocasiones ADD COLUMN orden INT NOT NULL DEFAULT 0');
            DB::statement('UPDATE ocasiones SET orden = id');
        }
        if (Schema::hasTable('web_productos')) return;
        DB::statement("CREATE TABLE web_productos (
            id INT NOT NULL AUTO_INCREMENT,
            ocasion_id INT NOT NULL,
            producto_id INT NULL,
            nombre VARCHAR(160) NOT NULL,
            precio DECIMAL(10,2) NOT NULL DEFAULT 0,
            incluye TEXT NULL,
            imagen1 VARCHAR(255) NULL,
            imagen2 VARCHAR(255) NULL,
            imagen3 VARCHAR(255) NULL,
            favorito TINYINT(1) NOT NULL DEFAULT 0,
            activo TINYINT(1) NOT NULL DEFAULT 1,
            orden INT NOT NULL DEFAULT 0,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_webprod_ocasion (ocasion_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Ocasiones por slug, para reconocer las categorías que se llaman igual que una ocasión
        $ocPorSlug = [];
        foreach (DB::select('SELECT id, nombre FROM ocasiones ORDER BY id') as $o) {
            $s = WebCatalogController::slug((string) $o->nombre);
            if ($s !== '' && !isset($ocPorSlug[$s])) $ocPorSlug[$s] = (int) $o->id;
        }
        $catSlug = [];
        foreach (DB::select('SELECT id, nombre FROM categorias') as $c) $catSlug[(int) $c->id] = WebCatalogController::slug((string) $c->nombre);

        $hayDescWeb = Schema::hasColumn('productos', 'desc_web');
        $publicados = DB::select('SELECT p.id, p.nombre, p.precio_venta, p.imagen_url, p.web_descripcion, p.destacado, p.ocasion_id, p.categoria_id'
            . ($hayDescWeb ? ', p.desc_web' : '') . ',
                (SELECT GROUP_CONCAT(pc.categoria_id) FROM producto_categorias pc WHERE pc.producto_id = p.id) AS cats
            FROM productos p WHERE p.activo = 1 AND p.web_visible = 1 AND COALESCE(p.es_insumo, 0) = 0 ORDER BY p.destacado DESC, p.nombre');
        $orden = 0;
        foreach ($publicados as $p) {
            $ocs = [];
            if ($p->ocasion_id) $ocs[(int) $p->ocasion_id] = true;
            $cids = $p->cats ? array_map('intval', explode(',', (string) $p->cats)) : ($p->categoria_id ? [(int) $p->categoria_id] : []);
            foreach ($cids as $cid) { $s = $catSlug[$cid] ?? ''; if ($s !== '' && isset($ocPorSlug[$s])) $ocs[$ocPorSlug[$s]] = true; }
            if (!$ocs) continue; // sin ocasión: no se veía en ningún catálogo de la web
            $img = (string) $p->imagen_url;
            $img = str_starts_with($img, '/uploads/') ? $img : null; // solo fotos propias (no las de ejemplo ni base64)
            $incluye = (!$hayDescWeb || (int) ($p->desc_web ?? 1) === 1) ? trim((string) $p->web_descripcion) : '';
            foreach (array_keys($ocs) as $oid) {
                DB::insert('INSERT INTO web_productos (ocasion_id, producto_id, nombre, precio, incluye, imagen1, favorito, activo, orden) VALUES (?,?,?,?,?,?,?,1,?)',
                    [$oid, $p->id, mb_substr((string) $p->nombre, 0, 160), (float) $p->precio_venta, $incluye === '' ? null : $incluye, $img, (int) $p->destacado ? 1 : 0, ++$orden]);
            }
        }

        // Las ocasiones ya no se usan en los productos del ERP
        DB::statement('UPDATE productos SET ocasion_id = NULL WHERE ocasion_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS web_productos');
    }
};

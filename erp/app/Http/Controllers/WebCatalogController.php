<?php

namespace App\Http\Controllers;

use App\Services\ImageStore;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * NUEVO: publica el catálogo para la web pública gcreativa.com.
 *
 * - GET  /api/web-catalog                 → vista previa de lo que se publicaría
 * - PUT  /api/web-catalog/productos/{id}  → marca/desmarca un producto como visible en la web
 * - POST /api/web-catalog/publicar        → escribe catalogo.json (y copia las fotos) en la carpeta de la web
 *
 * Se publican los productos activos marcados con "Mostrar en la web" (columna productos.web_visible).
 * Cada producto lleva como "categorias" los slugs de sus categorías del ERP y de su ocasión
 * (ej. "Graduaciones" → graduaciones, "Día del Maestro" → dia-del-maestro); la web muestra
 * como filtros solo las que tiene definidas en src/data/sitio.js.
 * Por seguridad NO se publica la descripción interna ni costos: solo productos.web_descripcion.
 * El formato es el que lee la web (src/data/catalogo.json → /data/catalogo.json).
 */
class WebCatalogController extends Controller
{
    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback . ': ' . $e->getMessage()], 500);
    }

    /** Construye el catálogo en el formato de la web */
    public static function build(): array
    {
        $rows = Db::query(
            "SELECT p.id, p.codigo, p.nombre, p.web_descripcion, p.precio_venta, p.imagen_url, p.destacado, p.categoria_id,
                    o.nombre AS ocasion,
                    (SELECT GROUP_CONCAT(pc.categoria_id) FROM producto_categorias pc WHERE pc.producto_id = p.id) AS cats
             FROM productos p
             LEFT JOIN ocasiones o ON o.id = p.ocasion_id
             WHERE p.activo = 1 AND p.web_visible = 1 AND COALESCE(p.es_insumo, 0) = 0
             ORDER BY p.destacado DESC, p.nombre"
        );
        $cats = [];
        foreach (Db::query('SELECT id, nombre, slug, color_badge FROM categorias WHERE estado = 1 ORDER BY id') as $c) $cats[$c['id']] = $c;

        $productos = [];
        $usadas = [];
        $ocasionesUsadas = [];
        foreach ($rows as $r) {
            $ids = Js::t($r['cats']) ? array_map('intval', explode(',', (string) $r['cats'])) : (Js::t($r['categoria_id']) ? [(int) $r['categoria_id']] : []);
            $slugs = [];
            foreach ($ids as $cid) {
                if (!isset($cats[$cid])) continue;
                $slugs[] = $cats[$cid]['slug'];
                $usadas[$cid] = true;
            }
            if (Js::t($r['ocasion'])) {
                $os = self::slug($r['ocasion']);
                $slugs[] = $os;
                $ocasionesUsadas[$os] = true;
            }
            $productos[] = [
                'id' => $r['id'],
                'sku' => $r['codigo'],
                'nombre' => $r['nombre'],
                'descripcion' => Js::slice(trim((string) $r['web_descripcion']), 0, 300),
                'precio' => (float) $r['precio_venta'],
                'categorias' => array_values(array_unique($slugs)),
                'imagen' => $r['imagen_url'],
                'destacado' => (bool) $r['destacado'],
            ];
        }
        $categorias = [];
        foreach ($cats as $id => $c) {
            if (!isset($usadas[$id])) continue;
            $categorias[] = ['slug' => $c['slug'], 'nombre' => $c['nombre'], 'color' => $c['color_badge'], 'tipo' => 'categoria'];
        }
        // Las ocasiones son los "catálogos" de la web: van en el orden en que se crearon en el ERP, con su emoji.
        // Si una categoría se llama igual que una ocasión, cuenta como ese catálogo (así un producto puede estar en varios).
        $porSlug = array_column($categorias, null, 'slug');
        $vistas = [];
        foreach (Db::query('SELECT id, nombre, icono FROM ocasiones ORDER BY id') as $o) {
            $slug = self::slug((string) $o['nombre']);
            if ($slug === '' || isset($vistas[$slug])) continue;
            $vistas[$slug] = true;
            $usada = isset($ocasionesUsadas[$slug]) || isset($porSlug[$slug]);
            if (!$usada) continue;
            $categorias = array_values(array_filter($categorias, fn ($c) => $c['slug'] !== $slug));
            $categorias[] = ['slug' => $slug, 'nombre' => $o['nombre'], 'color' => null, 'tipo' => 'ocasion', 'icono' => Js::t($o['icono']) ? $o['icono'] : null];
        }
        return [
            'version' => gmdate('Y-m-d\TH:i:s\Z'),
            'actualizado' => date('c'),
            'categorias' => $categorias,
            'productos' => $productos,
        ];
    }

    /** "Día del Maestro" → "dia-del-maestro" */
    public static function slug(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', '&' => 'y']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    }

    public function preview()
    {
        try {
            $cat = self::build();
            return $this->json(['success' => true, 'total' => count($cat['productos']), 'catalogo' => $cat, 'destino' => config('erp.catalogo_web_path')]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al preparar el catálogo web');
        }
    }

    /** Lista para la pantalla /catalogo-web: todos los productos vendibles con su marca de visibilidad */
    /** Lista para la pantalla /catalogo-web: productos vendibles con su ocasión, categorías y estado en la web */
    public function products()
    {
        try {
            $rows = Db::query(
                "SELECT p.id, p.codigo, p.nombre, p.precio_venta, p.imagen_url, p.activo, p.destacado, p.web_visible, p.web_descripcion,
                        p.ocasion_id, c.nombre AS categoria, o.nombre AS ocasion,
                        (SELECT GROUP_CONCAT(pc.categoria_id) FROM producto_categorias pc WHERE pc.producto_id = p.id) AS cats, p.categoria_id
                 FROM productos p
                 LEFT JOIN categorias c ON c.id = p.categoria_id
                 LEFT JOIN ocasiones o ON o.id = p.ocasion_id
                 WHERE COALESCE(p.es_insumo, 0) = 0
                 ORDER BY p.activo DESC, p.web_visible DESC, p.nombre"
            );
            foreach ($rows as &$r) {
                if (str_starts_with((string) $r['imagen_url'], 'data:')) $r['imagen_url'] = null; // la lista no necesita base64 pesados
                $ids = Js::t($r['cats']) ? array_map('intval', explode(',', (string) $r['cats'])) : [];
                if (Js::t($r['categoria_id'])) $ids[] = (int) $r['categoria_id'];
                $r['categoria_ids'] = array_values(array_unique($ids));
                unset($r['cats']);
            }
            unset($r);
            return $this->json([
                'success' => true,
                'productos' => $rows,
                'ocasiones' => Db::query('SELECT id, nombre, icono FROM ocasiones ORDER BY id'),
                'categorias' => Db::query('SELECT id, nombre FROM categorias WHERE estado = 1 ORDER BY nombre'),
                'destino' => config('erp.catalogo_web_path'),
            ]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al listar productos');
        }
    }

    public function setVisible($id)
    {
        try {
            $b = $this->body();
            $set = [];
            if (array_key_exists('web_visible', $b)) $set['web_visible'] = Js::t($b['web_visible']) ? 1 : 0;
            if (array_key_exists('web_descripcion', $b)) $set['web_descripcion'] = Js::t($b['web_descripcion']) ? Js::slice(trim((string) $b['web_descripcion']), 0, 300) : null;
            // Favorito = el mismo "Destacado" de la ficha del producto (portada de la web y de cada catálogo)
            if (array_key_exists('destacado', $b)) $set['destacado'] = Js::t($b['destacado']) ? 1 : 0;
            if (!$set) throw new HttpError(400, 'Envía web_visible, web_descripcion y/o destacado');
            $r = Db::query('UPDATE productos SET ? WHERE id = ?', [$set, $id]);
            if (!$r['affectedRows']) throw new HttpError(404, 'Producto no encontrado');
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al actualizar el producto');
        }
    }

    public function publish()
    {
        try {
            $destino = (string) config('erp.catalogo_web_path');
            if ($destino === '') throw new HttpError(400, 'Falta configurar CATALOGO_WEB_PATH en el archivo .env del ERP (ruta del catalogo.json de la web).');
            $cat = self::build();

            // Fotos: si hay carpeta de imágenes de la web, se copian ahí (la web no depende del ERP);
            // si no, se usa la URL completa del ERP.
            $dirImg = (string) config('erp.catalogo_web_imagenes');
            $urlImg = rtrim((string) config('erp.catalogo_web_url_imagenes'), '/');
            $erpUrl = rtrim((string) config('app.url'), '/');
            $sinFoto = 0;
            foreach ($cat['productos'] as &$p) {
                $img = (string) $p['imagen'];
                if ($img === '') { $p['imagen'] = null; $sinFoto++; continue; }
                if (ImageStore::isStored($img)) {
                    $name = basename($img);
                    if (!is_file(ImageStore::fullDir() . '/' . $name)) { $p['imagen'] = null; $sinFoto++; continue; }
                    if ($dirImg !== '') {
                        if (!is_dir($dirImg)) @mkdir($dirImg, 0775, true);
                        $src = ImageStore::fullDir() . '/' . $name;
                        if (is_file($src) && !is_file($dirImg . '/' . $name)) @copy($src, $dirImg . '/' . $name);
                        $p['imagen'] = $urlImg . '/' . $name;
                    } else {
                        $p['imagen'] = $erpUrl . $img;
                    }
                }
            }
            unset($p);

            $dir = dirname($destino);
            if (!is_dir($dir) && !@mkdir($dir, 0775, true)) throw new HttpError(500, 'No se pudo crear la carpeta ' . $dir);
            $tmp = $destino . '.tmp';
            $json = json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $destino)) {
                throw new HttpError(500, 'No se pudo escribir ' . $destino . ' (revisa permisos de la carpeta)');
            }
            return $this->json(['success' => true, 'message' => 'Catálogo publicado en la web: ' . count($cat['productos']) . ' producto(s)' . ($sinFoto ? " ({$sinFoto} sin foto)" : ''), 'sin_foto' => $sinFoto, 'version' => $cat['version'], 'total' => count($cat['productos'])]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al publicar el catálogo');
        }
    }
}

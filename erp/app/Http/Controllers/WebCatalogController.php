<?php

namespace App\Http\Controllers;

use App\Services\ImageStore;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * Catálogo de la web pública gcreativa.com, gestionado desde /catalogo-web.
 *
 * Los productos de la web son PROPIOS de cada ocasión (tabla web_productos), independientes de los productos
 * del ERP: un mismo producto se vende en varias ocasiones con otra foto, otro diseño y otro precio.
 * Las ocasiones son los "catálogos" de la web (Día de la Madre, Profesiones…) y se gestionan aquí.
 *
 * - GET    /api/web-catalog                       → vista previa de lo que se publicaría
 * - GET    /api/web-catalog/productos             → productos web, ocasiones y productos del ERP (para copiar datos)
 * - POST   /api/web-catalog/productos             → crear producto web
 * - PUT    /api/web-catalog/productos/{id}        → editar (también cambios sueltos: activo, favorito)
 * - DELETE /api/web-catalog/productos/{id}        → eliminar
 * - POST   /api/web-catalog/ocasiones             → crear ocasión · PUT …/{id} editar · DELETE …/{id} eliminar
 * - PUT    /api/web-catalog/ocasiones-orden       → orden de los catálogos en la web
 * - POST   /api/web-catalog/publicar              → escribe catalogo.json y sitio.json (y copia las fotos) en la web
 */
class WebCatalogController extends Controller
{
    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback . ': ' . $e->getMessage()], 500);
    }

    /** "Día del Maestro" → "dia-del-maestro" */
    public static function slug(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', '&' => 'y']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    }

    private static function ocasiones(): array
    {
        $rows = Db::query('SELECT o.id, o.nombre, o.icono, o.orden,
                (SELECT COUNT(*) FROM web_productos w WHERE w.ocasion_id = o.id) AS total,
                (SELECT COUNT(*) FROM web_productos w WHERE w.ocasion_id = o.id AND w.activo = 1) AS publicados
            FROM ocasiones o ORDER BY o.orden, o.id');
        foreach ($rows as &$o) $o['slug'] = self::slug((string) $o['nombre']);
        unset($o);
        return $rows;
    }

    /** Construye el catálogo en el formato que lee la web (data/catalogo.json) */
    public static function build(): array
    {
        $ocs = self::ocasiones();
        $porId = array_column($ocs, null, 'id');
        $rows = Db::query('SELECT w.* FROM web_productos w JOIN ocasiones o ON o.id = w.ocasion_id WHERE w.activo = 1 ORDER BY o.orden, o.id, w.favorito DESC, w.orden, w.id');
        $productos = [];
        $usadas = [];
        foreach ($rows as $r) {
            $o = $porId[$r['ocasion_id']] ?? null;
            if (!$o || $o['slug'] === '') continue;
            $usadas[$o['id']] = true;
            $imgs = array_values(array_filter([$r['imagen1'], $r['imagen2'], $r['imagen3']], fn ($v) => Js::t($v)));
            $productos[] = [
                'id' => (int) $r['id'],
                'sku' => null,
                'nombre' => $r['nombre'],
                'descripcion' => mb_substr(trim((string) $r['incluye']), 0, 2000),
                'precio' => (float) $r['precio'],
                'ocasion' => $o['slug'],
                'categorias' => [$o['slug']],
                'imagen' => $imgs[0] ?? null,
                'imagenes' => $imgs,
                'destacado' => (bool) $r['favorito'],
            ];
        }
        $categorias = [];
        $vistas = [];
        foreach ($ocs as $o) {
            if (!isset($usadas[$o['id']]) || isset($vistas[$o['slug']])) continue;
            $vistas[$o['slug']] = true;
            $categorias[] = ['slug' => $o['slug'], 'nombre' => $o['nombre'], 'color' => null, 'tipo' => 'ocasion', 'icono' => Js::t($o['icono']) ? $o['icono'] : null];
        }
        return ['version' => gmdate('Y-m-d\TH:i:s\Z'), 'actualizado' => date('c'), 'categorias' => $categorias, 'productos' => $productos];
    }

    /** Escribe un JSON de forma segura (archivo temporal + renombrar) con permisos de lectura para la web */
    private static function escribir(string $ruta, array $datos): void
    {
        $tmp = $ruta . '.tmp';
        $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $ruta)) {
            throw new HttpError(500, 'No se pudo escribir ' . $ruta . ' (revisa permisos de la carpeta)');
        }
        @chmod($ruta, 0644);
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

    /* ======================= Productos web ======================= */

    /** Datos del panel: productos web, ocasiones y productos del ERP (solo para copiar datos al crear) */
    public function products()
    {
        try {
            $erp = Db::query("SELECT p.id, p.codigo, p.nombre, p.precio_venta, p.web_descripcion, p.imagen_url
                FROM productos p WHERE p.activo = 1 AND COALESCE(p.es_insumo, 0) = 0 ORDER BY p.nombre");
            foreach ($erp as &$p) if (!str_starts_with((string) $p['imagen_url'], '/uploads/')) $p['imagen_url'] = null;
            unset($p);
            return $this->json([
                'success' => true,
                'productos' => Db::query('SELECT * FROM web_productos ORDER BY ocasion_id, favorito DESC, orden, id'),
                'ocasiones' => self::ocasiones(),
                'erp' => $erp,
                'destino' => config('erp.catalogo_web_path'),
            ]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al listar productos');
        }
    }

    private static function texto($v, int $max): ?string
    {
        $t = trim(str_replace("\r\n", "\n", (string) ($v ?? '')));
        return $t === '' ? null : mb_substr($t, 0, $max);
    }

    /** Valida y arma los datos de un producto web; $actual = fila guardada (al editar, admite cambios parciales) */
    private static function datosProducto(array $b, ?array $actual = null): array
    {
        $d = [];
        $tiene = fn ($k) => array_key_exists($k, $b);
        if (!$actual || $tiene('ocasion_id')) {
            $oid = (int) ($b['ocasion_id'] ?? 0);
            if (!$oid || !count(Db::query('SELECT id FROM ocasiones WHERE id = ?', [$oid]))) throw new HttpError(400, 'Elige la ocasión del producto');
            $d['ocasion_id'] = $oid;
        }
        if (!$actual || $tiene('nombre')) {
            $n = self::texto($b['nombre'] ?? '', 160);
            if (!$n) throw new HttpError(400, 'Escribe el nombre del producto');
            $d['nombre'] = $n;
        }
        if (!$actual || $tiene('precio')) {
            $pr = Js::num($b['precio'] ?? 0);
            if (Js::isNaN($pr) || $pr < 0) throw new HttpError(400, 'Precio no válido');
            $d['precio'] = round($pr, 2);
        }
        if ($tiene('incluye')) $d['incluye'] = self::texto($b['incluye'], 2000);
        if ($tiene('producto_id')) $d['producto_id'] = Js::t($b['producto_id']) ? (int) $b['producto_id'] : null;
        foreach (['activo', 'favorito'] as $k) if ($tiene($k)) $d[$k] = Js::t($b[$k]) ? 1 : 0;
        if (!$actual) { $d['activo'] = $d['activo'] ?? 1; $d['favorito'] = $d['favorito'] ?? 0; }
        foreach (['imagen1', 'imagen2', 'imagen3'] as $k) {
            if ($tiene($k)) $d[$k] = WebSiteController::imagen($b[$k], $actual[$k] ?? null, 'producto');
        }
        // Fotos sin huecos: la primera es la de la tarjeta
        if (array_intersect(['imagen1', 'imagen2', 'imagen3'], array_keys($d))) {
            $f = array_values(array_filter([$d['imagen1'] ?? $actual['imagen1'] ?? null, $d['imagen2'] ?? $actual['imagen2'] ?? null, $d['imagen3'] ?? $actual['imagen3'] ?? null]));
            foreach ([1, 2, 3] as $i) $d['imagen' . $i] = $f[$i - 1] ?? null;
        }
        return $d;
    }

    /** Borra fotos subidas para productos web que ya ningún producto web usa */
    private static function limpiarFotos(array $rutas): void
    {
        $dir = rtrim((string) config('erp.uploads_root'), '/') . '/web';
        foreach (array_unique(array_filter($rutas)) as $r) {
            if (!str_starts_with((string) $r, '/uploads/web/producto-')) continue;
            $uso = Db::query('SELECT COUNT(*) AS n FROM web_productos WHERE imagen1 = ? OR imagen2 = ? OR imagen3 = ?', [$r, $r, $r])[0]['n'] ?? 0;
            if ((int) $uso === 0) @unlink($dir . '/' . basename((string) $r));
        }
    }

    private function fila($id): array
    {
        $r = Db::query('SELECT * FROM web_productos WHERE id = ?', [$id])[0] ?? null;
        if (!$r) throw new HttpError(404, 'Producto no encontrado');
        return $r;
    }

    public function createProducto()
    {
        try {
            $d = self::datosProducto($this->body());
            $d['orden'] = (int) (Db::query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM web_productos WHERE ocasion_id = ?', [$d['ocasion_id']])[0]['n'] ?? 1);
            $r = Db::query('INSERT INTO web_productos SET ?', [$d]);
            return $this->json(['success' => true, 'message' => 'Producto creado', 'producto' => $this->fila($r['insertId'])], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al crear el producto');
        }
    }

    public function updateProducto($id)
    {
        try {
            $actual = $this->fila($id);
            $d = self::datosProducto($this->body(), $actual);
            if (!$d) throw new HttpError(400, 'No hay cambios');
            Db::query('UPDATE web_productos SET ? WHERE id = ?', [$d, $id]);
            self::limpiarFotos([$actual['imagen1'], $actual['imagen2'], $actual['imagen3']]);
            return $this->json(['success' => true, 'message' => 'Producto guardado', 'producto' => $this->fila($id)]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar el producto');
        }
    }

    public function deleteProducto($id)
    {
        try {
            $actual = $this->fila($id);
            Db::query('DELETE FROM web_productos WHERE id = ?', [$id]);
            self::limpiarFotos([$actual['imagen1'], $actual['imagen2'], $actual['imagen3']]);
            return $this->json(['success' => true, 'message' => 'Producto eliminado']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al eliminar el producto');
        }
    }

    /* ======================= Ocasiones (catálogos de la web) ======================= */

    private static function datosOcasion(array $b): array
    {
        $nombre = self::texto($b['nombre'] ?? '', 60);
        if (!$nombre) throw new HttpError(400, 'Escribe el nombre de la ocasión');
        if (self::slug($nombre) === '') throw new HttpError(400, 'El nombre necesita al menos una letra o número');
        $icono = self::texto($b['icono'] ?? '', 16) ?? '🎁';
        return ['nombre' => $nombre, 'icono' => $icono];
    }

    public function createOcasion()
    {
        try {
            $d = self::datosOcasion($this->body());
            $slugs = array_map(fn ($o) => $o['slug'], self::ocasiones());
            if (in_array(self::slug($d['nombre']), $slugs, true)) throw new HttpError(400, 'Ya existe una ocasión con ese nombre');
            $d['orden'] = (int) (Db::query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM ocasiones')[0]['n'] ?? 1);
            Db::query('INSERT INTO ocasiones SET ?', [$d]);
            return $this->json(['success' => true, 'message' => "Ocasión «{$d['nombre']}» creada", 'ocasiones' => self::ocasiones()], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al crear la ocasión');
        }
    }

    public function updateOcasion($id)
    {
        try {
            $d = self::datosOcasion($this->body());
            foreach (self::ocasiones() as $o) if ((int) $o['id'] !== (int) $id && $o['slug'] === self::slug($d['nombre'])) throw new HttpError(400, 'Ya existe una ocasión con ese nombre');
            $r = Db::query('UPDATE ocasiones SET ? WHERE id = ?', [$d, $id]);
            if (!$r['affectedRows'] && !count(Db::query('SELECT id FROM ocasiones WHERE id = ?', [$id]))) throw new HttpError(404, 'Ocasión no encontrada');
            return $this->json(['success' => true, 'message' => 'Ocasión guardada', 'ocasiones' => self::ocasiones()]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar la ocasión');
        }
    }

    public function deleteOcasion($id)
    {
        try {
            $n = (int) (Db::query('SELECT COUNT(*) AS n FROM web_productos WHERE ocasion_id = ?', [$id])[0]['n'] ?? 0);
            if ($n > 0) throw new HttpError(400, "La ocasión tiene {$n} producto(s): elimínalos o muévelos a otra ocasión primero.");
            Db::query('UPDATE web_campanas SET ocasion_id = NULL WHERE ocasion_id = ?', [$id]);
            Db::query('DELETE FROM ocasiones WHERE id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Ocasión eliminada', 'ocasiones' => self::ocasiones()]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al eliminar la ocasión');
        }
    }

    /** Orden de los catálogos: { ids: [3, 1, 2] } */
    public function ordenOcasiones()
    {
        try {
            $ids = $this->body()['ids'] ?? null;
            if (!is_array($ids)) throw new HttpError(400, 'Envía el orden');
            foreach (array_values($ids) as $i => $id) Db::query('UPDATE ocasiones SET orden = ? WHERE id = ?', [$i + 1, (int) $id]);
            return $this->json(['success' => true, 'ocasiones' => self::ocasiones()]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al ordenar');
        }
    }

    /* ======================= Publicar ======================= */

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
            $uploads = rtrim((string) config('erp.uploads_root'), '/');
            $copiar = function (?string $ruta) use ($dirImg, $urlImg, $erpUrl, $uploads): ?string {
                $ruta = (string) $ruta;
                if ($ruta === '') return null;
                if (str_starts_with($ruta, '/uploads/web/')) $src = $uploads . '/web/' . basename($ruta);
                elseif (ImageStore::isStored($ruta)) $src = ImageStore::fullDir() . '/' . basename($ruta);
                else return $ruta; // foto propia de la web (/img/…) o URL externa
                if (!is_file($src)) return null;
                if ($dirImg === '') return $erpUrl . $ruta;
                if (!is_dir($dirImg)) @mkdir($dirImg, 0775, true);
                $name = basename($ruta);
                if (!is_file($dirImg . '/' . $name)) { @copy($src, $dirImg . '/' . $name); @chmod($dirImg . '/' . $name, 0644); }
                return $urlImg . '/' . $name;
            };
            $sinFoto = 0;
            foreach ($cat['productos'] as &$p) {
                $p['imagenes'] = array_values(array_filter(array_map($copiar, $p['imagenes'])));
                $p['imagen'] = $p['imagenes'][0] ?? null;
                if (!$p['imagen']) $sinFoto++;
            }
            unset($p);

            $dir = dirname($destino);
            if (!is_dir($dir) && !@mkdir($dir, 0775, true)) throw new HttpError(500, 'No se pudo crear la carpeta ' . $dir);
            self::escribir($destino, $cat);

            // Textos, contacto y portada/campaña activa → data/sitio.json (junto al catálogo)
            $sitio = WebSiteController::buildSitio(fn (string $ruta) => $copiar($ruta) ?? $ruta);
            self::escribir($dir . '/sitio.json', $sitio);
            $portada = $sitio['portada']['campana'] ?? null;
            $nCat = count($cat['categorias']);
            return $this->json(['success' => true, 'message' => 'Web publicada: ' . count($cat['productos']) . " producto(s) en {$nCat} catálogo(s)" . ($sinFoto ? " ({$sinFoto} sin foto)" : '') . ' · portada: ' . ($portada ? "campaña {$portada}" : 'general'), 'sin_foto' => $sinFoto, 'version' => $cat['version'], 'total' => count($cat['productos'])]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al publicar el catálogo');
        }
    }
}

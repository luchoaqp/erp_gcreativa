<?php

namespace App\Http\Controllers;

use App\Services\ImageStore;
use App\Services\Kardex;
use App\Services\Productos;
use App\Services\StockProv;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class ProductController extends Controller
{
    public const IMG_DEFAULT = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&auto=format&fit=crop&q=80';
    private const UNIDADES = ['NIU', 'KGM', 'MTR', 'LTR', 'BX', 'DZN', 'PK', 'SET'];

    // Stock de un pack = lo que se puede armar con el stock de sus componentes
    public const STOCK_SQL = "CASE WHEN p.es_pack = 1 THEN COALESCE((\n  SELECT MIN(FLOOR(c.stock / NULLIF(pc.cantidad, 0))) FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id\n  WHERE pc.producto_id = p.id), 0) ELSE p.stock END";

    public static function r2($n) { return Js::roundTo($n, 2); }

    public static function bool($v): int
    {
        return ($v === true || $v === 1 || $v === 1.0 || $v === '1' || $v === 'true') ? 1 : 0;
    }

    public static function numOrNull($v)
    {
        if ($v === '' || $v === null || $v instanceof \App\Support\Undef) return null;
        $n = Js::num($v);
        return Js::isNaN($n) ? null : $n;
    }

    public static function txt($v, int $max): ?string
    {
        $s = Js::slice(Js::trim($v ?? ''), 0, $max);
        return $s !== '' ? $s : null;
    }

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    // ---------- Listado ----------
    public function getProducts()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $sql = "\n      SELECT p.*, " . self::STOCK_SQL . " AS stock,\n        c.nombre AS categoria_nombre, c.color_badge, o.nombre AS ocasion_nombre, m.nombre AS marca_nombre,\n        (SELECT GROUP_CONCAT(pc2.categoria_id) FROM producto_categorias pc2 WHERE pc2.producto_id = p.id) AS categorias_ids,\n        (SELECT GROUP_CONCAT(c2.nombre ORDER BY c2.nombre SEPARATOR ', ') FROM producto_categorias pc3 JOIN categorias c2 ON c2.id = pc3.categoria_id WHERE pc3.producto_id = p.id) AS categorias_nombres\n      FROM productos p\n      LEFT JOIN categorias c ON p.categoria_id = c.id\n      LEFT JOIN ocasiones o ON p.ocasion_id = o.id\n      LEFT JOIN marcas m ON p.marca_id = m.id\n      WHERE 1=1";
            $params = [];
            if ($g('estado') === 'deshabilitados') $sql .= ' AND p.activo = 0';
            elseif ($g('estado') !== 'todos') $sql .= ' AND p.activo = 1';
            if ($g('tipo') === 'pack') $sql .= ' AND p.es_pack = 1';
            elseif ($g('tipo') === 'producto') $sql .= ' AND p.es_pack = 0';
            elseif ($g('tipo') === 'insumo') $sql .= ' AND p.es_insumo = 1';
            if (Js::t($g('categoria_id'))) { $sql .= ' AND (p.categoria_id = ? OR EXISTS (SELECT 1 FROM producto_categorias x WHERE x.producto_id = p.id AND x.categoria_id = ?))'; array_push($params, $g('categoria_id'), $g('categoria_id')); }
            if (Js::t($g('ocasion_id'))) { $sql .= ' AND p.ocasion_id = ?'; $params[] = $g('ocasion_id'); }
            if (Js::t($g('marca_id'))) { $sql .= ' AND p.marca_id = ?'; $params[] = $g('marca_id'); }
            if (Js::t($g('search'))) {
                $sql .= ' AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.descripcion LIKE ? OR p.codigo_barras LIKE ? OR p.nombre_secundario LIKE ?)';
                $s = '%' . Js::str($g('search')) . '%';
                array_push($params, $s, $s, $s, $s, $s);
            }
            $sql .= ' ORDER BY p.destacado DESC, p.id DESC';
            $products = Db::query($sql, $params);
            $f = function ($cond) use (&$products) { $products = array_values(array_filter($products, $cond)); };
            if ($g('stock_bajo') === 'true') $f(fn ($p) => Js::num($p['stock']) <= Js::num($p['stock_minimo']));
            if ($g('stock') === 'con') $f(fn ($p) => Js::num($p['stock']) > 0);
            if ($g('stock') === 'sin') $f(fn ($p) => Js::num($p['stock']) <= 0);
            if ($g('stock') === 'bajo') $f(fn ($p) => Js::num($p['stock']) <= Js::num($p['stock_minimo']));

            $ids = array_column($products, 'id');
            $escalas = $porProv = $porLote = [];
            if (count($ids)) {
                foreach (Db::query('SELECT producto_id, etiqueta, factor, precio FROM producto_presentaciones WHERE producto_id IN (?) ORDER BY factor', [$ids]) as $x) {
                    $escalas[$x['producto_id']][] = ['etiqueta' => $x['etiqueta'], 'factor' => $x['factor'], 'precio' => Js::num($x['precio'])];
                }
                foreach (Db::query("SELECT s.producto_id, s.proveedor_id, s.stock, s.costo_unit, COALESCE(pr.nombre, 'Sin proveedor') AS proveedor\n         FROM producto_proveedor_stock s LEFT JOIN proveedores pr ON pr.id = s.proveedor_id\n         WHERE s.producto_id IN (?) AND s.stock > 0 ORDER BY s.stock DESC", [$ids]) as $x) {
                    $porProv[$x['producto_id']][] = ['proveedor_id' => $x['proveedor_id'], 'proveedor' => $x['proveedor'], 'stock' => Js::num($x['stock']), 'costo_unit' => Js::num($x['costo_unit'])];
                }
                foreach (Db::query("SELECT l.id, l.producto_id, l.proveedor_id, l.codigo, l.fecha_compra, l.stock, l.costo_unit, COALESCE(pr.nombre, 'Sin proveedor') AS proveedor\n         FROM producto_lotes l LEFT JOIN proveedores pr ON pr.id = l.proveedor_id\n         WHERE l.producto_id IN (?) AND l.estado = 1 AND l.stock > 0\n         ORDER BY (l.fecha_compra IS NULL) DESC, l.fecha_compra ASC, l.id ASC", [$ids]) as $x) {
                    $porLote[$x['producto_id']][] = ['id' => $x['id'], 'codigo' => $x['codigo'], 'proveedor_id' => $x['proveedor_id'], 'proveedor' => $x['proveedor'], 'fecha_compra' => $x['fecha_compra'], 'stock' => Js::num($x['stock']), 'costo_unit' => Js::num($x['costo_unit'])];
                }
            }
            $products = array_map(function ($p) use ($escalas, $porProv, $porLote) {
                $p['stock'] = Js::num($p['stock']);
                $p['escalas'] = $escalas[$p['id']] ?? [];
                $p['stock_proveedores'] = $porProv[$p['id']] ?? [];
                $p['lotes'] = $porLote[$p['id']] ?? [];
                $p['categorias_ids'] = Js::t($p['categorias_ids'])
                    ? array_map(fn ($x) => Js::num($x), explode(',', Js::str($p['categorias_ids'])))
                    : (Js::t($p['categoria_id']) ? [$p['categoria_id']] : []);
                $p['categoria_nombre'] = Js::or($p['categorias_nombres'], $p['categoria_nombre']);
                return $p;
            }, $products);
            return $this->json(['success' => true, 'products' => $products]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener productos');
        }
    }

    public static function loadComponents($productId): array
    {
        $rows = Db::query("\n    SELECT pc.*, c.nombre, c.codigo, c.stock, c.precio_costo, c.precio_venta, c.precio_insumo, c.imagen_url\n    FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id\n    WHERE pc.producto_id = ? ORDER BY pc.id", [$productId]);
        return array_map(function ($r) {
            $ins = $r['precio_insumo'] !== null ? Js::num($r['precio_insumo']) : Js::num($r['precio_venta']);
            $cambio = abs($ins - Js::num($r['precio_ref'])) > 0.009 || abs(Js::num($r['precio_costo']) - Js::num($r['costo_ref'])) > 0.009;
            return [
                'id' => $r['id'], 'componente_id' => $r['componente_id'], 'nombre' => $r['nombre'], 'codigo' => $r['codigo'], 'stock' => $r['stock'], 'imagen_url' => $r['imagen_url'],
                'cantidad' => Js::num($r['cantidad']), 'precio_unit' => Js::num($r['precio_unit']),
                'precio_insumo_actual' => $ins, 'costo_actual' => Js::num($r['precio_costo']), 'precio_venta_actual' => Js::num($r['precio_venta']),
                'precio_ref' => Js::num($r['precio_ref']), 'costo_ref' => Js::num($r['costo_ref']), 'cambio' => $cambio,
            ];
        }, $rows);
    }

    public function getProductById($id)
    {
        try {
            $products = Db::query("\n      SELECT p.*, c.nombre AS categoria_nombre, o.nombre AS ocasion_nombre, m.nombre AS marca_nombre\n      FROM productos p\n      LEFT JOIN categorias c ON p.categoria_id = c.id\n      LEFT JOIN ocasiones o ON p.ocasion_id = o.id\n      LEFT JOIN marcas m ON p.marca_id = m.id\n      WHERE p.id = ?", [$id]);
            if (count($products) === 0) throw new HttpError(404, 'Producto no encontrado');
            $pres = Db::query('SELECT id, etiqueta, descripcion, factor, precio FROM producto_presentaciones WHERE producto_id = ? ORDER BY factor', [$id]);
            $componentes = self::loadComponents($id);
            $cats = Db::query('SELECT categoria_id FROM producto_categorias WHERE producto_id = ?', [$id]);
            $p = $products[0];
            $p['categorias_ids'] = count($cats) ? array_column($cats, 'categoria_id') : (Js::t($p['categoria_id']) ? [$p['categoria_id']] : []);
            $p['presentaciones'] = array_map(function ($x) { $x['precio'] = Js::num($x['precio']); return $x; }, $pres);
            $p['componentes'] = $componentes;
            return $this->json(['success' => true, 'product' => $p]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener producto');
        }
    }

    // ---------- Crear / actualizar ----------
    public static function validateAndSave(array $b, $id)
    {
        $has = fn ($k) => array_key_exists($k, $b);
        $v = fn ($k) => $b[$k] ?? null;
        $nombre = self::txt($v('nombre'), 120);
        if ($nombre === null) throw new HttpError(400, 'El nombre es obligatorio');
        $precioVenta = Js::num($has('precio_venta') ? $b['precio_venta'] : Js::undef());
        if (!($precioVenta >= 0) || Js::isNaN($precioVenta) || $v('precio_venta') === '' || $v('precio_venta') === null) throw new HttpError(400, 'El precio de venta es obligatorio');
        $esPack = self::bool($v('es_pack'));
        $compras = self::numOrNull($v('precio_costo')) ?? 0;
        if ($compras < 0) throw new HttpError(400, 'El precio de compra no puede ser negativo');

        $codigo = self::txt($v('codigo'), 30);
        if ($codigo === null) $codigo = Productos::nextInternalCode();
        $dup = Db::query('SELECT id FROM productos WHERE codigo = ? AND id != ?', [$codigo, Js::or($id, 0)]);
        if (count($dup)) throw new HttpError(409, "El código interno {$codigo} ya existe");

        $unidad = in_array($v('unidad'), self::UNIDADES, true) ? $b['unidad'] : 'NIU';
        $rawCats = Js::isArray($v('categorias_ids')) ? $b['categorias_ids'] : (Js::t($v('categoria_id')) ? [$b['categoria_id']] : []);
        $catIds = [];
        foreach ($rawCats as $c) { $n = Js::num($c); if ($n > 0 && !in_array($n, $catIds, true)) $catIds[] = $n; }
        $precioInsumo = self::numOrNull($v('precio_insumo'));
        $data = [
            'codigo' => $codigo, 'nombre' => $nombre, 'descripcion' => Js::slice(Js::str($v('descripcion') ?? ''), 0, 2000),
            'categoria_id' => Js::or($catIds[0] ?? null, null),
            'ocasion_id' => Js::t($v('ocasion_id')) ? Js::num($b['ocasion_id']) : null,
            'precio_costo' => self::r2($compras), 'precio_venta' => self::r2($precioVenta),
            'stock_minimo' => max(0, Js::round(Js::or(Js::num($v('stock_minimo')), 0))),
            'imagen_url' => Js::t($v('imagen_url')) ? Js::str($b['imagen_url']) : self::IMG_DEFAULT,
            'es_personalizable' => self::bool($v('es_personalizable')), 'destacado' => self::bool($v('destacado')),
            'unidad' => $unidad, 'moneda' => 'PEN', 'marca_id' => Js::t($v('marca_id')) ? Js::num($b['marca_id']) : null,
            'codigo_barras' => self::txt($v('codigo_barras'), 50), 'nombre_secundario' => self::txt($v('nombre_secundario'), 120),
            'modelo' => self::txt($v('modelo'), 80), 'linea' => self::txt($v('linea'), 80), 'codigo_fabrica' => self::txt($v('codigo_fabrica'), 60),
            'precio_editable' => !$has('precio_editable') ? 1 : self::bool($b['precio_editable']),
            'precio_por_cantidad' => self::bool($v('precio_por_cantidad')),
            'proveedor_id' => Js::t($v('proveedor_id')) ? Js::num($b['proveedor_id']) : null,
            'ganancia_pct' => self::numOrNull($v('ganancia_pct')), 'calcular_con_ganancia' => self::bool($v('calcular_con_ganancia')),
            'requiere_insumos' => self::bool($v('requiere_insumos')), 'es_insumo' => self::bool($v('es_insumo')),
            'precio_insumo' => $precioInsumo === null ? null : self::r2($precioInsumo),
            'es_pack' => $esPack,
        ];
        if ($has('activo')) $data['activo'] = self::bool($b['activo']);
        // Descripción para clientes (cotizaciones, documentos de venta y web). La "descripcion" de arriba es interna.
        if ($has('web_descripcion')) {
            $txt = trim(str_replace("\r\n", "\n", Js::str($b['web_descripcion'] ?? '')));
            $data['web_descripcion'] = $txt === '' ? null : mb_substr($txt, 0, 2000);
        }
        foreach (['desc_cotizacion', 'desc_documentos', 'desc_web'] as $flag) {
            if ($has($flag)) $data[$flag] = self::bool($b[$flag]);
        }
        if (!$esPack && $has('stock') && $b['stock'] !== '') $data['stock'] = max(0, Js::round(Js::or(Js::num($b['stock']), 0)));
        if ($esPack) $data['stock'] = 0;

        $productId = $id;
        $stockAnterior = null;
        $oldImage = null;
        if (str_starts_with(Js::str($data['imagen_url']), 'data:image/')) {
            $url = ImageStore::saveProductImage($data['imagen_url'], $v('imagen_thumb'));
            $data['imagen_url'] = Js::or($url, self::IMG_DEFAULT);
        } elseif (!Js::t($data['imagen_url'])) {
            $data['imagen_url'] = self::IMG_DEFAULT;
        }
        // Producto nuevo que reutiliza la foto de otro (duplicar): se copia el archivo
        if (!Js::t($id) && ImageStore::isStored($data['imagen_url'])) $data['imagen_url'] = ImageStore::copyProductImage($data['imagen_url']);
        if (Js::t($id)) {
            $old = Db::query('SELECT stock, imagen_url FROM productos WHERE id = ?', [$id])[0] ?? null;
            $stockAnterior = $old ? Js::num($old['stock']) : 0;
            $oldImage = $old ? $old['imagen_url'] : null;
            $cols = array_keys($data);
            Db::query('UPDATE productos SET ' . implode(', ', array_map(fn ($c) => "`{$c}` = ?", $cols)) . ' WHERE id = ?', [...array_values($data), $id]);
            if (Js::t($oldImage) && $oldImage !== $data['imagen_url'] && ImageStore::isStored($oldImage)) ImageStore::removeProductImage($oldImage);
        } else {
            if (!array_key_exists('stock', $data)) $data['stock'] = 0;
            $cols = array_keys($data);
            $r = Db::query('INSERT INTO productos (' . implode(',', array_map(fn ($c) => "`{$c}`", $cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($data));
            $productId = $r['insertId'];
        }

        // Categorías (un producto puede estar en varias)
        Db::query('DELETE FROM producto_categorias WHERE producto_id = ?', [$productId]);
        foreach ($catIds as $cid) Db::query('INSERT IGNORE INTO producto_categorias (producto_id, categoria_id) VALUES (?, ?)', [$productId, $cid]);

        // Kardex: stock inicial al crear, o ajuste si se cambió el stock al editar
        if (!$esPack) {
            $nuevo = Js::or(Js::num($data['stock'] ?? Js::undef()), 0);
            if (!Js::t($id) && $nuevo > 0) {
                Kardex::logMovement(['producto_id' => $productId, 'tipo' => 'ingreso', 'cantidad' => $nuevo, 'motivo' => 'Stock inicial', 'ref_tipo' => 'producto', 'ref_id' => $productId]);
                StockProv::adjustProv($productId, $nuevo, Js::or(Js::num($data['precio_costo']), 0));
            } elseif (Js::t($id) && $stockAnterior !== null && array_key_exists('stock', $data) && $nuevo !== $stockAnterior) {
                StockProv::adjustProv($productId, $nuevo - $stockAnterior, Js::or(Js::num($data['precio_costo']), 0));
                Kardex::logMovement(['producto_id' => $productId, 'tipo' => $nuevo > $stockAnterior ? 'ingreso' : 'salida', 'cantidad' => abs($nuevo - $stockAnterior), 'motivo' => 'Ajuste de stock', 'ref_tipo' => 'producto', 'ref_id' => $productId]);
            }
        }

        // Presentaciones (precio unitario según cantidad)
        if (Js::isArray($v('presentaciones'))) {
            Db::query('DELETE FROM producto_presentaciones WHERE producto_id = ?', [$productId]);
            $seen = [];
            foreach ($b['presentaciones'] as $p) {
                $factor = Js::round(Js::num($p['factor'] ?? null));
                $precio = Js::num($p['precio'] ?? null);
                if (!($factor >= 1) || Js::isNaN($factor) || !($precio >= 0) || Js::isNaN($precio)) continue;
                if (in_array($factor, $seen, true)) throw new HttpError(400, 'La cantidad ' . Js::str($factor) . ' está repetida en las presentaciones');
                $seen[] = $factor;
                Db::query('INSERT INTO producto_presentaciones (producto_id, etiqueta, descripcion, factor, precio) VALUES (?,?,?,?,?)', [
                    $productId, Js::or(self::txt($p['etiqueta'] ?? null, 60), $factor === 1 ? 'UNIDAD' : Js::str($factor) . ' UNIDADES'),
                    self::txt($p['descripcion'] ?? null, 120), $factor, self::r2($precio),
                ]);
            }
        }

        // Componentes: insumos del producto o contenido del pack/box
        if (Js::isArray($v('componentes')) && ($esPack || $data['requiere_insumos'] || count($b['componentes']) === 0)) {
            Db::query('DELETE FROM producto_componentes WHERE producto_id = ?', [$productId]);
            if ($esPack || $data['requiere_insumos']) {
                if ($esPack && count($b['componentes']) === 0) throw new HttpError(400, 'El pack debe llevar al menos un producto');
                $seen = [];
                foreach ($b['componentes'] as $c) {
                    $cid = Js::num($c['componente_id'] ?? null);
                    $cant = Js::num($c['cantidad'] ?? null);
                    if (!Js::t($cid) || !($cant > 0)) throw new HttpError(400, 'Cada componente necesita producto y cantidad mayor a 0');
                    if ($cid === Js::num($productId)) throw new HttpError(400, 'Un producto no puede contenerse a sí mismo');
                    if (in_array($cid, $seen, true)) throw new HttpError(400, 'Hay un producto repetido en la lista; suma las cantidades en una sola línea');
                    $seen[] = $cid;
                    $pr = Db::query('SELECT id, es_pack, precio_costo, precio_venta, precio_insumo FROM productos WHERE id = ?', [$cid]);
                    if (!count($pr)) throw new HttpError(400, 'Un componente ya no existe');
                    if (Js::t($pr[0]['es_pack'])) throw new HttpError(400, 'Un pack no puede llevar otro pack dentro');
                    $ins = $pr[0]['precio_insumo'] !== null ? Js::num($pr[0]['precio_insumo']) : Js::num($pr[0]['precio_venta']);
                    $unit = self::numOrNull($c['precio_unit'] ?? null);
                    Db::query('INSERT INTO producto_componentes (producto_id, componente_id, cantidad, precio_unit, precio_ref, costo_ref) VALUES (?,?,?,?,?,?)', [
                        $productId, $cid, $cant, self::r2($unit === null ? $ins : $unit), self::r2($ins), self::r2($pr[0]['precio_costo']),
                    ]);
                }
            }
        }
        return $productId;
    }

    public function createProduct()
    {
        try {
            Db::begin();
            $id = self::validateAndSave($this->body(), null);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Producto creado exitosamente', 'id' => $id], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al registrar producto');
        }
    }

    public function updateProduct($id)
    {
        try {
            Db::begin();
            $cur = Db::query('SELECT id FROM productos WHERE id = ?', [$id]);
            if (!count($cur)) throw new HttpError(404, 'Producto no encontrado');
            self::validateAndSave($this->body(), Js::num($id));
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Producto actualizado exitosamente']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al actualizar producto');
        }
    }

    // Eliminar solo si no está en uso; si no, se deshabilita
    public function deleteProduct($id)
    {
        try {
            $id = Js::num($id);
            $cur = Db::query('SELECT id, imagen_url FROM productos WHERE id = ?', [$id]);
            if (!count($cur)) throw new HttpError(404, 'Producto no encontrado');
            $checks = [
                ['SELECT COUNT(*) AS n FROM pedido_detalles WHERE producto_id = ?', 'pedidos'],
                ['SELECT COUNT(*) AS n FROM compra_detalles WHERE producto_id = ?', 'compras'],
                ['SELECT COUNT(*) AS n FROM cotizacion_detalles WHERE producto_id = ?', 'cotizaciones'],
                ['SELECT COUNT(*) AS n FROM producto_componentes WHERE componente_id = ?', 'packs o insumos de otros productos'],
                ["SELECT COUNT(*) AS n FROM kardex_movimientos WHERE producto_id = ? AND motivo NOT IN ('Saldo inicial','Stock inicial')", 'movimientos de stock'],
            ];
            $usos = [];
            foreach ($checks as [$sql, $label]) {
                try { $r = Db::query($sql, [$id])[0]; if (Js::num($r['n']) > 0) $usos[] = $label; } catch (\Throwable $e) { /* tabla opcional */ }
            }
            if (count($usos)) {
                Db::query('UPDATE productos SET activo = 0 WHERE id = ?', [$id]);
                return $this->json(['success' => true, 'eliminado' => false, 'message' => 'No se puede eliminar porque está en ' . implode(', ', $usos) . '. Se deshabilitó en su lugar.']);
            }
            Db::begin();
            Db::query('DELETE FROM producto_presentaciones WHERE producto_id = ?', [$id]);
            Db::query('DELETE FROM producto_componentes WHERE producto_id = ?', [$id]);
            Db::query('DELETE FROM producto_categorias WHERE producto_id = ?', [$id]);
            Db::query('DELETE FROM kardex_movimientos WHERE producto_id = ?', [$id]);
            Db::query('DELETE FROM productos WHERE id = ?', [$id]);
            Db::commit();
            ImageStore::removeProductImage($cur[0]['imagen_url']);
            return $this->json(['success' => true, 'eliminado' => true, 'message' => 'Producto eliminado']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al eliminar producto');
        }
    }

    public function setActive($id)
    {
        try {
            Db::query('UPDATE productos SET activo = ? WHERE id = ?', [self::bool($this->body()['activo'] ?? null), $id]);
            return $this->json(['success' => true, 'message' => 'Estado actualizado']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al actualizar el estado');
        }
    }

    // ---------- Boxes y Packs ----------
    public function getPacks()
    {
        try {
            $search = $this->q('search');
            $estado = $this->q('estado');
            $sql = "\n      SELECT p.id, p.codigo, p.nombre, p.descripcion, p.unidad, p.precio_venta, p.imagen_url, p.activo, p.stock_minimo,\n        (SELECT COALESCE(SUM(pc.cantidad * c.precio_costo), 0) FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id WHERE pc.producto_id = p.id) AS costo_total,\n        (SELECT COALESCE(SUM(pc.cantidad * pc.precio_unit), 0) FROM producto_componentes pc WHERE pc.producto_id = p.id) AS valor_insumos,\n        (SELECT COUNT(*) FROM producto_componentes pc WHERE pc.producto_id = p.id) AS total_componentes,\n        (SELECT COUNT(*) FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id\n           WHERE pc.producto_id = p.id AND (ABS(COALESCE(c.precio_insumo, c.precio_venta) - pc.precio_ref) > 0.009 OR ABS(c.precio_costo - pc.costo_ref) > 0.009)) AS cambios,\n        " . self::STOCK_SQL . " AS stock\n      FROM productos p WHERE p.es_pack = 1";
            $params = [];
            if ($estado === 'deshabilitados') $sql .= ' AND p.activo = 0';
            elseif ($estado !== 'todos') $sql .= ' AND p.activo = 1';
            if (Js::t($search)) { $sql .= ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)'; array_push($params, '%' . Js::str($search) . '%', '%' . Js::str($search) . '%'); }
            $sql .= ' ORDER BY p.id DESC';
            $packs = array_map(function ($p) {
                $costo = self::r2($p['costo_total']);
                $venta = Js::num($p['precio_venta']);
                $p['stock'] = Js::num($p['stock']);
                $p['costo_total'] = $costo;
                $p['valor_insumos'] = self::r2($p['valor_insumos']);
                $p['precio_venta'] = $venta;
                $p['ganancia'] = self::r2($venta - $costo);
                $p['margen'] = $venta > 0 ? self::r2((($venta - $costo) / $venta) * 100) : 0;
                $p['revisar'] = Js::num($p['cambios']) > 0;
                return $p;
            }, Db::query($sql, $params));
            return $this->json(['success' => true, 'packs' => $packs]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener packs');
        }
    }

    public function refreshPack($id)
    {
        try {
            Db::begin();
            $comp = Db::query('SELECT pc.id, c.precio_costo, c.precio_venta, c.precio_insumo FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id WHERE pc.producto_id = ?', [$id]);
            $act = Js::t($this->body()['actualizar_precios'] ?? null);
            foreach ($comp as $c) {
                $ins = $c['precio_insumo'] !== null ? Js::num($c['precio_insumo']) : Js::num($c['precio_venta']);
                if ($act) Db::query('UPDATE producto_componentes SET precio_unit = ?, precio_ref = ?, costo_ref = ? WHERE id = ?', [self::r2($ins), self::r2($ins), self::r2($c['precio_costo']), $c['id']]);
                else Db::query('UPDATE producto_componentes SET precio_ref = ?, costo_ref = ? WHERE id = ?', [self::r2($ins), self::r2($c['precio_costo']), $c['id']]);
            }
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Pack revisado']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al revisar el pack');
        }
    }

    // ---------- Marcas y proveedores ----------
    public function getBrands()
    {
        try {
            return $this->json(['success' => true, 'brands' => Db::query('SELECT id, nombre FROM marcas ORDER BY nombre')]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener marcas');
        }
    }

    public function createBrand()
    {
        try {
            $nombre = self::txt($this->body()['nombre'] ?? null, 80);
            if ($nombre === null) throw new HttpError(400, 'El nombre de la marca es obligatorio');
            $ex = Db::query('SELECT id FROM marcas WHERE nombre = ?', [$nombre]);
            if (count($ex)) return $this->json(['success' => true, 'id' => $ex[0]['id'], 'nombre' => $nombre, 'existente' => true]);
            $r = Db::query('INSERT INTO marcas (nombre) VALUES (?)', [$nombre]);
            return $this->json(['success' => true, 'id' => $r['insertId'], 'nombre' => $nombre], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al crear la marca');
        }
    }

    public function getSuppliersLite()
    {
        try {
            return $this->json(['success' => true, 'suppliers' => Db::query('SELECT id, nombre FROM proveedores WHERE estado = 1 ORDER BY nombre')]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener proveedores');
        }
    }

    public function nextCode()
    {
        try {
            return $this->json(['success' => true, 'codigo' => Productos::nextInternalCode()]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al generar el código');
        }
    }

    // ---------- Miniaturas ----------
    public function pendingThumbs()
    {
        try {
            $rows = Db::query("SELECT id, imagen_url FROM productos WHERE imagen_url LIKE '/uploads/productos/%'");
            return $this->json(['success' => true, 'pendientes' => array_values(array_filter($rows, fn ($r) => ImageStore::thumbPending($r['imagen_url']))), 'total' => count($rows)]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al revisar las miniaturas'], 500);
        }
    }

    public function saveThumb($id)
    {
        try {
            $row = Db::query('SELECT imagen_url FROM productos WHERE id = ?', [$id])[0] ?? null;
            if (!$row) return $this->json(['success' => false, 'message' => 'Producto no encontrado'], 404);
            if (!ImageStore::saveThumbOnly($row['imagen_url'], $this->body()['thumb'] ?? null)) return $this->json(['success' => false, 'message' => 'Miniatura no válida'], 400);
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al guardar la miniatura'], 500);
        }
    }

    // ---------- Stock por lotes ----------
    public function getLotes()
    {
        try {
            $q = $this->query();
            $where = ['l.estado = 1'];
            $params = [];
            if (Js::str($q['con_stock'] ?? Js::undef()) !== '0') $where[] = 'l.stock > 0';
            if (Js::num($q['producto_id'] ?? Js::undef()) > 0) { $where[] = 'l.producto_id = ?'; $params[] = Js::num($q['producto_id']); }
            if (array_key_exists('proveedor_id', $q) && $q['proveedor_id'] !== '') { $where[] = 'l.proveedor_id = ?'; $params[] = Js::or(Js::num($q['proveedor_id']), 0); }
            if (Js::t($q['search'] ?? null) && Js::t(Js::trim($q['search']))) {
                $s = '%' . Js::trim($q['search']) . '%';
                $where[] = '(p.nombre LIKE ? OR p.codigo LIKE ? OR l.codigo LIKE ? OR pr.nombre LIKE ?)';
                array_push($params, $s, $s, $s, $s);
            }
            $rows = Db::query("SELECT l.id, l.producto_id, p.nombre AS producto, p.codigo AS producto_codigo, p.precio_venta, l.proveedor_id,\n              COALESCE(pr.nombre, 'Sin proveedor') AS proveedor, l.codigo, l.fecha_compra, l.compra_id,\n              c.codigo AS compra_codigo, l.cantidad_inicial, l.stock, l.costo_unit\n       FROM producto_lotes l\n       JOIN productos p ON p.id = l.producto_id\n       LEFT JOIN proveedores pr ON pr.id = l.proveedor_id\n       LEFT JOIN compras c ON c.id = l.compra_id\n       WHERE " . implode(' AND ', $where) . "\n       ORDER BY p.nombre, (l.fecha_compra IS NULL) DESC, l.fecha_compra ASC, l.id ASC LIMIT 1000", $params);
            $lotes = array_map(function ($r) {
                $r['stock'] = Js::num($r['stock']);
                $r['cantidad_inicial'] = Js::num($r['cantidad_inicial']);
                $r['costo_unit'] = Js::num($r['costo_unit']);
                $r['precio_venta'] = Js::num($r['precio_venta']);
                $r['valor'] = Js::round($r['stock'] * $r['costo_unit'] * 100) / 100;
                return $r;
            }, $rows);
            return $this->json(['success' => true, 'lotes' => $lotes]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al consultar los lotes');
        }
    }

    public function updateLote($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT * FROM producto_lotes WHERE id = ? FOR UPDATE', [$id]);
            if (!count($rows)) throw new HttpError(404, 'Lote no encontrado');
            $l = $rows[0];
            if (!Js::t($l['estado'])) throw new HttpError(400, 'Este lote pertenece a una compra anulada y no se puede editar');
            $b = $this->body();
            $prov = $l['proveedor_id'];
            if (array_key_exists('proveedor_id', $b)) {
                $prov = Js::or(Js::num($b['proveedor_id']), 0);
                if (Js::t($prov) && !count(Db::query('SELECT id FROM proveedores WHERE id = ?', [$prov]))) throw new HttpError(400, 'El proveedor no existe');
            }
            $codigo = array_key_exists('codigo', $b) ? Js::orNull(Js::slice(Js::trim($b['codigo']), 0, 60)) : $l['codigo'];
            $fecha = $l['fecha_compra'];
            if (array_key_exists('fecha_compra', $b)) {
                if (Js::t($b['fecha_compra']) && !preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str($b['fecha_compra']))) throw new HttpError(400, 'Fecha inválida');
                $fecha = Js::t($b['fecha_compra']) ? Js::slice(Js::str($b['fecha_compra']), 0, 10) : null;
            }
            $costo = array_key_exists('costo_unit', $b) ? Js::num($b['costo_unit']) : Js::num($l['costo_unit']);
            if (!($costo >= 0) || Js::isNaN($costo)) throw new HttpError(400, 'El costo no puede ser negativo');
            $nota = array_key_exists('nota', $b) ? Js::orNull(Js::slice(Js::trim($b['nota']), 0, 150)) : $l['nota'];
            $stock = Js::num($l['stock']);
            $delta = 0;
            if (array_key_exists('stock', $b)) {
                $ns = Js::round(Js::num($b['stock']));
                if (!($ns >= 0) || Js::isNaN($ns)) throw new HttpError(400, 'El stock no puede ser negativo');
                $delta = $ns - $stock;
                $stock = $ns;
            }
            Db::query('UPDATE producto_lotes SET proveedor_id = ?, codigo = ?, fecha_compra = ?, costo_unit = ?, nota = ?, stock = ?, cantidad_inicial = GREATEST(cantidad_inicial, ?) WHERE id = ?', [
                $prov, $codigo, $fecha, Js::round($costo * 10000) / 10000, $nota, $stock, $stock, $l['id'],
            ]);
            if ($delta !== 0) {
                Db::query('UPDATE productos SET stock = GREATEST(0, stock + ?) WHERE id = ?', [$delta, $l['producto_id']]);
                Kardex::logMovement(['producto_id' => $l['producto_id'], 'tipo' => $delta > 0 ? 'ingreso' : 'salida', 'cantidad' => abs($delta), 'motivo' => 'Ajuste de lote', 'documento' => $codigo, 'ref_tipo' => 'lote', 'ref_id' => $l['id'], 'usuario_id' => $this->userId()]);
            }
            StockProv::syncAgg($l['producto_id']);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Lote actualizado']);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al actualizar el lote');
        }
    }
}

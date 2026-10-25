<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

/**
 * Centro de reportes (Operaciones > Reportes): cada reporte devuelve columnas + filas para mostrar y exportar.
 */
class ReportHubController extends Controller
{
    private const CLIENTE = "COALESCE(cl.nombre, p.cliente_nombre, 'Cliente Varios')";
    private const PAGADO = '(SELECT COALESCE(SUM(pg.monto), 0) FROM pagos pg WHERE pg.pedido_id = p.id)';
    // Una venta = pedido con comprobante emitido (regla del negocio)
    private const VENTA_FROM = "\n  FROM pedidos p\n  JOIN (SELECT pedido_id, MIN(fecha) AS fecha_venta, MIN(CONCAT(serie, '-', LPAD(numero, 6, '0'))) AS comprobante\n        FROM comprobantes WHERE estado = 'emitido' GROUP BY pedido_id) cv ON cv.pedido_id = p.id\n  LEFT JOIN clientes cl ON cl.id = p.cliente_id\n  LEFT JOIN usuarios u ON u.id = p.usuario_id\n  WHERE p.estado_pedido <> 'cancelado'";
    private const COSTO_LINEA = 'COALESCE((SELECT SUM(va.cantidad * va.costo_unit) FROM venta_asignaciones va WHERE va.detalle_id = pd.id), pd.cantidad * COALESCE(pr.precio_costo, 0))';

    private static function detFrom(): string
    {
        return self::replaceFirst(self::VENTA_FROM, 'WHERE p.estado_pedido', 'JOIN pedido_detalles pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pr.id = pd.producto_id LEFT JOIN categorias ca ON ca.id = pr.categoria_id WHERE p.estado_pedido');
    }

    private static function replaceFirst(string $s, string $a, string $b): string
    {
        $i = strpos($s, $a);
        return $i === false ? $s : substr($s, 0, $i) . $b . substr($s, $i + strlen($a));
    }

    private static function isDate($s): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', Js::str(Js::or($s, ''))); }
    private static function num($v) { return Js::num(Js::or($v, 0)); }
    private static function r2($n) { return Js::roundTo($n, 2); }
    private static function like($s): string { return '%' . Js::str($s) . '%'; }

    private static function range(string $col, array $q, array &$params): string
    {
        $sql = '';
        if (self::isDate($q['desde'] ?? null)) { $sql .= " AND DATE({$col}) >= ?"; $params[] = $q['desde']; }
        if (self::isDate($q['hasta'] ?? null)) { $sql .= " AND DATE({$col}) <= ?"; $params[] = $q['hasta']; }
        return $sql;
    }

    private static function money($k, $l) { return ['key' => $k, 'label' => $l, 'type' => 'money', 'align' => 'right']; }
    private static function int($k, $l) { return ['key' => $k, 'label' => $l, 'type' => 'int', 'align' => 'right']; }
    private static function col($k, $l, array $extra = []) { return array_merge(['key' => $k, 'label' => $l], $extra); }
    private static function date($k, $l) { return ['key' => $k, 'label' => $l, 'type' => 'date']; }

    private static function sum(array $rows, string $k)
    {
        $a = 0;
        foreach ($rows as $r) $a = $a + self::num($r[$k] ?? null);
        return self::r2($a);
    }

    private static function dayList($desde, $hasta): array
    {
        $out = [];
        if (!self::isDate($desde) || !self::isDate($hasta)) return $out;
        $d = new \DateTime($desde . 'T00:00:00Z');
        $end = new \DateTime($hasta . 'T00:00:00Z');
        while ($d <= $end && count($out) < 400) {
            $out[] = $d->format('Y-m-d');
            $d->modify('+1 day');
        }
        return $out;
    }

    /** Definición de reportes (misma lista y orden que el backend Node) */
    private static function reports(): array
    {
        return [
            'ventas_periodo' => ['grupo' => 'analisis', 'viz' => true, 'titulo' => 'Ventas por período', 'desc' => 'Ventas netas por día, comprobantes y ticket promedio', 'icon' => 'BarChart3', 'fechas' => true, 'run' => 'ventasPeriodo'],
            'utilidades' => ['grupo' => 'analisis', 'viz' => true, 'titulo' => 'Utilidades', 'desc' => 'Ventas, costo real y utilidad por producto', 'icon' => 'Coins', 'fechas' => true, 'run' => 'utilidades'],
            'mas_vendidos' => ['grupo' => 'analisis', 'viz' => true, 'titulo' => 'Más vendidos', 'desc' => 'Los 30 productos con más unidades vendidas', 'icon' => 'Gift', 'fechas' => true, 'run' => 'masVendidos'],
            'ventas_cliente' => ['grupo' => 'ventas', 'titulo' => 'Ventas por cliente', 'desc' => 'Cuánto compró cada cliente en el periodo', 'icon' => 'Users', 'fechas' => true, 'buscar' => true, 'run' => 'ventasCliente'],
            'detalle_ventas' => ['grupo' => 'ventas', 'titulo' => 'Detalle de ventas', 'desc' => 'Cada producto vendido: cliente, vendedor, precio y ganancia', 'icon' => 'Package', 'fechas' => true, 'buscar' => true, 'run' => 'detalleVentas'],
            'ventas_vendedor' => ['grupo' => 'ventas', 'titulo' => 'Ventas por vendedor', 'desc' => 'Total vendido por cada usuario', 'icon' => 'Users', 'fechas' => true, 'run' => 'ventasVendedor'],
            'ventas_canal' => ['grupo' => 'ventas', 'titulo' => 'Ventas por tipo de entrega', 'desc' => 'Recojo en tienda, envío, delivery o por confirmar', 'icon' => 'Store', 'fechas' => true, 'run' => 'ventasCanal'],
            'compras_proveedor' => ['grupo' => 'compras', 'titulo' => 'Compras por proveedor', 'desc' => 'Cuánto se compró a cada proveedor', 'icon' => 'Store', 'fechas' => true, 'buscar' => true, 'run' => 'comprasProveedor'],
            'compras_producto' => ['grupo' => 'compras', 'titulo' => 'Compras por producto', 'desc' => 'Cantidades y costo promedio comprado', 'icon' => 'Package', 'fechas' => true, 'buscar' => true, 'run' => 'comprasProducto'],
            'ventas_link' => ['grupo' => 'ventas', 'titulo' => 'Ventas', 'desc' => 'Listado de ventas, documentos, pagos y saldos por cobrar', 'icon' => 'BarChart3', 'link' => 'reports'],
            'cotizaciones_link' => ['grupo' => 'ventas', 'titulo' => 'Cotizaciones', 'desc' => 'Historial y seguimiento de cotizaciones', 'icon' => 'FileText', 'link' => 'quotes'],
            'compras_link' => ['grupo' => 'compras', 'titulo' => 'Historial de compras', 'desc' => 'Mercadería recibida de tus proveedores y pagos pendientes', 'icon' => 'ShoppingCart', 'link' => 'purchases'],
            'productos_link' => ['grupo' => 'general', 'titulo' => 'Productos', 'desc' => 'Catálogo con stock, costos, precios y stock bajo', 'icon' => 'Gift', 'link' => 'inventory'],
            'clientes_link' => ['grupo' => 'general', 'titulo' => 'Clientes', 'desc' => 'Listado de clientes y su contacto', 'icon' => 'Users', 'link' => 'customers'],
            'proveedores_link' => ['grupo' => 'general', 'titulo' => 'Proveedores', 'desc' => 'Listado de proveedores y su contacto', 'icon' => 'Store', 'link' => 'suppliers'],
            'pedidos_link' => ['grupo' => 'pedidos', 'titulo' => 'Pedidos', 'desc' => 'Tablero por etapa y entregas programadas', 'icon' => 'ClipboardList', 'link' => 'orders'],
            'envios_link' => ['grupo' => 'guias', 'titulo' => 'Envíos y guías', 'desc' => 'Pedidos para envío, agencias y foto de la guía', 'icon' => 'Send', 'link' => 'shipments'],
            'kardex' => ['grupo' => 'general', 'titulo' => 'Kárdex', 'desc' => 'Movimientos de stock de los productos', 'icon' => 'PackageSearch', 'link' => 'kardex'],
            'kardex_valorizado' => ['grupo' => 'general', 'titulo' => 'Inventario valorizado', 'desc' => 'Valor del stock al costo y al precio de venta', 'icon' => 'Coins', 'link' => 'kardex_valorizado'],
            'productos_categoria' => ['grupo' => 'general', 'titulo' => 'Productos por categoría', 'desc' => 'Cantidad de productos y valor de stock en cada categoría', 'icon' => 'Layers', 'run' => 'productosCategoria'],
            'packs_ganancia' => ['grupo' => 'general', 'titulo' => 'Boxes y Packs: ganancia', 'desc' => 'Precio, costo de lo que lleva, ganancia y margen por pack', 'icon' => 'Boxes', 'buscar' => true, 'run' => 'packsGanancia'],
        ];
    }

    public function list()
    {
        $out = [];
        foreach (self::reports() as $key => $r) {
            $out[] = ['key' => $key, 'grupo' => $r['grupo'], 'titulo' => $r['titulo'], 'desc' => $r['desc'], 'icon' => $r['icon'],
                'fechas' => !empty($r['fechas']), 'buscar' => !empty($r['buscar']), 'link' => $r['link'] ?? null, 'viz' => !empty($r['viz'])];
        }
        return $this->json(['success' => true, 'reports' => $out]);
    }

    public function run($key)
    {
        try {
            $rep = self::reports()[$key] ?? null;
            if (!$rep || empty($rep['run'])) return $this->json(['success' => false, 'message' => 'Reporte no encontrado'], 404);
            $out = $this->{$rep['run']}($this->query());
            return $this->json([
                'success' => true, 'titulo' => $rep['titulo'], 'columns' => $out['columns'], 'rows' => $out['rows'],
                'summary' => $out['summary'] ?? [], 'kpis' => $out['kpis'] ?? null, 'chart' => $out['chart'] ?? null, 'nota' => $out['nota'] ?? null,
            ]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'No se pudo generar el reporte'], 500);
        }
    }

    // ------------------------------- ANÁLISIS -------------------------------
    private function ventasPeriodo(array $q): array
    {
        $params = [];
        $rows = Db::query("SELECT DATE(c.fecha) AS fecha, COUNT(*) AS comprobantes, SUM(p.total - p.igv_monto) AS subtotal, SUM(p.igv_monto) AS igv, SUM(p.total) AS total\n         FROM comprobantes c JOIN pedidos p ON p.id = c.pedido_id\n         WHERE c.estado = 'emitido' AND p.estado_pedido <> 'cancelado'" . self::range('c.fecha', $q, $params) . "\n         GROUP BY DATE(c.fecha) ORDER BY DATE(c.fecha)", $params);
        $p2 = [];
        $dev = Db::query("SELECT DATE(c.fecha) AS fecha, SUM(p.total) AS total FROM comprobantes c JOIN pedidos p ON p.id = c.pedido_id\n         WHERE c.estado = 'anulado'" . self::range('c.fecha', $q, $p2) . ' GROUP BY DATE(c.fecha)', $p2);
        $devMap = [];
        foreach ($dev as $d) $devMap[Js::slice(Js::str($d['fecha']), 0, 10)] = self::num($d['total']);
        $data = array_map(function ($r) use ($devMap) {
            $f = Js::slice(Js::str($r['fecha']), 0, 10);
            $devol = self::r2(Js::or($devMap[$f] ?? null, 0));
            return ['fecha' => $f, 'comprobantes' => self::num($r['comprobantes']), 'subtotal' => self::r2($r['subtotal']), 'igv' => self::r2($r['igv']), 'descuento' => 0, 'total' => self::r2($r['total']), 'devol' => $devol, 'neto' => self::r2(self::num($r['total']) - $devol)];
        }, $rows);
        $total = self::sum($data, 'neto');
        $n = self::sum($data, 'comprobantes');
        $mejor = null;
        foreach ($data as $r) if ($r['neto'] > ($mejor['neto'] ?? -1)) $mejor = $r;
        $byDay = [];
        foreach ($data as $r) $byDay[$r['fecha']] = $r['neto'];
        $days = self::dayList($q['desde'] ?? null, $q['hasta'] ?? null);
        $labels = count($days) ? $days : array_column($data, 'fecha');
        $fmt = fn ($d) => substr($d, 8, 2) . '/' . substr($d, 5, 2);
        return [
            'columns' => [self::date('fecha', 'Fecha'), self::int('comprobantes', 'Comprob.'), self::money('subtotal', 'Subtotal'), self::money('igv', 'IGV'), self::money('descuento', 'Descuento'), self::money('total', 'Total'), self::money('devol', 'Devol.'), self::money('neto', 'Neto')],
            'rows' => $data,
            'kpis' => [['Ventas netas', $total, 'money'], ['Comprobantes', $n, 'int'], ['Ticket promedio', $n ? self::r2($total / $n) : 0, 'money'],
                ['Mejor día', $mejor ? $fmt($mejor['fecha']) . ' · S/ ' . number_format((float) $mejor['neto'], 2, '.', ',') : '—', 'text']],
            'chart' => ['type' => 'line', 'labels' => array_map($fmt, $labels), 'values' => array_map(fn ($d) => Js::or($byDay[$d] ?? null, 0), $labels)],
            'summary' => [['Ventas netas', $total], ['Comprobantes', $n]],
        ];
    }

    private function utilidades(array $q): array
    {
        $params = [];
        $rows = Db::query("SELECT pr.id AS pid, COALESCE(pr.nombre, 'Producto eliminado') AS producto, COALESCE(ca.nombre, '—') AS categoria,\n                SUM(pd.cantidad) AS cantidad, SUM(pd.subtotal) AS ventas, SUM(" . self::COSTO_LINEA . ") AS costo\n         " . self::detFrom() . self::range('cv.fecha_venta', $q, $params) . "\n         GROUP BY pr.id, pr.nombre, ca.nombre ORDER BY SUM(pd.subtotal) DESC LIMIT 1000", $params);
        $data = array_map(function ($r) {
            $ventas = self::r2($r['ventas']);
            $costo = self::r2($r['costo']);
            $ut = self::r2($ventas - $costo);
            return ['producto' => $r['producto'], 'categoria' => $r['categoria'], 'cantidad' => self::num($r['cantidad']), 'ventas' => $ventas, 'costo' => $costo, 'utilidad' => $ut, 'margen' => $ventas > 0 ? self::r2(($ut / $ventas) * 100) : 0];
        }, $rows);
        $ventas = self::sum($data, 'ventas');
        $costo = self::sum($data, 'costo');
        $ut = self::r2($ventas - $costo);
        $top = $data;
        usort($top, fn ($a, $b) => $b['utilidad'] <=> $a['utilidad']);
        $top = array_slice($top, 0, 10);
        return [
            'columns' => [self::col('producto', 'Producto'), self::col('categoria', 'Categoría'), self::int('cantidad', 'Cant.'), self::money('ventas', 'Ventas'), self::money('costo', 'Costo'), self::money('utilidad', 'Utilidad'), ['key' => 'margen', 'label' => 'Margen', 'type' => 'pct', 'align' => 'right']],
            'rows' => $data,
            'kpis' => [['Ventas netas (sin IGV)', $ventas, 'money'], ['Costo real de ventas', $costo, 'money'], ['Utilidad bruta', $ut, 'money'], ['Margen bruto', $ventas > 0 ? self::r2(($ut / $ventas) * 100) : 0, 'pct']],
            'chart' => ['type' => 'hbar', 'labels' => array_column($top, 'producto'), 'values' => array_column($top, 'utilidad')],
            'nota' => 'Ventas sin IGV (el IGV cobrado se paga a SUNAT). Costo real: con factura de compra es sin IGV; sin factura es lo que pagaste (IGV incluido). Los gastos operativos no se restan.',
            'summary' => [['Ventas netas', $ventas], ['Costo real', $costo], ['Utilidad', $ut]],
        ];
    }

    private function masVendidos(array $q): array
    {
        $params = [];
        $rows = Db::query("SELECT COALESCE(pr.nombre, 'Producto eliminado') AS producto, COALESCE(ca.nombre, '—') AS categoria,\n                SUM(pd.cantidad) AS unidades, COUNT(DISTINCT p.id) AS en_ventas, SUM(pd.subtotal) AS ventas\n         " . self::detFrom() . self::range('cv.fecha_venta', $q, $params) . "\n         GROUP BY pr.id, pr.nombre, ca.nombre ORDER BY SUM(pd.cantidad) DESC, SUM(pd.subtotal) DESC LIMIT 30", $params);
        $data = array_map(fn ($r) => ['producto' => $r['producto'], 'categoria' => $r['categoria'], 'unidades' => self::num($r['unidades']), 'en_ventas' => self::num($r['en_ventas']), 'ventas' => self::r2($r['ventas'])], $rows);
        $top = array_slice($data, 0, 10);
        $topN = count($data) ?: 30;
        return [
            'columns' => [self::col('producto', 'Producto'), self::col('categoria', 'Categoría'), self::int('unidades', 'Unidades'), self::int('en_ventas', 'En ventas'), self::money('ventas', 'Ventas')],
            'rows' => $data,
            'kpis' => [['Productos distintos', count($data), 'int'], ['Unidades vendidas', self::sum($data, 'unidades'), 'int'], ["Ventas del top {$topN}", self::sum($data, 'ventas'), 'money']],
            'chart' => ['type' => 'hbar', 'labels' => array_column($top, 'producto'), 'values' => array_column($top, 'unidades')],
            'summary' => [['Unidades', self::sum($data, 'unidades')], ['Ventas del top', self::sum($data, 'ventas')]],
        ];
    }

    private function ventasCliente(array $q): array
    {
        $params = [];
        $sql = 'SELECT ' . self::CLIENTE . ' AS cliente, COUNT(*) AS ventas, SUM(p.total) AS total, SUM(' . self::PAGADO . ') AS pagado, SUM(p.total) - SUM(' . self::PAGADO . ') AS saldo ' . self::VENTA_FROM;
        $sql .= self::range('cv.fecha_venta', $q, $params);
        if (Js::t($q['search'] ?? null)) { $sql .= ' AND (cl.nombre LIKE ? OR p.cliente_nombre LIKE ?)'; array_push($params, self::like($q['search']), self::like($q['search'])); }
        $sql .= ' GROUP BY ' . self::CLIENTE . ' ORDER BY total DESC LIMIT 2000';
        $rows = Db::query($sql, $params);
        return ['columns' => [self::col('cliente', 'Cliente'), self::int('ventas', 'Ventas'), self::money('total', 'Total vendido'), self::money('pagado', 'Pagado'), self::money('saldo', 'Por cobrar')],
            'rows' => $rows, 'summary' => [['Clientes', count($rows)], ['Total vendido', self::sum($rows, 'total')]]];
    }

    private function detalleVentas(array $q): array
    {
        $params = [];
        $from = self::replaceFirst(self::VENTA_FROM, 'WHERE p.estado_pedido', 'JOIN pedido_detalles pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pr.id = pd.producto_id WHERE p.estado_pedido');
        $sql = 'SELECT cv.fecha_venta AS fecha, cv.comprobante, ' . self::CLIENTE . " AS cliente, u.nombre AS vendedor, COALESCE(pr.nombre, 'Producto eliminado') AS producto,\n                  pd.cantidad, pd.precio_unitario AS precio, pd.subtotal AS importe, COALESCE(pr.precio_costo, 0) * pd.cantidad AS costo,\n                  pd.subtotal - COALESCE(pr.precio_costo, 0) * pd.cantidad AS ganancia\n                 " . $from;
        $sql .= self::range('cv.fecha_venta', $q, $params);
        if (Js::t($q['search'] ?? null)) { $sql .= ' AND (pr.nombre LIKE ? OR cl.nombre LIKE ? OR p.cliente_nombre LIKE ? OR cv.comprobante LIKE ?)'; array_push($params, ...array_fill(0, 4, self::like($q['search']))); }
        $sql .= ' ORDER BY cv.fecha_venta DESC, pd.id LIMIT 5000';
        $rows = Db::query($sql, $params);
        return ['columns' => [self::date('fecha', 'Fecha'), self::col('comprobante', 'Comprobante'), self::col('cliente', 'Cliente'), self::col('vendedor', 'Vendedor'), self::col('producto', 'Producto'), self::int('cantidad', 'Cant.'), self::money('precio', 'Precio'), self::money('importe', 'Importe'), self::money('costo', 'Costo'), self::money('ganancia', 'Ganancia')],
            'rows' => $rows, 'summary' => [['Líneas', count($rows)], ['Importe', self::sum($rows, 'importe')], ['Ganancia', self::sum($rows, 'ganancia')]]];
    }

    private function ventasVendedor(array $q): array
    {
        $params = [];
        $sql = "SELECT COALESCE(u.nombre, 'Sin vendedor') AS vendedor, COUNT(*) AS ventas, SUM(p.total) AS total " . self::VENTA_FROM;
        $sql .= self::range('cv.fecha_venta', $q, $params);
        $sql .= ' GROUP BY u.id, u.nombre ORDER BY total DESC';
        $rows = Db::query($sql, $params);
        return ['columns' => [self::col('vendedor', 'Vendedor'), self::int('ventas', 'Ventas'), self::money('total', 'Total vendido')], 'rows' => $rows, 'summary' => [['Total vendido', self::sum($rows, 'total')]]];
    }

    private function ventasCanal(array $q): array
    {
        $params = [];
        $sql = 'SELECT p.tipo_entrega AS tipo, COUNT(*) AS ventas, SUM(p.total) AS total ' . self::VENTA_FROM;
        $sql .= self::range('cv.fecha_venta', $q, $params);
        $sql .= ' GROUP BY p.tipo_entrega ORDER BY total DESC';
        $L = ['tienda' => 'Recojo en tienda', 'envio' => 'Envío', 'delivery' => 'Delivery', 'por_confirmar' => 'Por confirmar'];
        $out = array_map(function ($r) use ($L) { $r['tipo'] = Js::or(is_string($r['tipo']) ? ($L[$r['tipo']] ?? null) : null, $r['tipo']); return $r; }, Db::query($sql, $params));
        return ['columns' => [self::col('tipo', 'Tipo de entrega'), self::int('ventas', 'Ventas'), self::money('total', 'Total')], 'rows' => $out, 'summary' => [['Total', self::sum($out, 'total')]]];
    }

    private function comprasProveedor(array $q): array
    {
        $params = [];
        $sql = "SELECT c.proveedor_nombre AS proveedor, COUNT(*) AS compras, SUM(c.total) AS total FROM compras c WHERE c.estado <> 'anulada'";
        $sql .= self::range('c.fecha_emision', $q, $params);
        if (Js::t($q['search'] ?? null)) { $sql .= ' AND c.proveedor_nombre LIKE ?'; $params[] = self::like($q['search']); }
        $sql .= ' GROUP BY c.proveedor_nombre ORDER BY total DESC';
        $rows = Db::query($sql, $params);
        return ['columns' => [self::col('proveedor', 'Proveedor'), self::int('compras', 'Compras'), self::money('total', 'Total comprado')], 'rows' => $rows, 'summary' => [['Total comprado', self::sum($rows, 'total')]]];
    }

    private function comprasProducto(array $q): array
    {
        $params = [];
        $sql = "SELECT d.codigo, d.nombre AS producto, SUM(d.cantidad) AS cantidad, SUM(d.total) / NULLIF(SUM(d.cantidad), 0) AS costo_promedio, SUM(d.total) AS total\n                 FROM compra_detalles d JOIN compras c ON c.id = d.compra_id WHERE c.estado <> 'anulada'";
        $sql .= self::range('c.fecha_emision', $q, $params);
        if (Js::t($q['search'] ?? null)) { $sql .= ' AND d.nombre LIKE ?'; $params[] = self::like($q['search']); }
        $sql .= ' GROUP BY d.producto_id, d.codigo, d.nombre ORDER BY total DESC LIMIT 2000';
        $rows = Db::query($sql, $params);
        return ['columns' => [self::col('codigo', 'Código'), self::col('producto', 'Producto'), self::int('cantidad', 'Cantidad'), self::money('costo_promedio', 'Costo promedio'), self::money('total', 'Total')],
            'rows' => $rows, 'summary' => [['Productos', count($rows)], ['Total', self::sum($rows, 'total')]]];
    }

    // ------------------------------- GENERAL / PRODUCTOS -------------------------------
    private function productosCategoria(array $q): array
    {
        $rows = Db::query("\n        SELECT c.nombre AS categoria, COUNT(p.id) AS productos, COALESCE(SUM(p.stock), 0) AS stock,\n               COALESCE(SUM(p.stock * p.precio_costo), 0) AS valor_costo, COALESCE(SUM(p.stock * p.precio_venta), 0) AS valor_venta\n        FROM categorias c\n        LEFT JOIN producto_categorias pc ON pc.categoria_id = c.id\n        LEFT JOIN productos p ON p.id = pc.producto_id AND p.activo = 1 AND p.es_pack = 0\n        WHERE c.estado = 1 GROUP BY c.id, c.nombre ORDER BY c.nombre");
        return ['columns' => [self::col('categoria', 'Categoría'), self::int('productos', 'Productos'), self::int('stock', 'Stock'), self::money('valor_costo', 'Valor al costo'), self::money('valor_venta', 'Valor a precio de venta')],
            'rows' => $rows, 'summary' => [['Categorías', count($rows)]]];
    }

    private function packsGanancia(array $q): array
    {
        $params = [];
        $sql = "SELECT p.codigo, p.nombre, p.precio_venta AS venta,\n                  (SELECT COALESCE(SUM(pc.cantidad * c.precio_costo), 0) FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id WHERE pc.producto_id = p.id) AS costo,\n                  (SELECT COUNT(*) FROM producto_componentes pc JOIN productos c ON c.id = pc.componente_id\n                    WHERE pc.producto_id = p.id AND (ABS(COALESCE(c.precio_insumo, c.precio_venta) - pc.precio_ref) > 0.009 OR ABS(c.precio_costo - pc.costo_ref) > 0.009)) AS cambios\n                 FROM productos p WHERE p.es_pack = 1 AND p.activo = 1";
        if (Js::t($q['search'] ?? null)) { $sql .= ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)'; array_push($params, self::like($q['search']), self::like($q['search'])); }
        $sql .= ' ORDER BY p.nombre';
        $out = array_map(function ($r) {
            $venta = self::num($r['venta']);
            $costo = self::r2($r['costo']);
            return ['codigo' => $r['codigo'], 'nombre' => $r['nombre'], 'venta' => $venta, 'costo' => $costo, 'ganancia' => self::r2($venta - $costo), 'margen' => $venta > 0 ? self::r2((($venta - $costo) / $venta) * 100) : 0, 'revisar' => self::num($r['cambios']) > 0 ? 'Revisar precios' : ''];
        }, Db::query($sql, $params));
        return ['columns' => [self::col('codigo', 'Código'), self::col('nombre', 'Pack'), self::money('venta', 'Precio venta'), self::money('costo', 'Costo'), self::money('ganancia', 'Ganancia'), self::col('margen', '% Margen', ['align' => 'right']), self::col('revisar', 'Alerta')],
            'rows' => $out, 'summary' => [['Packs', count($out)], ['Por revisar', count(array_filter($out, fn ($r) => $r['revisar'] !== ''))]]];
    }
}

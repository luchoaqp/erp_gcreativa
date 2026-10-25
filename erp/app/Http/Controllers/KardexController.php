<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class KardexController extends Controller
{
    private static function isDate($s): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', Js::str(Js::or($s, '')));
    }

    private static function r2($n) { return Js::roundTo($n, 2); }

    /** Movimientos de stock de productos individuales (los packs mueven el stock de sus componentes) */
    public function getMovements()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $sql = "\n      SELECT k.id, k.fecha, k.tipo, k.motivo, k.documento, k.cantidad, k.costo_unit, k.stock_despues, k.almacen,\n             p.id AS producto_id, p.codigo, p.nombre AS producto, p.unidad\n      FROM kardex_movimientos k JOIN productos p ON p.id = k.producto_id\n      WHERE p.es_pack = 0";
            $params = [];
            if (Js::t($g('producto_id'))) { $sql .= ' AND k.producto_id = ?'; $params[] = Js::num($g('producto_id')); }
            if (self::isDate($g('desde'))) { $sql .= ' AND DATE(k.fecha) >= ?'; $params[] = $g('desde'); }
            if (self::isDate($g('hasta'))) { $sql .= ' AND DATE(k.fecha) <= ?'; $params[] = $g('hasta'); }
            if ($g('tipo') === 'ingresos') $sql .= " AND k.tipo = 'ingreso'";
            elseif ($g('tipo') === 'salidas') $sql .= " AND k.tipo = 'salida'";
            if (Js::t($g('search'))) { $sql .= ' AND (k.documento LIKE ? OR k.motivo LIKE ?)'; array_push($params, '%' . Js::str($g('search')) . '%', '%' . Js::str($g('search')) . '%'); }
            $sql .= ' ORDER BY k.fecha ASC, k.id ASC LIMIT 10000';
            $ingresos = 0;
            $salidas = 0;
            $movs = array_map(function ($m) use (&$ingresos, &$salidas) {
                $c = Js::num($m['cantidad']);
                if ($m['tipo'] === 'ingreso') $ingresos += $c; else $salidas += $c;
                $m['cantidad'] = $c;
                $m['costo_unit'] = Js::num($m['costo_unit']);
                $m['stock_despues'] = $m['stock_despues'] === null ? null : Js::num($m['stock_despues']);
                return $m;
            }, Db::query($sql, $params));
            return $this->json(['success' => true, 'movimientos' => $movs, 'totales' => ['ingresos' => $ingresos, 'salidas' => $salidas, 'saldo' => $ingresos - $salidas]]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener el Kardex'], 500);
        }
    }

    /** Kardex valorizado: valor del stock al costo y a precio de venta; con periodo, lo vendido */
    public function getValued()
    {
        try {
            $q = $this->query();
            $g = fn ($k) => $q[$k] ?? null;
            $pv = [];
            $per = '';
            if (self::isDate($g('desde'))) { $per .= ' AND DATE(k.fecha) >= ?'; $pv[] = $g('desde'); }
            if (self::isDate($g('hasta'))) { $per .= ' AND DATE(k.fecha) <= ?'; $pv[] = $g('hasta'); }
            $sql = "\n      SELECT p.id, p.codigo, p.nombre, p.unidad, p.stock, p.stock_minimo, p.precio_costo, p.precio_venta, p.imagen_url,\n        (SELECT GROUP_CONCAT(c2.nombre ORDER BY c2.nombre SEPARATOR ', ') FROM producto_categorias pc3 JOIN categorias c2 ON c2.id = pc3.categoria_id WHERE pc3.producto_id = p.id) AS categorias_nombres,\n        c.nombre AS categoria_nombre,\n        (SELECT COALESCE(SUM(CASE WHEN k.motivo = 'Venta' THEN k.cantidad WHEN k.motivo = 'Anulación de venta' THEN -k.cantidad ELSE 0 END), 0)\n           FROM kardex_movimientos k WHERE k.producto_id = p.id{$per}) AS vendidos\n      FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id\n      WHERE p.es_pack = 0 AND p.activo = 1";
            $params = $pv;
            if (Js::t($g('search'))) { $sql .= ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)'; array_push($params, '%' . Js::str($g('search')) . '%', '%' . Js::str($g('search')) . '%'); }
            if (Js::t($g('categoria_id'))) { $sql .= ' AND (p.categoria_id = ? OR EXISTS (SELECT 1 FROM producto_categorias x WHERE x.producto_id = p.id AND x.categoria_id = ?))'; array_push($params, Js::num($g('categoria_id')), Js::num($g('categoria_id'))); }
            $sql .= ' ORDER BY p.nombre ASC';
            $productos = array_map(function ($p) {
                $stock = Js::num($p['stock']);
                $costo = Js::num($p['precio_costo']);
                $venta = Js::num($p['precio_venta']);
                $p['stock'] = $stock;
                $p['precio_costo'] = $costo;
                $p['precio_venta'] = $venta;
                $p['vendidos'] = Js::num($p['vendidos']);
                $p['categoria_nombre'] = Js::or($p['categorias_nombres'], $p['categoria_nombre'], '');
                $p['valor_costo'] = self::r2($stock * $costo);
                $p['valor_venta'] = self::r2($stock * $venta);
                $p['ganancia'] = self::r2($stock * ($venta - $costo));
                return $p;
            }, Db::query($sql, $params));
            $t = ['valor_costo' => 0, 'valor_venta' => 0, 'ganancia' => 0];
            foreach ($productos as $p) {
                $t = ['valor_costo' => $t['valor_costo'] + $p['valor_costo'], 'valor_venta' => $t['valor_venta'] + $p['valor_venta'], 'ganancia' => $t['ganancia'] + $p['ganancia']];
            }
            return $this->json(['success' => true, 'productos' => $productos, 'totales' => ['valor_costo' => self::r2($t['valor_costo']), 'valor_venta' => self::r2($t['valor_venta']), 'ganancia' => self::r2($t['ganancia'])]]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener el Kardex valorizado'], 500);
        }
    }
}

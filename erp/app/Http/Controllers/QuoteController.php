<?php

namespace App\Http\Controllers;

use App\Services\Orders;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

class QuoteController extends Controller
{
    private const ESTADO_EFECTIVO = "CASE WHEN c.estado = 'vigente' AND c.fecha_vencimiento < CURDATE() THEN 'vencida' ELSE c.estado END";

    private static function r2($n) { return Js::roundTo($n, 2); }

    private static function bool($v): int
    {
        return ($v === true || $v === 1 || $v === '1' || $v === 'true') ? 1 : 0;
    }

    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    public static function loadConfig(): ?array
    {
        Db::query("INSERT IGNORE INTO cotizacion_config (id, pie_pagina) VALUES (1, 'Precios sujetos a disponibilidad de stock. ¡Gracias por su preferencia!')");
        return Db::query('SELECT * FROM cotizacion_config WHERE id = 1')[0] ?? null;
    }

    public function getConfig()
    {
        try {
            return $this->json(['success' => true, 'config' => self::loadConfig() ?? Js::undef()]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener la plantilla de cotizaciones'], 500);
        }
    }

    public function updateConfig()
    {
        try {
            self::loadConfig();
            $b = $this->body();
            $has = fn ($k) => array_key_exists($k, $b);
            $sets = [];
            $vals = [];
            $put = function ($col, $v) use (&$sets, &$vals) { $sets[] = "{$col} = ?"; $vals[] = $v; };
            $color = fn ($v) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v);

            if ($has('titulo_documento')) $put('titulo_documento', Js::or(Js::slice(Js::trim($b['titulo_documento']), 0, 60), 'COTIZACIÓN'));
            if ($has('color_acento')) {
                if (!preg_match('/^#[0-9a-fA-F]{6}$/', Js::str($b['color_acento']))) return $this->json(['success' => false, 'message' => 'Color inválido (use formato #RRGGBB)'], 400);
                $put('color_acento', $b['color_acento']);
            }
            if ($has('doc_color_nombre')) {
                if (Js::t($b['doc_color_nombre']) && !preg_match('/^#[0-9a-fA-F]{6}$/', Js::str($b['doc_color_nombre']))) return $this->json(['success' => false, 'message' => 'Color del nombre inválido (use formato #RRGGBB)'], 400);
                $put('doc_color_nombre', Js::or($b['doc_color_nombre'], null));
            }
            if ($has('igv_porcentaje')) {
                $n = Js::num($b['igv_porcentaje']);
                if (!($n >= 0 && $n <= 100) || Js::isNaN($n)) return $this->json(['success' => false, 'message' => 'El IGV debe estar entre 0 y 100'], 400);
                $put('igv_porcentaje', $n);
            }
            if ($has('aplicar_igv_defecto')) $put('aplicar_igv_defecto', self::bool($b['aplicar_igv_defecto']));
            if ($has('mostrar_igv_defecto')) $put('mostrar_igv_defecto', self::bool($b['mostrar_igv_defecto']));
            if ($has('vigencia_dias_defecto')) $put('vigencia_dias_defecto', min(365, max(1, Js::or(Js::parseInt($b['vigencia_dias_defecto']), 7))));
            if ($has('nota_defecto')) $put('nota_defecto', Js::slice(Js::str($b['nota_defecto']), 0, 2000));
            if ($has('mostrar_terminos')) $put('mostrar_terminos', self::bool($b['mostrar_terminos']));
            if ($has('pie_pagina')) $put('pie_pagina', Js::slice(Js::str($b['pie_pagina']), 0, 2000));
            if ($has('adelanto_tipo_defecto')) $put('adelanto_tipo_defecto', $b['adelanto_tipo_defecto'] === 'monto' ? 'monto' : 'porcentaje');
            if ($has('adelanto_valor_defecto')) $put('adelanto_valor_defecto', max(0, Js::or(Js::num($b['adelanto_valor_defecto']), 0)));
            if ($has('mostrar_qr')) $put('mostrar_qr', self::bool($b['mostrar_qr']));
            if ($has('qr_titulo')) $put('qr_titulo', Js::slice(Js::str($b['qr_titulo']), 0, 120));
            if ($has('qr_detalle')) $put('qr_detalle', Js::slice(Js::str($b['qr_detalle']), 0, 255));
            foreach (['doc_razon_social:150', 'doc_ruc:30', 'doc_direccion:255', 'doc_telefono:60', 'doc_email:100', 'doc_web:120', 'atendido_etiqueta:40', 'atendido_texto:100'] as $x) {
                [$k, $n] = explode(':', $x);
                if ($has($k)) $put($k, Js::orNull(Js::slice(Js::trim($b[$k]), 0, (int) $n)));
            }
            foreach (['doc_mostrar_logo', 'doc_mostrar_ruc', 'doc_mostrar_direccion', 'doc_mostrar_telefono', 'doc_mostrar_email', 'doc_mostrar_web',
                'doc_mostrar_atendido', 'doc_mostrar_cliente_doc', 'doc_mostrar_cliente_tel', 'doc_mostrar_codigo', 'doc_mostrar_vigencia'] as $k) {
                if ($has($k)) $put($k, self::bool($b[$k]));
            }
            if ($has('atendido_modo')) $put('atendido_modo', $b['atendido_modo'] === 'fijo' ? 'fijo' : 'usuario');
            if ($has('formato_defecto')) $put('formato_defecto', $b['formato_defecto'] === 'ticket' ? 'ticket' : 'a4');
            if ($has('qr_imagen')) {
                if (Js::t($b['qr_imagen']) && (!str_starts_with(Js::str($b['qr_imagen']), 'data:image/') || mb_strlen(Js::str($b['qr_imagen'])) > 3000000)) {
                    return $this->json(['success' => false, 'message' => 'La imagen del QR no es válida o es demasiado grande'], 400);
                }
                $put('qr_imagen', Js::or($b['qr_imagen'], null));
            }
            if (count($sets) === 0) return $this->json(['success' => false, 'message' => 'No hay datos para actualizar'], 400);
            Db::query('UPDATE cotizacion_config SET ' . implode(', ', $sets) . ' WHERE id = 1', $vals);
            return $this->json(['success' => true, 'message' => 'Plantilla de cotizaciones guardada', 'config' => self::loadConfig() ?? Js::undef()]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al guardar la plantilla'], 500);
        }
    }

    private static function computeTotals(array $items, $envio, $aplicarIgv, $pct): array
    {
        $acc = 0;
        foreach ($items as $i) $acc = $acc + self::r2($i['precio_unitario'] * $i['cantidad']);
        $subtotal = self::r2($acc);
        $costo = self::r2($envio);
        $igv = Js::t($aplicarIgv) ? self::r2($subtotal * $pct / 100) : 0;
        return ['subtotal' => $subtotal, 'costo_envio' => $costo, 'igv_monto' => $igv, 'total' => self::r2($subtotal + $costo + $igv)];
    }

    private static function normalizeItems($raw): array
    {
        if (!Js::isArray($raw) || count($raw) === 0) throw new HttpError(400, 'Agrega al menos un producto a la cotización');
        $ids = [];
        foreach ($raw as $i) { $n = Js::num(is_array($i) ? ($i['producto_id'] ?? null) : null); if (Js::t($n) && !in_array($n, $ids, true)) $ids[] = $n; }
        $prods = count($ids) ? Db::query('SELECT id, codigo, nombre FROM productos WHERE id IN (?)', [$ids]) : [];
        $out = [];
        foreach ($raw as $i) {
            $p = null;
            foreach ($prods as $x) if ($x['id'] === Js::num($i['producto_id'] ?? null)) { $p = $x; break; }
            if (!$p) throw new HttpError(400, 'Un producto de la cotización ya no existe en el catálogo');
            $cn = Js::num($i['cantidad'] ?? null);
            $cantidad = Js::isNaN($cn) ? NAN : (is_float($cn) ? (int) floor($cn) : $cn);
            $precio = Js::num($i['precio_unitario'] ?? null);
            if (!($cantidad >= 1) || Js::isNaN($cantidad)) throw new HttpError(400, 'La cantidad debe ser al menos 1');
            if (!($precio >= 0) || Js::isNaN($precio)) throw new HttpError(400, 'El precio no puede ser negativo');
            $out[] = [
                'producto_id' => $p['id'],
                'codigo' => Js::or($p['codigo'], null),
                'descripcion' => Js::slice(Js::or(Js::trim(Js::or($i['descripcion'] ?? null, '')), $p['nombre']), 0, 255),
                'cantidad' => $cantidad,
                'precio_unitario' => self::r2($precio),
            ];
        }
        return $out;
    }

    private static function insertItems($cotizacionId, array $items): void
    {
        foreach ($items as $it) {
            Db::query("INSERT INTO cotizacion_detalles (cotizacion_id, producto_id, codigo, descripcion, cantidad, precio_unitario, subtotal)\n       VALUES (?, ?, ?, ?, ?, ?, ?)", [
                $cotizacionId, $it['producto_id'], $it['codigo'], $it['descripcion'], $it['cantidad'], $it['precio_unitario'], self::r2($it['precio_unitario'] * $it['cantidad']),
            ]);
        }
    }

    public function getQuotes()
    {
        try {
            $search = $this->q('search');
            $estado = $this->q('estado');
            $sql = "\n      SELECT c.*, " . self::ESTADO_EFECTIVO . " AS estado_efectivo, u.nombre AS vendedor_nombre\n      FROM cotizaciones c\n      LEFT JOIN usuarios u ON u.id = c.usuario_id\n      WHERE 1=1";
            $params = [];
            if ($estado === 'vencida') $sql .= " AND c.estado = 'vigente' AND c.fecha_vencimiento < CURDATE()";
            elseif ($estado === 'vigente') $sql .= " AND c.estado = 'vigente' AND c.fecha_vencimiento >= CURDATE()";
            elseif ($estado === 'aceptada' || $estado === 'anulada') { $sql .= ' AND c.estado = ?'; $params[] = $estado; }
            if (Js::t($search)) { $sql .= ' AND (c.numero LIKE ? OR c.cliente_nombre LIKE ?)'; array_push($params, '%' . Js::str($search) . '%', '%' . Js::str($search) . '%'); }
            $sql .= ' ORDER BY c.id DESC LIMIT 500';
            return $this->json(['success' => true, 'quotes' => Db::query($sql, $params)]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener cotizaciones');
        }
    }

    private static function fetchQuote($id): ?array
    {
        $rows = Db::query("\n    SELECT c.*, " . self::ESTADO_EFECTIVO . " AS estado_efectivo, u.nombre AS vendedor_nombre,\n           p.numero_pedido AS pedido_numero\n    FROM cotizaciones c\n    LEFT JOIN usuarios u ON u.id = c.usuario_id\n    LEFT JOIN pedidos p ON p.id = c.pedido_id\n    WHERE c.id = ?", [$id]);
        if (count($rows) === 0) return null;
        $q = $rows[0];
        $q['items'] = Db::query('SELECT * FROM cotizacion_detalles WHERE cotizacion_id = ? ORDER BY id ASC', [$id]);
        return $q;
    }

    public function getQuoteById($id)
    {
        try {
            $quote = self::fetchQuote($id);
            if (!$quote) return $this->json(['success' => false, 'message' => 'Cotización no encontrada'], 404);
            return $this->json(['success' => true, 'quote' => $quote]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener la cotización');
        }
    }

    private static function readHeader(array $b, array $cfg): array
    {
        $vig = min(365, max(1, Js::or(Js::parseInt($b['vigencia_dias'] ?? null), $cfg['vigencia_dias_defecto'] ?? null, 7)));
        $tel = Js::slice(Js::trim(Js::or($b['cliente_telefono'] ?? null, '')), 0, 30);
        $doc = Js::slice(Js::trim(Js::or($b['cliente_documento'] ?? null, '')), 0, 20);
        $nota = Js::slice(Js::str(Js::or($b['nota'] ?? null, '')), 0, 2000);
        $av = Js::num($b['adelanto_valor'] ?? Js::undef());
        $esCargos = Js::isArray($b['cargos'] ?? null);
        $envio = 0;
        if ($esCargos) { foreach (Orders::parseCargos($b['cargos']) as $c) $envio = $envio + $c['monto']; }
        else $envio = max(0, Js::or(Js::num($b['costo_envio'] ?? null), 0));
        return [
            'cliente_id' => Js::t($b['cliente_id'] ?? null) ? Js::num($b['cliente_id']) : null,
            'cliente_nombre' => Js::slice(Js::or(Js::trim(Js::or($b['cliente_nombre'] ?? null, '')), 'Cliente Varios'), 0, 120),
            'cliente_telefono' => $tel !== '' ? $tel : null,
            'cliente_documento' => $doc !== '' ? $doc : null,
            'vigencia_dias' => $vig,
            'aplicar_igv' => self::bool($b['aplicar_igv'] ?? null),
            'mostrar_igv' => self::bool($b['mostrar_igv'] ?? null),
            'nota' => $nota !== '' ? $nota : null,
            'mostrar_terminos' => !array_key_exists('mostrar_terminos', $b) ? 1 : self::bool($b['mostrar_terminos']),
            'adelanto_tipo' => ($b['adelanto_tipo'] ?? null) === 'monto' ? 'monto' : ($av > 0 ? 'porcentaje' : null),
            'adelanto_valor' => $av > 0 ? min(($b['adelanto_tipo'] ?? null) === 'monto' ? 10000000 : 100, $av) : null,
            'cargos' => $esCargos ? Orders::parseCargos($b['cargos']) : null,
            'envio' => $envio,
        ];
    }

    public function createQuote()
    {
        try {
            Db::begin();
            $cfg = self::loadConfig();
            $b = $this->body();
            $h = self::readHeader($b, $cfg);
            $items = self::normalizeItems($b['items'] ?? null);
            $pct = Js::or(Js::num($cfg['igv_porcentaje']), 0);
            $t = self::computeTotals($items, $h['envio'], $h['aplicar_igv'], $pct);
            $r = Db::query("\n      INSERT INTO cotizaciones\n        (numero, cliente_id, cliente_nombre, cliente_telefono, cliente_documento, usuario_id, fecha,\n         vigencia_dias, fecha_vencimiento, aplicar_igv, mostrar_igv, igv_porcentaje,\n         costo_envio, subtotal, igv_monto, total, nota, cargos_json, adelanto_tipo, adelanto_valor, mostrar_terminos, estado)\n      VALUES (NULL, ?, ?, ?, ?, ?, NOW(), ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vigente')", [
                $h['cliente_id'], $h['cliente_nombre'], $h['cliente_telefono'], $h['cliente_documento'], $this->userId(),
                $h['vigencia_dias'], $h['vigencia_dias'], $h['aplicar_igv'], $h['mostrar_igv'], $pct,
                $t['costo_envio'], $t['subtotal'], $t['igv_monto'], $t['total'], $h['nota'], $h['cargos'] !== null ? Js::stringify($h['cargos']) : null,
                $h['adelanto_tipo'], $h['adelanto_valor'], $h['mostrar_terminos'],
            ]);
            $id = $r['insertId'];
            // El número sale del id autoincremental: nunca se repite aunque dos personas guarden a la vez
            $numero = 'COT-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
            Db::query('UPDATE cotizaciones SET numero = ? WHERE id = ?', [$numero, $id]);
            self::insertItems($id, $items);
            Db::commit();
            return $this->json(['success' => true, 'message' => "Cotización {$numero} creada", 'id' => $id, 'numero' => $numero], 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al crear la cotización');
        }
    }

    public function updateQuote($id)
    {
        try {
            Db::begin();
            $rows = Db::query('SELECT id, estado FROM cotizaciones WHERE id = ? FOR UPDATE', [$id]);
            if (count($rows) === 0) { Db::rollback(); return $this->json(['success' => false, 'message' => 'Cotización no encontrada'], 404); }
            if ($rows[0]['estado'] !== 'vigente') {
                Db::rollback();
                return $this->json(['success' => false, 'message' => 'Solo se pueden editar cotizaciones que no estén anuladas ni convertidas en venta'], 400);
            }
            $cfg = self::loadConfig();
            $b = $this->body();
            $h = self::readHeader($b, $cfg);
            $items = self::normalizeItems($b['items'] ?? null);
            $pct = Js::or(Js::num($cfg['igv_porcentaje']), 0);
            $t = self::computeTotals($items, $h['envio'], $h['aplicar_igv'], $pct);
            Db::query("\n      UPDATE cotizaciones SET\n        cliente_id = ?, cliente_nombre = ?, cliente_telefono = ?, cliente_documento = ?,\n        vigencia_dias = ?, fecha_vencimiento = DATE_ADD(CURDATE(), INTERVAL ? DAY),\n        aplicar_igv = ?, mostrar_igv = ?, igv_porcentaje = ?,\n        costo_envio = ?, subtotal = ?, igv_monto = ?, total = ?, nota = ?, cargos_json = ?, adelanto_tipo = ?, adelanto_valor = ?, mostrar_terminos = ?\n      WHERE id = ?", [
                $h['cliente_id'], $h['cliente_nombre'], $h['cliente_telefono'], $h['cliente_documento'],
                $h['vigencia_dias'], $h['vigencia_dias'], $h['aplicar_igv'], $h['mostrar_igv'], $pct,
                $t['costo_envio'], $t['subtotal'], $t['igv_monto'], $t['total'], $h['nota'], $h['cargos'] !== null ? Js::stringify($h['cargos']) : null,
                $h['adelanto_tipo'], $h['adelanto_valor'], $h['mostrar_terminos'], $id,
            ]);
            Db::query('DELETE FROM cotizacion_detalles WHERE cotizacion_id = ?', [$id]);
            self::insertItems($id, $items);
            Db::commit();
            return $this->json(['success' => true, 'message' => 'Cotización actualizada', 'id' => Js::num($id)]);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al actualizar la cotización');
        }
    }

    public function annulQuote($id)
    {
        try {
            $r = Db::query("UPDATE cotizaciones SET estado = 'anulada' WHERE id = ? AND estado IN ('vigente','aceptada')", [$id]);
            if ($r['affectedRows'] === 0) return $this->json(['success' => false, 'message' => 'Solo se pueden anular cotizaciones vigentes, vencidas o convertidas'], 400);
            return $this->json(['success' => true, 'message' => 'Cotización anulada']);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al anular la cotización');
        }
    }

    public function convertQuote($id)
    {
        try {
            Db::begin();
            $q = Db::query('SELECT * FROM cotizaciones WHERE id = ? FOR UPDATE', [$id])[0] ?? null;
            if (!$q) { Db::rollback(); return $this->json(['success' => false, 'message' => 'Cotización no encontrada'], 404); }
            if ($q['estado'] !== 'vigente') { Db::rollback(); return $this->json(['success' => false, 'message' => 'Esta cotización ya fue convertida o anulada'], 400); }
            if (strcmp(Js::str($q['fecha_vencimiento']), date('Y-m-d')) < 0) {
                Db::rollback();
                return $this->json(['success' => false, 'message' => 'La cotización está vencida. Edítala para renovar la vigencia y actualizar precios.'], 400);
            }
            $items = Db::query('SELECT * FROM cotizacion_detalles WHERE cotizacion_id = ?', [$q['id']]);
            foreach ($items as $i) {
                if (!Js::t($i['producto_id'])) { Db::rollback(); return $this->json(['success' => false, 'message' => 'La cotización tiene productos que ya no existen en el catálogo'], 400); }
            }
            $cliente = null;
            $varios = false;
            if (Js::t($q['cliente_id'])) {
                if (count(Db::query('SELECT id FROM clientes WHERE id = ?', [$q['cliente_id']]))) $cliente = ['id' => $q['cliente_id']];
            }
            if (!$cliente) {
                if (!Js::t($q['cliente_nombre']) || $q['cliente_nombre'] === 'Cliente Varios') $varios = true;
                else $cliente = ['nombre' => $q['cliente_nombre'], 'telefono' => Js::or($q['cliente_telefono'], ''), 'numero_documento' => Js::or($q['cliente_documento'], '')];
            }
            $b = $this->body();
            $g = fn ($k) => Js::get($b, $k);
            $body = Js::compact([
                'cliente' => $varios ? Js::undef() : $cliente,
                'cliente_varios' => $varios,
                'tipo_entrega' => $g('tipo_entrega'),
                'ciudad_envio' => $g('ciudad_envio'),
                'fecha_entrega' => $g('fecha_entrega'),
                'fecha_entrega_diseno' => $g('fecha_entrega_diseno'),
                'franja_horaria' => $g('franja_horaria'),
                'fecha_por_confirmar' => $g('fecha_por_confirmar'),
                'hora_por_confirmar' => $g('hora_por_confirmar'),
                'direccion_entrega' => $g('direccion_entrega'),
                'telefono_destinatario' => $q['cliente_telefono'],
                'cargos' => Js::t($q['cargos_json']) ? Orders::parseCargos($q['cargos_json']) : Js::undef(),
                'costo_envio' => $q['costo_envio'],
                'metodo_pago' => $g('metodo_pago'),
                'notas_taller' => $g('notas_taller'),
                'aplicar_igv' => Js::t($q['aplicar_igv']),
                'igv_porcentaje' => $q['igv_porcentaje'],
                'adelanto_tipo' => $g('adelanto_tipo'),
                'adelanto_valor' => $g('adelanto_valor'),
                'cliente_documento' => $q['cliente_documento'],
                'cliente_nombre' => $q['cliente_nombre'] === 'Cliente Varios' ? null : $q['cliente_nombre'],
                'diseno_link' => $g('diseno_link'),
                'diseno_foto' => $g('diseno_foto'),
                'diseno_links' => $g('diseno_links'),
                'items' => array_map(fn ($i) => ['producto_id' => $i['producto_id'], 'cantidad' => $i['cantidad'], 'precio_unitario' => $i['precio_unitario'], 'detalles_personalizacion' => ''], $items),
            ]);
            $result = Orders::createOrderCore($body, $this->userId());
            Db::query("UPDATE cotizaciones SET estado = 'aceptada', pedido_id = ? WHERE id = ?", [$result['pedidoId'], $q['id']]);
            Db::commit();
            return $this->json(array_merge(['success' => true, 'message' => "Cotización convertida en el pedido {$result['numero_pedido']}"], $result), 201);
        } catch (\Throwable $e) {
            Db::rollback();
            return $this->sendError($e, 'Error al convertir la cotización en venta');
        }
    }
}

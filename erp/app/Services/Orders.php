<?php

namespace App\Services;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * Lógica compartida de pedidos (POS, conversión de cotizaciones, duplicado de ventas).
 * Copia fiel de orderController.js (createOrderCore, normalizeDelivery, calcLines...).
 */
final class Orders
{
    public const TIPOS_ENTREGA = ['tienda', 'por_confirmar', 'envio', 'delivery'];
    public const ESTADOS_PEDIDO = ['pendiente_diseno', 'pendiente_aprobacion', 'en_produccion', 'listo', 'en_ruta', 'entregado', 'cancelado'];

    public static function r2($n) { return Js::roundTo($n, 2); }

    /** Cargos adicionales (embalaje, traslado...): [{ nombre, monto }] */
    public static function parseCargos($raw): array
    {
        try {
            $arr = is_string($raw) ? Js::parse($raw, $ok) : $raw;
            if (is_string($raw) && !$ok) return [];
            if (!Js::isArray($arr)) return [];
            $out = [];
            foreach ($arr as $c) {
                if (!is_array($c)) {
                    if ($c === null) return []; // c.nombre sobre null → TypeError → []
                    $c = [];
                }
                $nombre = Js::slice(Js::trim(Js::or($c['nombre'] ?? null, $c['zona'] ?? null, '')), 0, 100);
                $monto = self::r2(max(0, Js::or(Js::num($c['monto'] ?? ($c['costo'] ?? null)), 0)));
                if ($nombre !== '') $out[] = ['nombre' => $nombre, 'monto' => $monto];
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }

    private static function flag($v): bool
    {
        return $v === true || $v === 1 || $v === '1' || $v === 'true';
    }

    /** Datos de entrega: tipo + fecha/hora que pueden quedar "por confirmar" */
    public static function normalizeDelivery(array $b): array
    {
        $tipo = in_array($b['tipo_entrega'] ?? null, self::TIPOS_ENTREGA, true) ? $b['tipo_entrega'] : 'tienda';
        $ciudad = Js::slice(Js::trim(Js::or($b['ciudad_envio'] ?? null, '')), 0, 100);
        if ($tipo === 'envio' && $ciudad === '') throw new HttpError(400, 'Indica la ciudad a la que se enviará el pedido');
        $fechaPC = $tipo === 'por_confirmar' || self::flag($b['fecha_por_confirmar'] ?? null);
        $horaPC = $fechaPC || self::flag($b['hora_por_confirmar'] ?? null) || preg_match('/^por (confirmar|definir)$/i', Js::trim(Js::or($b['franja_horaria'] ?? null, '')));
        $fe = $b['fecha_entrega'] ?? null;
        $fecha = $fechaPC ? null : (preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str(Js::or($fe, ''))) ? Js::slice(Js::str($fe), 0, 10) : date('Y-m-d'));
        $fr = Js::slice(Js::trim(Js::or($b['franja_horaria'] ?? null, '')), 0, 50);
        $franja = $horaPC ? 'Por confirmar' : ($fr !== '' ? $fr : 'Por confirmar');
        $dir = Js::slice(Js::trim(Js::or($b['direccion_entrega'] ?? null, '')), 0, 255);
        $direccion = $tipo === 'tienda' ? 'Recojo en tienda'
            : ($tipo === 'por_confirmar' ? 'Por confirmar'
            : ($tipo === 'envio' ? "Envío a {$ciudad}" : ($dir !== '' ? $dir : 'Delivery')));
        $cargos = Js::isArray($b['cargos'] ?? null) ? self::parseCargos($b['cargos']) : null;
        if ($cargos !== null) {
            $sum = 0;
            foreach ($cargos as $c) $sum += $c['monto'];
            $costo = self::r2($sum);
        } else {
            $costo = self::r2(max(0, Js::or(Js::num($b['costo_envio'] ?? null), 0)));
        }
        return ['tipo' => $tipo, 'ciudad' => $tipo === 'envio' ? $ciudad : null, 'fecha' => $fecha, 'franja' => $franja, 'direccion' => $direccion, 'cargos' => $cargos, 'costo_envio' => $costo];
    }

    /** Líneas con descuentos: subtotal = bruto - descuentos de línea - descuento global */
    public static function calcLines(array $items, $descuentoGlobal): array
    {
        $bruto = 0;
        $descLineas = 0;
        $lines = [];
        foreach ($items as $i) {
            $cantidad = Js::num($i['cantidad'] ?? null);
            $precio = Js::num($i['precio_unitario'] ?? null);
            $brutoL = self::r2($precio * $cantidad);
            $desc = min($brutoL, max(0, self::r2(Js::or(Js::num($i['descuento'] ?? null), 0))));
            $bruto += $brutoL;
            $descLineas += $desc;
            $i['descuento'] = $desc;
            $i['neto'] = self::r2($brutoL - $desc);
            $lines[] = $i;
        }
        $bruto = self::r2($bruto);
        $descLineas = self::r2($descLineas);
        $descGlobal = min(self::r2($bruto - $descLineas), max(0, self::r2(Js::or(Js::num($descuentoGlobal), 0))));
        return ['lines' => $lines, 'bruto' => $bruto, 'descLineas' => $descLineas, 'descGlobal' => $descGlobal, 'subtotal' => self::r2($bruto - $descLineas - $descGlobal)];
    }

    /** Solo el administrador puede cambiar precios: para los demás se toma el precio del catálogo */
    public static function enforceCatalogPrices(array &$items): void
    {
        foreach ($items as &$it) {
            $p = Db::query('SELECT precio_venta, precio_por_cantidad FROM productos WHERE id = ?', [$it['producto_id'] ?? null])[0] ?? null;
            if (!$p) continue;
            $precio = Js::num($p['precio_venta']);
            if (Js::t($p['precio_por_cantidad'])) {
                $esc = Db::query('SELECT factor, precio FROM producto_presentaciones WHERE producto_id = ? AND factor <= ? ORDER BY factor DESC LIMIT 1', [$it['producto_id'], Js::or(Js::num($it['cantidad'] ?? null), 0)]);
                if (count($esc)) $precio = Js::num($esc[0]['precio']);
            }
            $it['precio_unitario'] = $precio;
        }
        unset($it);
    }

    /**
     * Crea el pedido (dentro de una transacción ya iniciada).
     * IMPORTANTE: un pedido NO descuenta stock; el stock se descuenta al generar el comprobante.
     */
    public static function createOrderCore(array $body, $usuarioIdParam): array
    {
        $v = fn ($k) => $body[$k] ?? null;
        $cliente = $v('cliente');
        $items = $v('items');
        if (!Js::t($items) || (is_array($items) ? count($items) : (is_string($items) ? strlen($items) : null)) === 0) {
            throw new HttpError(400, 'El pedido debe incluir al menos un producto o regalo');
        }
        $entrega = self::normalizeDelivery($body);
        $cg = fn ($k) => is_array($cliente) ? ($cliente[$k] ?? null) : null;

        // 1. Cliente (existente o nuevo; se reutiliza si coincide documento o teléfono)
        $clienteId = Js::or($cg('id'), null);
        if (!Js::t($clienteId) && Js::t($cg('nombre'))) {
            $doc = Js::slice(Js::trim(Js::or($cg('numero_documento'), $v('cliente_documento'), '')), 0, 30);
            $existing = [];
            if ($doc !== '') $existing = Db::query('SELECT id FROM clientes WHERE numero_documento = ? LIMIT 1', [$doc]);
            if (!count($existing) && Js::t($cg('telefono'))) {
                $existing = Db::query('SELECT id FROM clientes WHERE telefono = ? LIMIT 1', [$cg('telefono')]);
            }
            if (count($existing) > 0) {
                $clienteId = $existing[0]['id'];
            } else {
                $new = Db::query("\n        INSERT INTO clientes (nombre, telefono, email, direccion_frecuente, numero_documento)\n        VALUES (?, ?, ?, ?, ?)\n      ", [Js::slice(Js::trim($cg('nombre')), 0, 120), Js::or($cg('telefono'), ''), Js::or($cg('email'), ''), Js::or($cg('direccion_frecuente'), ''), $doc !== '' ? $doc : null]);
                $clienteId = $new['insertId'];
                Db::query("UPDATE clientes SET codigo = CONCAT('CLI-', LPAD(id, 6, '0')) WHERE id = ?", [$clienteId]);
            }
        }
        if (!Js::t($clienteId) && !Js::t($v('permitir_sin_cliente')) && $v('cliente_varios') !== true) {
            throw new HttpError(400, 'Indica los datos del cliente (nombre y teléfono), elígelo de la lista o marca “Cliente Varios”.');
        }
        $nombreCliente = Js::orNull(Js::slice(Js::trim(Js::or($v('cliente_nombre'), $cg('nombre'), '')), 0, 120));

        // 2. Subtotales (sin IGV) e IGV opcional solo sobre productos
        $calc = self::calcLines($items, $v('descuento_global'));
        $subtotal = $calc['subtotal'];
        $envio = $entrega['costo_envio'];
        $ai = $v('aplicar_igv');
        $aplicaIgv = $ai === true || $ai === 1 || $ai === '1';
        $igvPct = $aplicaIgv ? Js::or(Js::num($v('igv_porcentaje')), 0) : 0;
        $igvMonto = $aplicaIgv ? self::r2($subtotal * $igvPct / 100) : 0;
        $total = self::r2($subtotal + $envio + $igvMonto);

        // Adelanto: porcentaje o monto (sin datos = pago completo)
        $adelanto = $total;
        if ($v('adelanto_tipo') === 'porcentaje') $adelanto = self::r2($total * Js::or(Js::num($v('adelanto_valor')), 0) / 100);
        elseif ($v('adelanto_tipo') === 'monto') $adelanto = self::r2(Js::or(Js::num($v('adelanto_valor')), 0));
        $adelanto = min($total, max(0, $adelanto));
        $estadoPago = $adelanto >= $total - 0.009 ? 'pagado' : ($adelanto > 0 ? 'adelanto' : 'pendiente');

        // 3. Número de pedido PED-AAAAMM-NNN. FOR UPDATE: dos ventas simultáneas no pueden tomar el mismo número.
        $prefix = 'PED-' . date('Ym');
        $last = Db::query("\n    SELECT numero_pedido FROM pedidos WHERE numero_pedido LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE\n  ", ["{$prefix}%"]);
        $seq = 100; // los correlativos de pedidos parten en 100
        if (count($last) > 0) {
            $parts = explode('-', (string) $last[0]['numero_pedido']);
            if (Js::t($parts[2] ?? null)) $seq = max(100, Js::parseInt($parts[2]) + 1);
        }
        $numero = $prefix . '-' . str_pad(Js::str($seq), 3, '0', STR_PAD_LEFT);

        // 4. Insertar pedido
        $usuarioId = Js::or($usuarioIdParam, 1);
        $cd = Js::slice(Js::str(Js::or($v('cliente_documento'), '')), 0, 20);
        $res = Db::query("\n    INSERT INTO pedidos (\n      numero_pedido, cliente_id, usuario_id, fecha_pedido, fecha_entrega, franja_horaria,\n      nombre_destinatario, telefono_destinatario, direccion_entrega, referencia_entrega,\n      mensaje_dedicatoria, de_parte_de, tipo_entrega, costo_envio, subtotal, total,\n      metodo_pago, estado_pago, estado_pedido, notas_taller,\n      aplica_igv, igv_porcentaje, igv_monto, cliente_documento, cliente_nombre, ciudad_envio, cargos_json\n    ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_diseno', ?, ?, ?, ?, ?, ?, ?, ?)\n  ", [
            $numero, $clienteId, $usuarioId, $entrega['fecha'], $entrega['franja'],
            Js::or($nombreCliente, 'Cliente'), Js::or($v('telefono_destinatario'), ''), $entrega['direccion'], '',
            Js::or($v('mensaje_dedicatoria'), ''), Js::or($v('de_parte_de'), ''), $entrega['tipo'], $envio, $subtotal, $total,
            Js::or($v('metodo_pago'), 'yape'), $estadoPago, Js::or($v('notas_taller'), ''),
            $aplicaIgv ? 1 : 0, $igvPct, $igvMonto, $cd !== '' ? $cd : null, $nombreCliente, $entrega['ciudad'],
            $entrega['cargos'] !== null ? Js::stringify($entrega['cargos']) : null,
        ]);
        $pedidoId = $res['insertId'];
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', Js::str(Js::or($v('fecha_entrega_diseno'), '')))) {
            Db::query('UPDATE pedidos SET fecha_entrega_diseno = ? WHERE id = ?', [Js::slice(Js::str($v('fecha_entrega_diseno')), 0, 10), $pedidoId]);
        }

        // 5. Detalles (el stock NO se descuenta aquí)
        if ($calc['descGlobal'] > 0) Db::query('UPDATE pedidos SET descuento_global = ? WHERE id = ?', [$calc['descGlobal'], $pedidoId]);
        foreach ($calc['lines'] as $item) {
            Db::query("\n      INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal, descuento, detalles_personalizacion, proveedor_id, lote_id)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ", [
                $pedidoId, $item['producto_id'] ?? null, $item['cantidad'] ?? null, $item['precio_unitario'] ?? null, $item['neto'], $item['descuento'],
                Js::or($item['detalles_personalizacion'] ?? null, ''),
                Js::num($item['proveedor_id'] ?? null) > 0 ? Js::num($item['proveedor_id']) : null,
                Js::num($item['lote_id'] ?? null) > 0 ? Js::num($item['lote_id']) : null,
            ]);
        }

        // 6. Adelanto / pago inicial
        if ($adelanto > 0) {
            $metodo = Js::or($v('metodo_pago'), 'yape');
            $destinos = ['efectivo' => 'Caja principal', 'yape' => 'Yape', 'plin' => 'Plin', 'tarjeta' => 'POS / Tarjeta', 'transferencia' => 'Cuenta bancaria'];
            Db::query("\n      INSERT INTO pagos (pedido_id, fecha, metodo, destino, referencia, monto, concepto, usuario_id)\n      VALUES (?, CURDATE(), ?, ?, NULL, ?, ?, ?)\n    ", [$pedidoId, $metodo, Js::or($v('destino_pago'), is_string($metodo) ? ($destinos[$metodo] ?? null) : null, null), $adelanto, $adelanto >= $total - 0.009 ? 'pago_total' : 'adelanto', $usuarioId]);
        }

        // 7. Diseño (link y/o foto)
        self::saveDisenoCore($pedidoId, self::opt($body, 'diseno_link'), self::opt($body, 'diseno_foto'), self::opt($body, 'diseno_links'));

        return ['pedidoId' => $pedidoId, 'numero_pedido' => $numero, 'total' => $total, 'adelanto' => $adelanto, 'saldo' => self::r2($total - $adelanto)];
    }

    /** Valor del body o undefined si la clave no viene */
    public static function opt(array $b, string $k)
    {
        return array_key_exists($k, $b) ? $b[$k] : Js::undef();
    }

    public static function cleanLink($v): ?string
    {
        $s = Js::slice(Js::trim(Js::or($v, '')), 0, 500);
        if ($s === '') return null;
        if (!preg_match('#^https?://#i', $s)) throw new HttpError(400, 'El link del diseño debe empezar con http:// o https://');
        return $s;
    }

    private static function cleanLinks($arr): array
    {
        if (!Js::isArray($arr)) return [];
        $out = [];
        foreach (array_slice($arr, 0, 20) as $x) {
            $isObj = is_array($x);
            $url = self::cleanLink($isObj ? ($x['url'] ?? null) : null);
            $item = ['url' => $url, 'comentario' => Js::slice(Js::trim(Js::or($isObj ? ($x['comentario'] ?? null) : null, '')), 0, 120)];
            if ($url !== null) $out[] = $item;
        }
        return $out;
    }

    public static function parseLinks($row): array
    {
        if (!$row) return [];
        $j = Js::parse($row['links_json'] ?? null, $ok);
        if ($ok && Js::isArray($j) && count($j)) return $j;
        return Js::t($row['link'] ?? null) ? [['url' => $row['link'], 'comentario' => '']] : [];
    }

    /** Guarda link/foto del diseño; solo toca lo que se envía (undefined = no cambiar) */
    public static function saveDisenoCore($pedidoId, $link, $foto, $links): void
    {
        $U = fn ($x) => Js::isUndef($x);
        if ($U($link) && $U($foto) && $U($links)) return;
        $cur = Db::query('SELECT link, foto, links_json FROM pedido_diseno WHERE pedido_id = ?', [$pedidoId]);
        if (!$U($links)) $list = self::cleanLinks($links);
        elseif (!$U($link)) { $l = self::cleanLink($link); $list = $l !== null ? [['url' => $l, 'comentario' => '']] : []; }
        else $list = self::parseLinks($cur[0] ?? null);
        $f = Js::undef();
        if (!$U($foto)) {
            if (Js::t($foto) && (!str_starts_with(Js::str($foto), 'data:image/') || mb_strlen(Js::str($foto)) > 4000000)) throw new HttpError(400, 'La foto del diseño no es válida o es demasiado grande');
            $f = Js::or($foto, null);
        }
        $nf = $U($f) ? (isset($cur[0]) ? $cur[0]['foto'] : null) : $f;
        $nl = count($list) ? $list[0]['url'] : null;
        if (!Js::t($nl) && !Js::t($nf)) {
            if (count($cur)) Db::query('DELETE FROM pedido_diseno WHERE pedido_id = ?', [$pedidoId]);
            return;
        }
        Db::query('INSERT INTO pedido_diseno (pedido_id, link, foto, links_json) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE link = VALUES(link), foto = VALUES(foto), links_json = VALUES(links_json)', [
            $pedidoId, $nl, $nf, count($list) ? Js::stringify($list) : null,
        ]);
    }
}

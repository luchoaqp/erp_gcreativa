<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class SettingController extends Controller
{
    public function getSettings()
    {
        try {
            $rows = Db::query('SELECT * FROM configuracion WHERE id = 1');
            return $this->json(['success' => true, 'settings' => $rows[0] ?? (object) []]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener configuración'], 500);
        }
    }

    public function updateSettings()
    {
        try {
            $b = $this->body();
            $v = fn ($k) => $b[$k] ?? null;
            $color = $v('color_principal');
            if (Js::t($color) && !preg_match('/^#[0-9a-fA-F]{6}$/', Js::str($color))) {
                return $this->json(['success' => false, 'message' => 'Color principal inválido (use formato #RRGGBB)'], 400);
            }
            $antes = Db::query('SELECT nombre_tienda, ruc, direccion, telefono_whatsapp, email_contacto FROM configuracion WHERE id = 1')[0] ?? null;

            // typeof zonas_reparto === 'object' (incluye null y arrays) → JSON.stringify
            $zonas = array_key_exists('zonas_reparto', $b)
                ? ((is_array($b['zonas_reparto']) || $b['zonas_reparto'] === null) ? Js::stringify($b['zonas_reparto']) : $b['zonas_reparto'])
                : null;

            Db::query("\n      UPDATE configuracion SET\n        nombre_tienda = COALESCE(?, nombre_tienda),\n        ruc = COALESCE(?, ruc),\n        slogan = COALESCE(?, slogan),\n        telefono_whatsapp = COALESCE(?, telefono_whatsapp),\n        telefono_fijo = COALESCE(?, telefono_fijo),\n        email_contacto = COALESCE(?, email_contacto),\n        direccion = COALESCE(?, direccion),\n        horario_atencion = COALESCE(?, horario_atencion),\n        logo_url = COALESCE(?, logo_url),\n        moneda_simbolo = COALESCE(?, moneda_simbolo),\n        moneda_codigo = COALESCE(?, moneda_codigo),\n        separador_decimales = COALESCE(?, separador_decimales),\n        separador_miles = COALESCE(?, separador_miles),\n        costo_delivery_base = COALESCE(?, costo_delivery_base),\n        zonas_reparto = COALESCE(?, zonas_reparto),\n        mensaje_whatsapp_plantilla = COALESCE(?, mensaje_whatsapp_plantilla),\n        pie_ticket = COALESCE(?, pie_ticket),\n        color_principal = COALESCE(?, color_principal)\n      WHERE id = 1\n    ", [
                $v('nombre_tienda'), $v('ruc'), $v('slogan'), $v('telefono_whatsapp'), $v('telefono_fijo'), $v('email_contacto'),
                $v('direccion'), $v('horario_atencion'), $v('logo_url'), $v('moneda_simbolo'), $v('moneda_codigo'),
                $v('separador_decimales'), $v('separador_miles'), $v('costo_delivery_base'), $zonas,
                $v('mensaje_whatsapp_plantilla'), $v('pie_ticket'), Js::or($color, null),
            ]);

            // Datos de los documentos (cotización, nota de venta...) se mantienen sincronizados si no se personalizaron
            try {
                $pares = [['doc_razon_social', 'nombre_tienda', $v('nombre_tienda')], ['doc_ruc', 'ruc', $v('ruc')], ['doc_direccion', 'direccion', $v('direccion')],
                    ['doc_telefono', 'telefono_whatsapp', $v('telefono_whatsapp')], ['doc_email', 'email_contacto', $v('email_contacto')]];
                $docs = Db::query('SELECT * FROM cotizacion_config WHERE id = 1')[0] ?? null;
                if ($docs && $antes) {
                    $sets = [];
                    $vals = [];
                    foreach ($pares as [$docCol, $cfgCol, $nuevo]) {
                        if ($nuevo === null) continue;
                        $actual = Js::trim(Js::or($docs[$docCol] ?? null, ''));
                        if ($actual === '' || $actual === Js::trim(Js::or($antes[$cfgCol] ?? null, ''))) {
                            $sets[] = "{$docCol} = ?";
                            $vals[] = Js::orNull(Js::trim($nuevo));
                        }
                    }
                    if (count($sets)) Db::query('UPDATE cotizacion_config SET ' . implode(', ', $sets) . ' WHERE id = 1', $vals);
                }
            } catch (\Throwable $e) {
                // la tabla de documentos puede no existir aún
            }

            // Colores del menú lateral: vacío = restablecer
            $sbSets = [];
            $sbVals = [];
            foreach (['sidebar_bg', 'sidebar_texto', 'sidebar_activo_bg', 'sidebar_activo_texto'] as $k) {
                if (array_key_exists($k, $b)) {
                    $val = Js::or($b[$k], null);
                    if (Js::t($val) && !preg_match('/^#[0-9a-fA-F]{6}$/', Js::str($val))) {
                        return $this->json(['success' => false, 'message' => 'Color del menú inválido (use formato #RRGGBB)'], 400);
                    }
                    $sbSets[] = "{$k} = ?";
                    $sbVals[] = $val;
                }
            }
            if (count($sbSets)) Db::query('UPDATE configuracion SET ' . implode(', ', $sbSets) . ' WHERE id = 1', $sbVals);

            $filas = Db::query('SELECT * FROM configuracion WHERE id = 1');
            return $this->json(['success' => true, 'message' => 'Configuración empresarial y regional actualizada exitosamente', 'settings' => $filas[0] ?? (object) []]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al actualizar configuración'], 500);
        }
    }
}

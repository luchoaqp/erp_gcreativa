<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/**
 * NUEVO: textos de la web, portada general y campañas por ocasión (gcreativa.com).
 *
 * - GET    /api/web-site                         → textos, campañas y ocasiones (para el panel)
 * - PUT    /api/web-site/textos                  → guarda textos y datos de contacto
 * - POST   /api/web-site/campanas                → nueva campaña
 * - PUT    /api/web-site/campanas/{id}           → edita (fotos en base64 o rutas ya guardadas)
 * - DELETE /api/web-site/campanas/{id}           → elimina (la portada general no se puede eliminar)
 * - POST   /api/web-site/campanas/{id}/activar   → la activa (y desactiva las demás)
 * - POST   /api/web-site/campanas/desactivar     → vuelve a la portada general
 *
 * Nada de esto se ve en la web hasta pulsar "Publicar web" (WebCatalogController::publish).
 */
class WebSiteController extends Controller
{
    public const MAX_CAMPANAS = 15;

    /** Textos editables con su valor actual en la web (si se dejan vacíos, la web usa estos) */
    public const TEXTOS = [
        'hero_dato' => ['Delivery en Lima con fecha y hora de entrega', 120],
        'hero_boton_whatsapp' => ['Pedir por WhatsApp', 40],
        'catalogos_titulo' => ['Nuestros catálogos', 80],
        'catalogos_texto' => ['Elige la ocasión y te mostramos los regalos pensados para ella.', 250],
        'destacados_titulo' => ['Los más pedidos', 80],
        'destacados_texto' => ['Los favoritos de nuestros clientes. Todos se pueden personalizar con nombre, foto o mensaje.', 250],
        'pasos_titulo' => ['Así de fácil es pedir', 80],
        'paso1_titulo' => ['Elige tu regalo', 60], 'paso1_texto' => ['Mira el catálogo y toca «Pedir» en el que te guste.', 200],
        'paso2_titulo' => ['Personalízalo', 60], 'paso2_texto' => ['Por WhatsApp nos cuentas el nombre, la dedicatoria y los detalles.', 200],
        'paso3_titulo' => ['Lo entregamos', 60], 'paso3_texto' => ['Coordinamos fecha, hora y dirección. Te avisamos cuando llegue.', 200],
        'empresas_titulo' => ['Regalos para tu empresa', 80],
        'empresas_texto' => ['Kits para colaboradores, clientes y eventos, con el logo de tu marca. Cotizamos por volumen y entregamos en tus oficinas.', 300],
        'empresas_boton' => ['Cotizar para empresas', 40],
        'pie_frase' => ['Armamos cada regalo a mano y lo entregamos con tu dedicatoria.', 200],
        // Quiénes somos
        'nosotros_titulo' => ['Un taller pequeño con mucho cariño en cada caja', 120],
        'nosotros_texto' => ['Somos Genia Creativa. Diseñamos y armamos regalos personalizados para que cada fecha importante tenga un detalle a su altura.', 300],
        'historia_titulo' => ['Cómo empezamos', 80],
        'historia_p1' => ['Todo comenzó armando regalos para familia y amigos. La gente preguntaba quién los hacía, y así nació Genia Creativa.', 500],
        'historia_p2' => ['Hoy preparamos cajas sorpresa, desayunos, kits corporativos y detalles para cada ocasión. Elegimos los productos, escribimos las dedicatorias y cuidamos que cada entrega llegue a tiempo.', 500],
        'historia_p3' => ['Trabajamos con personas que quieren sorprender a alguien y con empresas que quieren agradecer a su equipo o a sus clientes.', 500],
        'valores_titulo' => ['Lo que nos importa', 80],
        'valor1_titulo' => ['Hecho a mano', 60], 'valor1_texto' => ['Cada regalo se arma en nuestro taller, pieza por pieza, revisado antes de salir.', 200],
        'valor2_titulo' => ['A tu medida', 60], 'valor2_texto' => ['Nombres, fotos, logos y mensajes: adaptamos el detalle a la persona que lo recibe.', 200],
        'valor3_titulo' => ['Puntuales', 60], 'valor3_texto' => ['Coordinamos fecha y hora de entrega y te avisamos cuando el regalo llega.', 200],
        // Catálogo
        'catalogo_titulo' => ['Nuestros catálogos', 80],
        'catalogo_texto' => ['Elige una ocasión y pide el regalo que te guste por WhatsApp. Los precios son referenciales y varían según la personalización.', 300],
        // Contacto
        'contacto_titulo' => ['Hablemos de tu regalo', 80],
        'contacto_texto' => ['Respondemos por WhatsApp en horario de atención. Para pedidos corporativos, cuéntanos cuántas unidades necesitas y para qué fecha.', 300],
        'contacto_form_titulo' => ['Cuéntanos qué necesitas', 80],
        // Datos de contacto (pie de página, Contacto y botones de WhatsApp)
        'whatsapp' => ['51921663818', 15],
        'telefono_visible' => ['+51 921 663 818', 30],
        'email' => ['hola@gcreativa.com', 100],
        'direccion' => ['Lima, Perú', 150],
        'horario' => ['Lunes a sábado, 9:00 a 19:00', 100],
        'instagram' => ['https://www.instagram.com/', 200],
        'facebook' => ['https://www.facebook.com/', 200],
        'tiktok' => ['https://www.tiktok.com/', 200],
    ];

    /** Fotos de secciones de la web (vacío = la original de la web) */
    public const IMAGENES = [
        'catalogos' => '/img/productos/catalogos.svg',   // Inicio · "Nuestros catálogos"
        'nosotros' => '/img/productos/aniversario.svg',  // Quiénes somos
    ];

    public static function imagenes(): array
    {
        $row = Db::query("SELECT valor FROM web_ajustes WHERE clave = 'imagenes'")[0] ?? null;
        $g = $row ? (json_decode((string) $row['valor'], true) ?: []) : [];
        $out = [];
        foreach (self::IMAGENES as $k => $def) $out[$k] = !empty($g[$k]) && is_string($g[$k]) ? $g[$k] : $def;
        return $out;
    }

    public function saveImagenes()
    {
        try {
            $in = is_array($this->body()['imagenes'] ?? null) ? $this->body()['imagenes'] : [];
            $actual = self::imagenes();
            $nuevo = [];
            foreach (self::IMAGENES as $k => $def) {
                if (!array_key_exists($k, $in)) { $nuevo[$k] = $actual[$k] === $def ? null : $actual[$k]; continue; }
                $v = self::imagen($in[$k], null, 'seccion');
                $nuevo[$k] = $v === $def ? null : $v;
            }
            Db::query("INSERT INTO web_ajustes (clave, valor) VALUES ('imagenes', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)", [json_encode($nuevo, JSON_UNESCAPED_SLASHES)]);
            return $this->json(['success' => true, 'message' => 'Fotos guardadas. Pulsa «Publicar web» para que se vean.', 'imagenes' => self::imagenes()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar las fotos');
        }
    }

    private function fail(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    public static function textos(): array
    {
        $row = Db::query("SELECT valor FROM web_ajustes WHERE clave = 'textos'")[0] ?? null;
        $guardados = $row ? (json_decode((string) $row['valor'], true) ?: []) : [];
        $out = [];
        foreach (self::TEXTOS as $k => [$def]) {
            $v = isset($guardados[$k]) && is_string($guardados[$k]) ? trim($guardados[$k]) : '';
            $out[$k] = $v !== '' ? $v : $def;
        }
        return $out;
    }

    public static function campanas(): array
    {
        return Db::query('SELECT c.*, o.nombre AS ocasion_nombre, o.icono AS ocasion_icono FROM web_campanas c LEFT JOIN ocasiones o ON o.id = c.ocasion_id ORDER BY c.es_portada DESC, c.nombre');
    }

    public function show()
    {
        try {
            $ocasiones = Db::query('SELECT id, nombre, icono FROM ocasiones ORDER BY id');
            foreach ($ocasiones as &$o) $o['slug'] = WebCatalogController::slug((string) $o['nombre']);
            unset($o);
            return $this->json([
                'success' => true,
                'textos' => self::textos(),
                'defaults' => array_map(fn ($t) => $t[0], self::TEXTOS),
                'imagenes' => self::imagenes(),
                'imagenes_default' => self::IMAGENES,
                'campanas' => self::campanas(),
                'ocasiones' => $ocasiones,
                'max_campanas' => self::MAX_CAMPANAS,
                'web_url' => rtrim((string) config('erp.web_url'), '/'),
            ]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al cargar la configuración de la web');
        }
    }

    public function saveTextos()
    {
        try {
            $b = $this->body();
            $in = is_array($b['textos'] ?? null) ? $b['textos'] : [];
            $out = [];
            foreach (self::TEXTOS as $k => [$def, $max]) {
                if (!array_key_exists($k, $in)) continue;
                $v = trim(str_replace(["\r\n", "\r"], "\n", (string) $in[$k]));
                $out[$k] = mb_substr($v, 0, $max);
            }
            if (isset($out['whatsapp'])) {
                $n = preg_replace('/\D/', '', $out['whatsapp']);
                if (strlen($n) === 9) $n = '51' . $n; // número peruano sin código de país
                if ($n !== '' && (strlen($n) < 10 || strlen($n) > 15)) throw new HttpError(400, 'El número de WhatsApp debe tener el código de país (ej. 51921663818)');
                $out['whatsapp'] = $n;
            }
            foreach (['instagram', 'facebook', 'tiktok'] as $red) {
                if (!empty($out[$red]) && !preg_match('#^https?://#i', $out[$red])) $out[$red] = 'https://' . $out[$red];
            }
            $row = Db::query("SELECT valor FROM web_ajustes WHERE clave = 'textos'")[0] ?? null;
            $actual = $row ? (json_decode((string) $row['valor'], true) ?: []) : [];
            // Si cambió el WhatsApp y no se escribió otro "teléfono como se muestra", se arma solo (+51 987 111 222)
            if (!empty($out['whatsapp']) && ($out['telefono_visible'] ?? '') === '' && preg_match('/^51(\d{3})(\d{3})(\d{3})$/', $out['whatsapp'], $m)) {
                $out['telefono_visible'] = "+51 {$m[1]} {$m[2]} {$m[3]}";
            }
            $nuevo = array_merge($actual, $out);
            Db::query("INSERT INTO web_ajustes (clave, valor) VALUES ('textos', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)", [json_encode($nuevo, JSON_UNESCAPED_UNICODE)]);
            return $this->json(['success' => true, 'message' => 'Textos guardados. Pulsa «Publicar web» para que se vean.', 'textos' => self::textos()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar los textos');
        }
    }

    /** Foto de campaña: base64 (nueva), ruta ya guardada o vacío */
    private static function imagen($v, $actual = null, string $prefijo = 'campana'): ?string
    {
        if (!is_string($v) || trim($v) === '') return null;
        $v = trim($v);
        if (preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $v, $m)) {
            $bin = base64_decode($m[2], true);
            if ($bin === false || strlen($bin) > 6 * 1024 * 1024) throw new HttpError(400, 'La foto es muy pesada (máximo 6 MB)');
            if (@getimagesizefromstring($bin) === false) throw new HttpError(400, 'El archivo no es una imagen válida');
            $dir = rtrim((string) config('erp.uploads_root'), '/') . '/web';
            if (!is_dir($dir) && !@mkdir($dir, 0755, true)) throw new HttpError(500, 'No se pudo crear la carpeta de fotos de la web');
            $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
            $name = $prefijo . '-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $ext;
            if (@file_put_contents("{$dir}/{$name}", $bin) === false) throw new HttpError(500, 'No se pudo guardar la foto');
            @chmod("{$dir}/{$name}", 0644);
            return "/uploads/web/{$name}";
        }
        // Solo se aceptan rutas propias (fotos subidas antes o las de la web)
        if (preg_match('#^/(uploads/web|img)/[A-Za-z0-9._/-]+$#', $v) && !str_contains($v, '..')) return $v;
        return $actual;
    }

    private static function datos(array $b, ?array $actual = null): array
    {
        $txt = fn ($k, $max, $def = '') => mb_substr(trim(str_replace(["\r\n", "\r"], "\n", (string) ($b[$k] ?? $def))), 0, $max);
        $d = [
            'nombre' => $txt('nombre', 80),
            'titulo' => $txt('titulo', 160),
            'texto' => $txt('texto', 600),
            'boton_texto' => $txt('boton_texto', 60) ?: 'Ver catálogo',
            'boton_destino' => preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($b['boton_destino'] ?? ''))),
            'ocasion_id' => Js::t($b['ocasion_id'] ?? null) ? (int) $b['ocasion_id'] : null,
        ];
        foreach (['imagen1', 'imagen2', 'imagen3'] as $k) $d[$k] = self::imagen($b[$k] ?? null, $actual[$k] ?? null);
        if ($d['nombre'] === '') throw new HttpError(400, 'Escribe el nombre de la campaña (ej. Navidad)');
        if ($d['titulo'] === '') throw new HttpError(400, 'Escribe el encabezado de la portada');
        return $d;
    }

    public function createCampana()
    {
        try {
            $n = (int) (Db::query('SELECT COUNT(*) AS n FROM web_campanas WHERE es_portada = 0')[0]['n'] ?? 0);
            if ($n >= self::MAX_CAMPANAS) throw new HttpError(400, 'Llegaste al máximo de ' . self::MAX_CAMPANAS . ' campañas. Edita o elimina una existente.');
            $d = self::datos($this->body());
            $r = Db::query('INSERT INTO web_campanas SET ?', [$d]);
            return $this->json(['success' => true, 'message' => 'Campaña creada', 'id' => $r['insertId'], 'campanas' => self::campanas()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al crear la campaña');
        }
    }

    public function updateCampana($id)
    {
        try {
            $actual = Db::query('SELECT * FROM web_campanas WHERE id = ?', [$id])[0] ?? null;
            if (!$actual) throw new HttpError(404, 'Campaña no encontrada');
            $d = self::datos($this->body(), $actual);
            if (Js::t($actual['es_portada'])) $d['nombre'] = 'Portada general';
            Db::query('UPDATE web_campanas SET ? WHERE id = ?', [$d, $id]);
            self::limpiarFotos();
            return $this->json(['success' => true, 'message' => 'Cambios guardados. Pulsa «Publicar web» para que se vean.', 'campanas' => self::campanas()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al guardar la campaña');
        }
    }

    public function deleteCampana($id)
    {
        try {
            $actual = Db::query('SELECT * FROM web_campanas WHERE id = ?', [$id])[0] ?? null;
            if (!$actual) throw new HttpError(404, 'Campaña no encontrada');
            if (Js::t($actual['es_portada'])) throw new HttpError(400, 'La portada general no se puede eliminar');
            Db::query('DELETE FROM web_campanas WHERE id = ?', [$id]);
            self::limpiarFotos();
            return $this->json(['success' => true, 'message' => 'Campaña eliminada', 'campanas' => self::campanas()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al eliminar la campaña');
        }
    }

    public function activar($id)
    {
        try {
            $actual = Db::query('SELECT * FROM web_campanas WHERE id = ?', [$id])[0] ?? null;
            if (!$actual) throw new HttpError(404, 'Campaña no encontrada');
            Db::query('UPDATE web_campanas SET activa = 0');
            if (!Js::t($actual['es_portada'])) Db::query('UPDATE web_campanas SET activa = 1 WHERE id = ?', [$id]);
            $msg = Js::t($actual['es_portada']) ? 'Portada general activa' : "Campaña «{$actual['nombre']}» activa";
            return $this->json(['success' => true, 'message' => "{$msg}. Pulsa «Publicar web» para que se vea.", 'campanas' => self::campanas()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al activar la campaña');
        }
    }

    public function desactivar()
    {
        try {
            Db::query('UPDATE web_campanas SET activa = 0');
            return $this->json(['success' => true, 'message' => 'Se usará la portada general. Pulsa «Publicar web» para que se vea.', 'campanas' => self::campanas()]);
        } catch (\Throwable $e) {
            return $this->fail($e, 'Error al desactivar la campaña');
        }
    }

    /** Borra fotos subidas que ya ninguna campaña usa */
    private static function limpiarFotos(): void
    {
        $dir = rtrim((string) config('erp.uploads_root'), '/') . '/web';
        if (!is_dir($dir)) return;
        $usadas = [];
        foreach (Db::query('SELECT imagen1, imagen2, imagen3 FROM web_campanas') as $r) foreach ($r as $v) if ($v) $usadas[basename($v)] = true;
        foreach (glob("{$dir}/campana-*") ?: [] as $f) if (!isset($usadas[basename($f)]) && filemtime($f) < time() - 3600) @unlink($f);
    }

    /**
     * Lo que se publica en la web (data/sitio.json). $copiar recibe la ruta /uploads/web/... y devuelve la URL pública en la web.
     */
    public static function buildSitio(callable $copiar): array
    {
        $activa = Db::query('SELECT * FROM web_campanas WHERE activa = 1 AND es_portada = 0 LIMIT 1')[0]
            ?? Db::query('SELECT * FROM web_campanas WHERE es_portada = 1 LIMIT 1')[0] ?? null;
        $portada = null;
        if ($activa) {
            $imgs = [];
            foreach (['imagen1', 'imagen2', 'imagen3'] as $k) {
                $v = (string) $activa[$k];
                $imgs[] = $v === '' ? null : (str_starts_with($v, '/uploads/web/') ? $copiar($v) : $v);
            }
            $portada = [
                'campana' => Js::t($activa['es_portada']) ? null : $activa['nombre'],
                'titulo' => $activa['titulo'],
                'texto' => $activa['texto'],
                'boton_texto' => $activa['boton_texto'],
                'boton_destino' => $activa['boton_destino'],
                'imagenes' => $imgs,
            ];
        }
        $imagenes = [];
        foreach (self::imagenes() as $k => $v) $imagenes[$k] = str_starts_with($v, '/uploads/web/') ? $copiar($v) : $v;
        return ['version' => gmdate('Y-m-d\TH:i:s\Z'), 'textos' => self::textos(), 'imagenes' => $imagenes, 'portada' => $portada];
    }
}

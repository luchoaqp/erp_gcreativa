<?php

namespace App\Http\Controllers;

use App\Support\Js;
use Illuminate\Support\Facades\Http as HttpClient;

/**
 * Consulta de DNI (RENIEC) y RUC (SUNAT) mediante un proveedor externo.
 * Requiere CONSULTA_DOC_TOKEN en el .env (proveedor por defecto: apis.net.pe)
 */
class LookupController extends Controller
{
    public function lookup($tipo, $numero)
    {
        $tipo = mb_strtoupper(Js::str(Js::or($tipo, '')));
        $numero = Js::trim(Js::or($numero, ''));
        $token = config('erp.consulta_doc_token');
        if (!Js::t($token)) {
            return $this->json(['success' => false, 'message' => 'La consulta SUNAT/RENIEC no está configurada. Agrega CONSULTA_DOC_TOKEN en el archivo backend/.env (ver LEEME).'], 501);
        }
        $base = (string) config('erp.consulta_doc_base');
        try {
            if ($tipo === 'DNI' && preg_match('/^\d{8}$/', $numero)) $url = "{$base}/reniec/dni?numero={$numero}";
            elseif ($tipo === 'RUC' && preg_match('/^\d{11}$/', $numero)) $url = "{$base}/sunat/ruc?numero={$numero}";
            else return $this->json(['success' => false, 'message' => 'Solo se puede consultar DNI (8 dígitos) o RUC (11 dígitos)'], 400);
            $r = HttpClient::withToken((string) $token)->acceptJson()->timeout(15)->get($url);
            $j = $r->json() ?? [];
            if (!$r->successful()) return $this->json(['success' => false, 'message' => Js::or($j['message'] ?? null, 'No se encontró información para ese documento')], 404);
            $data = $tipo === 'DNI'
                ? ['nombre' => implode(' ', array_filter([$j['nombres'] ?? null, $j['apellidoPaterno'] ?? null, $j['apellidoMaterno'] ?? null], fn ($x) => Js::t($x))), 'direccion' => '', 'departamento' => '', 'provincia' => '']
                : ['nombre' => Js::or($j['razonSocial'] ?? null, $j['nombre'] ?? null, ''), 'direccion' => Js::or($j['direccion'] ?? null, ''), 'departamento' => Js::or($j['departamento'] ?? null, ''), 'provincia' => Js::or($j['provincia'] ?? null, '')];
            return $this->json(['success' => true, 'data' => $data]);
        } catch (\Throwable $e) {
            return $this->json(['success' => false, 'message' => 'No se pudo conectar con el servicio de consulta'], 502);
        }
    }
}

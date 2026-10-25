<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\HttpError;
use App\Support\Js;

/** Catálogos de enlaces (Canva, PDF...) que se comparten con los clientes */
class CatalogController extends Controller
{
    private function sendError(\Throwable $e, string $fallback)
    {
        if ($e instanceof HttpError) return $this->json(['success' => false, 'message' => $e->getMessage()], $e->status);
        report($e);
        return $this->json(['success' => false, 'message' => $fallback], 500);
    }

    private static function txt($v, int $n): ?string
    {
        $s = Js::slice(Js::trim($v === null ? '' : $v), 0, $n);
        return $s !== '' ? $s : null;
    }

    public static function parseJson($raw, $fallback)
    {
        $j = Js::parse(is_string($raw) ? $raw : Js::str($raw), $ok);
        if (!$ok || $j === null) return $fallback;
        return $j;
    }

    private static function cleanLinks($arr): array
    {
        $list = Js::isArray($arr) ? $arr : [];
        $out = [];
        foreach (array_slice($list, 0, 30) as $x) {
            $isObj = is_array($x);
            $url = Js::slice(Js::trim(Js::or($isObj ? ($x['url'] ?? null) : null, '')), 0, 500);
            if ($url === '') continue;
            if (!preg_match('#^https?://#i', $url)) throw new HttpError(400, 'Cada enlace debe empezar con http:// o https://');
            $out[] = ['titulo' => Js::slice(Js::trim(Js::or($isObj ? ($x['titulo'] ?? null) : null, '')), 0, 100), 'url' => $url];
        }
        return $out;
    }

    private static function values(array $b): array
    {
        $nombre = self::txt($b['nombre'] ?? null, 120);
        if ($nombre === null) throw new HttpError(400, 'Escribe el nombre del catálogo');
        $links = self::cleanLinks($b['links'] ?? null);
        if (!count($links)) throw new HttpError(400, 'Agrega al menos un enlace de Canva');
        return [$nombre, self::txt($b['ocasion'] ?? null, 80), self::txt($b['descripcion'] ?? null, 300), Js::stringify($links)];
    }

    public function list()
    {
        try {
            $rows = Db::query('SELECT * FROM catalogos WHERE activo = 1 ORDER BY ocasion IS NULL, ocasion, nombre');
            $oc = Db::try('SELECT nombre FROM ocasiones ORDER BY nombre') ?? [];
            return $this->json([
                'success' => true,
                'catalogs' => array_map(function ($c) { $c['links'] = self::parseJson($c['links_json'], []); return $c; }, $rows),
                'ocasiones' => array_column($oc, 'nombre'),
            ]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al obtener los catálogos');
        }
    }

    public function create()
    {
        try {
            $r = Db::query('INSERT INTO catalogos (nombre, ocasion, descripcion, links_json) VALUES (?,?,?,?)', self::values($this->body()));
            return $this->json(['success' => true, 'id' => $r['insertId']], 201);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al guardar el catálogo');
        }
    }

    public function update($id)
    {
        try {
            $r = Db::query('UPDATE catalogos SET nombre=?, ocasion=?, descripcion=?, links_json=? WHERE id = ? AND activo = 1', [...self::values($this->body()), $id]);
            if (!$r['affectedRows']) throw new HttpError(404, 'Catálogo no encontrado');
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al actualizar el catálogo');
        }
    }

    public function remove($id)
    {
        try {
            Db::query('UPDATE catalogos SET activo = 0 WHERE id = ?', [$id]);
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->sendError($e, 'Error al eliminar el catálogo');
        }
    }
}

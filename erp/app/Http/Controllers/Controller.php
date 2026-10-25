<?php

namespace App\Http\Controllers;

use App\Support\Http;
use App\Support\Js;
use Illuminate\Http\Request;

/**
 * Base de los controladores. Ofrece el cuerpo JSON, la query y el usuario del token
 * con la misma forma que `req.body`, `req.query` y `req.user` de Express.
 */
abstract class Controller
{
    protected function req(): Request
    {
        return request();
    }

    /** req.body (array asociativo; claves ausentes = undefined) */
    protected function body(): array
    {
        $r = $this->req();
        if ($r->attributes->has('_body')) return $r->attributes->get('_body');
        $raw = $r->getContent();
        $data = [];
        if ($raw !== '' && str_contains((string) $r->header('Content-Type'), 'json')) {
            $data = json_decode($raw, true, 512, JSON_BIGINT_AS_STRING);
            if (!is_array($data)) $data = [];
        } elseif ($raw !== '' && str_contains((string) $r->header('Content-Type'), 'application/x-www-form-urlencoded')) {
            parse_str($raw, $data);
        }
        $r->attributes->set('_body', $data);
        return $data;
    }

    /** req.query */
    protected function query(): array
    {
        return $this->req()->query->all();
    }

    /** Valor de req.query[key] (undefined → null) */
    protected function q(string $key)
    {
        return $this->req()->query->all()[$key] ?? null;
    }

    /** req.user (payload del JWT) */
    protected function user(): array
    {
        return $this->req()->attributes->get('user') ?? [];
    }

    protected function userId()
    {
        return $this->user()['id'] ?? null;
    }

    protected function json($data, int $status = 200)
    {
        return Http::json($data, $status);
    }

    /** ¿Existe la clave en el body? (equivale a `x !== undefined`) */
    protected function has(array $a, string $k): bool
    {
        return array_key_exists($k, $a);
    }
}

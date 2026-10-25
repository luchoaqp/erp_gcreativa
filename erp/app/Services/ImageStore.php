<?php

namespace App\Services;

use App\Support\Js;

/**
 * Fotos de productos como archivos (public/uploads/productos) en vez de base64 dentro de MySQL.
 * Cada foto tiene 2 versiones: completa y miniatura (thumb/), con el mismo nombre.
 */
final class ImageStore
{
    public const URL_PREFIX = '/uploads/productos/';
    private const EXT = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
    private const MAX_BYTES = 6 * 1024 * 1024;

    public static function root(): string
    {
        return rtrim((string) config('erp.uploads_root'), '/');
    }

    public static function fullDir(): string
    {
        $d = self::root() . '/productos';
        if (!is_dir($d . '/thumb')) @mkdir($d . '/thumb', 0775, true);
        return $d;
    }

    public static function thumbDir(): string
    {
        return self::fullDir() . '/thumb';
    }

    private static function decode($dataUrl): ?array
    {
        if (!preg_match('#^data:(image/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$#', Js::str(Js::or($dataUrl, '')), $m)) return null;
        $buf = base64_decode($m[2], false);
        if ($buf === false || $buf === '' || strlen($buf) > self::MAX_BYTES) return null;
        return ['buf' => $buf, 'ext' => self::EXT[$m[1]]];
    }

    public static function isStored($url): bool
    {
        return is_string($url) && str_starts_with($url, self::URL_PREFIX) && !str_contains($url, '..');
    }

    private static function newName(string $ext): string
    {
        return Js::base36(Js::now()) . '-' . bin2hex(random_bytes(4)) . '.' . ltrim($ext, '.');
    }

    /** Guarda foto completa (+ miniatura si se envía; si no, copia de la completa). Devuelve la URL o null. */
    public static function saveProductImage($fullDataUrl, $thumbDataUrl = null): ?string
    {
        $full = self::decode($fullDataUrl);
        if (!$full) return null;
        $name = self::newName($full['ext']);
        file_put_contents(self::fullDir() . '/' . $name, $full['buf']);
        $thumb = self::decode($thumbDataUrl);
        file_put_contents(self::thumbDir() . '/' . $name, ($thumb && $thumb['ext'] === $full['ext']) ? $thumb['buf'] : $full['buf']);
        return self::URL_PREFIX . $name;
    }

    /** Reemplaza solo la miniatura de una foto ya guardada */
    public static function saveThumbOnly($url, $thumbDataUrl): bool
    {
        if (!self::isStored($url)) return false;
        $t = self::decode($thumbDataUrl);
        if (!$t) return false;
        $name = basename($url);
        if (pathinfo($name, PATHINFO_EXTENSION) !== $t['ext']) return false;
        file_put_contents(self::thumbDir() . '/' . $name, $t['buf']);
        return true;
    }

    public static function removeProductImage($url): void
    {
        if (!self::isStored($url)) return;
        $name = basename($url);
        foreach ([self::fullDir(), self::thumbDir()] as $dir) @unlink($dir . '/' . $name);
    }

    /** ¿La miniatura sigue siendo copia de la foto completa (pendiente de reducir)? */
    public static function thumbPending($url): bool
    {
        if (!self::isStored($url)) return false;
        $name = basename($url);
        $t = @filesize(self::thumbDir() . '/' . $name);
        $f = @filesize(self::fullDir() . '/' . $name);
        if ($t === false || $f === false) return true;
        return $t >= $f;
    }

    /** Copia una foto ya guardada a archivos nuevos (productos duplicados) */
    public static function copyProductImage($url)
    {
        if (!self::isStored($url)) return $url;
        $src = basename($url);
        $ext = pathinfo($src, PATHINFO_EXTENSION);
        $name = self::newName($ext);
        if (!@copy(self::fullDir() . '/' . $src, self::fullDir() . '/' . $name)) return $url;
        if (!@copy(self::thumbDir() . '/' . $src, self::thumbDir() . '/' . $name)) @copy(self::fullDir() . '/' . $src, self::thumbDir() . '/' . $name);
        return self::URL_PREFIX . $name;
    }
}

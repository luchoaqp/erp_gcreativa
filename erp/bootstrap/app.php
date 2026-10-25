<?php

use App\Support\Http;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // El backend original no recortaba textos ni convertía '' en null: se mantiene igual
        $middleware->remove([
            \Illuminate\Foundation\Http\Middleware\TrimStrings::class,
            \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
        ]);
        $middleware->alias([
            'jwt' => \App\Http\Middleware\JwtAuth::class,
            'roles' => \App\Http\Middleware\AuthorizeRoles::class,
            'acceso' => \App\Http\Middleware\ModuleAccess::class,
        ]);
        // Cambios de base de datos de cada actualización: se aplican solos en la primera petición a la API
        $middleware->prependToGroup('api', \App\Http\Middleware\AutoMigrate::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport([\App\Support\HttpError::class]);
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (!$request->is('api/*') && !$request->is('uploads/*')) return null;
            if ($e instanceof NotFoundHttpException || $e instanceof MethodNotAllowedHttpException) {
                return Http::json(['success' => false, 'message' => 'Ruta no encontrada: ' . $request->getRequestUri()], 404);
            }
            report($e);
            return Http::json(['success' => false, 'message' => 'Error interno del servidor', 'error' => $e->getMessage()], 500);
        });
    })->create();

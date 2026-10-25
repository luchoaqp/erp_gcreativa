<?php

use Illuminate\Support\Facades\Route;

// Instalación inicial (solo con SETUP_TOKEN en el .env)
Route::get('/instalar', [\App\Http\Controllers\MaintenanceController::class, 'install']);

// Pantalla para elegir los productos de la web y publicarlos (usa la sesión del ERP)
Route::get('/catalogo-web', fn () => response()->file(public_path('catalogo-web.html'), ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache']));

// Frontend React (compilado en public/): cualquier ruta que no sea /api ni un archivo existente
// devuelve index.html para que React Router la resuelva.
Route::get('/{any?}', function () {
    $index = public_path('index.html');
    if (!is_file($index)) {
        return response('ERP Genia Creativa: falta subir el frontend compilado (index.html) a la carpeta public/.', 503);
    }
    return response()->file($index, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache']);
})->where('any', '^(?!api/|api$|uploads/).*');

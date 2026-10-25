<?php

// Configuración propia del ERP (se lee del archivo .env)
return [
    'version' => '2.0.0-laravel',
    // Clave para firmar los tokens de sesión. Usa la MISMA que tenía el backend Node
    // (JWT_SECRET) para que las sesiones abiertas sigan siendo válidas tras la migración.
    'jwt_secret' => env('JWT_SECRET'),
    'jwt_ttl_hours' => 12,

    // Solo para pruebas de equivalencia con el backend Node (que usaba la fecha UTC en el dashboard)
    'compat_hoy_utc' => (bool) env('ERP_COMPAT_HOY_UTC', false),

    // Consulta de DNI/RUC (apis.net.pe u otro proveedor compatible)
    'consulta_doc_token' => env('CONSULTA_DOC_TOKEN'),
    'consulta_doc_base' => env('CONSULTA_DOC_BASE', 'https://api.apis.net.pe/v2'),

    // Carpeta pública donde se guardan las fotos de productos (/uploads/productos/...)
    'uploads_root' => env('ERP_UPLOADS_ROOT', public_path('uploads')),

    // Carpeta de respaldos JSON (fuera de la carpeta pública)
    'backups_dir' => env('ERP_BACKUPS_DIR', storage_path('app/backups')),

    // Publicación del catálogo para la web gcreativa.com (ruta absoluta al archivo catalogo.json de la web)
    'catalogo_web_path' => env('CATALOGO_WEB_PATH'),
    'catalogo_web_imagenes' => env('CATALOGO_WEB_IMAGENES'),
    'catalogo_web_url_imagenes' => env('CATALOGO_WEB_URL_IMAGENES', '/img/catalogo'),
];

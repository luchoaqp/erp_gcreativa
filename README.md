# ERP & Web · Genia Creativa

Repositorio privado con todo el sistema:

| Carpeta | Qué es | Dónde corre |
|---|---|---|
| `erp/` | Backend del ERP en Laravel (PHP 8.2) + frontend ya compilado en `erp/public/` | `erp.gcreativa.com` → `/home/atcgroup/erp` |
| `frontend/` | Código fuente de las pantallas del ERP (React + Vite). Se compila y se copia a `erp/public/` | — |
| `web/` | Sitio público gcreativa.com (Astro, HTML estático) | `gcreativa.com` → `/home/atcgroup/gcreativa.com` |

Documentación:
- `erp/LEEME.md`: instalación y mantenimiento del ERP en cPanel.
- `erp/INFORME_MIGRACION.md`: migración Node → Laravel y resultados de las pruebas.
- `web/README.md`: cómo editar, compilar y subir la web; conexión con el ERP ("Publicar catálogo").

## Cómo se publican los cambios (plan B, sin SSH)

1. Cada cambio se hace en una rama y llega como *Pull Request* con su explicación.
2. Junto con el cambio se entrega un **zip solo con los archivos modificados**, con la misma estructura de carpetas.
3. Se sube a cPanel y se usa **Extraer** encima de `/home/atcgroup/erp` (o de la carpeta de la web).
   - Nunca se reemplazan `.env`, `public/uploads/` ni `storage/`.
4. Si el cambio incluye migraciones de base de datos, se ejecuta "Actualizar sistema" desde el ERP.

## No va en el repositorio

- `.env`: contraseñas y claves.
- Fotos de productos y copias de seguridad, porque son datos del negocio.
- `vendor/` y `node_modules/`: se regeneran con `composer install` / `npm ci` (versiones fijadas en los `.lock`).

# ERP Genia Creativa · versión Laravel (PHP)

Es el mismo ERP de siempre (mismas pantallas, misma base de datos), pero el "motor" ahora es PHP/Laravel en lugar de Node.js, para que funcione en el hosting cPanel de gcreativa.com, sin pagar un servidor aparte.

- **Pantallas (frontend React):** las mismas. Ya vienen compiladas dentro de `public/`.
- **Base de datos:** la misma estructura MySQL. Los datos se pasan con una exportación/importación normal.
- **API:** las mismas rutas `/api/...` y las mismas respuestas que el backend Node.
- **Contraseñas:** las mismas. Los hashes bcrypt de Node se aceptan tal cual.
- **Volver a Node en un VPS:** posible en cualquier momento, porque la base es compatible en ambos sentidos.

---

## 1. Requisitos del hosting

- **PHP 8.2 o superior** (cPanel → *Seleccionar versión de PHP* o *MultiPHP Manager*), con las extensiones:
  - `pdo_mysql`
  - `mbstring`
  - `zlib`
  - `openssl`
  - `fileinfo`
  - `intl` es opcional.
- **MySQL 5.7+ o MariaDB 10.3+.**
- **No hace falta SSH, Node ni Composer.** La carpeta `vendor/` ya viene incluida.

## 2. Primera instalación en cPanel (sin SSH)

1. **Versión de PHP.** En hostings con CloudLinux, la versión se elige en *Seleccionar versión de PHP*, que aplica a toda la cuenta, además de *MultiPHP Manager*.
1. **Crear el subdominio.** En cPanel → *Dominios* → *Crear dominio* → `erp.gcreativa.com`.
   - Como **raíz del documento** escribe solo `erp/public`: cPanel ya antepone `/home/CUENTA/`. Si pegas la ruta completa, queda duplicada.
   - Si tu cPanel no te deja elegirla, no pasa nada: el archivo `.htaccess` de la raíz redirige solo a `public/`.
2. **Crear la base de datos.** En cPanel → *Bases de datos MySQL*:
   - Crea la base (por ejemplo `CUENTA_erp`) y un usuario.
   - Asigna el usuario a la base con **todos los privilegios**.
3. **Pasar los datos actuales** (si ya usas el ERP en tu PC):
   - En tu PC, abre phpMyAdmin (XAMPP) → base `tienda_regalos` → **Exportar** → SQL.
   - En cPanel → phpMyAdmin → tu base nueva → **Importar** ese archivo.
   - Si empiezas desde cero, salta este paso: las tablas se crean en el paso 6.
4. **Subir el ERP.** En cPanel → *Administrador de archivos*:
   - Sube `erp-genia-laravel.zip` a `/home/CUENTA/` y usa **Extraer**. Queda la carpeta `/home/CUENTA/erp/`.
   - Copia tus fotos de productos (carpeta `backend/uploads/productos` del ERP Node) dentro de `erp/public/uploads/productos/`.
5. **Configurar.**
   - Abre `erp/.env.produccion`, completa lo marcado con `<<<` y renómbralo a **`.env`**:
     - Datos de la base.
     - El mismo `JWT_SECRET` que tenías en `backend/.env`.
     - Las rutas de la web.
   - Para la instalación, escribe una clave cualquiera en `SETUP_TOKEN`, por ejemplo `SETUP_TOKEN=miclave2026`.
   - Si la base es nueva, escribe también una contraseña en `ADMIN_PASSWORD`.
6. **Instalar.**
   - Abre `https://erp.gcreativa.com/instalar?token=miclave2026`.
   - Verás "Instalación completada". Si la base ya tenía datos, no se borra ni se modifica nada: solo se agregan las 2 columnas nuevas del catálogo web.
   - **Después borra la línea `SETUP_TOKEN`** del `.env`.
7. **Activar HTTPS.** En cPanel → *SSL/TLS Status* → activa el certificado para `erp.gcreativa.com`.
8. **Entrar.** Abre `https://erp.gcreativa.com` e inicia sesión con tus usuarios de siempre.

> Fotos y Excel grandes: el ERP acepta archivos de hasta 50 MB. Si una subida falla, ve a cPanel → *Editor INI MultiPHP* y sube `upload_max_filesize` y `post_max_size` a `60M`. El archivo `public/.user.ini` ya lo intenta automáticamente.

## 3. Catálogo de la web (gcreativa.com)

- **Catálogos de la web = Ocasiones del ERP.** Créalas en *Categorías & Ocasiones* con nombre y emoji. La web las muestra en el orden en que se crearon.
- **Productos de cada catálogo:** se toma la *ocasión* de cada producto. Si quieres un producto en varios catálogos, agrégale además una *categoría* que se llame igual que la otra ocasión.
- **Favoritos ★:** en `/catalogo-web` la estrella marca el producto como *Destacado*, que es lo mismo que la casilla de la ficha. Aparece primero en "Destacados", la vista inicial del catálogo de la web, y como portada de su catálogo.
- **Pestañas:** en `/catalogo-web` puedes ver los productos por *Ocasiones* o por *Categorías*, y filtrarlos por estado (en la web, favoritos, sin publicar).
- **Publicar:** en **`https://erp.gcreativa.com/catalogo-web`** activas los productos que salen en la web, escribes la descripción para clientes (la descripción interna **no** se publica) y pulsas **Publicar catálogo**.
- El ERP escribe `catalogo.json` y copia las fotos a la web. Los cambios se ven al instante, sin recompilar nada.
- Solo se muestran los catálogos con al menos un producto publicado.

## 4. Actualizaciones futuras del ERP

Cuando haya una versión nueva:

1. Recibirás un zip solo con lo que cambió, normalmente `app/`, `routes/`, `database/` y/o `public/assets`.
2. Súbelo y extráelo encima de `erp/`. **Nunca reemplaces tu `.env` ni `public/uploads/`.**
3. Si la versión trae cambios en la base de datos:
   - Entra al ERP como administrador.
   - Abre `https://erp.gcreativa.com/api/sistema/estado` para ver el estado.
   - Luego ejecuta la actualización: haz `POST /api/sistema/actualizar`, o pídeme el botón.
   - Esto aplica solo las migraciones pendientes y limpia la caché.
4. Antes de cada actualización, saca una **Copia de Seguridad** desde el ERP.

## 5. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Pantallas (React compiladas) | `public/index.html`, `public/assets/` |
| Fotos de productos | `public/uploads/productos/` |
| Copias de seguridad JSON | `storage/app/backups/` (no son públicas) |
| Registros de error | `storage/logs/laravel.log` |
| Rutas de la API | `routes/api.php` (mismo orden que el `server.js` de Node) |
| Lógica de cada módulo | `app/Http/Controllers/` |
| Servicios compartidos (stock, lotes, pedidos, kardex, Excel) | `app/Services/` |
| Estructura de la base | `database/schema/erp_schema.sql` + `database/migrations/` |
| Configuración propia del ERP | `config/erp.php` (lee el `.env`) |

## 6. Cambiar el frontend

El código de las pantallas sigue siendo tu carpeta `frontend/` de siempre. Para publicar un cambio:

1. En tu PC, dentro de `frontend/`, ejecuta `npm run build`.
2. Sube el **contenido** de `frontend/dist/` a `erp/public/`. Reemplaza `index.html` y `assets/`, y no toques `index.php`, `.htaccess` ni `uploads/`.

## 7. Seguridad

- El `.env` y las carpetas internas no son accesibles desde el navegador.
- `APP_DEBUG=false` en producción: los errores no muestran detalles al público, solo quedan en `storage/logs/`.
- Los tokens de sesión duran 12 horas, igual que antes.
- Los permisos por rol son los mismos (admin, vendedor, taller, repartidor).

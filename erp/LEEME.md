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

## 3. Gestión de la web (gcreativa.com)

En el menú del ERP, **Página web → Gestionar la web** abre en otra ventana el panel `https://erp.gcreativa.com/catalogo-web`. Usa tu misma sesión. **Nada cambia en la web hasta pulsar «Publicar web».**

| Pestaña | Para qué |
|---|---|
| **Productos** | Activar qué productos salen en la web, escribir su descripción para clientes y marcar favoritos ★. Puedes verlos por ocasión o categoría y filtrar por estado. |
| **Portada y campañas** | La portada del Inicio (encabezado, texto, botón y 3 fotos). La **portada general** se usa todo el año. Puedes tener hasta **15 campañas** (Navidad, Día de la Madre…): las preparas con anticipación y las **activas** cuando empieza la temporada. Solo una activa a la vez; «Volver a la portada general» la desactiva. |
| **Textos y contacto** | Una pestaña por página de la web: **Inicio · Quiénes somos · Catálogo · Contacto y pie de página**. Incluye títulos, textos, la foto de «Nuestros catálogos» y la de «Quiénes somos», WhatsApp, correo, dirección, horario y redes sociales. Si dejas un campo vacío, se usa el texto original; «Usar la original» devuelve la foto original. |

Cómo arma la web sus secciones:

- **Catálogos de la web = Ocasiones del ERP.** Se crean en *Categorías & Ocasiones*, con nombre y emoji. Un producto pertenece al catálogo de su *ocasión*. Para ponerlo en varios, agrégale además una *categoría* que se llame igual que la otra ocasión.
- **Durante una campaña:** el catálogo de esa ocasión aparece primero y el botón de la portada lleva directo a él.
- **Inicio:**
  - «Nuestros catálogos» tiene el texto y las etiquetas a la izquierda (hasta 9, en 3 x 3) y una foto a la derecha.
  - «Los más pedidos» muestra los productos con ★, hasta 6 (2 filas de 3).
- **Fotos de campaña:** se reducen solas a 1400 px. Se guardan en `public/uploads/web/` del ERP y, al publicar, se copian a la web (`img/catalogo/`).

## 4. Descripción para clientes (cotizaciones, documentos y web)

- En la ficha de cada **producto** o **pack**, la sección *Descripción para clientes* guarda el texto que ve el cliente debajo del nombre, por ejemplo qué incluye un box.
  - Las líneas que empiezan con `•` o `-` salen como lista.
  - En los packs, el botón **Armar desde lo que lleva** escribe la lista a partir de los productos del pack.
- Las casillas **Mostrar en: Cotizaciones · Documentos de venta · Página web** deciden dónde aparece.
- **Cotizaciones:** al agregar el producto, la descripción se copia en la línea y se puede editar solo para esa cotización.
- **Nota interna:** el campo de "Más datos" no lo ve el cliente.

## 5. Vista previa antes de guardar

- **Cotizaciones:** "Vista previa y guardar" muestra el documento tal como lo recibirá el cliente (A4, A5 o ticket) antes de guardarlo.
- **Punto de venta:** "Vista previa y generar venta" muestra el pedido antes de registrarlo.
- **Pedido en curso:** si cambias de pantalla, el carrito del Punto de venta se conserva. Si cierras el navegador con productos en el carrito, el ERP pide confirmación.

## 6. Actualizaciones futuras del ERP

1. Recibirás un zip solo con lo que cambió. Súbelo y usa **Extraer** encima de `erp/`. **Nunca reemplaces tu `.env` ni `public/uploads/`.**
2. **La base de datos se actualiza sola:** en la primera petición después de subir los archivos, el ERP aplica las migraciones nuevas. Queda constancia en `storage/app/esquema-*.ok` y, si algo falla, en `storage/logs/laravel.log`.
3. Antes de cada actualización, saca una **Copia de Seguridad** desde el ERP.

## 7. Dónde está cada cosa

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

## 8. Cambiar el frontend

El código de las pantallas sigue siendo tu carpeta `frontend/` de siempre. Para publicar un cambio:

1. En tu PC, dentro de `frontend/`, ejecuta `npm run build`.
2. Sube el **contenido** de `frontend/dist/` a `erp/public/`. Reemplaza `index.html` y `assets/`, y no toques `index.php`, `.htaccess` ni `uploads/`.

## 9. Seguridad

- El `.env` y las carpetas internas no son accesibles desde el navegador.
- `APP_DEBUG=false` en producción: los errores no muestran detalles al público, solo quedan en `storage/logs/`.
- Los tokens de sesión duran 12 horas, igual que antes.
- Los permisos por rol son los mismos (admin, vendedor, taller, repartidor).

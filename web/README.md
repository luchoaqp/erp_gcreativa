# Genia Creativa — sitio web (gcreativa.com)

Sitio estático hecho con **Astro**. Se desarrolla en tu PC, se compila y se sube a cPanel.
No usa WordPress, plugins ni base de datos: solo HTML, CSS y un poco de JavaScript.

## 1. Requisitos (una sola vez)

- **Node.js 20 LTS o superior** → https://nodejs.org/es/download/
- Un editor de código, por ejemplo **VS Code** → https://code.visualstudio.com/

## 2. Ponerlo en marcha en tu PC

Descomprime el proyecto en, por ejemplo, `C:\DEV\genia-creativa` y abre una terminal ahí:

```bash
npm install      # descarga Astro y las fuentes (solo la primera vez)
npm run dev      # servidor de desarrollo en http://localhost:4321
```

Abre http://localhost:4321. Cada vez que guardes un archivo, el navegador se actualiza solo.

## 3. Dónde se cambia cada cosa

| Quiero cambiar…                          | Archivo                              |
|------------------------------------------|--------------------------------------|
| WhatsApp, correo, dirección, redes       | `src/data/sitio.js`                  |
| Categorías (nombre y color)              | `src/data/sitio.js`                  |
| Productos del catálogo                   | `src/data/catalogo.json`             |
| Fotos de productos                       | `public/img/productos/`              |
| Textos de cada página                    | `src/pages/*.astro`                  |
| Colores, tipografía, espaciados          | `src/styles/global.css` (`:root`)    |
| Cabecera y pie                           | `src/components/`                    |
| Tarjeta de producto (HTML)               | `src/lib/render.js`                  |

**Agregar un producto:** copia un bloque en `catalogo.json`, cambia `id`, `sku`, `nombre`, etc.,
pon la foto en `public/img/productos/` y escribe su ruta en `imagen`. Las fotos ideales:
cuadradas, 1000×1000 px, formato **WebP** o JPG comprimido (menos de 150 KB).

## 4. Compilar y subir a cPanel

```bash
npm run build    # genera la carpeta dist/
npm run preview  # (opcional) revisa la versión compilada en http://localhost:4321
```

1. **Respaldo primero:** en cPanel → WordPress Manager → *Backup/restaurar*, y descarga el respaldo.
2. Activa el **SSL** del dominio (cPanel → SSL/TLS Status → AutoSSL).
3. Comprime el **contenido** de `dist/` (no la carpeta en sí) en `sitio.zip`.
4. cPanel → *Administrador de archivos* → `public_html`:
   - Mueve los archivos de WordPress a una carpeta `wp-antiguo/` (o elimínalos cuando estés seguro).
   - Sube `sitio.zip` y elige *Extraer*.
   - Activa "Mostrar archivos ocultos" y verifica que exista `.htaccess`.
5. Abre https://gcreativa.com y prueba las cuatro páginas, el filtro del catálogo y los botones de WhatsApp.

Para actualizaciones posteriores repite los pasos 3 y 4 (sin tocar WordPress).

## 5. Conectado al ERP (erp.gcreativa.com) ✅

La web **no tiene productos ni catálogos escritos en el código**. Todo sale del archivo
`/data/catalogo.json`, que escribe el ERP cuando pulsas **Publicar catálogo**.

| Lo que ves en la web | Dónde se gestiona en el ERP |
|---|---|
| **Catálogos**: tarjetas de Inicio, filtros del Catálogo, lista del pie y opciones de Contacto | **Categorías & Ocasiones → Ocasiones**: nombre + emoji. Orden: el de creación |
| Productos de cada catálogo | La **ocasión** de cada producto, en su ficha |
| Producto en varios catálogos | Además de su ocasión, una **categoría con el mismo nombre** que otra ocasión |
| Nombre, precio y foto | La ficha del producto |
| Descripción para clientes (qué incluye; las líneas con • salen como lista) | Ficha del producto o pack → *Descripción para clientes* (con la casilla "Página web"), o `/catalogo-web` |
| "Destacados" (vista inicial del Catálogo), "Los más pedidos" y portada de cada catálogo | La ★ (favorito) en `/catalogo-web` o "Destacado" en la ficha del producto. De cada catálogo sin favorito se muestra su primer producto |

- Solo aparecen los catálogos con al menos un producto publicado.
- Los productos sin ocasión salen al final, en "Más regalos".
- Los enlaces se pueden compartir: `gcreativa.com/catalogo/?catalogo=navidad`.

⚠️ Al subir una versión nueva de la web, **no reemplaces** `data/catalogo.json` ni `img/catalogo/`:
son del ERP. El zip de la web se entrega sin esas carpetas. Si algún día se pierden,
basta con volver a pulsar "Publicar catálogo".

## Estructura

```
public/            archivos que se copian tal cual (imágenes, favicon, .htaccess)
src/data/          datos del sitio y catálogo
src/lib/render.js  HTML de tarjetas y etiquetas (usado al compilar y en el navegador)
src/layouts/       plantilla base (head, cabecera, pie)
src/components/    cabecera, pie, íconos
src/pages/         una página por archivo → una URL
src/scripts/       JavaScript del filtro de catálogo
src/styles/        estilos globales
```

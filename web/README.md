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

- En el ERP abre `https://erp.gcreativa.com/catalogo-web`, activa los productos que quieres mostrar
  (y, si quieres, una descripción para clientes) y pulsa **Publicar catálogo**.
- El ERP escribe `public_html/data/catalogo.json` y copia las fotos a `public_html/img/catalogo/`.
  La portada (destacados ★) y el catálogo lo vuelven a leer en el navegador: **no hay que recompilar**.
- Los filtros de la web son los de `src/data/sitio.js`. Un producto entra en "Graduaciones" si en el ERP
  tiene la categoría **o** la ocasión "Graduaciones" (se compara el slug: "Día del Maestro" → `dia-del-maestro`).
- Productos sin foto muestran `/img/sin-foto.svg`.
- ⚠️ Al subir una versión nueva de la web, **no reemplaces** `public_html/data/catalogo.json` ni
  `public_html/img/catalogo/` (son los que publica el ERP). Si los reemplazas, basta con volver a pulsar
  "Publicar catálogo".
- El formulario de contacto hoy abre WhatsApp; luego podrá enviar a la API del ERP.

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

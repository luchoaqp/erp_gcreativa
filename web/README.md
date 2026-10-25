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

Casi todo lo que se ve en la web se gestiona desde el ERP: **Página web → Gestionar la web**, y luego **Publicar web**. El ERP escribe dos archivos que la web lee al abrirse, así que **no hay que recompilar**:

| Archivo | Qué contiene |
|---|---|
| `data/catalogo.json` | Productos publicados, catálogos (ocasiones) con su emoji, descripciones y favoritos ★ |
| `data/sitio.json` | Portada (general o campaña activa: encabezado, texto, botón y 3 fotos), textos de las secciones y datos de contacto |

En el HTML, los elementos editables llevan `data-t="clave"` (textos) o `data-contacto="..."` (WhatsApp, correo, redes). La portada usa `id="hero-..."`. Si `sitio.json` no existe, la web muestra los textos con los que se compiló.

⚠️ Al subir una versión nueva de la web, **no reemplaces** `data/` ni `img/catalogo/`: son del ERP. Los zips de actualización se entregan sin esas carpetas. Si algún día se pierden, basta con volver a pulsar «Publicar web».

Lo único que sigue en el código: el menú, las páginas «Quiénes somos» y «Contacto» (salvo los datos de contacto), el logo (`public/img/logo-genia-creativa.png`) y las fotos originales de la portada general (`public/img/productos/`).

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

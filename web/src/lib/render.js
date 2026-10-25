// Funciones que generan HTML a partir de los datos del catálogo (ver lib/catalogo.js).
// Se usan en el navegador cada vez que se abre la página, con lo último publicado desde el ERP.
import { sitio } from '../data/sitio.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const precioSoles = (n) => `S/ ${Number(n).toFixed(2)}`;

export function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

const SIN_FOTO = '/img/sin-foto.svg';
const GIROS = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5];

/**
 * Tarjeta de producto.
 * cat = { catalogos, nombres } de normalizar(): las etiquetas muestran primero los catálogos (ocasiones).
 */
export function tarjetaProducto(p, cat = { catalogos: [], nombres: new Map() }) {
  const msg = `Hola Genia Creativa, me interesa "${p.nombre}" (${p.sku}). ¿Me ayudan con mi pedido?`;
  const deCatalogo = new Set(cat.catalogos.map((c) => c.slug));
  const chips = [...(p.categorias || [])]
    .sort((a, b) => Number(deCatalogo.has(b)) - Number(deCatalogo.has(a)))
    .slice(0, 2)
    .map((c) => `<li>${esc(cat.nombres.get(c) ?? c)}</li>`)
    .join('');
  return `
<article class="producto" data-categorias="${esc((p.categorias || []).join(' '))}">
  <div class="producto__foto">
    <img src="${esc(p.imagen || SIN_FOTO)}" onerror="this.onerror=null;this.src='${SIN_FOTO}'" alt="${esc(p.nombre)}" width="800" height="800" loading="lazy" decoding="async">
  </div>
  <div class="producto__cuerpo">
    ${chips ? `<ul class="producto__categorias" aria-label="Catálogos">${chips}</ul>` : ''}
    <h3 class="producto__nombre">${esc(p.nombre)}</h3>
    ${p.descripcion ? `<p class="producto__desc">${esc(p.descripcion)}</p>` : ''}
    <div class="producto__pie">
      <p class="producto__precio"><span>Desde</span> ${precioSoles(p.precio)}</p>
      <a class="boton boton--chico" href="${enlaceWhatsApp(msg)}" target="_blank" rel="noopener">Pedir</a>
    </div>
  </div>
</article>`;
}

export function grillaProductos(lista, cat) {
  return lista.map((p) => tarjetaProducto(p, cat)).join('');
}

/** Etiquetas de catálogo: modo "enlace" (lleva al catálogo filtrado) o "filtro" (botones del Catálogo) */
export function etiquetasCatalogos(catalogos, modo = 'enlace') {
  return catalogos
    .map((c, i) => {
      const estilo = `--tono:${c.tono};--giro:${GIROS[i % GIROS.length]}deg`;
      const texto = `${c.icono ? `<span aria-hidden="true">${esc(c.icono)}</span> ` : ''}<span>${esc(c.nombre)}</span>`;
      if (modo === 'filtro') {
        return `<button type="button" class="etiqueta" style="${estilo}" data-catalogo="${esc(c.slug)}" aria-pressed="false">${texto}</button>`;
      }
      return `<a class="etiqueta" style="${estilo}" href="/catalogo/?catalogo=${encodeURIComponent(c.slug)}">${texto}</a>`;
    })
    .join('');
}

/** Tarjetas grandes de cada catálogo (portada) */
export function tarjetasCatalogos(catalogos) {
  return catalogos
    .map((c) => `
<a class="catalogo-tarjeta" style="--tono:${c.tono}" href="/catalogo/?catalogo=${encodeURIComponent(c.slug)}">
  <span class="catalogo-tarjeta__foto">${c.imagen ? `<img src="${esc(c.imagen)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span class="catalogo-tarjeta__icono" aria-hidden="true">${esc(c.icono || '🎁')}</span></span>
  <span class="catalogo-tarjeta__texto">
    <strong>${esc(c.nombre)}</strong>
    <span>${c.total} ${c.total === 1 ? 'regalo' : 'regalos'}</span>
  </span>
</a>`)
    .join('');
}

/** Catálogo completo separado por ocasión (vista segmentada) */
export function seccionesCatalogo(datos, soloSlug = null) {
  const lista = soloSlug ? datos.catalogos.filter((c) => c.slug === soloSlug) : datos.catalogos;
  const html = lista.map((c) => {
    const suyos = datos.productos.filter((p) => (p.categorias || []).includes(c.slug));
    return `
<section class="segmento" style="--tono:${c.tono}" aria-labelledby="seg-${esc(c.slug)}">
  <h2 class="segmento__titulo" id="seg-${esc(c.slug)}">${c.icono ? `<span aria-hidden="true">${esc(c.icono)}</span> ` : ''}${esc(c.nombre)} <small>${c.total} ${c.total === 1 ? 'regalo' : 'regalos'}</small></h2>
  <div class="grilla">${grillaProductos(suyos, datos)}</div>
</section>`;
  });
  if (!soloSlug) {
    const conCatalogo = new Set(datos.catalogos.map((c) => c.slug));
    const otros = datos.productos.filter((p) => !(p.categorias || []).some((s) => conCatalogo.has(s)));
    if (otros.length) {
      html.push(`
<section class="segmento" aria-labelledby="seg-otros">
  <h2 class="segmento__titulo" id="seg-otros">Más regalos <small>${otros.length}</small></h2>
  <div class="grilla">${grillaProductos(otros, datos)}</div>
</section>`);
    }
  }
  return html.join('');
}

/** Tarjetas "fantasma" mientras carga */
export function esqueleto(n = 4, clase = 'producto') {
  return Array.from({ length: n }, () => `<div class="${clase} esqueleto" aria-hidden="true"></div>`).join('');
}

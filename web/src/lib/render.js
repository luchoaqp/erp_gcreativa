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

// Descripción del ERP ("Incluye:\n• 2 tazas…"): las líneas que empiezan con •, - o "* " se muestran como lista
const VINETA = /^(?:[•·▪●◦\-–—]|\*(?=\s))\s*(.+)$/;
export function descripcionHTML(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return '';
  let html = '';
  let lista = [];
  const cerrar = () => { if (lista.length) { html += `<ul>${lista.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`; lista = []; } };
  for (const l of lineas) {
    const m = VINETA.exec(l);
    if (m) lista.push(m[1]);
    else { cerrar(); html += `<p>${esc(l)}</p>`; }
  }
  cerrar();
  return `<div class="producto__desc">${html}</div>`;
}
const GIROS = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5];

/**
 * Tarjeta de producto: foto (con galería si tiene varias), tag de su ocasión, nombre, lo que incluye y precio.
 * cat = { catalogos, nombres } de normalizar().
 */
export function tarjetaProducto(p, cat = { catalogos: [], nombres: new Map() }) {
  const slug = p.ocasion || (p.categorias || [])[0] || '';
  const oc = cat.catalogos.find((c) => c.slug === slug);
  const ocNombre = oc ? oc.nombre : (cat.nombres.get(slug) ?? '');
  const msg = `Hola Genia Creativa, me interesa "${p.nombre}"${ocNombre ? ` (${ocNombre})` : ''}${p.sku ? ` [${p.sku}]` : ''}. ¿Me ayudan con mi pedido?`;
  const chips = ocNombre ? `<li>${oc?.icono ? `<span aria-hidden="true">${esc(oc.icono)}</span> ` : ''}${esc(ocNombre)}</li>` : '';
  const fotos = (Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [p.imagen]).filter(Boolean);
  const galeria = fotos.length > 1
    ? `<div class="producto__puntos" role="group" aria-label="Fotos de ${esc(p.nombre)}">${fotos.map((f, i) =>
        `<button type="button" data-foto="${esc(f)}" aria-label="Foto ${i + 1} de ${fotos.length}" aria-pressed="${i === 0}"></button>`).join('')}</div>`
    : '';
  return `
<article class="producto" data-categorias="${esc((p.categorias || []).join(' '))}">
  <div class="producto__foto">
    <img src="${esc(fotos[0] || SIN_FOTO)}" onerror="this.onerror=null;this.src='${SIN_FOTO}'" alt="${esc(p.nombre)}" width="800" height="800" loading="lazy" decoding="async">
    ${galeria}
  </div>
  <div class="producto__cuerpo">
    ${chips ? `<ul class="producto__categorias" aria-label="Ocasión">${chips}</ul>` : ''}
    <h3 class="producto__nombre">${esc(p.nombre)}</h3>
    ${descripcionHTML(p.descripcion)}
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

/** Caja al final de los productos: invita a contar una idea propia por WhatsApp (textos editables en el ERP) */
export function cajaIdea(textos = {}, catalogo = null) {
  const t = (k, def) => (typeof textos[k] === 'string' && textos[k].trim() ? textos[k] : def);
  const msg = catalogo
    ? `Hola Genia Creativa, no encontré lo que buscaba en el catálogo de ${catalogo.nombre}. Mi idea es: `
    : 'Hola Genia Creativa, no encontré lo que buscaba en el catálogo. Mi idea es: ';
  return `
<article class="producto producto--idea">
  <span class="producto--idea__icono" aria-hidden="true">💡</span>
  <h3>${esc(t('idea_titulo', '¿No encuentras lo que buscas?'))}</h3>
  <p>${esc(t('idea_texto', 'Cuéntanos tu idea y lo personalizamos para ti.'))}</p>
  <a class="boton" href="${enlaceWhatsApp(msg)}" target="_blank" rel="noopener">${esc(t('idea_boton', 'Cuéntanos tu idea'))}</a>
</article>`;
}

// Galería de la tarjeta: los puntos cambian la foto (un solo manejador para toda la página)
if (typeof document !== 'undefined' && !window.__galeriaProductos) {
  window.__galeriaProductos = true;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.producto__puntos [data-foto]');
    if (!b) return;
    const caja = b.closest('.producto__foto');
    const img = caja.querySelector('img');
    if (img) img.src = b.dataset.foto;
    for (const x of caja.querySelectorAll('[data-foto]')) x.setAttribute('aria-pressed', String(x === b));
  });
}

/** Etiquetas de catálogo: modo "enlace" (lleva al catálogo filtrado) o "filtro" (botones del Catálogo).
 *  extras: etiquetas adicionales al inicio/fin, ej. { slug: 'destacados', nombre: 'Destacados', icono: '⭐' } */
export function etiquetasCatalogos(catalogos, modo = 'enlace', extras = { antes: [], despues: [] }) {
  return [...(extras.antes || []), ...catalogos, ...(extras.despues || [])]
    .map((c, i) => {
      const estilo = `--tono:${c.tono || 'var(--baya)'};--giro:${GIROS[i % GIROS.length]}deg`;
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

/**
 * Selección inicial del Catálogo: los favoritos (★ en el ERP) y, de cada catálogo que no tenga
 * ningún favorito, su primer producto. Así siempre se ve al menos un regalo de cada ocasión.
 */
export function seleccionDestacada(datos) {
  const elegidos = new Map();
  for (const p of datos.productos) if (p.destacado) elegidos.set(p.id, p);
  for (const c of datos.catalogos) {
    const suyos = datos.productos.filter((p) => (p.categorias || []).includes(c.slug));
    if (!suyos.some((p) => p.destacado) && suyos[0]) elegidos.set(suyos[0].id, suyos[0]);
  }
  return [...elegidos.values()];
}

/** Tarjetas "fantasma" mientras carga */
export function esqueleto(n = 4, clase = 'producto') {
  return Array.from({ length: n }, () => `<div class="${clase} esqueleto" aria-hidden="true"></div>`).join('');
}

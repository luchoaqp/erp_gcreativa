// Funciones que generan HTML a partir de los datos.
// Se usan en dos lugares: al compilar (Astro) y en el navegador (cuando el catálogo
// se actualiza desde el ERP). Así la tarjeta de producto se define una sola vez.
import { sitio, categorias } from '../data/sitio.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const precioSoles = (n) => `S/ ${Number(n).toFixed(2)}`;

export function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

// Nombres de categorías/ocasiones que llegan del ERP (catalogo.json → "categorias")
const nombresErp = new Map();
export function registrarCategorias(lista = []) {
  for (const c of lista) if (c && c.slug) nombresErp.set(c.slug, c.nombre);
}

export function nombreCategoria(slug) {
  return categorias.find((c) => c.slug === slug)?.nombre ?? nombresErp.get(slug) ?? slug;
}

const SIN_FOTO = '/img/sin-foto.svg';

export function tarjetaProducto(p) {
  const msg = `Hola Genia Creativa, me interesa "${p.nombre}" (${p.sku}). ¿Me ayudan con mi pedido?`;
  // Primero las categorías de la web (Para ellas, Padrinos…), luego las demás del ERP
  const web = new Set(categorias.map((c) => c.slug));
  const chips = [...(p.categorias || [])]
    .sort((a, b) => Number(web.has(b)) - Number(web.has(a)))
    .slice(0, 2)
    .map((c) => `<li>${esc(nombreCategoria(c))}</li>`)
    .join('');
  return `
<article class="producto" data-categorias="${esc((p.categorias || []).join(' '))}">
  <div class="producto__foto">
    <img src="${esc(p.imagen || SIN_FOTO)}" onerror="this.onerror=null;this.src='${SIN_FOTO}'" alt="${esc(p.nombre)}" width="800" height="800" loading="lazy" decoding="async">
  </div>
  <div class="producto__cuerpo">
    <ul class="producto__categorias" aria-label="Categorías">${chips}</ul>
    <h3 class="producto__nombre">${esc(p.nombre)}</h3>
    ${p.descripcion ? `<p class="producto__desc">${esc(p.descripcion)}</p>` : ''}
    <div class="producto__pie">
      <p class="producto__precio"><span>Desde</span> ${precioSoles(p.precio)}</p>
      <a class="boton boton--chico" href="${enlaceWhatsApp(msg)}" target="_blank" rel="noopener">Pedir</a>
    </div>
  </div>
</article>`;
}

export function grillaProductos(lista) {
  return lista.map(tarjetaProducto).join('');
}

// Etiquetas de categoría. modo "enlace" (Inicio) o "filtro" (Catálogo).
export function etiquetasCategorias(modo = 'enlace') {
  return categorias
    .map((c, i) => {
      const estilo = `--tono:${c.color};--giro:${[-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5][i % 8]}deg`;
      if (modo === 'filtro') {
        return `<button type="button" class="etiqueta" style="${estilo}" data-categoria="${c.slug}" aria-pressed="false"><span>${esc(c.nombre)}</span></button>`;
      }
      return `<a class="etiqueta" style="${estilo}" href="/catalogo/?categoria=${c.slug}"><span>${esc(c.nombre)}</span></a>`;
    })
    .join('');
}

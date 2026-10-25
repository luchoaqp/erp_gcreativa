// Página Catálogo: etiquetas arriba y una sola grilla.
// - Al entrar: "Destacados" = tus favoritos ★ + un regalo de cada catálogo que no tenga favorito.
// - Al tocar una ocasión: todos sus regalos. "Ver todos": el catálogo completo.
// La URL guarda la vista (?catalogo=navidad, ?catalogo=todos) para poder compartir el enlace.
import { cargarCatalogo } from '../lib/catalogo.js';
import { etiquetasCatalogos, grillaProductos, seleccionDestacada } from '../lib/render.js';

const filtros = document.getElementById('catalogo-filtros');
const grilla = document.getElementById('catalogo-grilla');
const titulo = document.getElementById('catalogo-titulo');
const conteo = document.getElementById('catalogo-conteo');
const vacio = document.getElementById('catalogo-vacio');

const DESTACADOS = { slug: 'destacados', nombre: 'Destacados', icono: '⭐', tono: '#8A5A00' };
const TODOS = { slug: 'todos', nombre: 'Ver todos', icono: '', tono: '#3A1C3A' };

let datos = null;
const params = new URLSearchParams(location.search);
let activa = params.get('catalogo') || params.get('categoria') || 'destacados'; // "categoria": enlaces antiguos

const plural = (n) => `${n} ${n === 1 ? 'regalo' : 'regalos'}`;

function pintar() {
  const cat = datos.catalogos.find((c) => c.slug === activa);
  if (!cat && activa !== 'todos') activa = 'destacados';

  let lista;
  if (cat) {
    lista = datos.productos.filter((p) => (p.categorias || []).includes(cat.slug));
    titulo.textContent = `${cat.icono ? cat.icono + ' ' : ''}${cat.nombre}`;
    conteo.textContent = plural(lista.length);
  } else if (activa === 'todos') {
    lista = datos.productos;
    titulo.textContent = 'Todos los regalos';
    conteo.textContent = plural(lista.length);
  } else {
    lista = seleccionDestacada(datos);
    titulo.textContent = '⭐ Destacados';
    conteo.textContent = `Una selección de cada catálogo · ${plural(lista.length)}`;
  }
  grilla.innerHTML = grillaProductos(lista, datos);
  vacio.hidden = lista.length > 0;

  for (const b of filtros.querySelectorAll('[data-catalogo]')) {
    b.setAttribute('aria-pressed', String(b.dataset.catalogo === activa));
  }
  const url = new URL(location.href);
  url.searchParams.delete('categoria');
  activa === 'destacados' ? url.searchParams.delete('catalogo') : url.searchParams.set('catalogo', activa);
  history.replaceState(null, '', url);
}

filtros.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-catalogo]');
  if (!b) return;
  activa = b.dataset.catalogo;
  pintar();
  b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
});

cargarCatalogo()
  .then((d) => {
    datos = d;
    filtros.innerHTML = etiquetasCatalogos(d.catalogos, 'filtro', { antes: [DESTACADOS], despues: [TODOS] });
    pintar();
    filtros.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  })
  .catch(() => {
    grilla.innerHTML = '';
    titulo.textContent = '';
    conteo.textContent = 'No pudimos cargar el catálogo.';
    vacio.hidden = false;
  })
  .finally(() => grilla.removeAttribute('aria-busy'));

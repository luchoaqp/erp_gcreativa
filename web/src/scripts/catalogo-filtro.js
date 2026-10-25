// Página Catálogos: arma los filtros y la vista por ocasión con lo publicado desde el ERP.
// La URL guarda el catálogo elegido (?catalogo=navidad) para poder compartir el enlace.
import { cargarCatalogo } from '../lib/catalogo.js';
import { etiquetasCatalogos, seccionesCatalogo } from '../lib/render.js';

const filtros = document.getElementById('catalogo-filtros');
const contenido = document.getElementById('catalogo-contenido');
const conteo = document.getElementById('catalogo-conteo');
const limpiar = document.getElementById('catalogo-limpiar');
const vacio = document.getElementById('catalogo-vacio');

let datos = null;
const params = new URLSearchParams(location.search);
let activa = params.get('catalogo') || params.get('categoria'); // "categoria": enlaces antiguos

function pintar() {
  if (activa && !datos.catalogos.some((c) => c.slug === activa)) activa = null;
  contenido.innerHTML = seccionesCatalogo(datos, activa);
  for (const b of filtros.querySelectorAll('[data-catalogo]')) {
    b.setAttribute('aria-pressed', String(b.dataset.catalogo === activa));
  }
  const cat = datos.catalogos.find((c) => c.slug === activa);
  const n = cat ? cat.total : datos.productos.length;
  conteo.textContent = cat
    ? `${n} ${n === 1 ? 'regalo' : 'regalos'} en ${cat.nombre}`
    : `${n} ${n === 1 ? 'regalo' : 'regalos'} en ${datos.catalogos.length} ${datos.catalogos.length === 1 ? 'catálogo' : 'catálogos'}`;
  limpiar.hidden = !activa;
  vacio.hidden = n > 0;

  const url = new URL(location.href);
  url.searchParams.delete('categoria');
  activa ? url.searchParams.set('catalogo', activa) : url.searchParams.delete('catalogo');
  history.replaceState(null, '', url);
}

filtros.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-catalogo]');
  if (!b) return;
  activa = activa === b.dataset.catalogo ? null : b.dataset.catalogo;
  pintar();
});
limpiar.addEventListener('click', () => { activa = null; pintar(); });

cargarCatalogo()
  .then((d) => {
    datos = d;
    filtros.innerHTML = etiquetasCatalogos(d.catalogos, 'filtro');
    pintar();
  })
  .catch(() => {
    contenido.innerHTML = '';
    conteo.textContent = 'No pudimos cargar el catálogo.';
    vacio.hidden = false;
  })
  .finally(() => contenido.removeAttribute('aria-busy'));

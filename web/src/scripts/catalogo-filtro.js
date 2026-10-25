// Filtro del catálogo por categoría. Lee y escribe ?categoria=slug en la URL
// para que los enlaces desde Inicio abran el catálogo ya filtrado.

const grilla = document.getElementById('catalogo-grilla');
const etiquetas = [...document.querySelectorAll('.etiqueta[data-categoria]')];
const conteo = document.getElementById('catalogo-conteo');
const limpiar = document.getElementById('catalogo-limpiar');
const vacio = document.getElementById('catalogo-vacio');

let activa = new URLSearchParams(location.search).get('categoria');
if (activa && !etiquetas.some((e) => e.dataset.categoria === activa)) activa = null;

function aplicar() {
  const productos = [...grilla.querySelectorAll('.producto')];
  let visibles = 0;
  for (const p of productos) {
    const coincide = !activa || p.dataset.categorias.split(' ').includes(activa);
    p.hidden = !coincide;
    if (coincide) visibles++;
  }
  for (const e of etiquetas) {
    e.setAttribute('aria-pressed', String(e.dataset.categoria === activa));
  }
  const nombre = etiquetas.find((e) => e.dataset.categoria === activa)?.textContent.trim();
  conteo.textContent = activa
    ? `${visibles} ${visibles === 1 ? 'regalo' : 'regalos'} en ${nombre}`
    : `Mostrando ${visibles} regalos`;
  limpiar.hidden = !activa;
  vacio.hidden = visibles > 0;

  const url = new URL(location.href);
  activa ? url.searchParams.set('categoria', activa) : url.searchParams.delete('categoria');
  history.replaceState(null, '', url);
}

for (const e of etiquetas) {
  e.addEventListener('click', () => {
    activa = activa === e.dataset.categoria ? null : e.dataset.categoria;
    aplicar();
  });
}
limpiar.addEventListener('click', () => {
  activa = null;
  aplicar();
});
document.addEventListener('catalogo:actualizado', aplicar);

aplicar();

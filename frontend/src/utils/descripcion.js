// Descripción para clientes (ej. qué incluye un box). Se escribe en la ficha del producto, línea por línea:
//   Incluye:
//   • 2 tazas 11 Oz. blancas personalizadas      ← líneas que empiezan con •, - o "* " se muestran como lista
//   *Regalo 2 minichocolates                      ← el resto, como texto normal
const BULLET = /^(?:[•·▪●◦\-–—]|\*(?=\s))\s*(.+)$/;

export const lineasDescripcion = (texto) =>
  String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => { const m = BULLET.exec(l); return m ? { item: true, texto: m[1] } : { item: false, texto: l }; });

/** HTML para documentos A4/A5 (lista con viñetas) */
export function descripcionHTML(texto, esc) {
  const lineas = lineasDescripcion(texto);
  if (!lineas.length) return '';
  let html = '';
  let lista = [];
  const cerrar = () => { if (lista.length) { html += `<ul>${lista.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`; lista = []; } };
  for (const l of lineas) {
    if (l.item) lista.push(l.texto);
    else { cerrar(); html += `<div>${esc(l.texto)}</div>`; }
  }
  cerrar();
  return `<div class="det">${html}</div>`;
}

/** Texto para ticket de 80 mm (sin listas HTML) */
export function descripcionTicket(texto, esc) {
  const lineas = lineasDescripcion(texto);
  if (!lineas.length) return '';
  return `<div class="det">${lineas.map((l) => esc((l.item ? '- ' : '') + l.texto)).join('<br>')}</div>`;
}

export const DET_CSS_A4 = '.det{font-size:.86em;color:#555;margin-top:3px;line-height:1.35} .det ul{margin:2px 0 0;padding-left:16px} .det li{margin:0}';
export const DET_CSS_TICKET = '.det{font-size:10.5px;margin:1px 0 2px 6px}';

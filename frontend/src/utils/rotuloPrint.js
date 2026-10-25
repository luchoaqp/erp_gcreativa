// Rótulo de envío (A4 o A5 horizontal). El logo es el de la tienda (Configuración Empresa).
import { esc } from './quotePrint';

const LINE = 'rgba(0,0,0,0.45)'; // líneas negras con transparencia: menos tinta
const SIZES = { a4: { w: 297, h: 210, k: 1 }, a5: { w: 210, h: 148, k: 0.707 } };

// Solo dos pictogramas: frágil (copa) y no apilar (no poner bultos encima)
const ICONS = [
  '<svg viewBox="0 0 40 40" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h18l-2 12a7 7 0 0 1-14 0zM20 24v10M13 34h14"/><path d="M12 11h16"/></svg>',
  '<svg viewBox="0 0 40 40" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="22" width="24" height="14"/><rect x="8" y="5" width="24" height="14"/><path d="M8 5l24 14M32 5L8 19"/></svg>'
];

export function buildRotuloHTML({ envio = {}, store = {}, format = 'a4', toolbar = true }) {
  const z = SIZES[format] || SIZES.a4;
  const k = z.k;
  const mm = (n) => `${(n * k).toFixed(2)}mm`;
  const doc = String(envio.doc || '').trim();
  const docTipo = envio.docTipo === 'RUC' || (!envio.docTipo && doc.length === 11) ? 'RUC' : 'DNI';
  const line = (label, value, extra = '') => `<div class="ln" style="${extra}"><span class="lb">${label}</span><span class="vl">${esc(value || '')}</span></div>`;
  const logo = store.logo_url
    ? `<img src="${esc(store.logo_url)}" alt="" style="max-height:${mm(15)};max-width:${mm(70)};object-fit:contain" onerror="this.outerHTML='<b class=&quot;lgt&quot;>${esc(store.nombre_tienda || 'GENIA CREATIVA').toUpperCase()}</b>'">`
    : `<b class="lgt">${esc(store.nombre_tienda || 'GENIA CREATIVA').toUpperCase()}</b>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Rótulo de envío</title><style>
    @page { size: ${z.w}mm ${z.h}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 400; color: #111; }
    .bar { padding: 8px; text-align: center; background: #fff; border-bottom: 1px solid #ddd; }
    .bar button { padding: 8px 16px; font-weight: 600; cursor: pointer; }
    .page { width: ${z.w}mm; height: ${z.h}mm; background: #fff; padding: ${mm(7)}; margin: 0 auto; }
    .box { width: 100%; height: 100%; border: ${mm(0.5)} solid ${LINE}; background: #fff; display: flex; flex-direction: column; }
    .row { border-bottom: ${mm(0.5)} solid ${LINE}; padding: ${mm(4)} ${mm(6)}; }
    .t { font-size: ${mm(9)}; font-weight: 500; line-height: 1.15; letter-spacing: .03em; text-transform: uppercase; }
    .t b { font-weight: 500; } .t .v { text-transform: none; letter-spacing: 0; margin-left: ${mm(2)}; font-weight: 400; }
    .r1 { display: flex; gap: ${mm(8)}; flex: 0 0 auto; }
    .r1 > div { flex: 1; min-width: 0; word-break: break-word; }
    .r2 { flex: 1; } .r2 .t { margin-bottom: ${mm(2)}; }
    .ln { display: flex; align-items: baseline; gap: ${mm(3)}; font-size: ${mm(11)}; line-height: 1.15; margin: ${mm(3)} ${mm(5)}; }
    .ln .lb { white-space: nowrap; color: #222; font-weight: 600; }
    .ln .vl { flex: 1; border-bottom: ${mm(0.3)} dotted rgba(0,0,0,.45); min-height: ${mm(11)}; font-weight: 700; padding-left: ${mm(2)}; word-break: break-word; }
    .two { display: flex; gap: ${mm(8)}; } .two .ln { flex: 1; margin-right: 0; }
    .r3 { text-align: center; padding: ${mm(4)} ${mm(6)}; border-bottom: 0; }
    .r3 .a { font-size: ${mm(11)}; font-weight: 600; letter-spacing: .04em; } .r3 .b { font-size: ${mm(7.5)}; font-weight: 500; margin-top: ${mm(1.5)}; text-transform: uppercase; }
    .foot { border-top: ${mm(0.5)} solid ${LINE}; padding: ${mm(4)} ${mm(6)}; display: flex; justify-content: space-between; align-items: center; margin-top: auto; background: #fff; }
    .pill { background: #fff; padding: ${mm(1)} 0; display: flex; gap: ${mm(3)}; align-items: center; }
    .pill .ic { width: ${mm(14)}; height: ${mm(16)}; border: ${mm(0.4)} solid ${LINE}; padding: ${mm(1.2)}; }
    .pill .ic svg { width: 100%; height: 100%; }
    .lgt { font-size: ${mm(7)}; font-style: italic; font-weight: 500; letter-spacing: .04em; }
    @media print { .no-print { display: none; } .page { margin: 0; } }
  </style></head><body>
  ${toolbar ? '<div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>' : ''}
  <div class="page"><div class="box">
    <div class="row r1">
      <div class="t">Origen:<span class="v">${esc(envio.origen || 'Arequipa')}</span></div>
      <div class="t">Destino:<span class="v">${esc(envio.destino || '')}</span></div>
    </div>
    <div class="row r2">
      <div class="t">Destinatario:</div>
      ${line('NOMBRE COMPLETO:', envio.nombre)}
      ${line(`${docTipo}:`, doc)}
      ${line('CEL.:', envio.telefono)}
    </div>
    <div class="row r3">
      <div class="a">¡ATENCIÓN!</div>
      <div class="b">Contenido de la caja altamente frágil</div>
      <div class="b">NO TIRAR LA CAJA</div>
    </div>
    <div class="foot">
      <div class="pill">${ICONS.map((i) => `<span class="ic">${i}</span>`).join('')}</div>
      <div class="pill">${logo}</div>
    </div>
  </div></div></body></html>`;
}

import { esc, fmtDate, docInfo } from './quotePrint';
import { entregaLabel, entregaTexto } from './entrega';
import { pdNumber } from './docPrint';
import { qrSvg } from './qr';

export const ETAPAS_PRODUCCION = ['en_produccion', 'listo', 'en_ruta', 'entregado'];
const TIPO = { tienda: 'Recojo en tienda', por_confirmar: 'Por confirmar', envio: 'Envío', delivery: 'Delivery' };
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

// Ticket para el taller (80 mm): datos del pedido, productos SIN precios, notas y QR del diseño (solo en producción)
export function buildTallerHTML({ order, link = '', links = [], store = {}, cfg = {}, toolbar = true }) {
  const info = docInfo(store, cfg);
  const items = order.items || [];
  const enProduccion = ETAPAS_PRODUCCION.includes(order.estado_pedido);
  const lista = (links && links.length ? links : (link ? [{ url: link, comentario: '' }] : [])).filter((x) => /^https?:\/\//i.test(x.url || ''));
  const showQR = lista.length > 0 && enProduccion;
  const entrega = entregaTexto(order);
  const filas = items.map((i) => `
    <div class="it"><strong>${esc(i.cantidad)} x</strong> ${esc(i.producto_nombre || i.descripcion || '')}
    ${i.detalles_personalizacion ? `<div class="det">» ${nl2br(i.detalles_personalizacion)}</div>` : ''}</div>`).join('');
  const bar = toolbar ? '<div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>' : '';
  const num = pdNumber(order.id);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>TALLER-${esc(num)}</title><style>
    @page { size: 80mm auto; margin: 3mm; }
    *{box-sizing:border-box} body{font-family:'Courier New',monospace;font-size:12px;color:#000;width:72mm;margin:0 auto;padding:4px}
    .c{text-align:center} hr{border:0;border-top:1px dashed #000;margin:7px 0} .small{font-size:10.5px}
    .t{font-size:15px;font-weight:700} .it{margin:5px 0} .det{font-size:11px;margin-left:10px}
    .lab{font-weight:700} .qr{text-align:center;margin-top:6px} .bar{text-align:center;margin-bottom:8px}
    @media print{.no-print{display:none}}
  </style></head><body>${bar}
    <div class="c"><strong>${esc(info.nombre)}</strong></div>
    <hr><div class="c t">TICKET DE TALLER</div><div class="c t">${esc(num)}</div>
    <hr>
    <div><span class="lab">Cliente:</span> ${esc(order.cliente_nombre || 'Cliente Varios')}</div>
    <div><span class="lab">Pedido:</span> ${esc(order.numero_pedido || num)}</div>
    <div><span class="lab">Fecha pedido:</span> ${fmtDate(order.fecha_pedido)}</div>
    ${order.fecha_entrega_diseno ? `<div><span class="lab">Entrega de diseño:</span> ${esc(entregaLabel(order.fecha_entrega_diseno, 'tienda'))}</div>` : ''}
    <div><span class="lab">Entrega:</span> ${esc(entrega)}</div>
    <div><span class="lab">Tipo:</span> ${esc(TIPO[order.tipo_entrega] || '')}${order.tipo_entrega === 'envio' && order.ciudad_envio ? ` a ${esc(order.ciudad_envio)}` : ''}</div>
    ${order.mensaje_dedicatoria ? `<div><span class="lab">Dedicatoria:</span> ${nl2br(order.mensaje_dedicatoria)}</div>` : ''}
    ${order.de_parte_de ? `<div><span class="lab">De parte de:</span> ${esc(order.de_parte_de)}</div>` : ''}
    <hr><div class="lab">PRODUCTOS</div>${filas || '<div class="small">Sin productos</div>'}
    <hr><div class="lab">NOTAS PARA EL TALLER</div>
    <div>${order.notas_taller ? nl2br(order.notas_taller) : '<span class="small">Sin notas</span>'}</div>
    ${showQR ? `<hr>${lista.map((x) => `<div class="qr">${qrSvg(x.url, { size: lista.length > 2 ? 120 : 150 })}<div class="small"><strong>${esc(x.comentario || 'Escanea para ver el diseño')}</strong></div></div>`).join('')}` : ''}
  </body></html>`;
}

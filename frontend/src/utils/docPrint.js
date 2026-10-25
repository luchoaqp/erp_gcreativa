// Documentos de venta imprimibles: Pedido (PD-000001) y comprobantes (nota de venta, boleta, factura).
// Formatos: A4, A5 y Ticket 80 mm. Se muestran en un iframe y se imprimen / guardan como PDF.
import { esc, fmtDate, r2, docInfo, atendidoPor, contactoRows, CONTACT_CSS } from './quotePrint';
import { fechaPorConfirmar, horaPorConfirmar } from './entrega';

const num = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

export const pdNumber = (id) => `PD-${String(id).padStart(6, '0')}`;
export const compNumber = (c) => `${c.serie}-${String(c.numero).padStart(6, '0')}`;
export const COMP_TITLES = { nota_venta: 'NOTA DE VENTA', boleta: 'BOLETA DE VENTA', factura: 'FACTURA' };
export const COMP_SHORT = { nota_venta: 'Nota de venta', boleta: 'Boleta', factura: 'Factura' };
export const METODOS = { yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
const CONCEPTOS = { adelanto: 'Adelanto', pago_total: 'Pago total', abono: 'Abono', saldo: 'Pago de saldo' };
const TIPO_ENTREGA = { delivery: 'Delivery', tienda: 'Recojo en tienda', por_confirmar: 'Por confirmar', envio: 'Envío' };

const parseCargos = (raw) => { try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a : []; } catch (e) { return []; } };

// kind: 'pedido' | 'comprobante'
export function buildSaleDocHTML({ kind = 'pedido', sale, comprobante, cfg = {}, store = {}, format = 'a4', toolbar = true }) {
  const sym = store.moneda_simbolo || 'S/';
  const accent = /^#[0-9a-fA-F]{6}$/.test(cfg.color_acento || '') ? cfg.color_acento : '#FF5E36';
  const nameColor = /^#[0-9a-fA-F]{6}$/.test(cfg.doc_color_nombre || '') ? cfg.doc_color_nombre : accent;
  const isTicket = format === 'ticket';
  const isA5 = format === 'a5';
  const pagos = sale.pagos || [];
  const pagado = r2(pagos.reduce((a, p) => a + Number(p.monto), 0));
  const total = Number(sale.total);
  const saldo = r2(Math.max(0, total - pagado));
  const anulada = sale.estado_pedido === 'cancelado';
  const aplicaIgv = !!Number(sale.aplica_igv);
  const showQR = saldo > 0 && !!Number(cfg.mostrar_qr) && !!cfg.qr_imagen && !anulada;

  const isComp = kind === 'comprobante' && comprobante;
  const title = isComp ? COMP_TITLES[comprobante.tipo] : 'PEDIDO';
  const borrador = !!(isComp && comprobante.borrador);
  const number = borrador ? 'VISTA PREVIA' : isComp ? compNumber(comprobante) : pdNumber(sale.id);
  const clienteNombre = isComp && comprobante.razon_social ? comprobante.razon_social : sale.cliente_nombre;
  const docLinea = isComp && comprobante.doc_numero ? `${comprobante.doc_tipo || 'Doc.'}: ${comprobante.doc_numero}` : (sale.cliente_documento ? `Doc.: ${sale.cliente_documento}` : '');
  const boldLabel = (txt, br = false) => { const i = String(txt).indexOf(':'); return i < 0 ? esc(txt) : `<strong>${esc(txt.slice(0, i + 1))}</strong>${br ? '<br>' : ' '}${esc(txt.slice(i + 1).trim())}`; };
  const fechaDoc = isComp ? fmtDate(comprobante.fecha) : fmtDate(sale.fecha_pedido);

  const info = docInfo(store, cfg);
  const atiende = atendidoPor(cfg, sale.vendedor_nombre);
  const verDoc = info.on('cliente_doc'); const verTel = info.on('cliente_tel'); const verCod = info.on('codigo');
  const logo = info.logo
    ? `<img src="${esc(info.logo)}" alt="" onerror="this.style.display='none'" style="max-height:${isTicket ? 44 : 60}px;max-width:140px;object-fit:contain">` : '';
  const barHtml = toolbar ? `<div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>` : '';

  const items = (sale.items || []).map((it) => ({
    desc: it.descripcion + (it.detalles_personalizacion ? ` (${it.detalles_personalizacion})` : '') + (Number(it.descuento) > 0 ? ` [Dto. -${num(it.descuento)}]` : ''),
    codigo: it.codigo, cant: Number(it.cantidad), pu: Number(it.precio_unitario), imp: Number(it.subtotal)
  }));

  const totalsRows = [];
  const dtoGlobal = Number(sale.descuento_global) || 0;
  const dtoLineas = (sale.items || []).reduce((a, it) => a + (Number(it.descuento) || 0), 0);
  const dtoTotal = r2(dtoGlobal + dtoLineas);
  if (dtoTotal > 0.009) {
    totalsRows.push(['Subtotal', num(r2(Number(sale.subtotal) + dtoTotal))]);
    totalsRows.push(['Descuento', '- ' + num(dtoTotal)]);
    if (aplicaIgv) totalsRows.push(['Subtotal con descuento', num(sale.subtotal)]);
  } else if (aplicaIgv) totalsRows.push(['Subtotal', num(sale.subtotal)]);
  const cargosRaw = parseCargos(sale.cargos_json);
  const cargos = cargosRaw.length ? cargosRaw : (Number(sale.costo_envio) > 0 ? [{ nombre: 'Envío', monto: Number(sale.costo_envio) }] : []);
  // El IGV va dentro del total facturable; embalaje y traslado son cargos NO gravados: se listan aparte
  if (aplicaIgv) totalsRows.push([`IGV (${Number(sale.igv_porcentaje || 0)}%)`, num(sale.igv_monto)]);
  const cargosTot = r2(cargos.reduce((a, c) => a + Number(c.monto || 0), 0));
  const facturable = cargosTot > 0 ? r2(total - cargosTot) : total;
  const cargosA4 = cargosTot > 0 ? `
      <div class="chead">Cargos adicionales <span>(no gravados · no incluidos en el total facturable)</span></div>
      ${cargos.map((c) => `<div class="row"><span>${esc(c.nombre)}</span><span>${num(c.monto)}</span></div>`).join('')}
      <div class="row pay"><span>TOTAL A PAGAR ${sym}</span><span>${num(total)}</span></div>` : '';
  const cargosT = cargosTot > 0 ? `<hr><div class="small"><strong>CARGOS ADICIONALES (no gravados)</strong></div>
      ${cargos.map((c) => `<div class="row"><span>${esc(c.nombre)}</span><span>${num(c.monto)}</span></div>`).join('')}
      <div class="row tot"><span>TOTAL A PAGAR</span><span>${num(total)}</span></div>` : '';

  const tipoTxt = TIPO_ENTREGA[sale.tipo_entrega] || '';
  const fPC = fechaPorConfirmar(sale), hPC = horaPorConfirmar(sale);
  const entregaTxt = sale.tipo_entrega === 'por_confirmar'
    ? 'Por confirmar (fecha y horario por definir)'
    : `${tipoTxt}${sale.tipo_entrega === 'envio' && sale.ciudad_envio ? ' a ' + sale.ciudad_envio : ''} · ${fPC ? 'Fecha por confirmar' : fmtDate(sale.fecha_entrega)} · ${hPC ? 'Hora por confirmar' : sale.franja_horaria}`;

  const estadoPago = anulada ? 'ANULADA' : saldo <= 0.009 ? 'CANCELADO' : 'SALDO PENDIENTE';
  const qrBlock = showQR
    ? `<div class="qr"><img src="${cfg.qr_imagen}" alt="QR"><div><strong>${esc(cfg.qr_titulo || 'Paga con Yape')}</strong><br>${nl2br(cfg.qr_detalle || '')}<br><strong>Saldo: ${sym} ${num(saldo)}</strong></div></div>` : '';
  const disclaimer = isComp && comprobante.tipo !== 'nota_venta' ? 'Documento de control interno; no reemplaza el comprobante electrónico emitido ante SUNAT.' : '';
  const estadoNota = anulada ? '<div class="anulada">VENTA ANULADA</div>' : borrador ? '<div class="anulada">VISTA PREVIA · BORRADOR · AÚN NO EMITIDO</div>' : '';

  const head = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(number)}</title><style>`;

  /* ------------------------------- TICKET 80 mm ------------------------------- */
  if (isTicket) {
    const rowsT = items.map((i) => `<div class="it"><div>${esc(i.desc)}</div><div class="row"><span>${i.cant} x ${num(i.pu)}</span><span>${num(i.imp)}</span></div></div>`).join('');
    const pagosT = pagos.map((p) => `<div class="row small"><span>${fmtDate(p.fecha)} ${esc(METODOS[p.metodo] || p.metodo)} · ${esc(CONCEPTOS[p.concepto] || 'Pago')}</span><span>${num(p.monto)}</span></div>`).join('');
    return `${head}
      @page { size: 80mm auto; margin: 3mm; }
      *{box-sizing:border-box} body{font-family:'Courier New',monospace;font-size:11.5px;color:#000;width:72mm;margin:0 auto;padding:4px}
      .c{text-align:center} .row{display:flex;justify-content:space-between;gap:6px} hr{border:0;border-top:1px dashed #000;margin:6px 0}
      .it{margin-bottom:5px} .tot{font-size:14px;font-weight:700} .small{font-size:10.5px} .bar{text-align:center;margin-bottom:8px}
      .qr{text-align:center;margin-top:8px} .qr img{width:42mm;height:42mm;object-fit:contain;filter:grayscale(1) contrast(1000%)} .anulada{text-align:center;font-weight:700;border:1px solid #000;margin:6px 0;padding:2px}
      ${CONTACT_CSS}
      @media print{.no-print{display:none}}
    </style></head><body>${barHtml}
      <div class="c"><div><strong>${esc(info.nombre)}</strong></div>
        <div class="small">${contactoRows(info, { center: true })}</div></div>
      <hr><div class="c"><strong>${title}</strong><br>${esc(number)}</div>${estadoNota}
      <div class="small">Fecha: ${fechaDoc}<br><strong>Cliente:</strong> ${esc(clienteNombre)}${verDoc && docLinea ? `<br>${boldLabel(docLinea)}` : ''}${verTel && sale.cliente_telefono ? `<br><strong>Tel.:</strong> ${esc(sale.cliente_telefono)}` : ''}
      ${!isComp ? `<br>Entrega: ${esc(entregaTxt)}` : ''}
      ${atiende ? `<br><strong>${esc(atiende.label)}:</strong> ${esc(atiende.valor)}` : ''}</div>
      <hr>${rowsT}<hr>
      ${totalsRows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('')}
      <div class="row tot"><span>TOTAL ${sym}</span><span>${num(facturable)}</span></div>
      ${cargosT}
      <hr><div class="small"><strong>HISTORIAL DE PAGOS</strong></div>${pagosT || '<div class="small">Sin pagos registrados</div>'}
      <div class="row small"><span>Pagado</span><span>${num(pagado)}</span></div>
      <div class="row tot"><span>${saldo > 0.009 ? 'SALDO' : ''}</span><span>${saldo > 0.009 ? num(saldo) : estadoPago}</span></div>
      ${qrBlock}
      <hr><div class="c small">${disclaimer ? esc(disclaimer) + '<br>' : ''}${nl2br(cfg.pie_pagina || '')}</div>
    </body></html>`;
  }

  /* ------------------------------- A4 / A5 ------------------------------- */
  const fs = isA5 ? 11 : 13;
  const rows = items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.desc)}${verCod && i.codigo ? ` <span class="mut">(${esc(i.codigo)})</span>` : ''}</td><td class="r">${i.cant}</td><td class="r">${num(i.pu)}</td><td class="r">${num(i.imp)}</td></tr>`).join('');
  const pagosRows = pagos.map((p) => `<tr><td>${fmtDate(p.fecha)}</td><td>${esc(METODOS[p.metodo] || p.metodo)}</td><td>${esc(CONCEPTOS[p.concepto] || 'Pago')}</td><td class="r">${num(p.monto)}</td></tr>`).join('');
  const entrega = !isComp ? `
    <div class="box"><strong>Entrega</strong><br>${esc(entregaTxt)}</div>` : '';

  return `${head}
    @page { size: ${isA5 ? 'A5' : 'A4'}; margin: ${isA5 ? '8mm' : '14mm'}; }
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:${fs}px;margin:0 auto;padding:${isA5 ? 10 : 18}px;max-width:${isA5 ? 560 : 820}px}
    .bar{text-align:center;margin-bottom:12px} .bar button{padding:7px 16px;font-size:14px;cursor:pointer}
    .top{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid ${accent};padding-bottom:12px}
    .brand{display:flex;gap:10px;align-items:center} .brand h1{margin:0;font-size:${isA5 ? 17 : 23}px;color:${nameColor}}
    .mut{color:#777} .r{text-align:right}
    .docbox{border:2px solid #111;border-radius:6px;padding:8px 14px;text-align:center;min-width:${isA5 ? 150 : 190}px} .docbox .t{font-size:${isA5 ? 11 : 13}px;font-weight:700} .docbox .n{font-size:${isA5 ? 15 : 19}px;font-weight:800;margin-top:2px}
    .box{background:#f6f6f8;border-radius:8px;padding:9px 12px;margin:10px 0;line-height:1.65}
    table{width:100%;border-collapse:collapse;margin-top:6px} th{background:${accent};color:#fff;text-align:left;padding:7px 6px;font-size:${fs - 1}px} th.r{text-align:right}
    td{padding:7px 6px;border-bottom:1px solid #eee}
    .tots{width:${isA5 ? 230 : 290}px;margin:10px 0 0 auto} .tots .row{display:flex;justify-content:space-between;padding:3px 0}
    .tots .grand{border-top:2px solid #111;margin-top:5px;padding-top:6px;font-size:${isA5 ? 14 : 17}px;font-weight:700}
    .tots .chead{margin-top:10px;padding-top:8px;border-top:1px dashed #bbb;font-weight:700;font-size:${fs - 1}px} .tots .chead span{font-weight:400;color:#777;font-size:10.5px} .tots .pay{border-top:2px solid #111;margin-top:6px;padding-top:7px;font-weight:800;font-size:${isA5 ? 14 : 16}px}
    h3{margin:16px 0 4px;font-size:${isA5 ? 12 : 14}px;color:${accent}}
    .sum{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap} .sum div{flex:1;min-width:110px;background:#f6f6f8;border-radius:8px;padding:8px 10px}
    .sum b{display:block;font-size:${isA5 ? 14 : 17}px}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:${fs - 1}px;background:${saldo <= 0.009 && !anulada ? '#d1fae5' : '#fef3c7'};color:${saldo <= 0.009 && !anulada ? '#047857' : '#b45309'}}
    .anulada{text-align:center;font-weight:800;color:#b91c1c;border:2px solid #b91c1c;border-radius:6px;padding:4px;margin:8px 0}
    ${CONTACT_CSS}
    .cg{display:flex;flex-wrap:wrap;gap:6px 34px}
    .qr{display:flex;gap:12px;align-items:center;border:1px dashed #bbb;border-radius:10px;padding:10px;margin-top:12px;width:max-content;max-width:100%}
    .qr img{width:${isA5 ? 80 : 110}px;height:${isA5 ? 80 : 110}px;object-fit:contain}
    .foot{margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#666;font-size:${fs - 1}px}
    @media print{.no-print{display:none} body{padding:0}}
  </style></head><body>${barHtml}
    <div class="top">
      <div class="brand">${logo}<div><h1>${esc(info.nombre)}</h1>
        <div class="mut">${contactoRows(info)}</div></div></div>
      <div class="docbox"><div class="t">${title}</div><div class="n">${esc(number)}</div></div>
    </div>
    ${estadoNota}
    <div class="box">
      <div class="cg">
        <div><strong>Cliente:</strong><br>${esc(clienteNombre)}</div>
        ${verDoc && docLinea ? `<div>${boldLabel(docLinea, true)}</div>` : ''}
        ${verTel && sale.cliente_telefono ? `<div><strong>Tel.:</strong><br>${esc(sale.cliente_telefono)}</div>` : ''}
        ${atiende ? `<div><strong>${esc(atiende.label)}:</strong><br>${esc(atiende.valor)}</div>` : ''}
      </div>
      <div style="margin-top:6px">${isComp && comprobante.direccion ? `<strong>Dirección:</strong> ${esc(comprobante.direccion)} · ` : ''}<strong>Fecha de emisión:</strong> ${fechaDoc}${!isComp ? ` · <strong>Pedido:</strong> ${esc(sale.numero_pedido || '')}` : ''}${sale.cotizacion_numero ? ` · <strong>Cotización:</strong> ${esc(sale.cotizacion_numero)}` : ''}</div></div>
    ${entrega}
    <table><thead><tr><th>#</th><th>Descripción</th><th class="r">Cant.</th><th class="r">P. unit.</th><th class="r">Importe</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tots">
      ${totalsRows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('')}
      <div class="row grand"><span>TOTAL ${sym}</span><span>${num(facturable)}</span></div>
      ${cargosA4}
    </div>
    <h3>Historial de pagos</h3>
    <table><thead><tr><th>Fecha</th><th>Método</th><th>Concepto</th><th class="r">Monto</th></tr></thead>
      <tbody>${pagosRows || `<tr><td colspan="4" class="mut">Aún no hay pagos registrados</td></tr>`}</tbody></table>
    <div class="sum"><div>${cargosTot > 0 ? 'Total a pagar' : 'Total'}<b>${sym} ${num(total)}</b></div><div>Pagado<b>${sym} ${num(pagado)}</b></div><div>Saldo pendiente<b>${sym} ${num(saldo)}</b></div><div>Estado<br><span class="badge">${estadoPago}</span></div></div>
    ${qrBlock}
    <div class="foot">${disclaimer ? esc(disclaimer) + '<br>' : ''}${nl2br(cfg.pie_pagina || '')}</div>
  </body></html>`;
}

export function openHtmlWindow(html) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permite las ventanas emergentes del navegador para abrir el documento.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

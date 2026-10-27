import { descripcionHTML, descripcionTicket, DET_CSS_A4, DET_CSS_TICKET } from './descripcion';
// Generación del documento imprimible de una cotización (PDF/A4 y Ticket 80 mm).
// Se abre en una ventana nueva: "Imprimir" -> "Guardar como PDF" o impresora térmica.

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtDate = (s) => {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '');
};

export const money = (n, sym = 'S/') =>
  `${sym} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Modos de presentación:
//  sin        -> precios base SIN IGV, no se suma IGV
//  desglosado -> precios base SIN IGV + Subtotal / IGV / Total
//  incluido   -> IGV sumado pero oculto: los precios se muestran CON IGV incluido
export function getDisplay(q) {
  const pct = Number(q.igv_porcentaje || 0);
  const aplica = !!Number(q.aplicar_igv);
  const muestra = !!Number(q.mostrar_igv);
  const mode = !aplica ? 'sin' : muestra ? 'desglosado' : 'incluido';
  const f = mode === 'incluido' ? 1 + pct / 100 : 1;
  const lines = (q.items || []).map((it) => ({
    ...it,
    pu: r2(Number(it.precio_unitario) * f),
    importe: r2(Number(it.precio_unitario) * Number(it.cantidad) * f)
  }));
  const envio = r2(Number(q.costo_envio || 0)); // los cargos no son afectos a IGV
  let cargos = [];
  try { const a = typeof q.cargos_json === 'string' ? JSON.parse(q.cargos_json) : q.cargos_json; cargos = Array.isArray(a) ? a.map((c) => ({ nombre: c.nombre, monto: r2(Number(c.monto || 0)) })) : []; } catch (e) { cargos = []; }
  const leyenda =
    mode === 'sin' ? 'Precios no incluyen IGV.'
    : mode === 'desglosado' ? 'Precios expresados sin IGV; el IGV se detalla en el total.'
    : 'Precios incluyen IGV.';
  const nota = (cargos.length || envio > 0) ? ' Los cargos adicionales (embalaje/traslado) no son operaciones gravadas ni forman parte del total facturable.' : '';
  return { mode, pct, lines, envio, cargos, subtotal: Number(q.subtotal), igv: Number(q.igv_monto), total: Number(q.total), leyenda: leyenda + nota };
}

const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

// Información de la empresa que se imprime en los documentos (se administra en Configuración > Documentos)
export function docInfo(store = {}, cfg = {}) {
  const on = (k, def = true) => (cfg[`doc_mostrar_${k}`] === undefined || cfg[`doc_mostrar_${k}`] === null ? def : !!Number(cfg[`doc_mostrar_${k}`]));
  const info = {
    on,
    nombre: cfg.doc_razon_social || store.nombre_tienda || '',
    ruc: on('ruc') ? (cfg.doc_ruc || store.ruc || '') : '',
    direccion: on('direccion') ? (cfg.doc_direccion || store.direccion || '') : '',
    telefono: on('telefono') ? (cfg.doc_telefono || store.telefono_whatsapp || '') : '',
    email: on('email', false) ? (cfg.doc_email || store.email_contacto || '') : '',
    web: on('web', false) ? (cfg.doc_web || '') : '',
    logo: on('logo') ? (store.logo_url || '') : ''
  };
  info.contacto = [info.ruc && `RUC ${info.ruc}`, info.direccion, info.telefono && `Tel. ${info.telefono}`, info.email, info.web].filter(Boolean);
  return info;
}

// Iconos de contacto (SVG en línea, sin dependencias)
const ICON_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  phone: `<svg ${ICON_ATTR}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6.3 6.3 0 1 0 5.3 6.2V8.7a7.6 7.6 0 0 0 4.4 1.4V6.8a4.4 4.4 0 0 1-4.4-4.8z"/></svg>`,
  instagram: `<svg ${ICON_ATTR}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  mail: `<svg ${ICON_ATTR}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  web: `<svg ${ICON_ATTR}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`
};
export const CONTACT_CSS = '.ct{display:flex;align-items:center;gap:5px;line-height:1.5} .ct svg{width:12px;height:12px;flex:none}';

// Filas de contacto: cada dato en su propia fila; teléfono y redes con ícono
export function contactoRows(info, { center = false, cls = '' } = {}) {
  const row = (icon, text) => `<div class="ct ${cls}"${center ? ' style="justify-content:center"' : ''}>${icon ? ICONS[icon] : ''}<span>${esc(text)}</span></div>`;
  const out = [];
  const base = [info.ruc && `RUC ${info.ruc}`, info.direccion].filter(Boolean).join(' · ');
  if (base) out.push(row('', base));
  if (info.telefono) out.push(row('phone', info.telefono));
  if (info.email) out.push(row('mail', info.email));
  if (info.web) {
    String(info.web).split(/\s*[|\n]\s*/).filter(Boolean).forEach((w) => {
      if (/tiktok/i.test(w)) out.push(row('tiktok', w.replace(/tiktok\s*:?\s*/i, '').trim()));
      else if (/instagram|^ig\b/i.test(w)) out.push(row('instagram', w.replace(/instagram\s*:?\s*|^ig\s*:?\s*/i, '').trim()));
      else out.push(row('web', w));
    });
  }
  return out.join('');
}

// Adelanto mínimo "real": redondea a 0.50 (0.25 sube a 0.50; 0.75 sube a la unidad siguiente) sin superar el total
export function adelantoMinimo(total, tipo, valor) {
  const t = Number(total) || 0; const v = Number(valor) || 0;
  if (v <= 0 || t <= 0) return { adelanto: 0, saldo: t };
  const crudo = tipo === 'monto' ? v : (t * v) / 100;
  const cents = Math.round(crudo * 100);
  const redondeado = Math.floor((cents + 25) / 50) * 50 / 100;
  const adelanto = Math.min(t, Math.max(0, redondeado));
  return { adelanto, saldo: r2(t - adelanto) };
}

// "Atendido por": nombre del usuario que atendió o un texto fijo; vacío si está oculto
export function atendidoPor(cfg = {}, usuario = '') {
  if (cfg.doc_mostrar_atendido !== undefined && !Number(cfg.doc_mostrar_atendido)) return null;
  const valor = cfg.atendido_modo === 'fijo' ? (cfg.atendido_texto || '') : (usuario || '');
  return valor ? { label: cfg.atendido_etiqueta || 'Atendido por', valor } : null;
}

export function buildQuoteHTML(q, cfg = {}, store = {}, format = 'a4', opts = {}) {
  const d = getDisplay(q);
  const isA5 = format === 'a5';
  const sym = store.moneda_simbolo || 'S/';
  const accent = /^#[0-9a-fA-F]{6}$/.test(cfg.color_acento || '') ? cfg.color_acento : '#FF5E36';
  const nameColor = /^#[0-9a-fA-F]{6}$/.test(cfg.doc_color_nombre || '') ? cfg.doc_color_nombre : accent;
  const titulo = cfg.titulo_documento || 'COTIZACIÓN';
  const verTerminos = Number(q.mostrar_terminos ?? cfg.mostrar_terminos ?? 1) !== 0;
  const nota = verTerminos ? String(q.nota || cfg.nota_defecto || '').trim() : '';
  const adv = adelantoMinimo(d.total, q.adelanto_tipo, q.adelanto_valor);
  const advBlock = adv.adelanto > 0
    ? `<div class="adv"><div class="advt">Pago mínimo para agendar tu pedido</div><div class="advm">${money(adv.adelanto, sym)}</div></div>`
    : '';
  const showQR = !!Number(cfg.mostrar_qr) && !!cfg.qr_imagen;
  const info = docInfo(store, cfg);
  const atiende = atendidoPor(cfg, q.vendedor_nombre);
  const verDoc = info.on('cliente_doc'); const verTel = info.on('cliente_tel'); const verCod = info.on('codigo'); const verVig = info.on('vigencia');
  const logo = info.logo
    ? `<img src="${esc(info.logo)}" alt="" onerror="this.style.display='none'" style="max-height:${format === 'ticket' ? 46 : 64}px;max-width:150px;object-fit:contain">`
    : '';
  const vigencia = fmtDate(q.fecha_vencimiento);
  const qrBlock = showQR
    ? `<div class="qr"><img src="${cfg.qr_imagen}" alt="QR"><div><strong>${esc(cfg.qr_titulo || 'Paga con Yape')}</strong><br>${nl2br(cfg.qr_detalle || '')}</div></div>`
    : '';

  // TOTAL = solo operaciones gravadas (+ IGV). Embalaje/traslado son cargos no gravados: se muestran aparte
  // y se suman únicamente en "TOTAL A PAGAR" (lo que paga el cliente).
  // QR de pago y pago mínimo en un mismo cuadro, en una sola fila
  const payRow = showQR
    ? `<div class="payrow">${qrBlock.replace('class="qr"', 'class="qr in"')}${advBlock}</div>`
    : (advBlock ? `<div class="payrow solo">${advBlock}</div>` : '');
  const totalsRows = [];
  const chargeList = d.cargos.length ? d.cargos : (d.envio > 0 ? [{ nombre: 'Envío', monto: d.envio }] : []);
  const cargosTot = r2(chargeList.reduce((a, c) => a + Number(c.monto || 0), 0));
  const facturable = r2(d.total - cargosTot);
  if (d.mode === 'desglosado') {
    totalsRows.push(['Subtotal', num(d.subtotal)]);
    totalsRows.push([`IGV (${d.pct}%)`, num(d.igv)]);
  }
  const cargosHtmlA4 = cargosTot > 0 ? `
      <div class="chead">Cargos adicionales <span>(no facturables)</span></div>
      ${chargeList.map((c) => `<div class="row"><span>${esc(c.nombre)}</span><span>${num(c.monto)}</span></div>`).join('')}
      <div class="row pay"><span>TOTAL A PAGAR ${sym}</span><span>${num(d.total)}</span></div>` : '';
  const cargosHtmlT = cargosTot > 0 ? `<hr><div class="small"><strong>CARGOS ADICIONALES (no facturables)</strong></div>
      ${chargeList.map((c) => `<div class="row"><span>${esc(c.nombre)}</span><span>${num(c.monto)}</span></div>`).join('')}
      <div class="row tot"><span>TOTAL A PAGAR</span><span>${num(d.total)}</span></div>` : '';
  const totalLabel = `TOTAL ${sym}`;

  const head = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(q.numero)}</title><style>`;
  const toolbar = opts.toolbar === false ? '' : `<div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>`;

  if (format === 'ticket') {
    const items = d.lines.map((l) => `
      <div class="it"><div>${esc(l.descripcion)}</div>${descripcionTicket(l.detalle, esc)}
      <div class="row"><span>${l.cantidad} x ${num(l.pu)}</span><span>${num(l.importe)}</span></div></div>`).join('');
    return `${head}
      @page { size: 80mm auto; margin: 3mm; }
      *{box-sizing:border-box} body{font-family:'Courier New',monospace;font-size:11.5px;color:#000;width:72mm;margin:0 auto;padding:4px}
      .c{text-align:center} .row{display:flex;justify-content:space-between;gap:6px}
      hr{border:0;border-top:1px dashed #000;margin:6px 0} .it{margin-bottom:5px}
      .tot{font-size:14px;font-weight:700} .qr{text-align:center;margin-top:8px} .qr img{width:42mm;height:42mm;object-fit:contain;filter:grayscale(1) contrast(1000%)} .adv{text-align:center;margin:8px 0;padding:6px;border:1px solid #000;border-radius:6px} .advt{font-size:11px} .advm{font-size:20px;font-weight:800;margin-top:2px} .advs{display:flex;justify-content:space-between;font-size:11px;margin-top:4px;border-top:1px dashed #000;padding-top:3px} .tnota{text-align:left;margin-top:6px}
      .small{font-size:10.5px} .bar{text-align:center;margin-bottom:8px}
      ${CONTACT_CSS} ${DET_CSS_TICKET}
      @media print{.no-print{display:none}}
    </style></head><body>${toolbar}${q.borrador ? `<div style="text-align:center;font-weight:700;border:1.5px dashed #B45309;color:#B45309;border-radius:8px;padding:4px;margin:0 0 10px">VISTA PREVIA · AÚN NO GUARDADA</div>` : ''}
      <div class="c"><div><strong>${esc(info.nombre)}</strong></div>
      <div class="small">${contactoRows(info, { center: true })}</div></div>
      <hr><div class="c"><strong>${esc(titulo)}</strong><br>${esc(q.numero)}</div>
      <div class="small">Fecha: ${fmtDate(q.fecha)}${verVig ? `<br>Válida hasta: ${vigencia}` : ''}<br><strong>Cliente:</strong> ${esc(q.cliente_nombre)}${verDoc && q.cliente_documento ? `<br><strong>Doc.:</strong> ${esc(q.cliente_documento)}` : ''}${verTel && q.cliente_telefono ? `<br><strong>Tel.:</strong> ${esc(q.cliente_telefono)}` : ''}${atiende ? `<br><strong>${esc(atiende.label)}:</strong> ${esc(atiende.valor)}` : ''}</div>
      <hr>${items}<hr>
      ${totalsRows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('')}
      <div class="row tot"><span>${totalLabel}</span><span>${num(facturable)}</span></div>
      ${cargosHtmlT}
      ${advBlock}${qrBlock}
      ${nota ? `<hr><div class="small tnota"><strong>Términos y Condiciones</strong><br>${nl2br(nota)}</div>` : ''}
      <hr><div class="c small">${esc(d.leyenda)}<br>${nl2br(cfg.pie_pagina || '')}</div>
    </body></html>`;
  }

  // ---- A4 ----
  const rows = d.lines.map((l, i) => `
    <tr><td>${i + 1}</td><td>${esc(l.descripcion)}${verCod && l.codigo ? ` <span class="mut">(${esc(l.codigo)})</span>` : ''}${descripcionHTML(l.detalle, esc)}</td>
    <td class="r">${l.cantidad}</td><td class="r">${num(l.pu)}</td><td class="r">${num(l.importe)}</td></tr>`).join('');
  return `${head}
    @page { size: ${isA5 ? 'A5' : 'A4'}; margin: ${isA5 ? '8mm' : '14mm'}; }
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:${isA5 ? 11 : 13}px;margin:0;padding:${isA5 ? 10 : 18}px;max-width:${isA5 ? 560 : 820}px;margin:0 auto}
    .bar{text-align:center;margin-bottom:12px} .bar button{padding:7px 16px;font-size:14px;cursor:pointer}
    .top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid ${accent};padding-bottom:14px}
    .brand{display:flex;gap:12px;align-items:center} .brand h1{margin:0;font-size:${isA5 ? 18 : 24}px;color:${nameColor}}
    .mut{color:#777} .r{text-align:right} .doc{text-align:right} .doc h2{margin:0;font-size:${isA5 ? 17 : 22}px} .doc .n{font-weight:700;font-size:15px}
    .client{background:#f6f6f8;border-radius:10px;padding:12px 14px;margin:16px 0;line-height:1.6;display:flex;flex-wrap:wrap;gap:6px 34px}
    ${CONTACT_CSS} ${DET_CSS_A4}
    table{width:100%;border-collapse:collapse} th{background:${accent};color:#fff;text-align:left;padding:9px 8px;font-size:12px}
    th.r{text-align:right} td{padding:9px 8px;border-bottom:1px solid #eee}
    .tots{width:${isA5 ? 230 : 300}px;margin:14px 0 0 auto} .tots .row{display:flex;justify-content:space-between;padding:4px 0}
    .tots .grand{border-top:2px solid #111;margin-top:6px;padding-top:8px;font-size:${isA5 ? 15 : 18}px;font-weight:700}
    .tots .chead{margin-top:12px;padding-top:8px;border-top:1px dashed #bbb;font-weight:700;font-size:12px} .tots .chead span{font-weight:400;color:#777;font-size:10.5px} .tots .pay{border-top:2px solid #111;margin-top:6px;padding-top:7px;font-weight:800;font-size:${isA5 ? 14 : 16}px}
    .qr{display:flex;gap:14px;align-items:center;border:1px dashed #bbb;border-radius:10px;padding:12px;margin-top:18px;width:max-content;max-width:100%}
    .qr img{width:${isA5 ? 90 : 120}px;height:${isA5 ? 90 : 120}px;object-fit:contain}
    .bottom{display:flex;justify-content:flex-start;margin-top:18px}
    .bottom .qr{margin-top:0;flex:none}
    .payrow{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px dashed #bbb;border-radius:12px;padding:12px;margin-top:18px;flex-wrap:wrap} .payrow.solo{border:0;padding:0;justify-content:flex-end} .payrow .qr.in{border:0;padding:0;margin:0;width:auto} .payrow .adv{margin:0;width:${isA5 ? 200 : 260}px;flex:none}
    .adv{width:${isA5 ? 230 : 300}px;margin:12px 0 0 auto;text-align:center;border:2px solid ${accent};border-radius:10px;padding:10px 14px}
    .advt{font-size:12px;color:#444}
    .advm{font-size:${isA5 ? 24 : 30}px;font-weight:800;color:#111;margin:2px 0 2px}
    .advs{display:flex;justify-content:space-between;font-size:${isA5 ? 12 : 13.5}px;border-top:1px dashed #bbb;padding-top:6px}
    .terminos{margin-top:16px;width:100%;padding:10px 14px;background:#fff;color:#444;border:1px solid #ddd;border-radius:8px;line-height:1.35;font-size:${isA5 ? 10.5 : 12}px;-webkit-print-color-adjust:exact;print-color-adjust:exact} .terminos strong{display:block;margin-bottom:3px;font-size:${isA5 ? 10.5 : 12}px;color:#222}
    .foot{margin-top:22px;border-top:1px dashed #ccc;padding-top:10px;color:#666;font-size:${isA5 ? 10.5 : 12}px;line-height:1.35}
    @media print{.no-print{display:none} body{padding:0}}
  </style></head><body>${toolbar}${q.borrador ? `<div style="text-align:center;font-weight:700;border:1.5px dashed #B45309;color:#B45309;border-radius:8px;padding:4px;margin:0 0 10px">VISTA PREVIA · AÚN NO GUARDADA</div>` : ''}
    <div class="top">
      <div class="brand">${logo}<div><h1>${esc(info.nombre)}</h1>
        <div class="mut">${contactoRows(info)}</div></div></div>
      <div class="doc"><h2>${esc(titulo)}</h2><div class="n">${esc(q.numero)}</div>
        <div class="mut">Fecha: ${fmtDate(q.fecha)}</div>${verVig ? `<div class="mut">Válida hasta: <strong>${vigencia}</strong></div>` : ''}</div>
    </div>
    <div class="client">
      <div><strong>Cliente:</strong><br>${esc(q.cliente_nombre)}</div>
      ${verDoc && q.cliente_documento ? `<div><strong>Doc.:</strong><br>${esc(q.cliente_documento)}</div>` : ''}
      ${verTel && q.cliente_telefono ? `<div><strong>Tel.:</strong><br>${esc(q.cliente_telefono)}</div>` : ''}
      ${atiende ? `<div><strong>${esc(atiende.label)}:</strong><br>${esc(atiende.valor)}</div>` : ''}</div>
    <table><thead><tr><th>#</th><th>Descripción</th><th class="r">Cant.</th><th class="r">P. unit.${d.mode === 'incluido' ? ' (c/IGV)' : ' (sin IGV)'}</th><th class="r">Importe</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tots">
      ${totalsRows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('')}
      <div class="row grand"><span>${totalLabel}</span><span>${num(facturable)}</span></div>
      ${cargosHtmlA4}
    </div>
    ${payRow}
    ${nota ? `<div class="terminos"><strong>Términos y Condiciones</strong>${nl2br(nota)}</div>` : ''}
    <div class="foot">${esc(d.leyenda)}${verVig ? ` Válida hasta el ${vigencia}.` : ''}<br>${nl2br(cfg.pie_pagina || '')}</div>
  </body></html>`;
}

export function openQuotePrint(q, cfg, store, format = 'a4') {
  const w = window.open('', '_blank');
  if (!w) { alert('Permite las ventanas emergentes del navegador para imprimir la cotización.'); return; }
  w.document.open();
  w.document.write(buildQuoteHTML(q, cfg, store, format));
  w.document.close();
}

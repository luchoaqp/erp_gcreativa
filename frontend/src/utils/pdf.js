// Descarga directa en PDF de los documentos (cotizaciones, pedidos, comprobantes, taller, rótulos) sin pasar por "Imprimir".
//
// Cómo funciona: el navegador arma el documento igual que al imprimir (mismo ancho de hoja y márgenes) y luego
// cada texto, fondo, borde, línea e imagen se DIBUJA en el PDF en su posición exacta. Así el PDF es vectorial:
// el texto es texto real (nítido a cualquier zoom, se puede seleccionar y buscar) y el archivo pesa poco.
// Solo el logo, el QR y los íconos van como imagen. jsPDF se carga recién al usarlo.

const FORMATOS = {
  a4: { anchoMm: 210, altoMm: 297, margenMm: 14 },
  a5: { anchoMm: 148, altoMm: 210, margenMm: 8 },
  ticket: { anchoMm: 80, altoMm: null, margenMm: 3 } // ticket: una sola tira del largo justo
};
const PX_POR_MM = 96 / 25.4;
const HOJAS = { a3: [297, 420], a4: [210, 297], a5: [148, 210], a6: [105, 148], letter: [215.9, 279.4], legal: [215.9, 355.6] };

// Tamaño de hoja y márgenes tal como los declara el documento en @page (así cada documento sale con su formato:
// A4/A5 vertical, ticket de 80 mm, rótulo horizontal…). Si no lo declara, se usa el formato elegido.
function hojaDe(html, formato) {
  const base = FORMATOS[formato] || FORMATOS.a4;
  const m = /@page\s*\{([^}]*)\}/i.exec(html || '');
  if (!m) return base;
  const mm = (v) => { const x = /^([\d.]+)(mm|cm|in|px|pt)?$/i.exec(v || ''); if (!x) return null; const n = parseFloat(x[1]); const u = (x[2] || 'mm').toLowerCase(); return u === 'cm' ? n * 10 : u === 'in' ? n * 25.4 : u === 'px' ? n / PX_POR_MM : u === 'pt' ? (n / 72) * 25.4 : n; };
  const size = (/size\s*:\s*([^;]+)/i.exec(m[1]) || [])[1];
  const margin = (/margin\s*:\s*([^;]+)/i.exec(m[1]) || [])[1];
  let ancho = base.anchoMm; let alto = base.altoMm;
  if (size) {
    const t = size.trim().toLowerCase().split(/\s+/);
    const hoja = HOJAS[t[0]];
    if (hoja) { [ancho, alto] = hoja; if (t.includes('landscape')) [ancho, alto] = [alto, ancho]; }
    else if (mm(t[0])) { ancho = mm(t[0]); alto = t[1] === 'auto' ? null : (mm(t[1]) || ancho); }
  }
  const mg = margin ? mm(margin.trim().split(/\s+/)[0]) : null;
  return { anchoMm: ancho, altoMm: alto, margenMm: mg ?? base.margenMm };
}
const PT = 0.75; // 1 px (96 ppp) = 0.75 pt

const nombreDe = (html, defecto) => {
  const m = /<title>([^<]*)<\/title>/i.exec(html || '');
  const t = (m ? m[1].replace(/&amp;/g, '&') : defecto || 'documento').trim();
  return t.replace(/[\\/:*?"<>|]+/g, '-') || 'documento';
};

const esperarImagenes = (doc) => Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; setTimeout(ok, 4000); }))));

// "rgb(1, 2, 3)" / "rgba(1, 2, 3, .5)" -> [r, g, b] mezclado con blanco según la transparencia; null si es transparente
function color(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || '');
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (a <= 0.02) return null;
  const mix = (v) => Math.round(v * a + 255 * (1 - a));
  return [mix(r), mix(g), mix(b)];
}

// Las fuentes estándar del PDF (Helvetica = Arial, Courier = Courier New) solo traen el alfabeto latino:
// se cambian los pocos signos que no existen en ellas para que nunca salgan símbolos raros.
const REEMPLAZOS = { '✓': 'v', '✔': 'v', '→': '->', '➔': '->', '➡': '->', '←': '<-', '≤': '<=', '≥': '>=', '−': '-', ' ': ' ', ' ': ' ', ' ': ' ' };
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const limpiar = (s) => [...s].map((ch) => {
  if (REEMPLAZOS[ch] !== undefined) return REEMPLAZOS[ch];
  const c = ch.codePointAt(0);
  return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.has(ch) ? ch : '';
}).join('');

const familia = (ff) => (/courier|mono/i.test(ff) ? 'courier' : /times|georgia|(^|,)\s*serif/i.test(ff) ? 'times' : 'helvetica');
const estiloFuente = (cs) => {
  const bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
  const it = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
  return bold && it ? 'bolditalic' : bold ? 'bold' : it ? 'italic' : 'normal';
};

/** Recorre el documento ya armado por el navegador y devuelve lo que hay que dibujar, con sus posiciones en px */
function recolectar(doc) {
  const win = doc.defaultView;
  const prims = [];
  const atomos = []; // piezas que no conviene partir entre dos hojas (renglones, filas, cuadros pequeños)
  const baseCache = new Map();

  // Distancia desde el borde superior del renglón hasta la línea base del texto, medida en el propio navegador
  const lineaBase = (cs) => {
    const k = `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${cs.fontStyle}`;
    if (baseCache.has(k)) return baseCache.get(k);
    const s = doc.createElement('span');
    s.style.cssText = `font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};line-height:normal;position:absolute;left:-9999px;top:0;white-space:nowrap`;
    s.textContent = 'Hg';
    const marca = doc.createElement('span');
    marca.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline';
    s.appendChild(marca);
    doc.body.appendChild(s);
    const v = marca.getBoundingClientRect().top - s.getBoundingClientRect().top;
    s.remove();
    baseCache.set(k, v);
    return v;
  };

  const textoDe = (nodo, cs) => {
    const data = nodo.data;
    if (!/\S/.test(data)) return;
    const range = doc.createRange();
    const palabras = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(data))) {
      range.setStart(nodo, m.index);
      range.setEnd(nodo, m.index + m[0].length);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      if (rects.length === 1) palabras.push({ t: m[0], r: rects[0] });
      else {
        // palabra partida en dos renglones (muy larga): se reparte por letras
        let i = m.index;
        for (const r of rects) {
          let j = i + 1;
          while (j < m.index + m[0].length) {
            range.setStart(nodo, i); range.setEnd(nodo, j + 1);
            const rr = range.getClientRects();
            if (rr.length > 1) break;
            j++;
          }
          palabras.push({ t: data.slice(i, j), r });
          i = j;
        }
      }
    }
    if (!palabras.length) return;
    const upper = cs.textTransform === 'uppercase';
    const lower = cs.textTransform === 'lowercase';
    const base = lineaBase(cs);
    const fs = parseFloat(cs.fontSize) || 12;
    const ls = parseFloat(cs.letterSpacing) || 0;
    // Alineación del renglón: el texto del PDF se ancla por ese lado (centro, derecha o izquierda), así un
    // pequeño cambio de ancho entre la fuente de la pantalla y la del PDF nunca separa ni aprieta las letras
    const alin = (() => {
      const ta = cs.textAlign;
      if (ta === 'center') return 'c';
      if (ta === 'right' || ta === 'end') return 'r';
      if (ta === 'justify') return 'j';
      const el = nodo.parentElement; const padre = el && el.parentElement;
      if (padre && padre.children.length > 1 && el === padre.lastElementChild) {
        const pcs = win.getComputedStyle(padre);
        if (/flex/.test(pcs.display) && !/column/.test(pcs.flexDirection) && /space-between|flex-end|end/.test(pcs.justifyContent)) return 'r'; // montos a la derecha de una fila
      }
      return 'l';
    })();
    let linea = null;
    const cerrar = () => {
      if (!linea) return;
      let t = linea.palabras.join(' ');
      if (upper) t = t.toUpperCase(); else if (lower) t = t.toLowerCase();
      prims.push({ tipo: 'texto', t: limpiar(t), x: linea.x, top: linea.top, bottom: linea.bottom, ancho: linea.right - linea.x, base: linea.top + base, fs, fam: familia(cs.fontFamily), est: estiloFuente(cs), col: color(cs.color) || [0, 0, 0], ls, alin });
      atomos.push({ top: linea.top, bottom: linea.bottom });
      linea = null;
    };
    for (const p of palabras) {
      if (linea && Math.abs(p.r.top - linea.top) < Math.max(2, fs * 0.3)) {
        linea.palabras.push(p.t); linea.right = p.r.right; linea.bottom = Math.max(linea.bottom, p.r.bottom);
      } else {
        cerrar();
        linea = { palabras: [p.t], x: p.r.left, top: p.r.top, bottom: p.r.bottom, right: p.r.right };
      }
    }
    cerrar();
  };

  const recorrer = (el) => {
    const cs = win.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'title') return;
    const r = el.getBoundingClientRect();

    // Fondo y bordes
    const bg = color(cs.backgroundColor);
    const lados = ['Top', 'Right', 'Bottom', 'Left'].map((s) => {
      const w = parseFloat(cs[`border${s}Width`]) || 0;
      const st = cs[`border${s}Style`];
      return { w: st === 'none' || st === 'hidden' ? 0 : w, st, col: color(cs[`border${s}Color`]) };
    });
    const hayBorde = lados.some((l) => l.w > 0 && l.col);
    if ((bg || hayBorde) && r.width > 0 && r.height > 0) {
      const radio = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
      prims.push({ tipo: 'caja', x: r.left, top: r.top, w: r.width, h: r.height, bottom: r.bottom, bg, lados, radio });
    }
    if (tag === 'tr' || ((bg || hayBorde) && r.height > 0 && tag !== 'body' && tag !== 'html')) atomos.push({ top: r.top, bottom: r.bottom, caja: tag !== 'tr' });

    // Viñeta de las listas
    if (cs.display === 'list-item' && /disc|circle|square/.test(cs.listStyleType)) {
      const fs = parseFloat(cs.fontSize) || 12;
      prims.push({ tipo: 'vineta', x: r.left - fs * 0.62, top: r.top, bottom: r.top + fs, cy: r.top + lineaBase(cs) - fs * 0.3, rad: fs * 0.16, col: color(cs.color) || [0, 0, 0] });
    }

    if (tag === 'img') {
      if (el.naturalWidth > 0 && r.width > 0) {
        prims.push({ tipo: 'img', el, x: r.left, top: r.top, w: r.width, h: r.height, bottom: r.bottom, fit: cs.objectFit, filtro: cs.filter && cs.filter !== 'none' ? cs.filter : '' });
        atomos.push({ top: r.top, bottom: r.bottom });
      }
      return;
    }
    if (tag === 'svg') {
      if (r.width > 0) { prims.push({ tipo: 'svg', el, col: cs.color, x: r.left, top: r.top, w: r.width, h: r.height, bottom: r.bottom }); atomos.push({ top: r.top, bottom: r.bottom }); }
      return;
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3) textoDe(n, cs);
      else if (n.nodeType === 1) recorrer(n);
    }
  };
  recorrer(doc.body);
  return { prims, atomos };
}

// Dónde empieza cada hoja (en px), sin partir renglones, filas de tabla ni cuadros pequeños
function cortes(atomos, altoTotal, altoHoja) {
  if (!altoHoja) return [0];
  const inicios = [0];
  let ini = 0;
  const lista = atomos.filter((a) => !a.caja || a.bottom - a.top < altoHoja * 0.35).sort((a, b) => a.top - b.top);
  for (const a of lista) {
    if (a.bottom > ini + altoHoja && a.top > ini + 1) {
      ini = a.top - 4;
      inicios.push(ini);
    }
    while (a.bottom > ini + altoHoja && a.top <= ini + 1 && a.bottom - ini > altoHoja) { // pieza más alta que una hoja
      ini += altoHoja;
      inicios.push(ini);
    }
  }
  while (altoTotal > ini + altoHoja + 2) { ini += altoHoja; inicios.push(ini); }
  return inicios;
}

// Imagen (o ícono SVG) a PNG del tamaño justo para que se vea nítida
async function aPNG(p, cache) {
  const clave = p.tipo === 'img' ? `${p.el.currentSrc || p.el.src}|${p.filtro}` : null;
  if (clave && cache.has(clave)) return cache.get(clave);
  let fuente = p.el;
  let nw; let nh;
  if (p.tipo === 'svg') {
    const clon = p.el.cloneNode(true);
    clon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clon.setAttribute('width', p.w); clon.setAttribute('height', p.h);
    clon.setAttribute('color', p.col);
    clon.style.color = p.col;
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clon).replace(/currentColor/g, p.col)); });
    fuente = img; nw = p.w * 6; nh = p.h * 6;
  } else {
    nw = p.el.naturalWidth; nh = p.el.naturalHeight;
    const max = Math.max(p.w, p.h) * 4; // 4x lo que ocupa en la hoja (≈ 380 ppp): de sobra para imprimir
    const k = Math.min(1, max / Math.max(nw, nh));
    nw = Math.round(nw * k); nh = Math.round(nh * k);
  }
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(nw)); cv.height = Math.max(1, Math.round(nh));
  const ctx = cv.getContext('2d');
  if (p.filtro) ctx.filter = p.filtro;
  try { ctx.drawImage(fuente, 0, 0, cv.width, cv.height); } catch (e) { return null; }
  let url;
  try { url = cv.toDataURL('image/png'); } catch (e) { return null; } // imagen de otro sitio sin permiso: se omite
  const res = { url, nw: cv.width, nh: cv.height, alias: clave ? `img${cache.size}` : undefined };
  if (clave) cache.set(clave, res);
  return res;
}

/**
 * html: documento completo; formato: 'a4' | 'a5' | 'ticket'
 */
export async function descargarPDF(html, formato = 'a4', nombre) {
  const f = hojaDe(html, formato);
  const { jsPDF } = await import('jspdf');

  const anchoPx = Math.round((f.anchoMm - 2 * f.margenMm) * PX_POR_MM); // A4 ≈ 688 px: el mismo ancho que al imprimir
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', left: '-10000px', top: '0', width: `${anchoPx}px`, height: '50px', border: '0', visibility: 'hidden' });
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    doc.open(); doc.write(html); doc.close();
    const st = doc.createElement('style');
    // Igual que al imprimir: sin barra de botones y sin el relleno de pantalla (salvo el ticket, que lo conserva)
    // (las reglas @media print del documento se aplican aquí también, como al imprimir)
    const reglasPrint = [...(html || '').matchAll(/@media\s+print\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/gi)].map((x) => x[1]).join(' ');
    st.textContent = `.no-print,.bar{display:none!important} html,body{background:#fff!important} html{margin:0} ${reglasPrint}`;
    doc.head.appendChild(st);
    await new Promise((ok) => setTimeout(ok, 50));
    await esperarImagenes(doc);
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready.catch(() => {});

    const altoTotal = Math.ceil(doc.body.getBoundingClientRect().bottom);
    iframe.style.height = `${altoTotal + 20}px`;
    const { prims, atomos } = recolectar(doc);

    const m = f.margenMm * PX_POR_MM; // márgenes en px
    const altoHoja = f.altoMm ? f.altoMm * PX_POR_MM - 2 * m : null;
    const anchoHojaPt = f.anchoMm * PX_POR_MM * PT;
    const altoHojaPt = f.altoMm ? f.altoMm * PX_POR_MM * PT : (altoTotal + 2 * m) * PT;
    const inicios = cortes(atomos, altoTotal, altoHoja);

    const orientacion = anchoHojaPt > altoHojaPt ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation: orientacion, unit: 'pt', format: [anchoHojaPt, altoHojaPt], compress: true });
    pdf.setProperties({ title: nombre || nombreDe(html), creator: 'ERP Genia Creativa' });
    const imgs = new Map();
    for (const p of prims) if (p.tipo === 'img' || p.tipo === 'svg') p.png = await aPNG(p, imgs);

    inicios.forEach((ini, n) => {
      if (n > 0) pdf.addPage([anchoHojaPt, altoHojaPt], orientacion);
      const fin = altoHoja ? (inicios[n + 1] ?? ini + altoHoja) : Infinity; // la hoja termina donde empieza la siguiente
      const X = (x) => (m + x) * PT;
      const Y = (y) => (m + y - ini) * PT;
      pdf.saveGraphicsState();
      if (altoHoja) { pdf.rect(0, m * PT, anchoHojaPt, (fin - ini) * PT, null); pdf.clip(); pdf.discardPath(); }
      for (const p of prims) {
        if (p.tipo === 'texto') {
          if (p.top < ini - 1 || p.top >= fin - 1) continue; // cada renglón va entero en una sola hoja
        } else if (p.bottom <= ini || p.top >= fin) continue;

        if (p.tipo === 'caja') {
          const x = X(p.x); const y = Y(p.top); const w = p.w * PT; const h = p.h * PT; const r = p.radio * PT;
          if (p.bg) {
            pdf.setFillColor(...p.bg);
            if (r > 0.3) pdf.roundedRect(x, y, w, h, r, r, 'F'); else pdf.rect(x, y, w, h, 'F');
          }
          const [t, d, b, i] = p.lados;
          const igual = p.lados.every((l) => l.w === t.w && l.st === t.st && l.col && t.col && l.col.join() === t.col.join());
          const trazo = (l) => {
            pdf.setDrawColor(...l.col);
            pdf.setLineWidth(l.w * PT);
            if (l.st === 'dashed') pdf.setLineDashPattern([l.w * 3 * PT, l.w * 2.2 * PT], 0);
            else if (l.st === 'dotted') pdf.setLineDashPattern([l.w * PT, l.w * 1.6 * PT], 0);
            else pdf.setLineDashPattern([], 0);
          };
          if (igual && t.w > 0) {
            trazo(t);
            const o = (t.w * PT) / 2;
            if (r > 0.3) pdf.roundedRect(x + o, y + o, w - 2 * o, h - 2 * o, Math.max(0, r - o), Math.max(0, r - o), 'S');
            else pdf.rect(x + o, y + o, w - 2 * o, h - 2 * o, 'S');
          } else {
            if (t.w > 0 && t.col) { trazo(t); pdf.line(x, y + (t.w * PT) / 2, x + w, y + (t.w * PT) / 2); }
            if (b.w > 0 && b.col) { trazo(b); pdf.line(x, y + h - (b.w * PT) / 2, x + w, y + h - (b.w * PT) / 2); }
            if (i.w > 0 && i.col) { trazo(i); pdf.line(x + (i.w * PT) / 2, y, x + (i.w * PT) / 2, y + h); }
            if (d.w > 0 && d.col) { trazo(d); pdf.line(x + w - (d.w * PT) / 2, y, x + w - (d.w * PT) / 2, y + h); }
          }
          pdf.setLineDashPattern([], 0);
        } else if (p.tipo === 'texto') {
          if (!p.t) continue;
          pdf.setFont(p.fam, p.est);
          pdf.setFontSize(p.fs * PT);
          pdf.setTextColor(...p.col);
          const letras = Math.max(1, p.t.length - 1);
          let cs = p.ls * PT; // espaciado entre letras propio del documento (letter-spacing)
          const objetivo = p.ancho * PT;
          let medido = pdf.getTextWidth(p.t) + cs * letras;
          // Solo el texto justificado se ajusta, y muy poco, para mantener el borde derecho parejo
          if (p.alin === 'j' && p.t.length > 1) {
            const extra = (objetivo - medido) / letras;
            if (Math.abs(extra) < p.fs * PT * 0.03) { cs += extra; medido = objetivo; }
          }
          let x = X(p.x);
          if (p.alin === 'c') x += (objetivo - medido) / 2;
          else if (p.alin === 'r') x += objetivo - medido;
          pdf.text(p.t, x, Y(p.base), { baseline: 'alphabetic', charSpace: cs || 0 });
        } else if (p.tipo === 'vineta') {
          pdf.setFillColor(...p.col);
          pdf.circle(X(p.x + p.rad), Y(p.cy), p.rad * PT, 'F');
        } else if ((p.tipo === 'img' || p.tipo === 'svg') && p.png) {
          let { x, top: y, w, h } = p;
          if (p.tipo === 'img' && (p.fit === 'contain' || p.fit === 'scale-down')) {
            const k = Math.min(w / p.png.nw, h / p.png.nh);
            const ww = p.png.nw * k; const hh = p.png.nh * k;
            x += (w - ww) / 2; y += (h - hh) / 2; w = ww; h = hh;
          }
          pdf.addImage(p.png.url, 'PNG', X(x), Y(y), w * PT, h * PT, p.png.alias, 'SLOW');
        }
      }
      pdf.restoreGraphicsState();
    });
    pdf.save(`${nombre || nombreDe(html)}.pdf`);
  } finally {
    iframe.remove();
  }
}

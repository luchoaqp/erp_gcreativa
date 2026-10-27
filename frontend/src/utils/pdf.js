// Descarga directa en PDF de los documentos (cotizaciones, pedidos, comprobantes) sin pasar por "Imprimir".
// Se dibuja el mismo HTML del documento y se guarda como PDF. Las librerías se cargan solo al usarlas.

const FORMATOS = {
  a4: { anchoPx: 794, anchoMm: 210, altoMm: 297, margenMm: 8 },
  a5: { anchoPx: 560, anchoMm: 148, altoMm: 210, margenMm: 6 },
  ticket: { anchoPx: 302, anchoMm: 80, altoMm: null, margenMm: 2 } // ticket: una sola tira del largo necesario
};

// Busca, subiendo desde "y", una fila completamente blanca para no cortar un renglón entre dos hojas
function corteLimpio(ctx, ancho, y, rango) {
  const desde = Math.max(1, y - rango);
  const datos = ctx.getImageData(0, desde, ancho, y - desde).data;
  for (let fila = y - desde - 1; fila >= 0; fila--) {
    let blanca = true;
    // Se ignoran los bordes laterales (marcos de cuadros como "Términos y Condiciones")
    for (let x = Math.floor(ancho * 0.05); x < ancho * 0.95; x += 3) {
      const i = (fila * ancho + x) * 4;
      if (datos[i] < 245 || datos[i + 1] < 245 || datos[i + 2] < 245) { blanca = false; break; }
    }
    if (blanca) return desde + fila;
  }
  return y;
}

const nombreDe = (html, defecto) => {
  const m = /<title>([^<]*)<\/title>/i.exec(html || '');
  const t = (m ? m[1].replace(/&amp;/g, '&') : defecto || 'documento').trim();
  return t.replace(/[\\/:*?"<>|]+/g, '-') || 'documento';
};

const esperarImagenes = (doc) => Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; setTimeout(ok, 4000); }))));

/**
 * html: documento completo (sin barra de "Imprimir"); formato: 'a4' | 'a5' | 'ticket'
 */
export async function descargarPDF(html, formato = 'a4', nombre) {
  const f = FORMATOS[formato] || FORMATOS.a4;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', left: '-10000px', top: '0', width: `${f.anchoPx}px`, height: '1200px', border: '0', visibility: 'hidden' });
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    doc.open(); doc.write(html); doc.close();
    // Sin márgenes de impresora: el PDF ya define la hoja
    const st = doc.createElement('style');
    st.textContent = '.no-print,.bar{display:none!important} html,body{background:#fff!important}';
    doc.head.appendChild(st);
    await new Promise((ok) => setTimeout(ok, 60));
    await esperarImagenes(doc);
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready.catch(() => {});
    const alto = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    iframe.style.height = `${alto}px`;

    const canvas = await html2canvas(doc.documentElement, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: f.anchoPx, width: f.anchoPx, height: alto, logging: false
    });
    const m = f.margenMm;
    const anchoUtil = f.anchoMm - 2 * m;
    const mmPorPx = anchoUtil / canvas.width;
    const altoTotalMm = canvas.height * mmPorPx;
    const altoHoja = f.altoMm || altoTotalMm + 2 * m;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [f.anchoMm, altoHoja], compress: true });

    // Se reparte en hojas del alto del formato (A4/A5), cortando en una franja blanca; el ticket va en una sola tira
    const altoUtilPx = Math.floor((altoHoja - 2 * m) / mmPorPx);
    const ctxTodo = canvas.getContext('2d');
    let y = 0;
    let primera = true;
    while (y < canvas.height - 2) {
      let fin = Math.min(y + altoUtilPx, canvas.height);
      if (fin < canvas.height) fin = corteLimpio(ctxTodo, canvas.width, fin, Math.floor(altoUtilPx * 0.25));
      if (fin <= y) fin = Math.min(y + altoUtilPx, canvas.height);
      const h = fin - y;
      const trozo = document.createElement('canvas');
      trozo.width = canvas.width; trozo.height = h;
      const ctx = trozo.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, trozo.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!primera) pdf.addPage([f.anchoMm, altoHoja], 'portrait');
      pdf.addImage(trozo.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, anchoUtil, h * mmPorPx);
      primera = false;
      y = fin;
    }
    pdf.save(`${nombre || nombreDe(html)}.pdf`);
  } finally {
    iframe.remove();
  }
}

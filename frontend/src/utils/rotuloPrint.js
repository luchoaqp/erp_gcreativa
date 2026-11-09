// Rótulo de envío según la plantilla de Genia Creativa (shalom_horizontal): hoja horizontal con una tabla
// ORIGEN / DESTINO / DESTINATARIO (nombre, DNI/RUC, teléfono) y el aviso de contenido frágil con dos íconos
// y el logo de marca de agua. Medidas tomadas de la plantilla Word (A4 horizontal); en A5 se reduce todo a escala.
// Fuente: Saira Condensed (libre, licencia OFL), muy parecida a la Agency FB de la plantilla; se incrusta en el PDF.
import { esc } from './quotePrint';

const SIZES = { a4: { w: 297, h: 210, k: 1 }, a5: { w: 210, h: 148, k: 0.707 } };
// Columnas y filas de la plantilla (mm)
const COLS = [55.4, 62.6, 46.7, 92.9];
// Filas de la plantilla con 30 % más de alto; la última crece lo necesario para el aviso, el logo y los íconos
const ROWS = [13.3, 14.1, 13.3, 13.3, 14.1, 40.0].map((h) => +(h * 1.3).toFixed(1));
const ICONO = 54; // íconos de frágil: 50 % más grandes que antes (36 mm)
const ANCHO = COLS.reduce((a, b) => a + b, 0); // 257.6 mm

const origen = () => (typeof window !== 'undefined' ? window.location.origin : '');

export function buildRotuloHTML({ envio = {}, store = {}, format = 'a4', toolbar = true }) {
  const z = SIZES[format] || SIZES.a4;
  const k = z.k;
  const mm = (n) => `${(n * k).toFixed(2)}mm`;
  const base = origen();
  const up = (v) => esc(String(v || '').trim().toUpperCase());
  const doc = String(envio.doc || '').trim();
  // Logo de la tienda (Configuración › Empresa); si no hay, el de la plantilla
  const logo = store.logo_url || `${base}/img/rotulo/logo-genia.png`;
  const fuente = `@font-face{font-family:'Saira Condensed';font-weight:400;src:url('${base}/fonts/SairaCondensed-Regular.ttf') format('truetype')}
    @font-face{font-family:'Saira Condensed';font-weight:700;src:url('${base}/fonts/SairaCondensed-Bold.ttf') format('truetype')}`;
  // Textos largos (agencias, nombres completos): se reduce la letra para que quepan en su casilla sin deformar la tabla
  const ajuste = (txt, base, caben) => { const n = String(txt || '').trim().length; return n > caben ? `font-size:${mm(Math.max(base * 0.5, base * caben / n))}` : ''; };
  const fila = (h, html, extra = '') => `<tr style="height:${mm(h)}${extra}">${html}</tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Rótulo de envío${envio.nombre ? ` - ${esc(envio.nombre)}` : ''}</title><style>
    ${fuente}
    @page { size: ${z.w}mm ${z.h}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body { font-family: 'Saira Condensed', 'Arial Narrow', Arial, sans-serif; color: #000; }
    .bar { padding: 8px; text-align: center; background: #fff; border-bottom: 1px solid #ddd; font-family: Arial, sans-serif; }
    .bar button { padding: 8px 16px; font-weight: 600; cursor: pointer; }
    .page { width: ${z.w}mm; height: ${z.h}mm; padding-top: ${mm(21)}; margin: 0 auto; background: #fff; }
    table { width: ${mm(ANCHO)}; margin: 0 auto; border-collapse: collapse; table-layout: fixed; }
    td { border: ${mm(0.35)} solid #000; text-align: center; vertical-align: middle; font-size: ${mm(9.88)}; line-height: 1.05; padding: 0 ${mm(1.9)}; overflow: hidden; word-break: break-word; }
    td.v { font-weight: 700; }
    td.v30 { font-weight: 700; font-size: ${mm(10.58)}; }
    tr.gris td { background: #E7E6E6; }
    td.aviso { position: relative; padding: ${mm(4)} 0; }
    td.aviso .ic { position: absolute; top: 50%; transform: translateY(-50%); height: ${mm(ICONO)}; width: ${mm(ICONO)}; object-fit: contain; }
    td.aviso .ic.i { left: ${mm(4)}; } td.aviso .ic.d { right: ${mm(4)}; }
    td.aviso .centro { min-height: ${mm(ICONO)}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${mm(3)}; }
    td.aviso .txt { font-weight: 700; line-height: 1.12; }
    td.aviso .logo { width: ${mm(71.5)}; height: ${mm(27.6)}; object-fit: contain; }
    @media print { .no-print { display: none; } .page { margin: 0; } }
  </style></head><body>
  ${toolbar ? '<div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>' : ''}
  <div class="page"><table>
    <colgroup>${COLS.map((c) => `<col style="width:${mm(c)}">`).join('')}</colgroup>
    ${fila(ROWS[0], `<td>ORIGEN:</td><td class="v" style="${ajuste(envio.origen || 'Arequipa', 9.88, 13)}">${up(envio.origen || 'Arequipa')}</td><td>DESTINO:</td><td class="v30" style="${ajuste(envio.destino, 10.58, 17)}">${up(envio.destino)}</td>`)}
    ${fila(ROWS[1], '<td colspan="4" class="v">DESTINATARIO</td>').replace('<tr ', '<tr class="gris" ')}
    ${fila(ROWS[2], `<td>NOMBRE:</td><td colspan="3" class="v" style="${ajuste(envio.nombre, 9.88, 40)}">${up(envio.nombre)}</td>`)}
    ${fila(ROWS[3], `<td>DNI/RUC:</td><td colspan="3" class="v">${esc(doc)}</td>`)}
    ${fila(ROWS[4], `<td>TELÉFONO:</td><td colspan="3" class="v">${esc(String(envio.telefono || '').trim())}</td>`)}
    ${fila(ROWS[5], `<td colspan="4" class="aviso">
      <img class="ic i" src="${base}/img/rotulo/fragil-1.jpg" alt="Frágil">
      <img class="ic d" src="${base}/img/rotulo/fragil-2.jpg" alt="Frágil">
      <div class="centro">
        <div class="txt">¡ATENCIÓN!<br>CONTENIDO ALTAMENTE FRÁGIL<br>NO TIRAR LA CAJA</div>
        <img class="logo" src="${esc(logo)}" alt="">
      </div>
    </td>`)}
  </table></div></body></html>`;
}

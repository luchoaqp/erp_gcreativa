// Exportación sin dependencias: Excel (.xlsx real) y PDF (ventana de impresión -> Guardar como PDF).
import { esc } from './quotePrint';
import { openHtmlWindow } from './docPrint';

/* ---------------- XLSX mínimo ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zipStore(files) { // files: [{ name, data(string) }]
  const enc = new TextEncoder();
  const parts = []; const central = []; let offset = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name); const data = enc.encode(f.data); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

// rows: array de arrays (la primera fila es el encabezado). Los números se guardan como números.
export function makeXlsx(sheetName, rows, widths = []) {
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    const ref = `${colName(c)}${r + 1}`;
    const st = r === 0 ? ' s="1"' : '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${st}/>`;
    return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipStore([
    { name: '[Content_Types].xml', data: `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${H}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `${H}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F5FA"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>` },
    { name: 'xl/worksheets/sheet1.xml', data: `${H}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>` }
  ]);
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const downloadXlsx = (filename, sheetName, rows, widths) => downloadBlob(makeXlsx(sheetName, rows, widths), filename);

/* ---------------- PDF (tabla) ---------------- */
// columns: [{ h, align }]  rows: arrays de texto  summary: [[etiqueta, valor], ...]
export function openTablePdf({ title, subtitle, columns, rows, summary = [], store = {} }) {
  const head = columns.map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((v, i) => `<td style="text-align:${columns[i].align || 'left'}">${esc(v)}</td>`).join('')}</tr>`).join('');
  const sum = summary.map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; color: #1C2A38; font-size: 10.5px; margin: 0; padding: 12px; }
    h1 { font-size: 20px; margin: 0; } .sub { color: #64748B; margin: 2px 0 10px; } .sum { display: flex; gap: 18px; margin-bottom: 10px; font-size: 11.5px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; } th { background: #F3F5FA; text-align: left; padding: 6px 5px; border-bottom: 1.5px solid #CBD5E1; font-size: 9.5px; text-transform: uppercase; }
    td { padding: 5px; border-bottom: 1px solid #E8EDF3; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
    .bar { margin-bottom: 10px; } .bar button { padding: 8px 14px; font-weight: 700; cursor: pointer; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style></head><body>
  <div class="no-print bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle || '')}</div></div>
  <div style="text-align:right;color:#64748B">${esc(store.nombre_tienda || '')}<br>${esc(new Date().toLocaleString('es-PE'))}</div></div>
  <div class="sum">${sum}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 400); };</script>
  </body></html>`;
  openHtmlWindow(html);
}

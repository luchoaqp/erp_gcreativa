// Generador de códigos QR (byte, corrección M, versiones 1-10: hasta 213 caracteres). Sin dependencias.
// Basado en el algoritmo estándar ISO/IEC 18004.

const EC_TABLE = { // versión: [codewords ECC por bloque, [[nº bloques, datos por bloque], ...]]
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]]
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

const EXP = new Array(512); const LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsEncode(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= gmul(gen[j], EXP[i]); }
    gen = next;
  }
  const res = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ res[0];
    res.shift(); res.push(0);
    if (f) for (let i = 0; i < n; i++) res[i] ^= gmul(gen[i + 1], f);
  }
  return res;
}

const utf8 = (s) => Array.from(unescape(encodeURIComponent(s))).map((c) => c.charCodeAt(0));

function buildCodewords(bytes, version) {
  const [eccLen, groups] = EC_TABLE[version];
  const dataCap = groups.reduce((a, [n, d]) => a + n * d, 0);
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
  for (let pad = 0xEC; cw.length < dataCap; pad ^= 0xEC ^ 0x11) cw.push(pad);
  const blocks = []; let pos = 0;
  groups.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const data = cw.slice(pos, pos + d); pos += d; blocks.push({ data, ecc: rsEncode(data, eccLen) }); } });
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.data.length) out.push(b.data[i]); });
  for (let i = 0; i < eccLen; i++) blocks.forEach((b) => out.push(b.ecc[i]));
  return out;
}

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

export function qrMatrix(text) {
  const bytes = utf8(String(text));
  let version = 0;
  for (let v = 1; v <= 10; v++) { const cap = EC_TABLE[v][1].reduce((a, [n, d]) => a + n * d, 0); if (bytes.length + (v <= 9 ? 2 : 3) <= cap) { version = v; break; } }
  if (!version) throw new Error('El texto es demasiado largo para el QR (máx. ~210 caracteres)');
  const size = 17 + 4 * version;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, dark) => { if (x >= 0 && x < size && y >= 0 && y < size) { mod[y][x] = dark; fn[y][x] = true; } };

  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = ALIGN[version];
  ap.forEach((cy, i) => ap.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask) => {
    const data = (0 << 3) | mask; // nivel M = 00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, getBit(bits, i));
    setF(8, 7, getBit(bits, 6)); setF(8, 8, getBit(bits, 7)); setF(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, getBit(bits, i));
    setF(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) { const c = getBit(bits, i); const a = size - 11 + (i % 3); const b = Math.floor(i / 3); setF(a, b, c); setF(b, a, c); }
  }

  const cw = buildCodewords(bytes, version);
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j; const up = ((right + 1) & 2) === 0; const y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = getBit(cw[bi >>> 3], 7 - (bi & 7)); bi++; }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];
  const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = () => {
    let p = 0;
    const line = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1; let hist = '';
        for (let b = 0; b < size; b++) {
          const v = get(a, b); hist += v ? '1' : '0';
          if (b > 0) { if (v === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1; }
        }
        const re = /(?=(1011101(0000)|(0000)1011101))/g; let m; while ((m = re.exec(hist))) { p += 40; re.lastIndex = m.index + 1; }
      }
    };
    line((y, x) => mod[y][x]); line((x, y) => mod[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
    let dark = 0; mod.forEach((r) => r.forEach((c) => { if (c) dark++; }));
    p += Math.max(0, Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    return p;
  };
  let best = 0; let bestP = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return mod;
}

// SVG en blanco y negro listo para insertar en un documento imprimible
export function qrSvg(text, { size = 140, margin = 2 } = {}) {
  const m = qrMatrix(text); const n = m.length; const t = n + margin * 2;
  let path = '';
  m.forEach((row, y) => { let x = 0; while (x < n) { if (row[x]) { let w = 1; while (x + w < n && row[x + w]) w++; path += `M${x + margin} ${y + margin}h${w}v1h-${w}z`; x += w; } else x++; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

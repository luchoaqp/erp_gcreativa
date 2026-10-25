import React from 'react';

const COLORS = ['#5B5BF0', '#14B8A6', '#F59E0B', '#F43F5E', '#0EA5E9', '#8B5CF6', '#10B981', '#EC4899', '#64748B', '#84CC16'];
const nf = (n) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 0 });
const niceMax = (m) => {
  if (m <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(m));
  const f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

export function LineChart({ labels, values, height = 300 }) {
  const W = 640; const H = height; const L = 46; const R = 14; const T = 14; const B = 30;
  const max = niceMax(Math.max(...values, 0));
  const n = values.length;
  const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  // curva suave (Catmull-Rom → Bézier)
  const pts = values.map((v, i) => [x(i), y(v)]);
  let d = pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const clampY = (v) => Math.min(H - B, Math.max(T, v));
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = pts.length ? `${d} L${pts[pts.length - 1][0]},${H - B} L${pts[0][0]},${H - B} Z` : '';
  const step = Math.max(1, Math.ceil(n / 8));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Gráfico de líneas">
      <defs><linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B5BF0" stopOpacity=".22" /><stop offset="100%" stopColor="#5B5BF0" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E6EAF2" /><text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#64748B">{nf(t)}</text></g>
      ))}
      <path d={area} fill="url(#lcg)" />
      <path d={d} fill="none" stroke="#5B5BF0" strokeWidth="2.6" strokeLinecap="round" />
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="3.6" fill="#5B5BF0" stroke="#fff" strokeWidth="1.5"><title>{`${labels[i]}: S/ ${nf(values[i])}`}</title></circle>)}
      {labels.map((l, i) => (i % step === 0 ? <text key={i} x={x(i)} y={H - 10} fontSize="11" textAnchor="middle" fill="#64748B">{l}</text> : null))}
    </svg>
  );
}

export function HBarChart({ labels, values, money = false }) {
  const rowH = 30; const L = 190; const R = 20; const W = 640; const T = 6; const B = 28;
  const H = T + B + labels.length * rowH;
  const max = niceMax(Math.max(...values, 0));
  const w = (v) => ((W - L - R) * Math.max(0, v)) / max;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const cut = (s) => (String(s).length > 26 ? `${String(s).slice(0, 25)}…` : String(s));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Gráfico de barras">
      {ticks.map((t) => (
        <g key={t}><line x1={L + w(t)} x2={L + w(t)} y1={T} y2={H - B} stroke="#E6EAF2" /><text x={L + w(t)} y={H - 10} fontSize="11" textAnchor="middle" fill="#64748B">{nf(t)}</text></g>
      ))}
      {labels.map((l, i) => (
        <g key={i}>
          <text x={L - 10} y={T + i * rowH + rowH / 2 + 4} fontSize="12" textAnchor="end" fill="#334155">{cut(l)}</text>
          <rect x={L} y={T + i * rowH + 5} width={w(values[i])} height={rowH - 12} rx="5" fill="#5B5BF0"><title>{`${l}: ${money ? 'S/ ' : ''}${nf(values[i])}`}</title></rect>
        </g>
      ))}
    </svg>
  );
}

export function DonutChart({ labels, values }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const R = 100; const r = 62; const C = 130;
  let a0 = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const a1 = a0 + (v / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, ang) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
    const [x0, y0] = p(R, a0); const [x1, y1] = p(R, a1); const [x2, y2] = p(r, a1); const [x3, y3] = p(r, a0);
    const full = values.length === 1;
    const path = full
      ? `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} L${C - 0.01},${C - r} A${r},${r} 0 1 0 ${C},${C - r} Z`
      : `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    a0 = a1;
    return <path key={i} d={path} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="2"><title>{`${labels[i]}: S/ ${nf(v)} (${((v / total) * 100).toFixed(1)}%)`}</title></path>;
  });
  return (
    <div>
      <svg viewBox="0 0 260 260" style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block', margin: '0 auto' }} role="img" aria-label="Gráfico circular">{arcs}</svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', justifyContent: 'center', marginTop: 12, fontSize: 12.5, color: '#475569' }}>
        {labels.map((l, i) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />{l}</span>)}
      </div>
    </div>
  );
}

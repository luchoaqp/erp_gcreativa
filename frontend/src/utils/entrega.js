// Utilidades de fechas de entrega (hora local, no UTC)
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

export const localISO = (d = new Date()) => d.toLocaleDateString('en-CA');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parts = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return { y, m, d, date: new Date(y, m - 1, d) }; };
export const fmtDMY = (iso) => { const { y, m, d } = parts(iso); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };

// Fecha y hora "por confirmar" son independientes del tipo de entrega (tienda / envío / delivery)
export const fechaPorConfirmar = (o) => !o || o.tipo_entrega === 'por_confirmar' || !o.fecha_entrega;
export const horaPorConfirmar = (o) => fechaPorConfirmar(o) || !o.franja_horaria || /^por (confirmar|definir)$/i.test(String(o.franja_horaria).trim());
// Texto de entrega: "HOY 18/10/2026 · 09:00 AM - 11:00 AM" | "HOY 18/10/2026 · HORA POR CONFIRMAR" | "FECHA POR CONFIRMAR"
export const entregaTexto = (o) => (fechaPorConfirmar(o) ? 'FECHA POR CONFIRMAR' : `${entregaLabel(o.fecha_entrega, o.tipo_entrega)} · ${horaPorConfirmar(o) ? 'HORA POR CONFIRMAR' : o.franja_horaria}`);

// "HOY 18/10/2026", "MAÑANA 19/10/2026", "MARTES 20/10/2026" o "POR CONFIRMAR"
export function entregaLabel(fecha, tipo) {
  if (tipo === 'por_confirmar' || !fecha) return 'POR CONFIRMAR';
  const iso = String(fecha).slice(0, 10);
  const hoy = localISO();
  if (iso === hoy) return `HOY ${fmtDMY(iso)}`;
  if (iso === localISO(addDays(new Date(), 1))) return `MAÑANA ${fmtDMY(iso)}`;
  return `${DIAS[parts(iso).date.getDay()]} ${fmtDMY(iso)}`;
}

export function entregaTone(fecha, tipo) {
  if (tipo === 'por_confirmar' || !fecha) return { bg: '#EDE9FE', color: '#6D28D9' };
  const iso = String(fecha).slice(0, 10);
  const hoy = localISO();
  if (iso < hoy) return { bg: '#FEE2E2', color: '#B91C1C' };
  if (iso === hoy) return { bg: '#FFEDD5', color: '#C2410C' };
  if (iso === localISO(addDays(new Date(), 1))) return { bg: '#FEF3C7', color: '#B45309' };
  return { bg: '#F1F5F9', color: '#475569' };
}

// Días de la semana actual (lunes a domingo) como fechas ISO
export function semanaActual() {
  const hoy = new Date();
  const lunes = addDays(hoy, -((hoy.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => localISO(addDays(lunes, i)));
}

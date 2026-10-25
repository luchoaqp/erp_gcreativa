// Color principal de la aplicación (se guarda en Configuración > Apariencia y aplica a todos los usuarios)
export const DEFAULT_PRIMARY = '#FF5E36';
export const PRESETS = [
  { name: 'Naranja (original)', hex: '#FF5E36' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Índigo', hex: '#4F46E5' },
  { name: 'Violeta', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#DB2777' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Verde', hex: '#059669' },
  { name: 'Turquesa', hex: '#0D9488' },
  { name: 'Ámbar', hex: '#D97706' },
  { name: 'Pizarra', hex: '#334155' }
];
const HEX = /^#[0-9a-fA-F]{6}$/;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function applyTheme(hex) {
  const c = HEX.test(hex || '') ? hex : DEFAULT_PRIMARY;
  const a = rgb(c);
  const r = document.documentElement.style;
  r.setProperty('--primary', c);
  r.setProperty('--primary-hover', toHex(mix(a, [0, 0, 0], 0.12)));
  r.setProperty('--primary-light', toHex(mix(a, [255, 255, 255], 0.9)));
  r.setProperty('--primary-rgb', a.join(', '));
  r.setProperty('--primary-glow', `rgba(${a.join(', ')}, 0.25)`);
  r.setProperty('--shadow-glow', `0 8px 25px rgba(${a.join(', ')}, 0.35)`);
  r.setProperty('--sidebar-bg', c);
  r.setProperty('--sidebar-text-active', c);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', c);
  try { localStorage.setItem('theme_primary', c); } catch (e) { /* sin guardado */ }
}

export function applySavedTheme() {
  try { const c = localStorage.getItem('theme_primary'); if (c) applyTheme(c); } catch (e) { /* sin guardado */ }
  try { const b = JSON.parse(localStorage.getItem('theme_sidebar')); if (b) applySidebar(b); } catch (e) { /* sin guardado */ }
}

// Menú lateral: fondo, texto/iconos y opción activa. Vacío = automático (sigue el color principal, texto blanco)
const SB_VARS = { bg: '--sb-bg', activoBg: '--sb-active-bg', activoTexto: '--sb-active-text' };
export function applySidebar(sb = {}) {
  const r = document.documentElement.style;
  const ok = (v) => HEX.test(v || '');
  const set = (name, v) => (ok(v) ? r.setProperty(name, v) : r.removeProperty(name));
  set(SB_VARS.bg, sb.bg); set(SB_VARS.activoBg, sb.activoBg); set(SB_VARS.activoTexto, sb.activoTexto);
  if (ok(sb.texto)) r.setProperty('--sb-text-rgb', rgb(sb.texto).join(', ')); else r.removeProperty('--sb-text-rgb');
  try { localStorage.setItem('theme_sidebar', JSON.stringify(sb)); } catch (e) { /* sin guardado */ }
}
export const sidebarFromSettings = (s = {}) => ({ bg: s.sidebar_bg, texto: s.sidebar_texto, activoBg: s.sidebar_activo_bg, activoTexto: s.sidebar_activo_texto });

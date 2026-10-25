import React, { useState, useEffect } from 'react';
import { TrendingUp, FileText, Wallet, Users, ArrowRight, Armchair, Palette, X, AlertTriangle } from 'lucide-react';
import { dashboardAPI, ordersAPI } from '../api';
import { entregaLabel, entregaTone, localISO, fmtDMY, horaPorConfirmar } from '../utils/entrega';
import { pdNumber } from '../utils/docPrint';

const PALETA = ['#FF5E36', '#E83E8C', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#14B8A6', '#EF4444'];
const fmt = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt0 = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
// HOY, MAÑANA o la fecha de entrega (dd/mm/aaaa)
const diaTxt = (p) => {
  if (p.tipo_entrega === 'por_confirmar' || !p.fecha_entrega) return 'POR CONFIRMAR';
  const iso = String(p.fecha_entrega).slice(0, 10);
  const m = new Date(); m.setDate(m.getDate() + 1);
  if (iso === localISO()) return 'HOY';
  if (iso === localISO(m)) return 'MAÑANA';
  return fmtDMY(iso);
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const ETAPA = {
  pendiente_diseno: ['Pend. diseño', '#F1F5F9', '#475569'],
  pendiente_aprobacion: ['Pend. aprobación', '#FCE7F3', '#BE185D'],
  en_produccion: ['En producción', '#FEF3C7', '#B45309'],
  listo: ['Listo', '#EDE9FE', '#6D28D9'],
  en_ruta: ['En ruta', '#DBEAFE', '#1D4ED8'],
  entregado: ['Entregado', '#D1FAE5', '#047857']
};
const ADVANCE = {
  pendiente_diseno: { next: 'pendiente_aprobacion', label: 'Aprobación', bg: '#FDF2F8', border: '#FBCFE8', color: '#DB2777' },
  pendiente_aprobacion: { next: 'en_produccion', label: 'Producción', bg: '#FFF7ED', border: '#FED7AA', color: '#EA580C' },
  en_produccion: { next: 'listo', label: 'Listo', bg: '#F5F3FF', border: '#DDD6FE', color: '#7C3AED' },
  listo: { next: 'en_ruta', label: 'Ruta', bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB' },
  en_ruta: { next: 'entregado', label: 'Entregado', bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A' }
};

export default function Dashboard({ user, onNavigatePOS, onNavigateOrders, onNavigateCustomers, onNavigateReports, onNavigateExpenses, onNavigateWorkshop }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getStats();
      if (res.success) setStats(res);
    } catch (error) { console.error('Error cargando dashboard:', error); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const advance = async (id, estado) => {
    const next = ADVANCE[estado]?.next;
    if (!next) return;
    try { await ordersAPI.updateStatus(id, { estado_pedido: next }); load(); } catch (err) { alert('Error al actualizar entrega: ' + err.message); }
  };

  const k = stats?.stats || {};
  const meses = stats?.ventas_mes || [];
  const totalMeses = meses.reduce((a, m) => a + m.total, 0);
  const ultimo = meses.length ? meses[meses.length - 1].total : 0;
  const previo = meses.length > 1 ? meses[meses.length - 2].total : 0;
  const delta = previo > 0 ? ((ultimo - previo) / previo) * 100 : null;
  const maxMes = Math.max(1, ...meses.map((m) => m.total));
  const pts = meses.map((m, i) => ({ x: 30 + (i * (490 / Math.max(1, meses.length - 1))), y: 100 - (m.total / maxMes) * 82, m }));
  const linea = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x},${p.y}`).join(' ');

  const cats = (stats?.ventas_por_categoria || []).filter((c) => Number(c.total) > 0);
  const totCats = cats.reduce((a, c) => a + Number(c.total), 0);
  const unidades = cats.reduce((a, c) => a + Number(c.cantidad_items || 0), 0);
  const C = 2 * Math.PI * 38;
  let acum = 0;
  const segs = cats.map((c, i) => { const frac = Number(c.total) / totCats; const s = { ...c, color: PALETA[i % PALETA.length], len: frac * C, off: -acum, pct: Math.round(frac * 100) }; acum += frac * C; return s; });

  const ocs = stats?.ventas_por_ocasion || [];
  const maxOc = Math.max(1, ...ocs.map((o) => Number(o.total)));
  const totOc = ocs.reduce((a, o) => a + Number(o.total), 0);

  const pendDis = stats?.pendientes_diseno || [];
  // Tarjeta "Equipos del taller" desactivada (los datos siguen llegando en stats.taller por si se reactiva)
  const hoy = stats?.entregas_hoy || [];
  const nombre = (user?.nombre || '').split(' ')[0];
  const fechaHoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  const panel = (cls, value, title, sub, onClick, Icon) => (
    <div className={`stat-panel-card ${cls}`} onClick={onClick} role="button" tabIndex={0}>
      <div><div className="stat-panel-value">{value}</div><div className="stat-panel-title">{title}</div><div className="stat-panel-subtitle">{sub}</div></div>
      <button className="stat-panel-action" type="button" onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}><span>Ver</span><ArrowRight size={13} strokeWidth={2.5} /></button>
      <div className="stat-panel-watermark"><Icon size={56} strokeWidth={1.5} fill="currentColor" /></div>
    </div>
  );

  return (
    <div className="content-body animate-fade-in">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1C2A38' }}>Hola, {nombre || 'bienvenido'} 👋</h1>
        <div style={{ fontSize: 12.5, color: '#788A9B', marginTop: 2 }}>{cap(fechaHoy)} · este es el resumen de tu negocio</div>
      </div>

      <div className="stat-panels-grid">
        {panel('stat-panel-orange', k.pedidos_activos ?? 0, 'Pedidos activos', 'En diseño, fabricación y despacho', onNavigateOrders, Armchair)}
        {panel('stat-panel-blue', fmt0(k.total_ingresos), 'Ingresos Totales', 'Ventas con comprobante emitido', onNavigateReports || onNavigatePOS, Wallet)}
        {panel('stat-panel-green', k.total_clientes ?? 0, 'Clientes Registrados', 'Cartera de clientes', onNavigateCustomers, Users)}
        {panel('stat-panel-amber', fmt0(k.gastos_mes), 'Gastos del mes', 'Movilidad, servicios y otros gastos', onNavigateExpenses || onNavigateReports, AlertTriangle)}
      </div>

      <div className="dashboard-grid">
        <div className="side-column">
          {/* Pendientes de entrega de diseño */}
          <div className="urgent-deliveries-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Palette size={16} color="#EC4899" /> Pendientes de entrega de diseño</span>
              <span className="chart-badge" style={{ background: '#FCE7F3', color: '#BE185D' }}>{pendDis.length}</span>
            </div>
            {pendDis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '14px 0', color: '#788A9B', fontSize: 12 }}>No hay diseños pendientes 🎉</div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {pendDis.map((p) => {
                  const tone = p.fecha_entrega_diseno ? entregaTone(p.fecha_entrega_diseno, 'tienda') : { bg: '#F1F5F9', color: '#64748B' };
                  return (
                    <div key={p.id} className="urgent-item">
                      <div className="urgent-info">
                        <div className="urgent-name" title={p.cliente_nombre}>{p.cliente_nombre}</div>
                        <div style={{ fontSize: 11, color: '#788A9B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdNumber(p.id)} · {p.producto_principal || 'Sin productos'}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: tone.bg, color: tone.color, whiteSpace: 'nowrap' }}>{p.fecha_entrega_diseno ? entregaLabel(p.fecha_entrega_diseno, 'tienda') : 'Sin fecha'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={onNavigateOrders} style={{ marginTop: 10, fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Ir al tablero de pedidos ➔</button>
          </div>

          {/* Entregas de la semana */}
          <div className="urgent-deliveries-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Entregas de la semana</span>
              <button onClick={onNavigateOrders} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Ver todas ➔</button>
            </div>
            {hoy.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#788A9B', fontSize: 12 }}>No hay entregas pendientes esta semana</div>
            ) : hoy.map((p) => {
              const et = ETAPA[p.estado_pedido] || ['—', '#F1F5F9', '#475569'];
              const dtone = entregaTone(p.fecha_entrega, p.tipo_entrega);
              return (
                <div key={p.id} className="urgent-item">
                  <div className="urgent-info">
                    <div className="urgent-name" title={p.nombre_cliente}>{p.nombre_cliente || p.nombre_destinatario}</div>
                    <div style={{ fontSize: 11, color: '#788A9B' }}>{horaPorConfirmar(p) ? 'Hora por confirmar' : p.franja_horaria} · {pdNumber(p.id)}</div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                      <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: et[1], color: et[2] }}>{et[0]}</span>
                      <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: dtone.bg, color: dtone.color }}>{diaTxt(p)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setNoteFor(p)} title="Notas para el taller" style={{ padding: 6, borderRadius: 8, background: p.notas_taller ? '#FEF3C7' : '#F4F7F6', color: p.notas_taller ? '#B45309' : '#788A9B' }}><FileText size={14} /></button>
                    {ADVANCE[p.estado_pedido] && (
                      <button onClick={() => advance(p.id, p.estado_pedido)} title="Avanzar a la siguiente etapa"
                        style={{ padding: '5px 9px', background: ADVANCE[p.estado_pedido].bg, border: `1px solid ${ADVANCE[p.estado_pedido].border}`, color: ADVANCE[p.estado_pedido].color, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {ADVANCE[p.estado_pedido].label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        <div className="main-column">
            {/* Tendencia: ventas por mes, últimos 6 meses */}
            <div className="chart-box" style={{ gridColumn: '1 / -1' }}>
              <div className="chart-box-header">
                <div><div className="chart-box-title">Tendencia de Ventas & Facturación</div><div className="chart-box-subtitle">Total de ventas por mes · últimos 6 meses</div></div>
                <div className="chart-badge" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
                  <TrendingUp size={12} /> {fmt0(totalMeses)}{delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs mes previo)` : ''}
                </div>
              </div>
              {totalMeses === 0 && !loading ? (
                <div style={{ textAlign: 'center', color: '#788A9B', fontSize: 13, padding: '34px 0' }}>Aún no hay ventas con comprobante en los últimos 6 meses.</div>
              ) : (
                <>
                  <div className="area-chart-container">
                    <svg viewBox="0 0 540 125" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs><linearGradient id="areaSalesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
                      {[20, 55, 90].map((y) => <line key={y} x1="20" y1={y} x2="525" y2={y} stroke="#EEF2F0" strokeWidth="1" strokeDasharray="3,3" />)}
                      {pts.length > 1 && <path d={`${linea} L ${pts[pts.length - 1].x},108 L ${pts[0].x},108 Z`} fill="url(#areaSalesGrad)" />}
                      <path d={linea} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      {pts.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 6 : 4.5} fill={i === pts.length - 1 ? 'var(--primary)' : '#FFFFFF'} stroke="var(--primary)" strokeWidth="2.5"><title>{`${cap(p.m.mes)}: ${fmt(p.m.total)}`}</title></circle>
                          <text x={p.x} y={Math.max(11, p.y - 10)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#475569">{p.m.total > 0 ? fmt0(p.m.total).replace('S/. ', '') : ''}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#788A9B', fontWeight: 600, padding: '4px 14px 0 22px' }}>
                    {meses.map((m, i) => <span key={m.ym} style={i === meses.length - 1 ? { color: 'var(--primary)', fontWeight: 700 } : {}}>{cap(m.mes)}</span>)}
                  </div>
                </>
              )}
            </div>

            {/* Ventas por categoría de regalo */}
        </div>
      </div>

      <div className="charts-grid-2x2" style={{ marginTop: 24 }}>
            <div className="chart-box">
              <div className="chart-box-header">
                <div><div className="chart-box-title">Ventas por Categoría de Regalo</div><div className="chart-box-subtitle">Acumulado de ventas con comprobante</div></div>
                <div className="chart-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{unidades} {unidades === 1 ? 'ítem' : 'ítems'}</div>
              </div>
              {segs.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#788A9B', fontSize: 13, padding: '34px 0' }}>Sin ventas por categoría todavía.</div>
              ) : (
                <div className="donut-container">
                  <div className="donut-svg-wrap">
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F3" strokeWidth="13" />
                      {segs.map((s) => <circle key={s.categoria} cx="50" cy="50" r="38" fill="none" stroke={s.color} strokeWidth="13" strokeDasharray={`${Math.max(0, s.len - 1.5)} ${C}`} strokeDashoffset={s.off} />)}
                    </svg>
                    <div className="donut-center-text"><span style={{ fontSize: '15px', fontWeight: '800', color: '#1C2A38', lineHeight: 1 }}>{fmt0(totCats).replace('S/. ', '')}</span><span style={{ fontSize: '9px', color: '#788A9B', fontWeight: 600, textTransform: 'uppercase' }}>Soles</span></div>
                  </div>
                  <div className="donut-legends">
                    {segs.slice(0, 6).map((s) => (
                      <div key={s.categoria} className="donut-legend-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} /><span style={{ fontWeight: 600, color: '#1C2A38' }}>{s.categoria}</span></div>
                        <div style={{ display: 'flex', gap: 6 }}><span style={{ color: '#788A9B' }}>{s.pct}%</span><span style={{ fontWeight: 700, color: s.color }}>{fmt0(s.total)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ventas por ocasiones especiales */}
            <div className="chart-box">
              <div className="chart-box-header">
                <div><div className="chart-box-title">Ventas por Ocasiones Especiales</div><div className="chart-box-subtitle">Según la ocasión asignada a cada producto</div></div>
                <div className="chart-badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>{fmt0(totOc)}</div>
              </div>
              {ocs.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#788A9B', fontSize: 13, padding: '30px 8px' }}>Aún no hay ventas con ocasión. Asigna una ocasión (Día de la Madre, Navidad…) a tus productos para verlas aquí.</div>
              ) : (
                <div className="payment-channels-list">
                  {ocs.slice(0, 7).map((o, i) => (
                    <div key={o.ocasion} className="payment-row">
                      <div className="payment-row-top">
                        <span style={{ color: '#1C2A38', fontWeight: 600 }}>{o.ocasion}<span style={{ color: '#788A9B', fontWeight: 500, fontSize: 11, marginLeft: 6 }}>{Number(o.unidades)} und · {Number(o.pedidos)} ped.</span></span>
                        <div><span style={{ color: '#788A9B', marginRight: 6, fontSize: 11 }}>{totOc > 0 ? Math.round((Number(o.total) / totOc) * 100) : 0}%</span><span style={{ color: '#1C2A38', fontWeight: 700 }}>{fmt(o.total)}</span></div>
                      </div>
                      <div className="payment-bar-track"><div className="payment-bar-fill" style={{ width: `${(Number(o.total) / maxOc) * 100}%`, background: PALETA[i % PALETA.length] }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
      </div>

      {noteFor && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setNoteFor(null); }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} color="#F59E0B" /> Notas para el taller</h3>
              <button onClick={() => setNoteFor(null)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: '#788A9B', marginBottom: 8 }}>{pdNumber(noteFor.id)} · {noteFor.nombre_cliente}</div>
            <div style={{ fontSize: 14, color: '#1C2A38', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{noteFor.notas_taller || 'Este pedido no tiene notas para el taller.'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

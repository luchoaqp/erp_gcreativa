import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, Search, LayoutGrid, List, ChevronRight, ArrowLeft, History, FileText, Users, Package, ClipboardList, Wallet, Store,
  ShoppingCart, PackageSearch, Coins, Gift, AlertTriangle, Layers, Boxes, Truck, Send, CalendarDays
} from 'lucide-react';
import { reportHubAPI, settingsAPI } from '../api';
import ExportMenu from '../components/ExportMenu';
import { LineChart, HBarChart, DonutChart } from '../components/MiniCharts';
import { downloadXlsx, openTablePdf } from '../utils/exporters';
import '../components/party.css';

const ICONS = { FileText, Users, Package, ClipboardList, Wallet, Store, ShoppingCart, PackageSearch, Coins, Gift, AlertTriangle, Layers, Boxes, Truck, Send, BarChart3 };
const GRUPOS = [['analisis', 'Análisis'], ['ventas', 'Ventas'], ['compras', 'Compras'], ['general', 'General'], ['pedidos', 'Pedidos'], ['guias', 'Guías y envíos']];
const ESTADOS = { emitido: 'Emitido', anulado: 'Anulado', anulada: 'Anulada', pendiente_diseno: 'Pendiente de diseño', pendiente_aprobacion: 'Pendiente de aprobación', en_produccion: 'En producción', listo_despacho: 'Listo para despacho', en_ruta: 'En ruta', entregado: 'Entregado' };
const TIPOS = { nota_venta: 'Nota de venta', boleta: 'Boleta', factura: 'Factura', tienda: 'Recojo en tienda', envio: 'Envío', delivery: 'Delivery', por_confirmar: 'Por confirmar' };
const RECENT_KEY = 'reportes_recientes';

const iso = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };
const fmtDate = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '');
const fmtMoney = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const display = (c, v) => {
  if (v === null || v === undefined || v === '') return '';
  if (c.type === 'money') return fmtMoney(v);
  if (c.type === 'int') return Number(v).toLocaleString('es-PE');
  if (c.type === 'pct') return `${Number(v).toFixed(1)}%`;
  if (c.type === 'date') return fmtDate(v);
  return ESTADOS[v] || TIPOS[v] || String(v);
};

export default function ReportCenter({ onNavigate = () => {} }) {
  const [reports, setReports] = useState([]);
  const [grupo, setGrupo] = useState('todos');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('reportes_vista') || 'lista'; } catch (e) { return 'lista'; } });
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } });
  const [open, setOpen] = useState(null);       // reporte abierto
  const [store, setStore] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => {
    reportHubAPI.list().then((r) => setReports(r.reports || [])).catch((e) => setErr(e.message));
    settingsAPI.get().then((r) => setStore(r.settings || {})).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return reports.filter((r) => (grupo === 'todos' || r.grupo === grupo) && (!t || `${r.titulo} ${r.desc}`.toLowerCase().includes(t)));
  }, [reports, grupo, q]);
  const count = (g) => reports.filter((r) => g === 'todos' || r.grupo === g).length;

  const go = (r) => {
    if (r.link) { onNavigate(r.link); return; }
    const next = [r.key, ...recent.filter((k) => k !== r.key)].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) { /* sin guardado */ }
    setOpen(r);
  };
  const setView = (v) => { setVista(v); try { localStorage.setItem('reportes_vista', v); } catch (e) { /* sin guardado */ } };

  if (open) return open.viz ? <AnalyticView report={open} store={store} onBack={() => setOpen(null)} /> : <ReportView report={open} store={store} onBack={() => setOpen(null)} />;

  const Row = ({ r }) => {
    const Icon = ICONS[r.icon] || FileText;
    return vista === 'lista' ? (
      <button onClick={() => go(r)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '14px 18px', background: 'transparent', border: 0, borderBottom: '1px solid #EEF2F6', cursor: 'pointer' }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon size={18} color="#16A34A" /></span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600, color: '#1C2A38', fontSize: 14 }}>{r.titulo}{r.link && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: '#6D4AE0', background: '#F1ECFF', borderRadius: 999, padding: '2px 8px' }}>Abre la pantalla</span>}</span><span style={{ display: 'block', fontSize: 12.5, color: '#788A9B' }}>{r.desc}</span></span>
        <ChevronRight size={16} color="#94A3B8" />
      </button>
    ) : (
      <button onClick={() => go(r)} style={{ textAlign: 'left', padding: 16, background: '#fff', border: '1px solid #E4EAF0', borderRadius: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color="#16A34A" /></span>
        <span style={{ fontWeight: 700, color: '#1C2A38', fontSize: 14 }}>{r.titulo}</span>
        <span style={{ fontSize: 12.5, color: '#788A9B' }}>{r.desc}</span>
      </button>
    );
  };

  const recents = recent.map((k) => reports.find((r) => r.key === k)).filter(Boolean);

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-card pm-head">
          <div className="pm-head-l">
            <BarChart3 size={38} color="#FF7A3C" strokeWidth={1.7} />
            <div><h2>Reportes</h2><p>Encuentra y accede a cualquier reporte de tu negocio</p></div>
          </div>
          <div className="pm-tabs" style={{ margin: 0 }}>
            <button className={vista === 'lista' ? 'on' : ''} onClick={() => setView('lista')}><List size={14} style={{ verticalAlign: '-2px' }} /> Lista</button>
            <button className={vista === 'tarjetas' ? 'on' : ''} onClick={() => setView('tarjetas')}><LayoutGrid size={14} style={{ verticalAlign: '-2px' }} /> Tarjetas</button>
          </div>
        </div>
        {err && <div className="pm-err">{err}</div>}

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="pm-card" style={{ flex: '0 0 250px', padding: 14 }}>
            <div className="pm-search" style={{ marginLeft: 0, flex: 'none', width: '100%' }}>
              <input placeholder="Buscar reportes…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="button" aria-label="Buscar"><Search size={18} /></button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 2 }}>
              {[['todos', 'Todos'], ...GRUPOS].map(([id, label]) => (
                <button key={id} onClick={() => setGrupo(id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 10, border: 0, cursor: 'pointer', fontSize: 13.5, fontWeight: grupo === id ? 700 : 500, background: grupo === id ? 'var(--primary-light)' : 'transparent', color: grupo === id ? 'var(--primary)' : '#475569' }}>
                  <span>{label}</span><span style={{ color: '#94A3B8', fontSize: 12 }}>{count(id)}</span>
                </button>
              ))}
            </div>
            {recents.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #EEF2F6', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: '#788A9B', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><History size={13} /> Abiertos hace poco</div>
                {recents.map((r) => <button key={r.key} onClick={() => go(r)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 4px', background: 'none', border: 0, cursor: 'pointer', fontSize: 13, color: '#334155' }}>{r.titulo}</button>)}
              </div>
            )}
          </div>

          <div className="pm-card" style={{ flex: '1 1 480px', minWidth: 0, padding: vista === 'lista' ? 0 : 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: vista === 'lista' ? '14px 18px' : '0 0 12px', fontSize: 14 }}>
              <strong>{grupo === 'todos' ? 'Todos los reportes' : GRUPOS.find((g) => g[0] === grupo)[1]}</strong>
              <span style={{ color: '#788A9B', fontSize: 12.5 }}>{filtered.length} reportes</span>
            </div>
            {vista === 'lista'
              ? <div style={{ borderTop: '1px solid #EEF2F6' }}>{filtered.map((r) => <Row key={r.key} r={r} />)}</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>{filtered.map((r) => <Row key={r.key} r={r} />)}</div>}
            {!filtered.length && <div className="pm-empty">NO HAY REPORTES CON ESA BÚSQUEDA</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportView({ report, store, onBack }) {
  const hoy = new Date();
  const [desde, setDesde] = useState(report.fechas ? iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) : '');
  const [hasta, setHasta] = useState(report.fechas ? iso(hoy) : '');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ columns: [], rows: [], summary: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams();
      if (report.fechas && desde) p.set('desde', desde);
      if (report.fechas && hasta) p.set('hasta', hasta);
      if (report.buscar && search.trim()) p.set('search', search.trim());
      const r = await reportHubAPI.run(report.key, `?${p.toString()}`);
      setData({ columns: r.columns || [], rows: r.rows || [], summary: r.summary || [] });
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [report, desde, hasta, search]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const periodo = report.fechas ? `${fmtDate(desde)} – ${fmtDate(hasta)}` : 'Al día de hoy';
  const summaryTxt = data.summary.map(([l, v]) => [l, typeof v === 'number' && /total|importe|ganancia|cobrar|cobrado|comprado|cotizado|emitido|vendido|saldo/i.test(l) ? fmtMoney(v) : String(v)]);

  const exportExcel = () => {
    const head = data.columns.map((c) => c.label);
    const rows = data.rows.map((r) => data.columns.map((c) => (c.type === 'money' || c.type === 'int' ? Number(r[c.key] || 0) : display(c, r[c.key]))));
    downloadXlsx(`${report.key}_${new Date().toISOString().slice(0, 10)}.xlsx`, report.titulo, [head, ...rows], data.columns.map((c) => (c.type === 'money' ? 14 : c.type === 'int' ? 10 : 22)));
  };
  const exportPdf = () => openTablePdf({
    title: report.titulo, subtitle: periodo, store,
    columns: data.columns.map((c) => ({ h: c.label, align: c.align })),
    rows: data.rows.map((r) => data.columns.map((c) => display(c, r[c.key]))),
    summary: summaryTxt
  });

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-card pm-head">
          <div className="pm-head-l">
            <button className="pm-icon-btn" onClick={onBack} aria-label="Volver" style={{ border: '1px solid #E4EAF0', borderRadius: 10 }}><ArrowLeft size={18} /></button>
            <div><h2>{report.titulo}</h2><p>{report.desc} · {periodo}</p></div>
          </div>
          <div className="pm-head-r"><ExportMenu onPdf={exportPdf} onExcel={exportExcel} disabled={!data.rows.length} /></div>
        </div>

        <div className="pm-card" style={{ paddingBottom: 6 }}>
          <div className="pm-toolbar">
            {report.buscar && (
              <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 260px' }}>
                <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <button type="button" aria-label="Buscar"><Search size={18} /></button>
              </div>
            )}
            {report.fechas && (
              <>
                <label className="pm-select" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><CalendarDays size={15} /><input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent' }} /></label>
                <label className="pm-select" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><CalendarDays size={15} /><input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent' }} /></label>
              </>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13.5, flexWrap: 'wrap' }}>
              {summaryTxt.map(([l, v]) => <span key={l}>{l}: <strong>{v}</strong></span>)}
            </div>
          </div>
          {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
          <div className="pm-table-wrap" style={{ minHeight: 160 }}>
            <table className="pm-table">
              <thead><tr><th>#</th>{data.columns.map((c) => <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{c.label}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}><td>{i + 1}</td>{data.columns.map((c) => <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{display(c, r[c.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {!loading && !data.rows.length && <div className="pm-empty"><BarChart3 size={40} />SIN RESULTADOS PARA ESTE REPORTE</div>}
            {loading && <div className="pm-empty">Cargando…</div>}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{data.rows.length} fila(s)</div>
        </div>
      </div>
    </div>
  );
}


/* ---------- Reportes de análisis: filtros rápidos, KPIs, gráfico y detalle ---------- */
function AnalyticView({ report, store, onBack }) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = useState(report.fechas ? iso(inicioMes) : '');
  const [hasta, setHasta] = useState(report.fechas ? iso(hoy) : '');
  const [quick, setQuick] = useState('mes');
  const [data, setData] = useState({ columns: [], rows: [], kpis: [], chart: null, nota: null, summary: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const setRango = (k) => {
    const h = new Date();
    const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    if (k === 'hoy') { setDesde(iso(h)); setHasta(iso(h)); }
    else if (k === '7') { setDesde(back(6)); setHasta(iso(h)); }
    else if (k === '30') { setDesde(back(29)); setHasta(iso(h)); }
    else if (k === 'mes') { setDesde(iso(new Date(h.getFullYear(), h.getMonth(), 1))); setHasta(iso(h)); }
    else if (k === 'anterior') { setDesde(iso(new Date(h.getFullYear(), h.getMonth() - 1, 1))); setHasta(iso(new Date(h.getFullYear(), h.getMonth(), 0))); }
    setQuick(k);
  };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams();
      if (report.fechas && desde) p.set('desde', desde);
      if (report.fechas && hasta) p.set('hasta', hasta);
      const r = await reportHubAPI.run(report.key, `?${p.toString()}`);
      setData({ columns: r.columns || [], rows: r.rows || [], kpis: r.kpis || [], chart: r.chart, nota: r.nota, summary: r.summary || [] });
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [report, desde, hasta]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const periodo = report.fechas ? `${fmtDate(desde)} – ${fmtDate(hasta)}` : 'Al día de hoy';
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [data.columns.map((c) => esc(c.label)).join(',')].concat(data.rows.map((r) => data.columns.map((c) => esc(c.type === 'money' || c.type === 'int' || c.type === 'pct' ? r[c.key] : display(c, r[c.key]))).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${report.key}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const imprimir = () => openTablePdf({
    title: report.titulo, subtitle: periodo, store,
    columns: data.columns.map((c) => ({ h: c.label, align: c.align })),
    rows: data.rows.map((r) => data.columns.map((c) => display(c, r[c.key]))),
    summary: data.kpis.map(([l, v, t]) => [l, t === 'money' ? fmtMoney(v) : t === 'pct' ? `${Number(v).toFixed(1)}%` : t === 'int' ? Number(v).toLocaleString('es-PE') : String(v)])
  });
  const kpiVal = (v, t) => (t === 'money' ? fmtMoney(v) : t === 'pct' ? `${Number(v).toFixed(1)}%` : t === 'int' ? Number(v).toLocaleString('es-PE') : String(v));
  const ch = data.chart;

  return (
    <div className="content-body animate-fade-in">
      <div className="pm an">
        <div className="an-head">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="pm-icon-btn" onClick={onBack} aria-label="Volver a reportes" style={{ border: '1px solid #E4EAF0', borderRadius: 10 }}><ArrowLeft size={18} /></button>
            <div><h2>{report.titulo}</h2><p>Analiza el rendimiento de tu negocio y exporta los datos</p></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="an-btn" onClick={exportCsv} disabled={!data.rows.length}>Exportar CSV</button>
            <button className="an-btn" onClick={imprimir} disabled={!data.rows.length}>Imprimir</button>
          </div>
        </div>
        {err && <div className="pm-err">{err}</div>}

        {report.fechas && (
          <div className="an-card an-filters">
            <div className="an-seg">
              {[['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes'], ['anterior', 'Mes anterior']].map(([k, l]) => (
                <button key={k} className={quick === k ? 'on' : ''} onClick={() => setRango(k)}>{l}</button>
              ))}
            </div>
            <input type="date" className="an-date" value={desde} max={hasta} onChange={(e) => { setDesde(e.target.value); setQuick(''); }} />
            <span>a</span>
            <input type="date" className="an-date" value={hasta} min={desde} onChange={(e) => { setHasta(e.target.value); setQuick(''); }} />
          </div>
        )}

        <div className="an-kpis">
          {data.kpis.map(([l, v, t]) => <div className="an-card an-kpi" key={l}><span>{l}</span><strong>{kpiVal(v, t)}</strong></div>)}
        </div>

        <div className="an-grid">
          <div className="an-card">
            <h4>Gráfico</h4>
            {loading ? <div className="an-empty">Cargando…</div>
              : !ch || !ch.values.length ? <div className="an-empty">Sin datos en este período</div>
              : ch.type === 'line' ? <LineChart labels={ch.labels} values={ch.values} />
              : ch.type === 'donut' ? <DonutChart labels={ch.labels} values={ch.values} />
              : <HBarChart labels={ch.labels} values={ch.values} money={report.key === 'utilidades'} />}
          </div>
          <div className="an-card">
            <h4>Detalle</h4>
            <div className="an-sub">{data.rows.length} registros</div>
            <div className="an-tablewrap">
              <table className="an-table">
                <thead><tr>{data.columns.map((c) => <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r, i) => <tr key={i}>{data.columns.map((c) => <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{display(c, r[c.key])}</td>)}</tr>)}
                </tbody>
              </table>
              {!loading && !data.rows.length && <div className="an-empty">Sin resultados</div>}
            </div>
          </div>
        </div>
        {data.nota && <p className="an-note">{data.nota}</p>}
      </div>
    </div>
  );
}

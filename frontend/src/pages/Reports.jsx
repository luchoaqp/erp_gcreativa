import FloatingMenu from '../components/FloatingMenu';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, Plus, Search, Wallet, MoreVertical, X, Trash2, MessageCircle, Paperclip, FileText, Printer
} from 'lucide-react';
import { dashboardAPI, salesAPI, ordersAPI, settingsAPI } from '../api';
import { fmtDate, money, r2 } from '../utils/quotePrint';
import { useCols, ColList, dragProps } from '../utils/columns';
import { buildSaleDocHTML, pdNumber, compNumber, COMP_SHORT, COMP_TITLES, METODOS } from '../utils/docPrint';
import PrintModal from '../components/PrintModal';
import SaleEditModal from '../components/SaleEditModal';
import { entregaLabel, entregaTone } from '../utils/entrega';

const ETAPAS = [
  { id: 'pendiente_diseno', label: 'Pendiente de diseño', bg: '#F1F5F9', color: '#475569' },
  { id: 'pendiente_aprobacion', label: 'Pendiente de aprobación', bg: '#FCE7F3', color: '#BE185D' },
  { id: 'en_produccion', label: 'En producción', bg: '#FEF3C7', color: '#B45309' },
  { id: 'listo', label: 'Listo para despacho', bg: '#EDE9FE', color: '#6D28D9' },
  { id: 'en_ruta', label: 'En ruta con repartidor', bg: '#DBEAFE', color: '#1D4ED8' },
  { id: 'entregado', label: 'Entregado', bg: '#D1FAE5', color: '#047857' }
];
const SALE_COLS = [
  { id: 'num', label: '#' },
  { id: 'emision', label: 'Fecha emisión' },
  { id: 'entrega', label: 'F. de Entrega' },
  { id: 'diseno', label: 'Entrega de diseño' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'total', label: 'Total' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'comprobante', label: 'Comprobante' },
  { id: 'estado', label: 'Estado' },
  { id: 'descarga', label: 'Descarga' },
  { id: 'cotizacion', label: 'Cotización' }
];
const DESTINOS = ['Caja principal', 'Yape', 'Plin', 'POS / Tarjeta', 'Cuenta BCP', 'Cuenta BBVA', 'Cuenta Interbank', 'Cuenta bancaria'];
const DESTINO_POR_METODO = { efectivo: 'Caja principal', yape: 'Yape', plin: 'Plin', tarjeta: 'POS / Tarjeta', transferencia: 'Cuenta bancaria' };

const inputStyle = { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const labelStyle = { fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' };
const btn = (bg, color, extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
  border: '1px solid transparent', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: bg, color, ...extra
});

function Modal({ title, subtitle, icon, onClose, children, width = 760 }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: width, padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#1C2A38' }}>{title}</div>
              {subtitle && <div style={{ fontSize: '12.5px', color: '#788A9B' }}>{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ ...btn('#F1F5F9', '#475569'), padding: '6px' }} aria-label="Cerrar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Reports({ user, onNavigatePOS, initialSearch }) {
  const isAdmin = user?.rol === 'admin';
  const [kpi, setKpi] = useState(null);
  const [sales, setSales] = useState([]);
  const [counts, setCounts] = useState({ todas: 0, pendientes: 0, pagadas: 0, anuladas: 0 });
  const [totals, setTotals] = useState({ total: 0, contabilizado: 0, adelantos: 0, por_cobrar: 0 });
  const [tab, setTab] = useState('todas');
  const [search, setSearch] = useState(initialSearch?.q || '');
  const [periodo, setPeriodo] = useState('todo');
  const [etapa, setEtapa] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState(null); // { id, anchor }
  const [colMenu, setColMenu] = useState(false);
  const colApi = useCols('ventas_cols_v2', SALE_COLS);
  const [paymentsFor, setPaymentsFor] = useState(null);
  const [compFor, setCompFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [cfg, setCfg] = useState({});
  const [store, setStore] = useState({});

  const sym = store.moneda_simbolo || 'S/';

  const loadKpis = async () => {
    try { const r = await dashboardAPI.getStats(); if (r.success) setKpi(r); } catch (e) { /* opcional */ }
  };

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams({ tab, periodo, etapa });
      if (search.trim()) p.set('search', search.trim());
      const res = await salesAPI.list(`?${p}`);
      if (res.success) { setSales(res.sales); setCounts(res.counts); setTotals(res.totals); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [tab, periodo, etapa, search]);

  useEffect(() => {
    loadKpis();
    salesAPI.docConfig().then((r) => { if (r.success) setCfg(r.config); }).catch(() => {});
    settingsAPI.get().then((r) => { if (r.success) setStore(r.settings || {}); }).catch(() => {});
  }, []);
  useEffect(() => { const t = setTimeout(loadSales, 250); return () => clearTimeout(t); }, [loadSales]);

  // Búsqueda lanzada desde la barra superior: muestra todas las ventas que coinciden
  useEffect(() => {
    if (initialSearch && initialSearch.q !== undefined) { setSearch(initialSearch.q); setTab('todas'); setPeriodo('todo'); setEtapa('todas'); }
  }, [initialSearch && initialSearch.n]);

  const refresh = () => { loadSales(); loadKpis(); };

  const changeStage = async (s, next) => {
    try {
      await ordersAPI.updateStatus(s.id, { estado_pedido: next });
      refresh();
    } catch (e) { alert(e.message); refresh(); }
  };

  const openPrint = async (s) => {
    try {
      const res = await salesAPI.getById(s.id);
      if (!res.success) return;
      const sale = res.sale;
      const msgBase = `Hola ${sale.cliente_nombre !== 'Cliente Varios' ? sale.cliente_nombre : ''}, te compartimos el detalle de tu pedido`;
      const docs = [{
        key: 'pedido', label: `Pedido ${pdNumber(sale.id)}`,
        build: (f) => buildSaleDocHTML({ kind: 'pedido', sale, cfg, store, format: f, toolbar: false }),
        message: `${msgBase} ${pdNumber(sale.id)} de ${store.nombre_tienda || 'nuestra tienda'} por ${money(sale.total, sym)}. Pagado: ${money(sale.pagado, sym)}. Saldo: ${money(sale.saldo, sym)}. ¡Gracias por tu preferencia!`
      }];
      sale.comprobantes.filter((c) => c.estado === 'emitido').forEach((c) => docs.push({
        key: `c${c.id}`, label: `${COMP_SHORT[c.tipo]} ${compNumber(c)}`,
        build: (f) => buildSaleDocHTML({ kind: 'comprobante', sale, comprobante: c, cfg, store, format: f, toolbar: false }),
        message: `Hola, te compartimos tu ${COMP_SHORT[c.tipo].toLowerCase()} ${compNumber(c)} de ${store.nombre_tienda || 'nuestra tienda'} por ${money(sale.total, sym)}. ¡Gracias!`
      }));
      setPrintData({ title: `Pedido ${pdNumber(sale.id)}`, docs, phone: sale.cliente_telefono || sale.telefono_destinatario || '' });
    } catch (e) { alert(e.message); }
  };

  const annulSale = async (s) => {
    if (!window.confirm(`¿Anular la venta ${pdNumber(s.id)}? Se anularán sus comprobantes y se devolverá el stock si ya estaba descontado.`)) return;
    try { await salesAPI.annulSale(s.id); refresh(); } catch (e) { alert(e.message); }
  };
  const duplicateSale = async (s) => {
    if (!window.confirm(`¿Duplicar la venta ${pdNumber(s.id)}? Se creará un pedido nuevo (sin pagos ni comprobante) con los mismos productos.`)) return;
    try { const r = await salesAPI.duplicate(s.id); alert(r.message + ` (${pdNumber(r.id)})`); refresh(); } catch (e) { alert(e.message); }
  };
  const annulComp = async (s) => {
    const c = s.comprobantes[0];
    if (!c || !window.confirm(`¿Anular el comprobante ${compNumber(c)}?`)) return;
    try { await salesAPI.annulComprobante(s.id, c.id); refresh(); } catch (e) { alert(e.message); }
  };

  const tabStyle = (active) => ({
    padding: '6px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
    border: active ? '1px solid var(--primary)' : '1px solid transparent', background: active ? 'var(--primary-light)' : 'transparent', color: active ? 'var(--primary)' : '#64748B'
  });
  const kpiCard = (label, value, note, color) => (
    <div style={{ background: '#fff', border: '1px solid #EEF3F0', borderRadius: '12px', padding: '10px 14px', minWidth: 0 }}>
      <div style={{ fontSize: '11.5px', color: '#788A9B', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: 800, color: '#1C2A38', lineHeight: 1.25 }}>{value}</div>
      <div style={{ fontSize: '11px', color }}>{note}</div>
    </div>
  );

  return (
    <div className="content-body animate-fade-in">
      <div className="page-header-responsive" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Ventas</h2>
        </div>
        <div className="header-actions-responsive">
          <button onClick={() => window.print()} style={btn('#fff', '#475569', { border: '1px solid #E2E8F0' })}><Download size={15} /> Imprimir reporte</button>
          {onNavigatePOS && (
            <button onClick={onNavigatePOS} className="btn-primary" style={{ width: 'auto', padding: '8px 18px', fontSize: '13px', borderRadius: '999px' }}>
              <Plus size={15} /><span>Nueva venta</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {kpiCard('Ingresos de hoy', `${sym} ${Number(kpi?.stats?.ventas_hoy || 0).toFixed(2)}`, 'Ventas registradas', '#10B981')}
        {kpiCard('Entregas realizadas', `${kpi?.stats?.entregas_completadas ?? 0} / ${kpi?.stats?.entregas_hoy ?? 0} hoy`, 'Seguimiento de despachos', '#3B82F6')}
        {kpiCard('Clientes registrados', kpi?.stats?.total_clientes ?? 0, 'Base de datos activa', 'var(--primary)')}
        {kpiCard('Por cobrar', `${sym} ${totals.por_cobrar.toFixed(2)}`, `${counts.pendientes} ventas pendientes`, '#B45309')}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '2px', background: '#F8FAFC', border: '1px solid #EEF3F0', borderRadius: '12px', padding: '3px' }}>
          {[['todas', 'Todas'], ['pendientes', 'Pendientes'], ['pagadas', 'Pagadas'], ['anuladas', 'Anuladas']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={tabStyle(tab === id)}>{label} <span style={{ opacity: 0.7 }}>{counts[id]}</span></button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F5F7F8', borderRadius: '10px', padding: '7px 12px', flex: '1 1 220px', maxWidth: '340px' }}>
          <Search size={15} color="#788A9B" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, documento o N° de pedido..."
            style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '8px', fontSize: '13px', width: '100%' }} />
        </div>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="todo">Periodo: todo</option><option value="hoy">Hoy</option><option value="semana">Últimos 7 días</option>
          <option value="mes">Este mes</option><option value="mes_anterior">Mes anterior</option>
        </select>
        <select value={etapa} onChange={(e) => setEtapa(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="todas">Estado: todos</option>
          {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          <option value="cancelado">Anulada</option>
        </select>
      </div>
      <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '10px', lineHeight: 1.7 }}>
        <strong>Total:</strong> {money(totals.total, sym)} <span style={{ margin: '0 6px' }}>•</span>
        <strong>Pagado (con comprobante):</strong> {money(totals.contabilizado, sym)} <span style={{ margin: '0 6px' }}>•</span>
        <span title="Adelantos de pedidos sin comprobante: no se contabilizan"><strong>Adelantos sin comprobante:</strong> {money(totals.adelantos, sym)}</span> <span style={{ margin: '0 6px' }}>•</span>
        <strong>Por cobrar:</strong> {money(totals.por_cobrar, sym)}
      </div>

      {/* Tabla de ventas */}
      <div className="table-responsive-container" style={{ overflow: 'visible' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '11px', color: '#788A9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {colApi.cols.map((c) => (
                  <th key={c.id} {...dragProps(colApi, c.id)} style={{ padding: '10px 8px', textAlign: c.id === 'total' ? 'right' : 'left', cursor: 'grab' }}>{c.label}</th>
                ))}
                <th style={{ padding: '10px 8px', textAlign: 'right', position: 'relative' }}>
                  <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }} title="Elegir columnas" aria-label="Elegir columnas"
                    style={{ padding: '2px', background: 'transparent', cursor: 'pointer', color: '#1C2A38' }}><Plus size={20} /></button>
                  {colMenu && (
                    <FloatingMenu anchor={colMenu} onClose={() => setColMenu(false)} keepOpen width={250}><ColList api={colApi} /></FloatingMenu>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => {
                const anulada = s.estado_pedido === 'cancelado';
                const et = ETAPAS.find((e) => e.id === s.estado_pedido);
                const comp = s.comprobantes[0];
                const cells = {
                    num: (<td key="num" style={{ padding: '9px 8px', color: '#94A3B8' }}>{i + 1}</td>),
                    emision: (<td key="emision" style={{ padding: '9px 8px' }}>{fmtDate(s.fecha_pedido)}<div style={{ fontSize: '11px', color: '#94A3B8' }}>{pdNumber(s.id)}</div></td>),
                    entrega: (<td key="entrega" style={{ padding: '9px 8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', background: entregaTone(s.fecha_entrega, s.tipo_entrega).bg, color: entregaTone(s.fecha_entrega, s.tipo_entrega).color, whiteSpace: 'nowrap' }}>
                        {entregaLabel(s.fecha_entrega, s.tipo_entrega)}
                      </span>
                      {s.tipo_entrega === 'envio' && s.ciudad_envio && <div style={{ fontSize: '11px', color: '#1D4ED8' }}>Envío a {s.ciudad_envio}</div>}
                    </td>),
                    diseno: (<td key="diseno" style={{ padding: '9px 8px' }}>
                      {s.fecha_entrega_diseno ? (
                        <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', background: entregaTone(s.fecha_entrega_diseno, 'tienda').bg, color: entregaTone(s.fecha_entrega_diseno, 'tienda').color, whiteSpace: 'nowrap' }}>
                          {entregaLabel(s.fecha_entrega_diseno, 'tienda')}
                        </span>
                      ) : '—'}
                    </td>),
                    cliente: (<td key="cliente" style={{ padding: '9px 8px' }}><strong style={{ fontWeight: 800, color: '#0F172A' }}>{s.cliente_nombre}</strong><div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.cliente_documento || s.cliente_telefono || '—'}</div></td>),
                    total: (<td key="total" style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>{money(s.total, sym)}</td>),
                    pagos: (<td key="pagos" style={{ padding: '9px 8px' }}>
                      <button onClick={() => setPaymentsFor(s)} title="Gestionar pagos"
                        style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          border: `1px solid ${s.saldo <= 0.009 ? '#A7F3D0' : '#FDE68A'}`, background: s.saldo <= 0.009 ? '#ECFDF5' : '#FFFBEB', color: s.saldo <= 0.009 ? '#047857' : '#B45309' }}>
                        {s.saldo <= 0.009 ? '● Pagado' : `● Pendiente ${sym} ${s.saldo.toFixed(2)}`}
                      </button>
                    </td>),
                    comprobante: (<td key="comprobante" style={{ padding: '9px 8px', fontWeight: 700 }}>
                      {comp ? (
                        <button onClick={() => openPrint(s)} style={{ ...btn('#F5F3FF', '#6D28D9'), padding: '3px 9px', fontSize: '12px' }} title={COMP_TITLES[comp.tipo]}>{compNumber(comp)}</button>
                      ) : anulada ? '—' : s.saldo > 0.009 ? (
                        <span title="El pedido debe estar cancelado (pagado en su totalidad) para generar el comprobante" style={{ fontSize: '11.5px', fontWeight: 600, color: '#94A3B8' }}>Pendiente de pago</span>
                      ) : (
                        <button onClick={() => setCompFor(s)} style={{ ...btn('#fff', '#475569', { border: '1px dashed #CBD5E1' }), padding: '3px 9px', fontSize: '12px' }}>+ Generar</button>
                      )}
                    </td>),
                    estado: (<td key="estado" style={{ padding: '9px 8px' }}>
                      {anulada ? (
                        <span style={{ background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: '12px', padding: '4px 10px', borderRadius: '999px' }}>Anulada</span>
                      ) : (
                        <select value={s.estado_pedido} onChange={(e) => changeStage(s, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '999px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', background: et?.bg, color: et?.color }}>
                          {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                        </select>
                      )}
                    </td>),
                    descarga: (<td key="descarga" style={{ padding: '9px 8px' }}>
                      <button onClick={() => openPrint(s)} style={{ ...btn('#F5F3FF', '#6D28D9'), padding: '4px 10px', fontSize: '12px' }}><FileText size={13} /> PDF</button>
                    </td>),
                    cotizacion: (<td key="cotizacion" style={{ padding: '9px 8px', fontWeight: 600 }}>{s.cotizacion_numero || '—'}</td>),
                };
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid #EEF3F0', fontSize: '13px', opacity: anulada ? 0.6 : 1 }}>
                    {colApi.cols.map((c) => cells[c.id])}
                    <td style={{ padding: '9px 8px', position: 'relative', textAlign: 'right' }}>
                      <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuFor(menuFor?.id === s.id ? null : { id: s.id, anchor: r }); }} style={{ padding: '4px', borderRadius: '8px', background: 'transparent' }} aria-label="Acciones"><MoreVertical size={16} /></button>
                      {menuFor?.id === s.id && (
                        <FloatingMenu anchor={menuFor.anchor} onClose={() => setMenuFor(null)} width={220}>
                          {[
                            { label: 'Ver / imprimir pedido', on: () => openPrint(s), show: true },
                            { label: 'Gestionar pagos', on: () => setPaymentsFor(s), show: !anulada },
                            { label: 'Generar comprobante', on: () => setCompFor(s), show: !anulada && !comp && s.saldo <= 0.009 },
                            { label: 'Editar venta', on: () => setEditFor(s), show: isAdmin && !anulada && !comp },
                            { label: 'Duplicar venta', on: () => duplicateSale(s), show: !anulada },
                            { label: 'Anular comprobante', on: () => annulComp(s), show: isAdmin && !!comp, danger: true },
                            { label: 'Anular venta', on: () => annulSale(s), show: isAdmin && !anulada, danger: true }
                          ].filter((x) => x.show).map((x) => (
                            <button key={x.label} onClick={x.on} style={x.danger ? { color: '#B91C1C' } : undefined}>{x.label}</button>
                          ))}
                        </FloatingMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && sales.length === 0 && (
                <tr><td colSpan={13} style={{ padding: '36px', textAlign: 'center', color: '#788A9B' }}>No hay ventas con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentsFor && (
        <PaymentsModal sale={paymentsFor} isAdmin={isAdmin} sym={sym} store={store}
          onClose={() => { setPaymentsFor(null); refresh(); }} onChanged={refresh} />
      )}
      {compFor && (
        <ComprobanteModal sale={compFor} cfg={cfg} store={store} onClose={() => setCompFor(null)}
          onDone={(yaMostrado) => { const s = compFor; setCompFor(null); refresh(); if (!yaMostrado) openPrint(s); }} />
      )}
      {editFor && <SaleEditModal saleId={editFor.id} sym={sym} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); refresh(); }} />}
      {printData && <PrintModal title={printData.title} docs={printData.docs} phone={printData.phone} onClose={() => setPrintData(null)} />}
    </div>
  );
}

/* ------------------------------ Pagos ------------------------------ */
export function PaymentsModal({ sale, isAdmin, sym, store, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ fecha: new Date().toLocaleDateString('en-CA'), metodo: '', destino: '', referencia: '', monto: '', comprobante_url: '', archivo: '' });

  const load = async () => {
    try { const r = await salesAPI.getById(sale.id); if (r.success) { setD(r.sale); setF((p) => ({ ...p, monto: r.sale.saldo > 0 ? r.sale.saldo.toFixed(2) : '' })); } }
    catch (e) { alert(e.message); }
  };
  useEffect(() => { load(); }, []);

  const setMetodo = (m) => setF((p) => ({ ...p, metodo: m, destino: DESTINO_POR_METODO[m] || p.destino }));
  const onFile = (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('El archivo no puede pesar más de 3 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setF((p) => ({ ...p, comprobante_url: reader.result, archivo: file.name }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!f.metodo) { alert('Elige el método de pago.'); return; }
    try {
      setBusy(true);
      await salesAPI.addPayment(sale.id, { fecha: f.fecha, metodo: f.metodo, destino: f.destino, referencia: f.referencia, monto: Number(f.monto), comprobante_url: f.comprobante_url || undefined });
      setAdding(false);
      setF((p) => ({ ...p, metodo: '', destino: '', referencia: '', comprobante_url: '', archivo: '' }));
      await load();
      onChanged();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const del = async (p) => {
    if (!window.confirm(`¿Eliminar el pago de ${sym} ${Number(p.monto).toFixed(2)}?`)) return;
    try { await salesAPI.deletePayment(sale.id, p.id); await load(); onChanged(); } catch (e) { alert(e.message); }
  };
  const remind = () => {
    let phone = String(d.cliente_telefono || d.telefono_destinatario || '').replace(/\D/g, '');
    if (phone.length === 9) phone = '51' + phone;
    const msg = `Hola ${d.cliente_nombre !== 'Cliente Varios' ? d.cliente_nombre : ''}, te recordamos el saldo pendiente de ${sym} ${d.saldo.toFixed(2)} de tu pedido ${pdNumber(d.id)} en ${store.nombre_tienda || 'nuestra tienda'}. Puedes pagarlo por Yape/Plin o transferencia. ¡Gracias!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!d) return null;
  const anulada = d.estado_pedido === 'cancelado';
  return (
    <Modal title={`Pagos · ${pdNumber(d.id)}`} icon={<Wallet size={20} />} onClose={onClose} width={820}
      subtitle={`Pagado ${d.pagado.toFixed(2)} de ${Number(d.total).toFixed(2)} · pendiente ${d.saldo.toFixed(2)}`}>
      <div style={{ border: '1px solid #EEF3F0', borderRadius: '12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ fontSize: '11px', color: '#788A9B', textTransform: 'uppercase', textAlign: 'left', background: '#F8FAFC' }}>
              {['Pago', 'Fecha', 'Método', 'Destino', 'Referencia', 'Monto', ''].map((h, i) => <th key={i} style={{ padding: '10px 10px', textAlign: h === 'Monto' ? 'right' : 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {d.pagos.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #EEF3F0' }}>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>PAGO-{String(p.id).padStart(6, '0')}</td>
                <td style={{ padding: '9px 10px' }}>{fmtDate(p.fecha)}</td>
                <td style={{ padding: '9px 10px' }}>{METODOS[p.metodo] || p.metodo}</td>
                <td style={{ padding: '9px 10px' }}>{p.destino || '—'}</td>
                <td style={{ padding: '9px 10px' }}>{p.referencia || '—'} {p.comprobante_url && <a href={p.comprobante_url} target="_blank" rel="noreferrer" title="Ver comprobante adjunto"><Paperclip size={13} /></a>}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{Number(p.monto).toFixed(2)}</td>
                <td style={{ padding: '9px 6px' }}>{isAdmin && <button onClick={() => del(p)} style={{ color: '#DC2626', background: 'transparent' }} title="Eliminar pago"><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
            {d.pagos.length === 0 && <tr><td colSpan={7} style={{ padding: '18px', textAlign: 'center', color: '#94A3B8' }}>Aún no hay pagos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      {!anulada && d.saldo > 0.009 && !adding && (
        <button onClick={() => setAdding(true)} className="btn-primary" style={{ width: 'auto', padding: '9px 16px', borderRadius: '12px', marginTop: '12px', fontSize: '13px' }}><Plus size={15} /> Nuevo pago</button>
      )}
      {d.saldo <= 0.009 && !anulada && <div style={{ marginTop: '12px', color: '#047857', fontWeight: 700, fontSize: '13px' }}>✔ Pedido cancelado (pagado por completo). Ya puede salir a ruta y generar su comprobante.</div>}

      {adding && (
        <div style={{ border: '1px solid #EEF3F0', background: '#FCFCFD', borderRadius: '12px', padding: '14px', marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            <div><label style={labelStyle}>Fecha</label><input type="date" style={inputStyle} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
            <div><label style={labelStyle}>Método de pago</label>
              <select style={inputStyle} value={f.metodo} onChange={(e) => setMetodo(e.target.value)}>
                <option value="">Elige el método</option>
                {Object.entries(METODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label style={labelStyle}>Destino</label>
              <input style={inputStyle} list="destinos-pago" value={f.destino} placeholder="Caja o cuenta" onChange={(e) => setF({ ...f, destino: e.target.value })} />
              <datalist id="destinos-pago">{DESTINOS.map((x) => <option key={x} value={x} />)}</datalist></div>
            <div><label style={labelStyle}>Referencia</label><input style={inputStyle} value={f.referencia} placeholder="N° de operación" onChange={(e) => setF({ ...f, referencia: e.target.value })} /></div>
            <div><label style={labelStyle}>Monto (saldo {d.saldo.toFixed(2)})</label><input type="number" min="0" step="0.01" style={inputStyle} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></div>
            <div><label style={labelStyle}>Comprobante (opcional)</label>
              <label style={{ ...inputStyle, display: 'block', cursor: 'pointer', color: f.archivo ? '#1C2A38' : '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.archivo || 'Seleccionar archivo'}
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files[0])} />
              </label></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button onClick={() => setAdding(false)} style={btn('#F1F5F9', '#475569')}>Cancelar</button>
            <button onClick={save} disabled={busy} className="btn-primary" style={{ width: 'auto', padding: '8px 18px', borderRadius: '10px', fontSize: '13px' }}>{busy ? 'Guardando...' : 'Registrar pago'}</button>
          </div>
        </div>
      )}

      {d.saldo > 0.009 && !anulada && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', borderTop: '1px solid #EEF3F0', paddingTop: '12px' }}>
          <button onClick={remind} style={btn('#ECFDF5', '#047857', { border: '1px solid #A7F3D0' })}><MessageCircle size={15} /> Recordar pago</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------- Comprobante ---------------------------- */
export function ComprobanteModal({ sale, cfg = {}, store = {}, onClose, onDone }) {
  const [f, setF] = useState({
    tipo: 'nota_venta', doc_numero: sale.cliente_documento || '',
    razon_social: sale.cliente_nombre !== 'Cliente Varios' ? sale.cliente_nombre : '', direccion: '',
    cliente_telefono: sale.cliente_telefono || sale.telefono_destinatario || ''
  });
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(null);
  const [preview, setPreview] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [hadDraft, setHadDraft] = useState(false);
  const [emitido, setEmitido] = useState(null); // comprobante ya generado desde la vista previa
  useEffect(() => {
    salesAPI.getById(sale.id).then((r) => {
      if (!r.success) return;
      setFull(r.sale);
      const v = r.sale;
      setF((p) => ({
        ...p, doc_numero: p.doc_numero || v.cliente_documento || '',
        razon_social: p.razon_social || (v.cliente_nombre !== 'Cliente Varios' ? v.cliente_nombre : ''),
        cliente_telefono: p.cliente_telefono || v.cliente_telefono || v.telefono_destinatario || ''
      }));
      try { const d = v.comprobante_borrador && JSON.parse(v.comprobante_borrador); if (d) { setF((p) => ({ ...p, ...d })); setHadDraft(true); } } catch (e) { /* borrador inválido */ }
    }).catch(() => {});
  }, [sale.id]);
  const validar = () => {
    if (f.tipo !== 'factura' && !f.razon_social.trim() && !String(f.cliente_telefono).trim()) { alert('Indica al menos el nombre o el teléfono del cliente.'); return false; }
    if (f.tipo === 'factura' && (!/^\d{11}$/.test(String(f.doc_numero).trim()) || !f.razon_social.trim())) { alert('La factura requiere un RUC de 11 dígitos y la razón social.'); return false; }
    const d = String(f.doc_numero).trim();
    if (f.tipo !== 'factura' && d && !/^(\d{8}|\d{11})$/.test(d)) { alert('El documento debe ser un DNI (8 dígitos) o RUC (11 dígitos).'); return false; }
    return true;
  };
  const verPrevia = () => { if (validar()) { setDraftMsg(''); setPreview(true); } };
  const emitir = async (desdePrevia = false) => {
    try {
      setBusy(true); await salesAPI.createComprobante(sale.id, f);
      if (!desdePrevia) { onDone(); return; }
      const r = await salesAPI.getById(sale.id);
      const c = r.success ? [...r.sale.comprobantes].reverse().find((x) => x.estado === 'emitido') : null;
      if (!c) { onDone(); return; }
      setFull(r.sale); setEmitido(c);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const guardarBorrador = async () => {
    try { setBusy(true); await salesAPI.saveComprobanteDraft(sale.id, f); setDraftMsg('Borrador guardado. Podrás retomarlo desde "Generar comprobante".'); setHadDraft(true); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  if (preview) {
    const base = full || sale;
    const comp = { ...f, borrador: true, doc_tipo: /^\d{11}$/.test(String(f.doc_numero).trim()) ? 'RUC' : /^\d{8}$/.test(String(f.doc_numero).trim()) ? 'DNI' : null, fecha: new Date().toISOString() };
    const sym = store.moneda_simbolo || 'S/';
    const docs = [{ key: 'previa', label: emitido ? `${COMP_SHORT[emitido.tipo]} ${compNumber(emitido)}` : 'Vista previa',
      build: (fm) => buildSaleDocHTML({ kind: 'comprobante', sale: base, comprobante: emitido || comp, cfg, store, format: fm, toolbar: false }),
      message: emitido ? `Hola, te compartimos tu ${COMP_SHORT[emitido.tipo].toLowerCase()} ${compNumber(emitido)} por ${money(base.total, sym)}. ¡Gracias!` : `Vista previa por ${money(base.total, sym)}` }];
    const bt = (bg, color, extra) => ({ padding: '11px', borderRadius: '12px', fontSize: '14px', fontWeight: 800, background: bg, color, border: 'none', cursor: busy ? 'wait' : 'pointer', ...extra });
    const actions = emitido ? (
      <div style={{ display: 'grid', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
        <button disabled style={bt('#DCFCE7', '#15803D', { cursor: 'default' })}>✓ Comprobante generado · {compNumber(emitido)}</button>
        <button onClick={() => onDone(true)} style={bt('#F1F5F9', '#475569')}>Cerrar</button>
      </div>
    ) : (
      <div style={{ display: 'grid', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: '12px', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '8px 10px' }}>
          Revisa los datos: una vez generado, el comprobante <strong>no se puede editar</strong> (solo anular).
        </div>
        <button disabled={busy} onClick={() => emitir(true)} style={bt('#16A34A', '#fff')}>{busy ? 'Generando…' : 'Generar comprobante'}</button>
        <button disabled={busy} onClick={guardarBorrador} style={bt('#FFF7ED', '#C2410C', { border: '1px solid #FED7AA' })}>Guardar borrador</button>
        <button disabled={busy} onClick={() => setPreview(false)} style={bt('#F1F5F9', '#475569')}>← Volver y editar</button>
        {draftMsg && <div style={{ fontSize: '12px', color: '#15803D', fontWeight: 600 }}>{draftMsg}</div>}
      </div>
    );
    return <PrintModal title={emitido ? `${COMP_SHORT[emitido.tipo]} ${compNumber(emitido)}` : `Vista previa · ${COMP_SHORT[f.tipo]} de ${pdNumber(sale.id)}`}
      subtitle={emitido ? 'Comprobante emitido: ya puedes imprimirlo o descargarlo en PDF' : 'Aún no se ha emitido: genera el comprobante o guarda un borrador'}
      docs={docs} showWhatsApp={!!emitido} phone={f.cliente_telefono} actions={actions} onClose={() => (emitido ? onDone(true) : setPreview(false))} />;
  }
  return (
    <Modal title={`Generar comprobante · ${pdNumber(sale.id)}`} icon={<Printer size={20} />} onClose={onClose} width={560}
      subtitle="Registro interno con fines de control; no se envía a SUNAT.">
      {hadDraft && <div style={{ fontSize: '12px', color: '#C2410C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '7px 10px', marginBottom: '10px' }}>Se cargó el borrador guardado de esta venta.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        <div><label style={labelStyle}>Tipo de comprobante</label>
          <select style={inputStyle} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="nota_venta">Nota de venta (NV01)</option><option value="boleta">Boleta (B001)</option><option value="factura">Factura (F001)</option>
          </select></div>
        <div><label style={labelStyle}>{f.tipo === 'factura' ? 'RUC (obligatorio)' : 'DNI o RUC (opcional)'}</label>
          <input style={inputStyle} value={f.doc_numero} onChange={(e) => setF({ ...f, doc_numero: e.target.value })} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>{f.tipo === 'factura' ? 'Razón social' : 'Nombre del cliente'}</label>
          <input style={inputStyle} value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Teléfono del cliente (nombre o teléfono es obligatorio)</label>
          <input style={inputStyle} value={f.cliente_telefono} onChange={(e) => setF({ ...f, cliente_telefono: e.target.value })} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Dirección (opcional)</label>
          <input style={inputStyle} value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button onClick={onClose} style={btn('#F1F5F9', '#475569')}>Cancelar</button>
        <button onClick={verPrevia} disabled={busy} style={btn('#FFF7ED', '#C2410C', { border: '1px solid #FED7AA', padding: '10px 16px', borderRadius: '12px', fontSize: '14px' })}>Vista previa</button>
        <button onClick={() => { if (validar()) emitir(false); }} disabled={busy} className="btn-primary" style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px' }}>{busy ? 'Generando...' : 'Generar comprobante'}</button>
      </div>
    </Modal>
  );
}

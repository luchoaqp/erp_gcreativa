import FloatingMenu from '../components/FloatingMenu';
import { DocInfoFields, pickDocInfo } from '../components/DocInfoFields';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Eye, Printer, Receipt, MessageCircle, Pencil,
  ShoppingCart, Ban, X, Settings, Upload, Trash2, Package, Check, Copy, Download
} from 'lucide-react';
import { descargarPDF } from '../utils/pdf';
import { precioPorCantidad } from '../utils/precios';
import { quotesAPI, productsAPI, customersAPI, settingsAPI } from '../api';
import { buildQuoteHTML, getDisplay, fmtDate, money, r2, adelantoMinimo } from '../utils/quotePrint';
import PrintModal from '../components/PrintModal';
import { useCols, ColList, dragProps } from '../utils/columns';
import DeliveryFields, { entregaPayload, ChargesPicker, emptyDelivery, sumCargos, parseCargosJson, useCharges } from '../components/DeliveryFields';

const ESTADOS = {
  vigente: { label: 'Vigente', bg: '#E0F2FE', color: '#0369A1' },
  aceptada: { label: 'Convertida', bg: '#D1FAE5', color: '#047857' },
  vencida: { label: 'Vencida', bg: '#FEF3C7', color: '#B45309' },
  anulada: { label: 'Anulada', bg: '#F1F5F9', color: '#64748B' }
};

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '10px',
  fontSize: '13.5px', outline: 'none', background: '#fff', boxSizing: 'border-box'
};
const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block' };
const btn = (bg, color, extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 14px',
  borderRadius: '10px', border: '1px solid transparent', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
  background: bg, color, ...extra
});

function Modal({ title, icon, onClose, children, width = 760 }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: width, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 800, color: '#1C2A38' }}>
            {icon}{title}
          </div>
          <button onClick={onClose} style={{ ...btn('#F1F5F9', '#475569'), padding: '6px' }} aria-label="Cerrar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Badge = ({ estado }) => {
  const e = ESTADOS[estado] || ESTADOS.vigente;
  return <span style={{ background: e.bg, color: e.color, fontWeight: 700, fontSize: '11.5px', padding: '4px 10px', borderRadius: '999px' }}>{e.label}</span>;
};

const QUOTE_COLS = [
  { id: 'numero', label: 'N°', always: true },
  { id: 'fecha', label: 'Fecha' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'vigencia', label: 'Vigencia' },
  { id: 'estado', label: 'Estado' },
  { id: 'total', label: 'Total' },
  { id: 'pdf', label: 'PDF', always: true }
];

export default function Quotes({ user, onConverted, nuevaCotizacion = 0 }) {
  const [quotes, setQuotes] = useState([]);
  const colApi = useCols('cotizaciones_cols_v1', QUOTE_COLS);
  const [colMenu, setColMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [cfg, setCfg] = useState({});
  const [store, setStore] = useState({});
  const [formFor, setFormFor] = useState(null);      // null | 'new' | quote completo (editar)
  const [detail, setDetail] = useState(null);        // quote completo
  const [convertFor, setConvertFor] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [printFor, setPrintFor] = useState(null);   // cotización a imprimir (A4 / A5 / Ticket)

  const isAdmin = user?.rol === 'admin';

  const loadList = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (estado !== 'todos') params.set('estado', estado);
      const res = await quotesAPI.getAll(params.toString() ? `?${params}` : '');
      if (res.success) setQuotes(res.quotes);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadConfig = async () => {
    try {
      const [c, s] = await Promise.all([quotesAPI.getConfig(), settingsAPI.get()]);
      if (c.success) setCfg(c.config);
      if (s.success) setStore(s.settings || {});
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadConfig(); }, []);
  // "Nueva Cotización" desde el encabezado (en cualquier pantalla): abre el formulario
  useEffect(() => { if (nuevaCotizacion) setFormFor((cur) => cur || 'new'); }, [nuevaCotizacion]);
  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [search, estado]);

  const openDetail = async (id) => {
    try {
      const res = await quotesAPI.getById(id);
      if (res.success) setDetail(res.quote);
    } catch (e) { alert(e.message); }
  };

  // Columna PDF: descargar directo (A4) o abrir para imprimir
  const [bajando, setBajando] = useState(null);
  const descargar = async (q) => {
    setBajando(q.id);
    try {
      const res = await quotesAPI.getById(q.id);
      if (res.success) await descargarPDF(buildQuoteHTML(res.quote, cfg, store, 'a4', { toolbar: false }), 'a4');
    } catch (e) { alert('No se pudo generar el PDF: ' + e.message); } finally { setBajando(null); }
  };
  const imprimir = async (q) => {
    try { const res = await quotesAPI.getById(q.id); if (res.success) setPrintFor(res.quote); } catch (e) { alert(e.message); }
  };

  const startEdit = async (id) => {
    try {
      const res = await quotesAPI.getById(id);
      if (res.success) { setDetail(null); setFormFor(res.quote); }
    } catch (e) { alert(e.message); }
  };

  const annul = async (q) => {
    const conv = q.estado_efectivo === 'aceptada';
    if (!window.confirm(`¿Anular la cotización ${q.numero}? Esta acción no se puede deshacer.${conv ? '\n\nLa venta/pedido ya generado NO se anula; se mantiene tal cual.' : ''}`)) return;
    try {
      await quotesAPI.annul(q.id);
      setDetail(null);
      loadList();
    } catch (e) { alert(e.message); }
  };

  const sendWhatsApp = (q) => {
    let phone = String(q.cliente_telefono || '').replace(/\D/g, '');
    if (phone.length === 9) phone = '51' + phone;
    const sym = store.moneda_simbolo || 'S/';
    const msg = `Hola ${q.cliente_nombre !== 'Cliente Varios' ? q.cliente_nombre : ''}, te compartimos la cotización ${q.numero} de ${store.nombre_tienda || 'nuestra tienda'} por ${money(q.total, sym)}, válida hasta el ${fmtDate(q.fecha_vencimiento)}. ¡Quedamos atentos!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sym = store.moneda_simbolo || 'S/';
  const renderCell = (id, q) => {
    switch (id) {
      case 'numero': return q.numero;
      case 'fecha': return fmtDate(q.fecha);
      case 'cliente': return q.cliente_nombre;
      case 'vendedor': return q.vendedor_nombre || '-';
      case 'vigencia': return fmtDate(q.fecha_vencimiento);
      case 'estado': return <Badge estado={q.estado_efectivo} />;
      case 'total': return money(q.total, sym);
      case 'pdf': return (
        <span style={{ display: 'inline-flex', gap: '6px' }}>
          <button type="button" onClick={() => descargar(q)} disabled={bajando === q.id} title={`Descargar ${q.numero}.pdf`}
            style={btn('var(--primary-light)', 'var(--primary)', { padding: '6px 10px', fontSize: '12px', fontWeight: 800, cursor: bajando === q.id ? 'wait' : 'pointer' })}>
            <Download size={14} /> {bajando === q.id ? '…' : 'PDF'}
          </button>
          <button type="button" onClick={() => imprimir(q)} title="Imprimir (A4, A5 o ticket)" aria-label={`Imprimir ${q.numero}`} style={btn('#F1F5F9', '#475569', { padding: '6px' })}><Printer size={14} /></button>
        </span>
      );
      default: return '';
    }
  };

  return (
    <div className="content-body animate-fade-in">
      <div className="page-header-responsive">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Cotizaciones</h2>
          </div>
          <div style={{ fontSize: '13px', color: '#788A9B', marginTop: '2px' }}>
            Presupuestos para tus clientes con vigencia; conviértelos en venta con un clic
          </div>
        </div>
        <div className="header-actions-responsive">
          {isAdmin && (
            <button onClick={() => setShowCfg(true)} style={btn('#fff', '#475569', { border: '1px solid #E2E8F0' })}>
              <Settings size={16} /> Plantilla
            </button>
          )}
          <button onClick={() => setFormFor('new')} className="btn-primary" style={{ width: 'auto', padding: '9px 18px', fontSize: '13px', borderRadius: '999px' }}>
            <Plus size={16} /><span>Nueva cotización</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F5F7F8', borderRadius: '10px', padding: '8px 14px', flex: '1 1 260px', maxWidth: '420px' }}>
          <Search size={16} color="#788A9B" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente o N° de cotización..."
            style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '8px', fontSize: '13px', width: '100%' }} />
        </div>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="todos">Estado: todos</option>
          <option value="vigente">Vigentes</option>
          <option value="vencida">Vencidas</option>
          <option value="aceptada">Convertidas</option>
          <option value="anulada">Anuladas</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: 6 }}>
        <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }} style={btn('#fff', '#475569', { border: '1px solid #E2E8F0', padding: '6px 12px', fontSize: '12.5px' })}>Columnas</button>
        {colMenu && (
          <FloatingMenu anchor={colMenu} onClose={() => setColMenu(false)} keepOpen width={250}><ColList api={colApi} /></FloatingMenu>
        )}
      </div>

      <div className="table-responsive-container">
        <table>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: '11.5px', color: '#788A9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {colApi.cols.map((c) => (
                <th key={c.id} {...dragProps(colApi, c.id)} style={{ padding: '14px 12px', textAlign: c.id === 'total' ? 'right' : 'left', cursor: 'grab' }}>{c.label}</th>
              ))}
              <th style={{ padding: '14px 12px' }} />
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} style={{ borderTop: '1px solid #EEF3F0', fontSize: '13.5px' }}>
                {colApi.cols.map((c) => <td key={c.id} style={{ padding: '14px 12px', ...(c.id === 'numero' ? { fontWeight: 800 } : {}), ...(c.id === 'total' ? { textAlign: 'right', fontWeight: 800 } : {}) }}>{renderCell(c.id, q)}</td>)}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button onClick={() => openDetail(q.id)} style={btn('#F1F5F9', '#475569', { padding: '7px' })} title="Ver detalle"><Eye size={16} /></button>
                </td>
              </tr>
            ))}
            {!loading && quotes.length === 0 && (
              <tr><td colSpan={colApi.cols.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#788A9B' }}>
                Aún no hay cotizaciones. Crea la primera con “Nueva cotización”.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {formFor && (
        <QuoteForm
          initial={formFor === 'new' ? null : formFor}
          cfg={cfg}
          store={store}
          sym={sym}
          onClose={() => setFormFor(null)}
          onSaved={(id) => { setFormFor(null); loadList(); openDetail(id); }}
        />
      )}

      {detail && (
        <Modal title={detail.numero} icon={<FileText size={20} color="var(--primary)" />} onClose={() => setDetail(null)} width={940}>
          <DetailView
            q={detail} sym={sym}
            onPrint={() => setPrintFor(detail)}
            onWhatsApp={() => sendWhatsApp(detail)}
            onEdit={() => startEdit(detail.id)}
            onConvert={() => { setConvertFor(detail); setDetail(null); }}
            onAnnul={() => annul(detail)}
            onDuplicate={() => { setFormFor({ ...detail, __duplicate: true }); setDetail(null); }}
            onClose={() => setDetail(null)}
          />
        </Modal>
      )}

      {convertFor && (
        <ConvertModal
          q={convertFor}
          onClose={() => setConvertFor(null)}
          onDone={() => { setConvertFor(null); loadList(); if (onConverted) onConverted(); }}
        />
      )}

      {printFor && (
        <PrintModal
          title={`Cotización ${printFor.numero}`}
          phone={printFor.cliente_telefono || ''}
          docs={[{
            key: 'cot', label: `Cotización ${printFor.numero}`,
            build: (f) => buildQuoteHTML(printFor, cfg, store, f, { toolbar: false }),
            message: `Hola ${printFor.cliente_nombre !== 'Cliente Varios' ? printFor.cliente_nombre : ''}, te compartimos la cotización ${printFor.numero} de ${store.nombre_tienda || 'nuestra tienda'} por ${money(printFor.total, sym)}, válida hasta el ${fmtDate(printFor.fecha_vencimiento)}. ¡Quedamos atentos!`
          }]}
          onClose={() => setPrintFor(null)}
        />
      )}

      {showCfg && (
        <ConfigModal cfg={cfg} onClose={() => setShowCfg(false)} onSaved={(c) => { setCfg(c); setShowCfg(false); }} />
      )}
    </div>
  );
}

/* ------------------------------ Detalle ------------------------------ */
function DetailView({ q, sym, onPrint, onWhatsApp, onEdit, onConvert, onAnnul, onDuplicate, onClose }) {
  const d = getDisplay(q);
  const open = q.estado_efectivo === 'vigente';
  const editable = q.estado_efectivo === 'vigente' || q.estado_efectivo === 'vencida';
  const anulable = editable || q.estado_efectivo === 'aceptada';
  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <div style={{ flex: '1 1 480px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ color: '#64748B', fontSize: '13px' }}>
          {q.cliente_nombre}{q.cliente_telefono ? ` · ${q.cliente_telefono}` : ''} · válida hasta {fmtDate(q.fecha_vencimiento)}
          {q.pedido_numero ? ` · Pedido ${q.pedido_numero}` : ''}
        </div>
        <Badge estado={q.estado_efectivo} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
          <thead>
            <tr style={{ fontSize: '11.5px', color: '#64748B', textTransform: 'uppercase', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Producto</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Cant.</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>P.U. {d.mode === 'incluido' ? '(c/IGV)' : '(sin IGV)'}</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid #EEF3F0', fontSize: '13.5px' }}>
                <td style={{ padding: '10px 8px' }}>{l.descripcion}{l.detalle && <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'pre-line', marginTop: '3px' }}>{l.detalle}</div>}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{l.cantidad}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{l.pu.toFixed(2)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{l.importe.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginLeft: 'auto', maxWidth: '280px', marginTop: '12px', fontSize: '13.5px' }}>
        {d.mode === 'desglosado' && <Row a="Subtotal" b={money(d.subtotal, sym)} />}
        {d.mode === 'desglosado' && <Row a={`IGV (${d.pct}%)`} b={money(d.igv, sym)} />}
        {d.cargos.length > 0
          ? d.cargos.map((c) => <Row key={c.nombre} a={c.nombre} b={money(c.monto, sym)} />)
          : d.envio > 0 && <Row a="Envío" b={money(d.envio, sym)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '19px', fontWeight: 800, marginTop: '6px', borderTop: '2px solid #1C2A38', paddingTop: '8px' }}>
          <span>Total</span><span>{money(d.total, sym)}</span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#788A9B', textAlign: 'right', marginTop: '4px' }}>{d.leyenda}</div>
      </div>
      {q.nota && <div style={{ marginTop: '12px', background: '#F8FAFC', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap' }}>{q.nota}</div>}
    </div>

    <div style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'sticky', top: 0, marginLeft: 'auto' }}>
      {open && (
        <button onClick={onConvert} className="btn-primary" style={{ width: '100%', padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
          <ShoppingCart size={17} /> Convertir en venta
        </button>
      )}
      <button onClick={onPrint} style={btn('#fff', '#1C2A38', { border: '1px solid #E2E8F0', justifyContent: 'center' })}><Printer size={16} /> Imprimir / PDF</button>
      <button onClick={onWhatsApp} style={btn('#25D366', '#fff', { justifyContent: 'center' })}><MessageCircle size={16} /> WhatsApp</button>
      {editable && <button onClick={onEdit} style={btn('#F1F5F9', '#334155', { justifyContent: 'center' })}><Pencil size={16} /> Editar</button>}
      <button onClick={onDuplicate} style={btn('#F1F5F9', '#334155', { justifyContent: 'center' })} title="Crea una cotización nueva con los mismos datos"><Copy size={16} /> Duplicar</button>
      {anulable && <button onClick={onAnnul} style={btn('#FEF2F2', '#B91C1C', { justifyContent: 'center' })} title="Anular"><Ban size={16} /> Anular</button>}
      <button onClick={onClose} style={btn('#F1F5F9', '#475569', { justifyContent: 'center' })}>Cerrar</button>
    </div>
    </div>
  );
}

const Row = ({ a, b }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569' }}><span>{a}</span><span>{b}</span></div>
);

/* --------------------------- Crear / Editar --------------------------- */
function QuoteForm({ initial, cfg, store = {}, sym, onClose, onSaved }) {
  const duplicating = !!(initial && initial.__duplicate);
  const editing = !!initial && !duplicating;
  const pct = Number(cfg.igv_porcentaje ?? 18);
  const daysLeft = () => {
    if (!initial || duplicating) return null;
    const diff = Math.ceil((new Date(String(initial.fecha_vencimiento).slice(0, 10)) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
    return Math.max(1, diff);
  };

  const [products, setProducts] = useState([]);
  const [prodQuery, setProdQuery] = useState('');
  const [cliQuery, setCliQuery] = useState(initial && initial.cliente_nombre !== 'Cliente Varios' ? initial.cliente_nombre : '');
  const [cliResults, setCliResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({
    cliente_id: initial?.cliente_id || null,
    cliente_telefono: initial?.cliente_telefono || '',
    cliente_documento: initial?.cliente_documento || '',
    vigencia_dias: initial && !duplicating ? daysLeft() : (cfg.vigencia_dias_defecto || 7),
    mostrar_terminos: initial ? !!Number(initial.mostrar_terminos ?? 1) : !!Number(cfg.mostrar_terminos ?? 1),
    aplicar_igv: initial ? !!Number(initial.aplicar_igv) : !!Number(cfg.aplicar_igv_defecto),
    mostrar_igv: initial ? !!Number(initial.mostrar_igv) : !!Number(cfg.mostrar_igv_defecto ?? 1),
    nota: initial ? (initial.nota || '') : (cfg.nota_defecto || ''),
    adelanto_tipo: initial ? (initial.adelanto_tipo || 'porcentaje') : (cfg.adelanto_tipo_defecto || 'porcentaje'),
    adelanto_valor: initial ? (initial.adelanto_valor ?? '') : (Number(cfg.adelanto_valor_defecto) > 0 ? String(Number(cfg.adelanto_valor_defecto)) : '')
  });
  const charges = useCharges();
  const [cargos, setCargos] = useState(() => {
    if (!initial) return [];
    const c = parseCargosJson(initial.cargos_json);
    if (c.length) return c;
    return Number(initial.costo_envio) > 0 ? [{ nombre: 'Envío', monto: Number(initial.costo_envio) }] : [];
  });
  const [lines, setLines] = useState(
    initial ? initial.items.map((i) => ({
      producto_id: i.producto_id, codigo: i.codigo, descripcion: i.descripcion, detalle: i.detalle || '',
      cantidad: i.cantidad, precio_unitario: String(i.precio_unitario)
    })) : []
  );

  useEffect(() => {
    productsAPI.getAll().then((r) => { if (r.success) setProducts(r.products || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (cliQuery.trim().length < 2 || (form.cliente_id && initial?.cliente_nombre === cliQuery)) { setCliResults([]); return; }
      try {
        const r = await customersAPI.getAll(`?estado=activo&search=${encodeURIComponent(cliQuery.trim())}`);
        if (r.success) setCliResults(r.customers.slice(0, 6));
      } catch (e) { /* ignorar */ }
    }, 250);
    return () => clearTimeout(t);
  }, [cliQuery]);

  const prodMatches = useMemo(() => {
    const t = prodQuery.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter((p) => p.activo !== 0 && (String(p.nombre).toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t)))
      .slice(0, 8);
  }, [prodQuery, products]);

  const addProduct = (p) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.producto_id === p.id);
      if (i >= 0) return prev.map((l, k) => (k === i ? withTier({ ...l, cantidad: Number(l.cantidad) + 1 }) : l));
      // La descripción para clientes del producto (ej. qué incluye el box) se copia y se puede editar en esta cotización
      const detalle = Number(p.desc_cotizacion ?? 1) !== 0 && p.web_descripcion ? p.web_descripcion : '';
      return [...prev, { producto_id: p.id, codigo: p.codigo, descripcion: p.nombre, detalle, cantidad: 1, precio_unitario: String(precioPorCantidad(p, 1)), precio_manual: false }];
    });
    setProdQuery('');
  };
  // Precio por cantidad: se recalcula al cambiar la cantidad, salvo que el precio se haya editado a mano
  const tierProd = (l) => { const p = products.find((x) => x.id === l.producto_id); return p && p.precio_por_cantidad && p.escalas?.length ? p : null; };
  const withTier = (l) => { const p = tierProd(l); return p && !l.precio_manual ? { ...l, precio_unitario: String(precioPorCantidad(p, l.cantidad)) } : l; };
  // Al cargar el catálogo: en cotizaciones guardadas, el precio es "manual" solo si difiere del que corresponde a la cantidad
  useEffect(() => {
    if (!products.length) return;
    setLines((prev) => prev.map((l) => {
      if (l.precio_manual !== undefined) return l;
      const p = products.find((x) => x.id === l.producto_id);
      if (!p || !p.precio_por_cantidad || !p.escalas?.length) return { ...l, precio_manual: true };
      return { ...l, precio_manual: Math.abs(Number(l.precio_unitario) - precioPorCantidad(p, l.cantidad)) > 0.009 };
    }));
  }, [products]);
  const setLine = (i, patch) => setLines((prev) => prev.map((l, k) => {
    if (k !== i) return l;
    const next = { ...l, ...patch };
    if (patch.precio_unitario !== undefined) next.precio_manual = true;
    return patch.cantidad !== undefined && patch.precio_unitario === undefined ? withTier(next) : next;
  }));

  const subtotal = r2(lines.reduce((s, l) => s + r2((Number(l.precio_unitario) || 0) * (Number(l.cantidad) || 0)), 0));
  const envio = sumCargos(cargos);
  const igv = form.aplicar_igv ? r2(subtotal * pct / 100) : 0; // embalaje/traslado no llevan IGV
  const total = r2(subtotal + envio + igv);

  // Paso 1: revisar el documento tal como lo verá el cliente; paso 2: confirmar y guardar
  const verPrevia = () => {
    if (lines.length === 0) { alert('Agrega al menos un producto.'); return; }
    if (lines.some((l) => !(Number(l.cantidad) >= 1))) { alert('Revisa las cantidades: deben ser al menos 1.'); return; }
    setPreview(true);
  };
  const borrador = () => {
    const hoy = new Date();
    const vence = new Date(hoy.getTime() + (Number(form.vigencia_dias) || 0) * 86400000);
    const iso = (d) => d.toLocaleDateString('en-CA');
    return {
      borrador: true, numero: editing ? initial.numero : 'VISTA PREVIA', fecha: iso(hoy), fecha_vencimiento: iso(vence),
      cliente_nombre: cliQuery.trim() || 'Cliente Varios', cliente_telefono: form.cliente_telefono, cliente_documento: form.cliente_documento,
      vendedor_nombre: initial?.vendedor_nombre,
      aplicar_igv: form.aplicar_igv ? 1 : 0, mostrar_igv: form.aplicar_igv && form.mostrar_igv ? 1 : 0, igv_porcentaje: pct,
      costo_envio: envio, cargos_json: cargos, subtotal, igv_monto: igv, total,
      nota: form.nota, mostrar_terminos: form.mostrar_terminos ? 1 : 0, adelanto_tipo: form.adelanto_tipo, adelanto_valor: Number(form.adelanto_valor) || 0,
      items: lines.map((l) => ({ codigo: l.codigo, descripcion: l.descripcion, detalle: l.detalle, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario) }))
    };
  };

  const save = async () => {
    if (lines.length === 0) { alert('Agrega al menos un producto.'); return; }
    const payload = {
      cliente_id: form.cliente_id,
      cliente_nombre: cliQuery.trim() || 'Cliente Varios',
      cliente_telefono: form.cliente_telefono,
      cliente_documento: form.cliente_documento,
      vigencia_dias: form.vigencia_dias,
      aplicar_igv: form.aplicar_igv,
      mostrar_igv: form.aplicar_igv ? form.mostrar_igv : false,
      cargos,
      nota: form.nota,
      mostrar_terminos: form.mostrar_terminos,
      adelanto_tipo: form.adelanto_tipo,
      adelanto_valor: Number(form.adelanto_valor) || 0,
      items: lines.map((l) => ({
        producto_id: l.producto_id, descripcion: l.descripcion, detalle: (l.detalle || '').trim(),
        cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario)
      }))
    };
    try {
      setSaving(true);
      const res = editing ? await quotesAPI.update(initial.id, payload) : await quotesAPI.create(payload);
      if (res.success) onSaved(res.id);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={editing ? `Editar ${initial.numero}` : duplicating ? `Duplicar ${initial.numero}` : 'Nueva cotización'} icon={<FileText size={20} color="var(--primary)" />} onClose={onClose} width={860}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        <div style={{ gridColumn: 'span 2', position: 'relative' }}>
          <label style={labelStyle}>Cliente (vacío = Cliente Varios)</label>
          <input style={inputStyle} value={cliQuery} placeholder="Buscar cliente o escribir un nombre..."
            onChange={(e) => { setCliQuery(e.target.value); setForm({ ...form, cliente_id: null }); }} />
          {cliResults.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              {cliResults.map((c) => (
                <div key={c.id} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px' }}
                  onClick={() => { setCliQuery(c.nombre); setForm({ ...form, cliente_id: c.id, cliente_telefono: c.telefono || '' }); setCliResults([]); }}>
                  <strong>{c.nombre}</strong> <span style={{ color: '#788A9B' }}>· {c.telefono}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input style={inputStyle} value={form.cliente_telefono} onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>RUC / DNI (opcional)</label>
          <input style={inputStyle} value={form.cliente_documento} onChange={(e) => setForm({ ...form, cliente_documento: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>{editing ? 'Vigencia (días desde hoy)' : 'Vigencia (días)'}</label>
          <input type="number" min="1" style={inputStyle} value={form.vigencia_dias}
            onChange={(e) => setForm({ ...form, vigencia_dias: e.target.value })} />
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '14px' }}>
        <input style={inputStyle} value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} placeholder="Buscar producto por nombre o código..." />
        {prodMatches.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: '260px', overflowY: 'auto' }}>
            {prodMatches.map((p) => (
              <div key={p.id} onClick={() => addProduct(p)} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span><strong>{p.nombre}</strong> <span style={{ color: '#788A9B' }}>{p.codigo}</span></span>
                <span>{money(p.precio_venta, sym)} <span style={{ color: '#788A9B' }}>· {p.stock} un.</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', marginTop: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
          <thead>
            <tr style={{ fontSize: '11.5px', color: '#64748B', textTransform: 'uppercase', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Producto (editable)</th>
              <th style={{ padding: '8px', width: '80px' }}>Cant.</th>
              <th style={{ padding: '8px', width: '120px' }}>P. unit. sin IGV</th>
              <th style={{ padding: '8px', width: '90px', textAlign: 'right' }}>Subtotal</th>
              <th style={{ width: '36px' }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.producto_id} style={{ borderTop: '1px solid #EEF3F0' }}>
                <td style={{ padding: '6px' }}>
                  <input style={inputStyle} value={l.descripcion} onChange={(e) => setLine(i, { descripcion: e.target.value })} />
                  {(l.detalle || l.verDetalle) ? (
                    <textarea rows={Math.min(6, Math.max(2, String(l.detalle || '').split('\n').length))} value={l.detalle || ''} placeholder="Descripción para el cliente (ej. qué incluye). Déjala vacía para no mostrarla."
                      onChange={(e) => setLine(i, { detalle: e.target.value })}
                      style={{ ...inputStyle, marginTop: '4px', fontSize: '12.5px', color: '#475569', resize: 'vertical', lineHeight: 1.4 }} />
                  ) : (
                    <button type="button" onClick={() => setLine(i, { verDetalle: true })} style={{ fontSize: '11.5px', color: 'var(--primary)', background: 'none', border: 0, cursor: 'pointer', padding: '3px 0', fontWeight: 700 }}>+ Agregar descripción</button>
                  )}
                </td>
                <td style={{ padding: '6px' }}><input type="number" min="1" style={inputStyle} value={l.cantidad} onChange={(e) => setLine(i, { cantidad: e.target.value })} /></td>
                <td style={{ padding: '6px' }}>
                  <input type="number" min="0" step="0.01" style={inputStyle} value={l.precio_unitario} onChange={(e) => setLine(i, { precio_unitario: e.target.value })} />
                  {tierProd(l) && (l.precio_manual
                    ? <button type="button" onClick={() => setLines((prev) => prev.map((x, k) => (k === i ? withTier({ ...x, precio_manual: false }) : x)))} style={{ fontSize: '10.5px', color: '#B45309', background: 'none', border: 0, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}>Precio editado · restaurar automático</button>
                    : <span style={{ fontSize: '10.5px', color: '#10B981', fontWeight: 700 }}>Precio por cantidad automático</span>)}
                </td>
                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{r2((Number(l.precio_unitario) || 0) * (Number(l.cantidad) || 0)).toFixed(2)}</td>
                <td style={{ padding: '6px' }}><button onClick={() => setLines(lines.filter((_, k) => k !== i))} style={btn('#FEF2F2', '#B91C1C', { padding: '6px' })}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8' }}>
                <Package size={30} style={{ opacity: 0.5 }} /><div style={{ fontSize: '13px' }}>Busca y agrega productos</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '14px', alignItems: 'start' }}>
        <div>
          <label style={labelStyle}>Términos y condiciones</label>
          <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
            <input type="checkbox" checked={!!form.mostrar_terminos} onChange={(e) => setForm({ ...form, mostrar_terminos: e.target.checked })} /> Mostrar Términos y condiciones en la cotización
          </label>
          <ChargesPicker selected={cargos} onChange={setCargos} charges={charges} sym={sym} />
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.aplicar_igv} onChange={(e) => setForm({ ...form, aplicar_igv: e.target.checked })} />
            Agregar IGV ({pct}%) al total
          </label>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginTop: '8px', opacity: form.aplicar_igv ? 1 : 0.45, cursor: form.aplicar_igv ? 'pointer' : 'not-allowed' }}>
            <input type="checkbox" disabled={!form.aplicar_igv} checked={form.aplicar_igv && form.mostrar_igv} onChange={(e) => setForm({ ...form, mostrar_igv: e.target.checked })} />
            Mostrar el IGV desglosado en el documento
          </label>
          <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '6px' }}>
            Los precios del catálogo se tratan como <strong>sin IGV</strong>. Si no desglosas el IGV, el documento muestra los precios con IGV incluido.
          </div>
          <div style={{ marginTop: '10px', fontSize: '13.5px' }}>
            <Row a="Subtotal" b={money(subtotal, sym)} />
            {form.aplicar_igv && <Row a={`IGV (${pct}%)`} b={money(igv, sym)} />}
            {cargos.map((c) => <Row key={c.nombre} a={c.nombre} b={money(c.monto, sym)} />)}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 800, borderTop: '2px solid #1C2A38', marginTop: '6px', paddingTop: '6px' }}>
              <span>Total</span><span>{money(total, sym)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px', background: '#FFF8F5', border: '1px solid #FFE1D6', borderRadius: '12px', padding: '12px 14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#1C2A38', marginBottom: '8px' }}>💰 Adelanto mínimo para agendar el pedido</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...inputStyle, width: 'auto', fontWeight: 600 }} value={form.adelanto_tipo}
            onChange={(e) => setForm({ ...form, adelanto_tipo: e.target.value, adelanto_valor: e.target.value === 'porcentaje' ? '50' : '' })}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto">Monto exacto (S/)</option>
          </select>
          <input type="number" min="0" step="0.01" style={{ ...inputStyle, width: '110px' }} value={form.adelanto_valor}
            onChange={(e) => setForm({ ...form, adelanto_valor: e.target.value })} />
          {form.adelanto_tipo === 'porcentaje' && [30, 50, 75, 100].map((pc) => (
            <button key={pc} type="button" onClick={() => setForm({ ...form, adelanto_valor: String(pc) })}
              style={{ padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, border: '1px solid #FFD7CB', background: Number(form.adelanto_valor) === pc ? 'var(--primary)' : '#fff', color: Number(form.adelanto_valor) === pc ? '#fff' : 'var(--primary)', cursor: 'pointer' }}>{pc}%</button>
          ))}
          <span style={{ fontSize: '13px', color: '#475569' }}>
            Mínimo a pagar (redondeado a 0.50): <strong style={{ color: 'var(--primary)' }}>S/ {adelantoMinimo(total, form.adelanto_tipo, form.adelanto_valor).adelanto.toFixed(2)}</strong>
          </span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '4px' }}>Deja el valor en 0 para no mostrarlo en la cotización.</div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={btn('#F1F5F9', '#475569')}>Cancelar</button>
        <button onClick={verPrevia} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
          <Eye size={17} /> {saving ? 'Guardando...' : editing ? 'Vista previa y guardar cambios' : 'Vista previa y guardar'}
        </button>
      </div>
      {preview && (() => {
        const q = borrador();
        const bt = (bg, color, extra) => ({ padding: '11px', borderRadius: '12px', fontSize: '14px', fontWeight: 800, background: bg, color, border: 'none', cursor: saving ? 'wait' : 'pointer', ...extra });
        return (
          <PrintModal
            title={editing ? `Vista previa · ${initial.numero}` : 'Vista previa de la cotización'}
            subtitle="Así la verá tu cliente. Aún no se ha guardado."
            docs={[{ key: 'previa', label: 'Cotización', build: (fm) => buildQuoteHTML(q, cfg, store, fm, { toolbar: false }), message: '' }]}
            showWhatsApp={false}
            onClose={() => setPreview(false)}
            actions={(
              <div style={{ display: 'grid', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
                <button disabled={saving} onClick={save} style={bt('#16A34A', '#fff')}>{saving ? 'Guardando…' : editing ? 'Confirmar y guardar cambios' : 'Confirmar y guardar cotización'}</button>
                <button disabled={saving} onClick={() => setPreview(false)} style={bt('#F1F5F9', '#475569')}>← Volver y editar</button>
              </div>
            )}
          />
        );
      })()}
    </Modal>
  );
}

/* ------------------------- Convertir en venta ------------------------- */
function ConvertModal({ q, onClose, onDone }) {
  // Cliente: si la cotización se hizo como «Cliente Varios», aquí se escriben los datos reales (como en el Punto de venta)
  const esVarios = !q.cliente_nombre || q.cliente_nombre === 'Cliente Varios';
  const [clienteVarios, setClienteVarios] = useState(esVarios);
  const [clienteNombre, setClienteNombre] = useState(esVarios ? '' : q.cliente_nombre);
  const [clienteTel, setClienteTel] = useState(q.cliente_telefono || '');
  const [delivery, setDelivery] = useState(emptyDelivery());
  const [metodo, setMetodo] = useState('yape');
  const [notas, setNotas] = useState('');
  const advQ = Number(q.adelanto_valor) > 0 ? adelantoMinimo(q.total, q.adelanto_tipo, q.adelanto_valor).adelanto : 0;
  const [advType, setAdvType] = useState(advQ > 0 ? 'monto' : 'porcentaje');
  const [advValue, setAdvValue] = useState(advQ > 0 ? String(advQ) : '50');
  const [busy, setBusy] = useState(false);

  const advRaw = advType === 'porcentaje' ? Number(q.total) * (Number(advValue) || 0) / 100 : (Number(advValue) || 0);
  const advance = r2(Math.min(Number(q.total), Math.max(0, advRaw)));
  const cargosQ = parseCargosJson(q.cargos_json);

  const go = async () => {
    if (!clienteVarios && (!clienteNombre.trim() || !clienteTel.trim())) {
      alert('Escribe el nombre y el teléfono del cliente, o marca «Cliente Varios».');
      return;
    }
    try {
      setBusy(true);
      const res = await quotesAPI.convert(q.id, {
        cliente_varios: clienteVarios,
        cliente_nombre: clienteVarios ? '' : clienteNombre.trim(),
        cliente_telefono: clienteVarios ? '' : clienteTel.trim(),
        tipo_entrega: delivery.tipo_entrega,
        ciudad_envio: delivery.ciudad_envio,
        fecha_entrega: delivery.fecha_entrega,
        fecha_entrega_diseno: delivery.fecha_entrega_diseno || null,
        diseno_link: (delivery.diseno_link || '').trim() || undefined,
        diseno_foto: delivery.diseno_foto || undefined,
        diseno_links: ((delivery.diseno_links || []).filter((x) => (x.url || '').trim()).map((x) => ({ url: x.url.trim(), comentario: (x.comentario || '').trim() }))).length ? (delivery.diseno_links || []).filter((x) => (x.url || '').trim()).map((x) => ({ url: x.url.trim(), comentario: (x.comentario || '').trim() })) : undefined,
        franja_horaria: delivery.franja_horaria,
        ...entregaPayload(delivery),
        metodo_pago: metodo,
        notas_taller: notas,
        adelanto_tipo: advType,
        adelanto_valor: Number(advValue) || 0
      });
      if (res.success) { alert(res.message); onDone(); }
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Convertir ${q.numero} en venta`} icon={<ShoppingCart size={20} color="var(--primary)" />} onClose={onClose} width={720}>
      <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>
        Se creará un pedido con los productos, precios y cargos de la cotización. El stock se descuenta recién cuando se genera el comprobante.
      </div>
      <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>Cliente</div>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={clienteVarios} onChange={(e) => setClienteVarios(e.target.checked)} />
            Cliente Varios (venta sin datos del cliente)
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', ...(clienteVarios ? { opacity: 0.5 } : {}) }}>
          <div><label style={labelStyle}>Nombre del cliente (comprador)</label>
            <input style={inputStyle} value={clienteNombre} placeholder={clienteVarios ? 'Escribe para quitar «Cliente Varios»' : 'Nombre y apellido'}
              onChange={(e) => { setClienteNombre(e.target.value); if (e.target.value) setClienteVarios(false); }} /></div>
          <div><label style={labelStyle}>Teléfono del comprador</label>
            <input style={inputStyle} value={clienteTel} inputMode="tel" placeholder="987654321"
              onChange={(e) => { setClienteTel(e.target.value); if (e.target.value) setClienteVarios(false); }} /></div>
        </div>
        {esVarios && (
          <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '6px' }}>
            La cotización se hizo como «Cliente Varios». Si escribes los datos, el pedido y la cotización quedan a nombre del cliente y se guarda en Clientes (si el teléfono ya existe, se usa esa ficha).
          </div>
        )}
      </div>
      <DeliveryFields value={delivery} onChange={setDelivery} chargesMode="none" showDesign={false} />
      {cargosQ.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569' }}>
          Cargos de la cotización: {cargosQ.map((c) => `${c.nombre} (S/ ${c.monto.toFixed(2)})`).join(' · ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginTop: '12px' }}>
        <div><label style={labelStyle}>Método de pago del adelanto</label>
          <select style={inputStyle} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {['yape', 'plin', 'efectivo', 'tarjeta', 'transferencia'].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
          </select></div>
        <div><label style={labelStyle}>Notas para el taller (opcional)</label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: '70px' }} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
      </div>

      <div style={{ marginTop: '14px', background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Adelanto para iniciar el diseño y la producción</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...inputStyle, width: 'auto' }} value={advType} onChange={(e) => { setAdvType(e.target.value); setAdvValue(e.target.value === 'porcentaje' ? '50' : ''); }}>
            <option value="porcentaje">Porcentaje (%)</option><option value="monto">Monto exacto</option>
          </select>
          <input type="number" min="0" step="0.01" style={{ ...inputStyle, width: '110px' }} value={advValue} onChange={(e) => setAdvValue(e.target.value)} />
          {advType === 'porcentaje' && [50, 75, 100].map((p) => (
            <button key={p} type="button" onClick={() => setAdvValue(String(p))} style={btn(Number(advValue) === p ? 'var(--primary-light)' : '#fff', 'var(--primary)', { border: '1px solid #FFD7CB', padding: '6px 10px' })}>{p}%</button>
          ))}
          <span style={{ fontSize: '13px', color: '#475569' }}>
            Adelanto: <strong>{money(advance, 'S/')}</strong> · Saldo: <strong>{money(Math.max(0, Number(q.total) - advance), 'S/')}</strong>
          </span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '6px' }}>
          El adelanto queda registrado en el pedido y solo se contabiliza al generar el comprobante. El pedido no sale a ruta hasta quedar pagado.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={btn('#F1F5F9', '#475569')}>Cancelar</button>
        <button onClick={go} disabled={busy} className="btn-primary" style={{ flex: 1, padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
          <ShoppingCart size={17} /> {busy ? 'Creando pedido...' : 'Crear pedido'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------- Plantilla (admin) ------------------------- */
function ConfigModal({ cfg, onClose, onSaved }) {
  const [c, setC] = useState({ ...cfg });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));

  const onQR = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 600;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        set('qr_imagen', cv.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    try {
      setBusy(true);
      const res = await quotesAPI.updateConfig({
        titulo_documento: c.titulo_documento, color_acento: c.color_acento,
        igv_porcentaje: c.igv_porcentaje, aplicar_igv_defecto: !!Number(c.aplicar_igv_defecto),
        mostrar_igv_defecto: !!Number(c.mostrar_igv_defecto), vigencia_dias_defecto: c.vigencia_dias_defecto,
        nota_defecto: c.nota_defecto || '', mostrar_terminos: !!Number(c.mostrar_terminos ?? 1), pie_pagina: c.pie_pagina || '',
        adelanto_tipo_defecto: c.adelanto_tipo_defecto || 'porcentaje', adelanto_valor_defecto: c.adelanto_valor_defecto ?? 50,
        mostrar_qr: !!Number(c.mostrar_qr), qr_imagen: c.qr_imagen || '', qr_titulo: c.qr_titulo || '', qr_detalle: c.qr_detalle || '',
        ...pickDocInfo(c)
      });
      if (res.success) onSaved(res.config);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const chk = (key, label) => (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!Number(c[key])} onChange={(e) => set(key, e.target.checked ? 1 : 0)} /> {label}
    </label>
  );

  return (
    <Modal title="Plantilla de cotizaciones" icon={<Settings size={20} color="var(--primary)" />} onClose={onClose} width={760}>
      <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>
        Estos datos se aplican a todas las cotizaciones nuevas y a los documentos (PDF / ticket). Los datos de empresa vacíos se toman de “Configuración Empresa”.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        <div><label style={labelStyle}>Título del documento</label><input style={inputStyle} value={c.titulo_documento || ''} onChange={(e) => set('titulo_documento', e.target.value)} /></div>
        <div><label style={labelStyle}>Color de acento</label><input type="color" style={{ ...inputStyle, padding: '3px', height: '40px' }} value={c.color_acento || '#FF5E36'} onChange={(e) => set('color_acento', e.target.value)} /></div>
        <div><label style={labelStyle}>IGV (%)</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={c.igv_porcentaje ?? 18} onChange={(e) => set('igv_porcentaje', e.target.value)} /></div>
        <div><label style={labelStyle}>Adelanto mínimo por defecto</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select style={{ ...inputStyle, width: 'auto' }} value={c.adelanto_tipo_defecto || 'porcentaje'} onChange={(e) => set('adelanto_tipo_defecto', e.target.value)}><option value="porcentaje">%</option><option value="monto">S/</option></select>
            <input type="number" min="0" step="0.01" style={inputStyle} value={c.adelanto_valor_defecto ?? 50} onChange={(e) => set('adelanto_valor_defecto', e.target.value)} />
          </div></div>
        <div><label style={labelStyle}>Vigencia por defecto (días)</label><input type="number" min="1" style={inputStyle} value={c.vigencia_dias_defecto || 7} onChange={(e) => set('vigencia_dias_defecto', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '14px 0' }}>
        {chk('aplicar_igv_defecto', 'Agregar IGV por defecto en cotizaciones nuevas')}
        {chk('mostrar_igv_defecto', 'Mostrar IGV desglosado por defecto')}
      </div>
      <label style={labelStyle}>Términos y condiciones por defecto</label>
      <textarea style={{ ...inputStyle, minHeight: '56px' }} value={c.nota_defecto || ''} onChange={(e) => set('nota_defecto', e.target.value)} />
      <div style={{ marginTop: '6px' }}>{chk('mostrar_terminos', 'Mostrar Términos y condiciones por defecto en las cotizaciones nuevas')}</div>
      <label style={{ ...labelStyle, marginTop: '10px' }}>Pie de página del documento</label>
      <textarea style={{ ...inputStyle, minHeight: '70px' }} value={c.pie_pagina || ''} onChange={(e) => set('pie_pagina', e.target.value)} />

      <div style={{ marginTop: '14px' }}><DocInfoFields c={c} set={set} /></div>

      <div style={{ marginTop: '14px', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
        {chk('mostrar_qr', 'Mostrar código QR de pago (Yape / Plin) en la cotización')}
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: '130px', height: '130px', border: '1px dashed #CBD5E1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#F8FAFC' }}>
            {c.qr_imagen ? <img src={c.qr_imagen} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '12px', color: '#94A3B8' }}>Sin QR</span>}
          </div>
          <div style={{ flex: '1 1 240px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label style={btn('#F1F5F9', '#334155', { cursor: 'pointer' })}>
                <Upload size={15} /> Subir imagen del QR
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onQR(e.target.files[0])} />
              </label>
              {c.qr_imagen && <button onClick={() => set('qr_imagen', '')} style={btn('#FEF2F2', '#B91C1C')}><Trash2 size={15} /> Quitar</button>}
            </div>
            <div><label style={labelStyle}>Texto sobre el QR</label><input style={inputStyle} value={c.qr_titulo || ''} onChange={(e) => set('qr_titulo', e.target.value)} /></div>
            <div><label style={labelStyle}>Detalle (titular, número de Yape...)</label><textarea style={{ ...inputStyle, minHeight: '50px' }} value={c.qr_detalle || ''} onChange={(e) => set('qr_detalle', e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={btn('#F1F5F9', '#475569')}>Cancelar</button>
        <button onClick={save} disabled={busy} className="btn-primary" style={{ flex: 1, padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
          <Check size={17} /> {busy ? 'Guardando...' : 'Guardar plantilla'}
        </button>
      </div>
    </Modal>
  );
}

import FloatingMenu from '../components/FloatingMenu';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PackageSearch, Search, X, CalendarDays } from 'lucide-react';
import { kardexAPI, productsAPI, settingsAPI } from '../api';
import ExportMenu from '../components/ExportMenu';
import { downloadXlsx, openTablePdf } from '../utils/exporters';
import '../components/party.css';

const iso = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };
const firstOfMonth = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const fmt = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '');
const fmtDT = (s) => (s ? `${fmt(s)} ${String(s).slice(11, 16)}` : '');
const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const UNI = { NIU: 'UND', KGM: 'KG', MTR: 'M', LTR: 'L', BX: 'CAJA', DZN: 'DOC', PK: 'PQT', SET: 'JGO' };

const COLS = [
  { id: 'n', label: '#', always: true },
  { id: 'fecha', label: 'Fecha emisión', def: true },
  { id: 'documento', label: 'Documento', def: true },
  { id: 'motivo', label: 'Motivo', def: true },
  { id: 'almacen', label: 'Almacén', def: true },
  { id: 'producto', label: 'Producto', def: true },
  { id: 'ingreso', label: 'Ingreso', def: true },
  { id: 'salida', label: 'Salida', def: true },
  { id: 'saldo', label: 'Saldo', def: true }
];

export default function Kardex({ focusProduct = null, onClearFocus = () => {} }) {
  const [products, setProducts] = useState([]);
  const [productoId, setProductoId] = useState(focusProduct ? String(focusProduct) : '');
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(iso(new Date()));
  const [tipo, setTipo] = useState('todos');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ movimientos: [], totales: { ingresos: 0, salidas: 0 } });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [store, setStore] = useState({});
  const [colMenu, setColMenu] = useState(false);
  const [vis, setVis] = useState(() => { try { const s = JSON.parse(localStorage.getItem('cols_kardex_v1')); if (Array.isArray(s)) return s; } catch (e) { /* sin guardado */ } return COLS.filter((c) => c.def).map((c) => c.id); });
  const cols = COLS.filter((c) => c.always || vis.includes(c.id));
  const toggleCol = (id) => { const n = vis.includes(id) ? vis.filter((x) => x !== id) : [...vis, id]; setVis(n); try { localStorage.setItem('cols_kardex_v1', JSON.stringify(n)); } catch (e) { /* sin guardado */ } };

  useEffect(() => {
    productsAPI.getAll('?estado=todos&tipo=producto').then((r) => setProducts(r.products || [])).catch(() => {});
    settingsAPI.get().then((r) => setStore(r.settings || {})).catch(() => {});
  }, []);
  useEffect(() => { if (focusProduct) setProductoId(String(focusProduct)); }, [focusProduct]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams({ tipo });
      if (productoId) q.set('producto_id', productoId);
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (search.trim()) q.set('search', search.trim());
      const r = await kardexAPI.movements(`?${q.toString()}`);
      setData({ movimientos: r.movimientos || [], totales: r.totales || { ingresos: 0, salidas: 0 } });
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [productoId, desde, hasta, tipo, search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const prod = products.find((p) => String(p.id) === String(productoId));
  const titulo = prod ? `Kárdex · ${prod.nombre}` : 'Kárdex · Todos los productos';
  const rango = `${fmt(desde)} – ${fmt(hasta)}`;
  const rows = data.movimientos;

  const flat = useMemo(() => rows.map((m, i) => ({
    n: i + 1, fecha: fmt(m.fecha), documento: m.documento || '—', motivo: m.motivo, almacen: m.almacen, producto: m.producto, codigo: m.codigo,
    ingreso: m.tipo === 'ingreso' ? m.cantidad : null, salida: m.tipo === 'salida' ? m.cantidad : null, saldo: m.stock_despues
  })), [rows]);

  const exportExcel = () => {
    const head = ['#', 'Fecha emisión', 'Documento', 'Motivo', 'Almacén', 'Código', 'Producto', 'Ingreso', 'Salida', 'Saldo'];
    const body = flat.map((r) => [r.n, r.fecha, r.documento, r.motivo, r.almacen, r.codigo, r.producto, r.ingreso ?? '', r.salida ?? '', r.saldo ?? '']);
    body.push([], ['', '', '', '', '', '', 'TOTALES', data.totales.ingresos, data.totales.salidas, '']);
    downloadXlsx(`kardex_${desde}_${hasta}.xlsx`, 'Kardex', [head, ...body], [5, 14, 16, 22, 26, 12, 40, 10, 10, 10]);
  };
  const exportPdf = () => openTablePdf({
    title: titulo, subtitle: `${prod ? prod.codigo + ' · ' : ''}${rango}`, store,
    columns: [{ h: '#' }, { h: 'Fecha' }, { h: 'Documento' }, { h: 'Motivo' }, { h: 'Almacén' }, { h: 'Producto' }, { h: 'Ingreso', align: 'right' }, { h: 'Salida', align: 'right' }, { h: 'Saldo', align: 'right' }],
    rows: flat.map((r) => [r.n, r.fecha, r.documento, r.motivo, r.almacen, r.producto, r.ingreso ?? '', r.salida ?? '', r.saldo ?? '']),
    summary: [['Ingresos', `+${num(data.totales.ingresos)}`], ['Salidas', `-${num(data.totales.salidas)}`], ['Movimientos', String(flat.length)]]
  });

  const cell = (c, r) => {
    switch (c.id) {
      case 'n': return r.n;
      case 'fecha': return r.fecha;
      case 'documento': return r.documento;
      case 'motivo': return r.motivo;
      case 'almacen': return r.almacen;
      case 'producto': return (<>{r.producto}<span className="pm-extra">{r.codigo}</span></>);
      case 'ingreso': return r.ingreso !== null ? <span style={{ background: '#E6F7EE', color: '#047857', borderRadius: 999, padding: '2px 9px', fontWeight: 700 }}>+{num(r.ingreso)}</span> : '—';
      case 'salida': return r.salida !== null ? <span style={{ background: '#FEE8EC', color: '#B91C1C', borderRadius: 999, padding: '2px 9px', fontWeight: 700 }}>−{num(r.salida)}</span> : '—';
      case 'saldo': return r.saldo ?? '—';
      default: return '';
    }
  };

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-card pm-head">
          <div className="pm-head-l">
            <PackageSearch size={38} color="#FF7A3C" strokeWidth={1.7} />
            <div><h2>Kárdex</h2><p>{prod ? prod.nombre : 'Todos los productos'} · {rango}</p></div>
          </div>
          <div className="pm-head-r"><ExportMenu onPdf={exportPdf} onExcel={exportExcel} disabled={!rows.length} /></div>
        </div>

        <div className="pm-card" style={{ paddingBottom: 6 }}>
          <div className="pm-toolbar">
            <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 220px' }}>
              <input placeholder="Buscar documento: B001-16…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" aria-label="Buscar"><Search size={18} /></button>
            </div>
            <select className="pm-select" style={{ minWidth: 220 }} value={productoId} onChange={(e) => { setProductoId(e.target.value); if (!e.target.value) onClearFocus(); }}>
              <option value="">Todos los productos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
            </select>
            <label className="pm-select" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><CalendarDays size={15} /><input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent' }} /></label>
            <label className="pm-select" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><CalendarDays size={15} /><input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent' }} /></label>
            <select className="pm-select" defaultValue="" onChange={() => {}}><option value="">Almacén: todos los almacenes</option><option value="p">ALMACÉN PRINCIPAL</option></select>
            <div className="pm-colsel" style={{ marginLeft: 'auto' }}>
              <button className="pm-btn-outline" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }}>Columnas</button>
              {colMenu && (
                <FloatingMenu anchor={colMenu} onClose={() => setColMenu(false)} keepOpen width={230}>
                  {COLS.filter((c) => !c.always).map((c) => <label key={c.id}><input type="checkbox" checked={vis.includes(c.id)} onChange={() => toggleCol(c.id)} /> {c.label}</label>)}
                </FloatingMenu>
              )}
            </div>
          </div>
          <div className="pm-toolbar" style={{ paddingTop: 0 }}>
            <div className="pm-tabs" style={{ margin: 0 }}>
              {[['todos', 'Todos'], ['ingresos', 'Solo ingresos'], ['salidas', 'Solo salidas']].map(([id, l]) => (
                <button key={id} className={tipo === id ? 'on' : ''} onClick={() => setTipo(id)}>{l}</button>
              ))}
            </div>
            {productoId && <button className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => { setProductoId(''); onClearFocus(); }}><X size={14} /> Quitar filtro de producto</button>}
            <div style={{ marginLeft: 'auto', fontSize: 14, display: 'flex', gap: 16 }}>
              <span>Ingresos <strong style={{ color: '#047857' }}>+{num(data.totales.ingresos)}</strong></span>
              <span>Salidas <strong style={{ color: '#B91C1C' }}>−{num(data.totales.salidas)}</strong></span>
            </div>
          </div>
          {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
          <div className="pm-table-wrap" style={{ minHeight: 160 }}>
            <table className="pm-table">
              <thead><tr>{cols.map((c) => <th key={c.id} style={['ingreso', 'salida', 'saldo'].includes(c.id) ? { textAlign: 'right' } : undefined}>{c.label}</th>)}</tr></thead>
              <tbody>
                {flat.map((r) => <tr key={r.n}>{cols.map((c) => <td key={c.id} style={['ingreso', 'salida', 'saldo'].includes(c.id) ? { textAlign: 'right' } : undefined}>{cell(c, r)}</td>)}</tr>)}
              </tbody>
            </table>
            {!loading && !flat.length && <div className="pm-empty"><PackageSearch size={40} />NO HAY MOVIMIENTOS EN ESTE PERIODO</div>}
            {loading && <div className="pm-empty">Cargando…</div>}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{flat.length} movimiento(s)</div>
        </div>
      </div>
    </div>
  );
}

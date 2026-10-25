import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Coins, Search, Package, Tag, TrendingUp, MoreVertical, PackageSearch } from 'lucide-react';
import { kardexAPI, categoriesAPI, settingsAPI } from '../api';
import FloatingMenu from '../components/FloatingMenu';
import ExportMenu from '../components/ExportMenu';
import { downloadXlsx, openTablePdf } from '../utils/exporters';
import '../components/party.css';

const iso = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };
const money = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const m2 = (n) => Number(n || 0).toFixed(2);

const periodRange = (p) => {
  const hoy = new Date();
  if (p === 'hoy') return [iso(hoy), iso(hoy)];
  if (p === 'semana') { const d = new Date(hoy); d.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); return [iso(d), iso(hoy)]; }
  if (p === 'mes') return [iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), iso(hoy)];
  if (p === 'anio') return [iso(new Date(hoy.getFullYear(), 0, 1)), iso(hoy)];
  return ['', ''];
};
const PERIODS = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['anio', 'Este año'], ['todo', 'Todo']];

const COLS = [
  { id: 'n', label: '#', always: true },
  { id: 'producto', label: 'Producto', always: true },
  { id: 'almacen', label: 'Almacén', def: true },
  { id: 'categoria', label: 'Categoría', def: true },
  { id: 'minimo', label: 'Stock mínimo', def: true },
  { id: 'stock', label: 'Stock actual', def: true },
  { id: 'vendidos', label: 'Vendidos', def: true },
  { id: 'venta', label: 'Precio de venta', def: true },
  { id: 'costo', label: 'Costo', def: true },
  { id: 'vcosto', label: 'Valor al costo', def: true },
  { id: 'vventa', label: 'Valor a P. venta', def: true },
  { id: 'ganancia', label: 'Ganancia', def: true }
];
const NUMERIC = ['minimo', 'stock', 'vendidos', 'venta', 'costo', 'vcosto', 'vventa', 'ganancia'];

export default function KardexValorizado({ onOpenKardex = () => {} }) {
  const [rows, setRows] = useState([]);
  const [totales, setTotales] = useState({ valor_costo: 0, valor_venta: 0, ganancia: 0 });
  const [cats, setCats] = useState([]);
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('hoy');
  const [categoria, setCategoria] = useState('');
  const [rowMenu, setRowMenu] = useState(null);
  const [colMenu, setColMenu] = useState(false);
  const [vis, setVis] = useState(() => { try { const s = JSON.parse(localStorage.getItem('cols_kardexval_v1')); if (Array.isArray(s)) return s; } catch (e) { /* sin guardado */ } return COLS.filter((c) => c.def).map((c) => c.id); });
  const cols = COLS.filter((c) => c.always || vis.includes(c.id));
  const toggleCol = (id) => { const n = vis.includes(id) ? vis.filter((x) => x !== id) : [...vis, id]; setVis(n); try { localStorage.setItem('cols_kardexval_v1', JSON.stringify(n)); } catch (e) { /* sin guardado */ } };

  useEffect(() => {
    categoriesAPI.getAll().then((r) => setCats(r.categories || [])).catch(() => {});
    settingsAPI.get().then((r) => setStore(r.settings || {})).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [d, h] = periodRange(period);
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      if (categoria) q.set('categoria_id', categoria);
      if (d) q.set('desde', d);
      if (h) q.set('hasta', h);
      const r = await kardexAPI.valued(`?${q.toString()}`);
      setRows(r.productos || []); setTotales(r.totales || {});
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, period, categoria]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const flat = useMemo(() => rows.map((p, i) => ({ ...p, n: i + 1 })), [rows]);
  const periodLabel = PERIODS.find((x) => x[0] === period)[1];

  const exportExcel = () => {
    const head = ['#', 'Código', 'Producto', 'Almacén', 'Categoría', 'Stock mínimo', 'Stock actual', `Vendidos (${periodLabel})`, 'Precio de venta', 'Costo', 'Valor al costo', 'Valor a precio de venta', 'Ganancia'];
    const body = flat.map((p) => [p.n, p.codigo, p.nombre, 'ALMACÉN PRINCIPAL', p.categoria_nombre, Number(p.stock_minimo), p.stock, p.vendidos, p.precio_venta, p.precio_costo, p.valor_costo, p.valor_venta, p.ganancia]);
    body.push([], ['', '', 'TOTALES', '', '', '', '', '', '', '', totales.valor_costo, totales.valor_venta, totales.ganancia]);
    downloadXlsx('kardex_valorizado.xlsx', 'Kardex valorizado', [head, ...body], [5, 12, 40, 20, 22, 12, 12, 14, 14, 12, 14, 16, 14]);
  };
  const exportPdf = () => openTablePdf({
    title: 'Kárdex valorizado', subtitle: `Vendidos: ${periodLabel}`, store,
    columns: [{ h: '#' }, { h: 'Producto' }, { h: 'Categoría' }, { h: 'Stock mín.', align: 'right' }, { h: 'Stock', align: 'right' }, { h: 'Vendidos', align: 'right' }, { h: 'P. venta', align: 'right' }, { h: 'Costo', align: 'right' }, { h: 'Valor costo', align: 'right' }, { h: 'Valor venta', align: 'right' }, { h: 'Ganancia', align: 'right' }],
    rows: flat.map((p) => [p.n, `${p.nombre} (${p.codigo})`, p.categoria_nombre, p.stock_minimo, p.stock, p.vendidos, m2(p.precio_venta), m2(p.precio_costo), m2(p.valor_costo), m2(p.valor_venta), m2(p.ganancia)]),
    summary: [['Valor al costo', money(totales.valor_costo)], ['Valor a precio de venta', money(totales.valor_venta)], ['Ganancia si se vende todo', money(totales.ganancia)]]
  });

  const cell = (c, p) => {
    switch (c.id) {
      case 'n': return p.n;
      case 'producto': return (<>{p.nombre}<span className="pm-extra">{p.codigo}</span></>);
      case 'almacen': return 'ALMACÉN PRINCIPAL';
      case 'categoria': return p.categoria_nombre || '—';
      case 'minimo': return Number(p.stock_minimo);
      case 'stock': return <span style={{ fontWeight: 700, color: p.stock <= 0 ? '#B91C1C' : p.stock <= Number(p.stock_minimo) ? '#B45309' : 'inherit' }}>{p.stock}</span>;
      case 'vendidos': return p.vendidos;
      case 'venta': return money(p.precio_venta);
      case 'costo': return money(p.precio_costo);
      case 'vcosto': return money(p.valor_costo);
      case 'vventa': return money(p.valor_venta);
      case 'ganancia': return <span style={{ color: p.ganancia >= 0 ? '#047857' : '#B91C1C', fontWeight: 600 }}>{money(p.ganancia)}</span>;
      default: return '';
    }
  };
  const card = (Icon, label, value, color, bg) => (
    <div className="pm-card" style={{ flex: '1 1 220px', display: 'flex', gap: 12, alignItems: 'center', padding: '14px 18px' }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={color} /></span>
      <div><div style={{ fontSize: 12.5, color: '#788A9B' }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color }}>{money(value)}</div></div>
    </div>
  );

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-card pm-head">
          <div className="pm-head-l">
            <Coins size={38} color="#FF7A3C" strokeWidth={1.7} />
            <div><h2>Inventario valorizado</h2><p>Cuánto vale tu stock al costo y a precio de venta; con un periodo, también lo vendido.</p></div>
          </div>
          <div className="pm-head-r"><ExportMenu onPdf={exportPdf} onExcel={exportExcel} disabled={!rows.length} /></div>
        </div>

        <div className="pm-card" style={{ paddingBottom: 6 }}>
          <div className="pm-toolbar">
            <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 240px' }}>
              <input placeholder="Buscar producto o código…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" aria-label="Buscar"><Search size={18} /></button>
            </div>
            <select className="pm-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([id, l]) => <option key={id} value={id}>Periodo: {l}</option>)}
            </select>
            <select className="pm-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Categoría: todas</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select className="pm-select" defaultValue="" onChange={() => {}}><option value="">Almacén: todos</option><option value="p">ALMACÉN PRINCIPAL</option></select>
            <div className="pm-colsel" style={{ marginLeft: 'auto' }}>
              <button className="pm-btn-outline" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }}>Columnas</button>
              {colMenu && (
                <FloatingMenu anchor={colMenu} onClose={() => setColMenu(false)} keepOpen width={230}>
                  {COLS.filter((c) => !c.always).map((c) => <label key={c.id}><input type="checkbox" checked={vis.includes(c.id)} onChange={() => toggleCol(c.id)} /> {c.label}</label>)}
                </FloatingMenu>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '4px 20px 10px' }}>
            {card(Package, 'Valor al costo', totales.valor_costo, '#0E7490', '#E0F2FE')}
            {card(Tag, 'Valor a precio de venta', totales.valor_venta, '#6D28D9', '#EDE9FE')}
            {card(TrendingUp, 'Ganancia si se vende todo', totales.ganancia, '#047857', '#DCFCE7')}
          </div>
          {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}

          <div className="pm-table-wrap" style={{ minHeight: 160 }}>
            <table className="pm-table">
              <thead><tr>{cols.map((c) => <th key={c.id} style={NUMERIC.includes(c.id) ? { textAlign: 'right' } : undefined}>{c.label}</th>)}<th style={{ width: 44 }} /></tr></thead>
              <tbody>
                {flat.map((p) => (
                  <tr key={p.id}>
                    {cols.map((c) => <td key={c.id} style={NUMERIC.includes(c.id) ? { textAlign: 'right' } : undefined}>{cell(c, p)}</td>)}
                    <td style={{ position: 'relative' }}>
                      <button className="pm-icon-btn" onClick={(e) => { const a = e.currentTarget.getBoundingClientRect(); setRowMenu(rowMenu?.id === p.id ? null : { id: p.id, anchor: a }); }} aria-label="Acciones"><MoreVertical size={18} /></button>
                      {rowMenu?.id === p.id && (
                        <FloatingMenu anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} width={250}>
                          <button onClick={() => { setRowMenu(null); onOpenKardex(p.id); }}><PackageSearch size={15} /> Ver Kárdex de movimientos</button>
                        </FloatingMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !flat.length && <div className="pm-empty"><Package size={40} />NO HAY PRODUCTOS PARA MOSTRAR</div>}
            {loading && <div className="pm-empty">Cargando…</div>}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{flat.length} producto(s) · los packs y boxes no forman parte del Kárdex</div>
        </div>
      </div>
    </div>
  );
}

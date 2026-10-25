import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Layers, Search, Pencil, X } from 'lucide-react';
import { productsAPI } from '../api';
import './party.css';

const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtFecha = (s) => {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
export const loteLabel = (l) => `${l.codigo || 'Lote'} · ${l.proveedor} · ${fmtFecha(l.fecha_compra)} · ${l.stock} u. · S/ ${money(l.costo_unit)}`;

/** Consulta de stock por lotes: producto, proveedor, fecha de compra, stock restante y costo real de cada lote. */
export default function LotesView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [prov, setProv] = useState('');
  const [agotados, setAgotados] = useState(false);
  const [edit, setEdit] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { productsAPI.suppliers().then((r) => setSuppliers(r.suppliers || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      if (prov !== '') q.set('proveedor_id', prov);
      if (agotados) q.set('con_stock', '0');
      const r = await productsAPI.getLotes(`?${q.toString()}`);
      setRows(r.lotes || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, prov, agotados]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const proveedores = useMemo(() => {
    const m = new Map(); rows.forEach((r) => m.set(r.proveedor_id, r.proveedor)); return [...m.entries()];
  }, [rows]);
  // El primer lote con stock de cada producto es el que sale primero (el más antiguo)
  const siguiente = useMemo(() => {
    const s = new Set(); const vistos = new Set();
    rows.forEach((r) => { if (r.stock > 0 && !vistos.has(r.producto_id)) { vistos.add(r.producto_id); s.add(r.id); } });
    return s;
  }, [rows]);
  const totUnid = rows.reduce((a, r) => a + r.stock, 0);
  const totVal = rows.reduce((a, r) => a + r.valor, 0);

  return (
    <div className="pm-card">
      <div className="pm-toolbar">
        <div className="pm-search" style={{ flex: 1, minWidth: 220 }}>
          <input placeholder="Buscar por producto, código, lote o proveedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" aria-label="Buscar"><Search size={17} /></button>
        </div>
        <select className="pm-select" value={prov} onChange={(e) => setProv(e.target.value)}>
          <option value="">Proveedor: todos</option>
          {proveedores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={agotados} onChange={(e) => setAgotados(e.target.checked)} /> Incluir lotes agotados
        </label>
      </div>
      {err && <div className="pm-empty" style={{ color: '#B91C1C' }}>{err}</div>}
      <div className="pm-table-wrap pm-fit" style={{ minHeight: 160 }}>
        <table className="pm-table" style={{ minWidth: 980 }}>
          <thead><tr>
            <th>Producto</th><th>Lote</th><th>Proveedor</th><th>Fecha de compra</th><th>Compra</th>
            <th style={{ textAlign: 'right' }}>Comprado</th><th style={{ textAlign: 'right' }}>Stock</th>
            <th style={{ textAlign: 'right' }}>Costo real</th><th style={{ textAlign: 'right' }}>Margen</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ width: 44 }} />
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const margen = r.precio_venta > 0 ? ((r.precio_venta - r.costo_unit) / r.precio_venta) * 100 : null;
              return (
                <tr key={r.id} style={r.stock > 0 ? undefined : { opacity: 0.55 }}>
                  <td><b>{r.producto}</b><div style={{ fontSize: 11.5, color: '#788A9B' }}>{r.producto_codigo}</div></td>
                  <td>{r.codigo || '—'} {siguiente.has(r.id) && <span title="Es el lote que se usa primero (más antiguo)" style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 999, padding: '1px 8px', fontSize: 10.5, fontWeight: 700, marginLeft: 4 }}>SALE PRIMERO</span>}</td>
                  <td>{r.proveedor}</td>
                  <td>{fmtFecha(r.fecha_compra)}</td>
                  <td>{r.compra_codigo || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.cantidad_inicial}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{r.stock}</td>
                  <td style={{ textAlign: 'right' }}>S/ {money(r.costo_unit)}</td>
                  <td style={{ textAlign: 'right', color: margen !== null && margen < 15 ? '#B45309' : undefined }}>{margen === null ? '—' : `${margen.toFixed(1)}%`}</td>
                  <td style={{ textAlign: 'right' }}>S/ {money(r.valor)}</td>
                  <td><button type="button" className="pm-icon-btn" title="Editar lote" aria-label="Editar lote" onClick={() => setEdit({ ...r, fecha: String(r.fecha_compra || '').slice(0, 10), costo: String(r.costo_unit), stockN: String(r.stock) })}><Pencil size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="pm-empty"><Layers size={40} />NO HAY LOTES PARA MOSTRAR (se crean con cada compra)</div>}
        {loading && <div className="pm-empty">Cargando…</div>}
      </div>
      <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>
        {rows.length} lote(s) · {totUnid} unidades · valor al costo S/ {money(totVal)}
      </div>
      {edit && <LoteEditor lote={edit} suppliers={suppliers} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

/** Edición de un lote para regularizar datos (proveedor, N° de lote, fecha, costo, stock). */
function LoteEditor({ lote, suppliers, onClose, onSaved }) {
  const [f, setF] = useState({ proveedor_id: String(lote.proveedor_id || 0), codigo: lote.codigo || '', fecha: lote.fecha, costo: lote.costo, stock: lote.stockN, nota: lote.nota || '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = async (e) => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      await productsAPI.updateLote(lote.id, { proveedor_id: Number(f.proveedor_id) || 0, codigo: f.codigo, fecha_compra: f.fecha || null, costo_unit: Number(f.costo), stock: Number(f.stock), nota: f.nota });
      onSaved();
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };
  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="pm-modal" style={{ maxWidth: 520 }} onSubmit={save}>
        <button type="button" className="pm-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <h3>Editar lote</h3>
        <div className="sub">{lote.producto}</div>
        {err && <div className="pm-err">{err}</div>}
        <div className="pm-grid2">
          <div className="pm-f"><label>Proveedor</label>
            <select className="pm-in" value={f.proveedor_id} onChange={(e) => set({ proveedor_id: e.target.value })}>
              <option value="0">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select></div>
          <div className="pm-f"><label>N° de lote / referencia</label><input className="pm-in" maxLength={60} value={f.codigo} onChange={(e) => set({ codigo: e.target.value })} /></div>
          <div className="pm-f"><label>Fecha de compra</label><input type="date" className="pm-in" value={f.fecha} onChange={(e) => set({ fecha: e.target.value })} /></div>
          <div className="pm-f"><label>Costo real unitario (S/)</label><input type="number" min="0" step="0.0001" className="pm-in" value={f.costo} onChange={(e) => set({ costo: e.target.value })} /></div>
          <div className="pm-f"><label>Stock del lote</label><input type="number" min="0" step="1" className="pm-in" value={f.stock} onChange={(e) => set({ stock: e.target.value })} /></div>
          <div className="pm-f"><label>Nota</label><input className="pm-in" maxLength={150} value={f.nota} onChange={(e) => set({ nota: e.target.value })} /></div>
        </div>
        <p style={{ fontSize: 12, color: '#788A9B', margin: '4px 0 10px' }}>La fecha define el orden de salida: el lote más antiguo se usa primero. Si cambias el stock, se ajusta el stock total del producto y queda en el Kardex. Las ventas ya hechas no cambian su costo.</p>
        <div className="pm-foot">
          <button type="button" className="c" onClick={onClose}>Cancelar</button>
          <button type="submit" className="s" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  );
}

import { thumbSrc, thumbFallback, imgSrc } from '../utils/img';
import { urlToThumb } from '../utils/image';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Gift, Search, PlusCircle, MoreVertical, CheckCircle2, XCircle, Download, Edit2, Power, Boxes, Eye, AlertTriangle, X, RefreshCw, Package, Trash2, Upload, FileSpreadsheet, Copy } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../api';
import FloatingMenu from '../components/FloatingMenu';
import ProductForm from '../components/ProductForm';
import PackForm from '../components/PackForm';
import ImportProductsModal from '../components/ImportProductsModal';
import LotesView, { loteLabel, fmtFecha } from '../components/LotesView';
import '../components/party.css';

const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PROD_COLS = [
  { id: 'nombre', label: 'Producto', always: true },
  { id: 'codigo', label: 'Cód. interno', def: true },
  { id: 'unidad', label: 'Unidad', def: true },
  { id: 'imagen', label: 'Imagen', def: true },
  { id: 'stock', label: 'Stock', def: true },
  { id: 'precio_costo', label: 'P. unitario compra', def: true },
  { id: 'precio_venta', label: 'P. unitario venta', def: true },
  { id: 'marca', label: 'Marca', def: true },
  { id: 'categoria', label: 'Categoría', def: true },
  { id: 'ocasion', label: 'Ocasión especial', def: true },
  { id: 'insumo', label: 'Precio insumo', def: false },
  { id: 'estado', label: 'Estado', def: true }
];
const PACK_COLS = [
  { id: 'contenido', label: 'Contenido', always: true },
  { id: 'codigo', label: 'Cód. interno', def: true },
  { id: 'unidad', label: 'Unidad', def: true },
  { id: 'nombre', label: 'Nombre', always: true },
  { id: 'descripcion', label: 'Descripción', def: true },
  { id: 'precio_venta', label: 'P. unitario venta', def: true },
  { id: 'costo', label: 'Costo real', def: true },
  { id: 'ganancia', label: 'Ganancia', def: true },
  { id: 'stock', label: 'Stock', def: false },
  { id: 'estado', label: 'Estado', def: true }
];

/** Detecta si el contenedor de la tabla es angosto (pantalla dividida) para mostrar solo columnas esenciales */
function useCompact(limit = 900) {
  const ref = React.useRef(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setCompact(el.clientWidth < limit));
    ro.observe(el); setCompact(el.clientWidth < limit);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, compact];
}
const ESENCIALES_PROD = ['nombre', 'imagen', 'stock', 'precio_venta', 'estado'];
const ESENCIALES_PACK = ['contenido', 'nombre', 'precio_venta', 'estado'];
const UNI = { NIU: 'UND', KGM: 'KG', MTR: 'M', LTR: 'L', BX: 'CAJA', DZN: 'DOC', PK: 'PQT', SET: 'JGO' };

const exportCsv = (rows, cols, file) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map((c) => esc(c.h)).join(','), ...rows.map((r) => cols.map((c) => esc(c.v(r))).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = file; a.click();
};

function useCols(key, defs) {
  const [st, setSt] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(s)) return { vis: s, order: [] };
      if (s && Array.isArray(s.vis)) return { vis: s.vis, order: Array.isArray(s.order) ? s.order : [] };
    } catch (e) { /* sin guardado */ }
    return { vis: defs.filter((c) => c.def).map((c) => c.id), order: [] };
  });
  const save = (next) => { setSt(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) { /* sin guardado */ } };
  // Orden completo: primero el guardado, luego las columnas nuevas en su posición original
  const ids = [...st.order.filter((id) => defs.some((d) => d.id === id)), ...defs.map((d) => d.id).filter((id) => !st.order.includes(id))];
  const ordered = ids.map((id) => defs.find((d) => d.id === id));
  const toggle = (id) => save({ ...st, vis: st.vis.includes(id) ? st.vis.filter((x) => x !== id) : [...st.vis, id] });
  const moveTo = (from, to) => {
    if (from === to) return;
    const arr = ids.filter((x) => x !== from);
    arr.splice(Math.max(0, arr.indexOf(to) + (ids.indexOf(from) < ids.indexOf(to) ? 1 : 0)), 0, from);
    save({ ...st, order: arr });
  };
  const nudge = (id, d) => {
    const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const arr = [...ids]; [arr[i], arr[j]] = [arr[j], arr[i]];
    save({ ...st, order: arr });
  };
  const reset = () => save({ vis: defs.filter((c) => c.def).map((c) => c.id), order: [] });
  return [ordered.filter((c) => c.always || st.vis.includes(c.id)), st.vis, toggle, { ordered, moveTo, nudge, reset }];
}

/** Menú de columnas: marcar/ocultar y reordenar con flechas */
function ColMenu({ api, vis, toggle, onClose, anchor }) {
  const arrow = { border: 0, background: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 12, color: '#64748B' };
  return (
    <FloatingMenu anchor={anchor} onClose={onClose} keepOpen width={290}>
      <div style={{ fontSize: 11.5, color: '#788A9B', padding: '2px 4px 6px' }}>Marca las visibles y reordénalas con ▲▼ (o arrastra el encabezado de la tabla).</div>
      {api.ordered.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ flex: 1 }}><input type="checkbox" checked={c.always || vis.includes(c.id)} disabled={!!c.always} onChange={() => toggle(c.id)} /> {c.label}</label>
          <button type="button" style={arrow} disabled={i === 0} onClick={() => api.nudge(c.id, -1)} aria-label="Subir">▲</button>
          <button type="button" style={arrow} disabled={i === api.ordered.length - 1} onClick={() => api.nudge(c.id, 1)} aria-label="Bajar">▼</button>
        </div>
      ))}
      <button type="button" onClick={api.reset} style={{ ...arrow, color: '#4F8EF7', fontWeight: 700, marginTop: 6 }}>Restablecer columnas</button>
    </FloatingMenu>
  );
}

/** Encabezados arrastrables */
const dragProps = (api, id, label) => ({
  draggable: true, title: 'Arrastra para mover la columna', style: { cursor: 'grab' },
  onDragStart: (e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; },
  onDragOver: (e) => e.preventDefault(),
  onDrop: (e) => { e.preventDefault(); api.moveTo(e.dataTransfer.getData('text/plain'), id); },
  children: label
});

export default function Inventory() {
  const [view, setView] = useState('productos');
  const [categories, setCategories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null);     // { id? }
  const [packForm, setPackForm] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [revisarCount, setRevisarCount] = useState(0);

  const loadCats = useCallback(() => categoriesAPI.getAll().then((r) => setCategories(r.categories || [])).catch(() => {}), []);
  const loadCatalog = useCallback(() => productsAPI.getAll('?estado=habilitados&tipo=producto').then((r) => setCatalog(r.products || [])).catch(() => {}), []);
  useEffect(() => { loadCats(); loadCatalog(); }, [loadCats, loadCatalog]);

  const refreshAll = () => { loadCatalog(); setReload((n) => n + 1); };
  const [reload, setReload] = useState(0);

  return (
    <div className="content-body animate-fade-in">
    <div className="pm">
      <div className="pm-card pm-head">
        <div className="pm-head-l">
          <Gift size={38} color="#FF7A3C" strokeWidth={1.7} />
          <div>
            <h2>Productos</h2>
            <p>Catálogo, precios, insumos y packs de tu tienda</p>
          </div>
        </div>
        <div className="pm-tabs" style={{ margin: 0 }}>
          <button className={view === 'productos' ? 'on' : ''} onClick={() => setView('productos')}>Productos</button>
          <button className={view === 'packs' ? 'on' : ''} onClick={() => setView('packs')}>
            Boxes y Packs {revisarCount > 0 && <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{revisarCount}</span>}
          </button>
          <button className={view === 'lotes' ? 'on' : ''} onClick={() => setView('lotes')}>Lotes</button>
        </div>
      </div>

      {view === 'lotes' ? <LotesView /> : view === 'productos'
        ? <ProductList key={reload} categories={categories} onNew={() => setForm({})} onEdit={(id) => setForm({ id })} onDuplicate={(id) => setForm({ duplicateFrom: id })} />
        : <PackList key={reload} onNew={() => setPackForm({})} onEdit={(id) => setPackForm({ id })} onContenido={setContenido} onRevisar={setRevisarCount} />}

      {form && (
        <ProductForm key={form.duplicateFrom || form.id || 'new'} productId={form.id} duplicateFrom={form.duplicateFrom} categories={categories} catalog={catalog}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshAll(); }} onCategoryCreated={setCategories} />
      )}
      {packForm && (
        <PackForm packId={packForm.id} categories={categories} catalog={catalog}
          onClose={() => setPackForm(null)} onSaved={() => { setPackForm(null); refreshAll(); }} />
      )}
      {contenido && <ContenidoModal packId={contenido} onClose={() => setContenido(null)} />}
    </div>
    </div>
  );
}

/* ====================== LISTA DE PRODUCTOS ====================== */
function ProductList({ categories, onNew, onEdit, onDuplicate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('habilitados');
  const [stock, setStock] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('producto');
  const [selected, setSelected] = useState([]);
  const [menu, setMenu] = useState(false);
  const [colMenu, setColMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [provView, setProvView] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [err, setErr] = useState('');
  const [allCols, vis, toggleCol, colApi] = useCols('cols_productos_v2', PROD_COLS);
  const [wrapRef, compact] = useCompact();
  const cols = compact ? allCols.filter((c) => ESENCIALES_PROD.includes(c.id)) : allCols;

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams({ estado });
      if (search.trim()) q.set('search', search.trim());
      if (stock) q.set('stock', stock);
      if (categoria) q.set('categoria_id', categoria);
      if (tipo) q.set('tipo', tipo);
      const r = await productsAPI.getAll(`?${q.toString()}`);
      setRows(r.products || []); setSelected([]);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, estado, stock, categoria, tipo]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setActivo = async (ids, activo) => {
    try { await Promise.all(ids.map((id) => productsAPI.setActive(id, activo))); load(); } catch (e) { setErr(e.message); }
    setMenu(false); setRowMenu(null);
  };
  const [notice, setNotice] = useState('');
  // Reduce a miniaturas (160 px) las fotos que aún son copia de la foto completa
  const optimizeThumbs = async () => {
    setMenu(false);
    try {
      const r = await productsAPI.pendingThumbs();
      const list = r.pendientes || [];
      if (!list.length) { setNotice('Todas las miniaturas ya están optimizadas.'); return; }
      let ok = 0;
      for (let i = 0; i < list.length; i++) {
        setNotice(`Optimizando miniaturas… ${i + 1} de ${list.length}`);
        try { await productsAPI.saveThumb(list[i].id, await urlToThumb(imgSrc(list[i].imagen_url))); ok++; } catch (e) { /* se omite esa imagen */ }
      }
      setNotice(`Miniaturas optimizadas: ${ok} de ${list.length}.`);
      load();
    } catch (e) { setErr(e.message); }
  };
  const eliminar = async (r) => {
    setRowMenu(null);
    if (!window.confirm(`¿Eliminar "${r.nombre}"?\n\nSi el producto ya está en algún pedido, compra o cotización, solo se deshabilitará.`)) return;
    try { const res = await productsAPI.delete(r.id); setNotice(res.message || 'Listo'); load(); } catch (e) { setErr(e.message); }
  };
  const allSel = rows.length > 0 && selected.length === rows.length;

  const cell = (c, r) => {
    switch (c.id) {
      case 'nombre': return (<>{r.nombre}{r.es_insumo ? <span className="pm-tag" style={{ marginLeft: 6 }}>insumo</span> : null}{r.nombre_secundario ? <span className="pm-extra">{r.nombre_secundario}</span> : null}</>);
      case 'codigo': return r.codigo;
      case 'unidad': return UNI[r.unidad] || r.unidad || 'UND';
      case 'imagen': return r.imagen_url ? <img src={thumbSrc(r.imagen_url)} onError={thumbFallback(r.imagen_url)} alt="" loading="lazy" decoding="async" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: '#F3F5FA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Package size={18} color="#B9BED3" /></span>;
      case 'stock': return <span style={{ fontWeight: 700, color: Number(r.stock) <= 0 ? '#B91C1C' : Number(r.stock) <= Number(r.stock_minimo) ? '#B45309' : 'inherit' }}>{Number(r.stock)}</span>;
      case 'precio_costo': return `S/ ${money(r.precio_costo)}`;
      case 'precio_venta': return (<>S/ {money(r.precio_venta)}{r.escalas?.length > 0 && <span className="pm-extra">{r.escalas.length} presentación(es)</span>}</>);
      case 'marca': return r.marca_nombre || '';
      case 'categoria': return r.categoria_nombre || '';
      case 'ocasion': return r.ocasion_nombre || '';
      case 'insumo': return r.es_insumo ? `S/ ${money(r.precio_insumo ?? r.precio_venta)}` : '';
      case 'estado': return r.activo ? <span className="pm-state on"><CheckCircle2 size={16} /> HABILITADO</span> : <span className="pm-state off"><XCircle size={16} /> DESHABILITADO</span>;
      default: return '';
    }
  };

  return (
    <div className="pm-card" style={{ paddingBottom: 6 }}>
      <div className="pm-toolbar">
        <select className="pm-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="habilitados">Habilitados</option><option value="deshabilitados">Deshabilitados</option><option value="todos">Todos</option>
        </select>
        <select className="pm-select" value={stock} onChange={(e) => setStock(e.target.value)}>
          <option value="">Stock: todos</option><option value="con">Con stock</option><option value="sin">Sin stock</option><option value="bajo">Stock bajo</option>
        </select>
        <select className="pm-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Categoría: todas</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="pm-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="producto">Productos</option><option value="insumo">Solo insumos</option><option value="">Productos y packs</option>
        </select>
        <div className="pm-head-r" style={{ marginLeft: 'auto' }}>
          <div className="pm-colsel">
            <button className="pm-btn-outline" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }}>Columnas</button>
            {colMenu && (
              <ColMenu api={colApi} vis={vis} toggle={toggleCol} anchor={colMenu} onClose={() => setColMenu(false)} />
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="pm-btn-outline" onClick={() => setMenu((v) => !v)}><MoreVertical size={16} /> Más acciones</button>
            {menu && (
              <div className="pm-menu" onMouseLeave={() => setMenu(false)}>
                <button disabled={!selected.length} onClick={() => setActivo(selected, 1)}><CheckCircle2 size={15} /> Habilitar seleccionados</button>
                <button disabled={!selected.length} onClick={() => setActivo(selected, 0)}><XCircle size={15} /> Deshabilitar seleccionados</button>
                <button onClick={() => { setShowImport(true); setMenu(false); }}><Upload size={15} /> Importar desde Excel</button>
                <button onClick={optimizeThumbs}><Package size={15} /> Optimizar miniaturas</button>
                <button onClick={() => { setMenu(false); productsAPI.downloadExcel('exportar', 'productos.xlsx').catch((e) => setErr(e.message)); }}><FileSpreadsheet size={15} /> Exportar a Excel (con precios y packs)</button>
                <button onClick={() => { setMenu(false); productsAPI.downloadExcel('plantilla', 'plantilla_productos.xlsx').catch((e) => setErr(e.message)); }}><Download size={15} /> Descargar plantilla de Excel</button>
                <button onClick={() => {
                  exportCsv(rows, [
                    { h: 'Código', v: (r) => r.codigo }, { h: 'Producto', v: (r) => r.nombre }, { h: 'Unidad', v: (r) => UNI[r.unidad] || r.unidad },
                    { h: 'Stock', v: (r) => r.stock }, { h: 'P. compra', v: (r) => r.precio_costo }, { h: 'P. venta', v: (r) => r.precio_venta },
                    { h: 'Marca', v: (r) => r.marca_nombre }, { h: 'Categoría', v: (r) => r.categoria_nombre }
                  ], 'productos.csv'); setMenu(false);
                }}><Download size={15} /> Exportar lista (CSV)</button>
              </div>
            )}
          </div>
          <button className="pm-btn-green" onClick={onNew}><PlusCircle size={20} /> Nuevo producto</button>
        </div>
      </div>
      <div className="pm-toolbar" style={{ paddingTop: 0 }}>
        <div className="pm-search" style={{ marginLeft: 0, flexBasis: '100%' }}>
          <input placeholder="Buscar por nombre, código o código de barras…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" aria-label="Buscar"><Search size={18} /></button>
        </div>
      </div>
      {showImport && <ImportProductsModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); setNotice('Productos importados correctamente.'); }} />}
      {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
      {notice && <div className="pm-bulk" style={{ justifyContent: 'space-between' }}><span>{notice}</span><button onClick={() => setNotice('')}>OK</button></div>}
      {selected.length > 0 && <div className="pm-bulk">{selected.length} seleccionado(s)<button onClick={() => setActivo(selected, 1)}>Habilitar</button><button onClick={() => setActivo(selected, 0)}>Deshabilitar</button></div>}

      <div className="pm-table-wrap pm-fit" ref={wrapRef} style={{ minHeight: 160 }}>
        <table className="pm-table">
          <thead>
            <tr>
              <th className="pm-sticky-l" style={{ width: 76 }}><input type="checkbox" className="pm-chk" checked={allSel} onChange={() => setSelected(allSel ? [] : rows.map((r) => r.id))} aria-label="Seleccionar todos" /></th>
              {cols.map((c) => <th key={c.id} {...dragProps(colApi, c.id, c.label)} />)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={r.activo ? undefined : { opacity: 0.6 }}>
                <td className="pm-sticky-l"><div className="pm-rowact"><input type="checkbox" className="pm-chk" checked={selected.includes(r.id)} onChange={() => setSelected(selected.includes(r.id) ? selected.filter((x) => x !== r.id) : [...selected, r.id])} aria-label="Seleccionar" />
                  <button className="pm-icon-btn" onClick={(e) => { const a = e.currentTarget.getBoundingClientRect(); setRowMenu(rowMenu?.id === r.id ? null : { id: r.id, anchor: a }); }} aria-label="Acciones"><MoreVertical size={18} /></button>
                  {rowMenu?.id === r.id && (
                    <FloatingMenu anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} width={200}>
                      <button onClick={() => { setRowMenu(null); onEdit(r.id); }}><Edit2 size={15} /> Editar</button>
                      <button onClick={() => { setRowMenu(null); onDuplicate(r.id); }}><Copy size={15} /> Duplicar (variante)</button>
                      <button onClick={() => { setRowMenu(null); setProvView(r); }}><Boxes size={15} /> Stock por proveedor</button>
                      <button onClick={() => setActivo([r.id], r.activo ? 0 : 1)}><Power size={15} /> {r.activo ? 'Deshabilitar' : 'Habilitar'}</button>
                      <button style={{ color: '#B91C1C' }} onClick={() => eliminar(r)}><Trash2 size={15} /> Eliminar</button>
                    </FloatingMenu>
                  )}
                </div></td>
                {cols.map((c) => <td key={c.id}>{cell(c, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="pm-empty"><Gift size={40} />NO HAY PRODUCTOS PARA MOSTRAR</div>}
        {loading && <div className="pm-empty">Cargando…</div>}
      </div>
      <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{rows.length} producto(s)</div>
      {provView && (
        <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setProvView(null); }}>
          <div className="pm-modal" style={{ maxWidth: 520 }}>
            <button type="button" className="pm-close" onClick={() => setProvView(null)} aria-label="Cerrar"><X size={20} /></button>
            <h3>Stock por proveedor y lote</h3>
            <div className="sub">{provView.nombre} · total {provView.stock} {provView.unidad_medida || 'UND'}</div>
            {(provView.stock_proveedores || []).length === 0
              ? <div style={{ color: '#788A9B', fontSize: 14 }}>Aún no hay stock repartido por proveedor. Se llena con las compras que registres.</div>
              : (
                <table className="pm-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Proveedor</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>Costo real prom.</th></tr></thead>
                  <tbody>{provView.stock_proveedores.map((s) => (
                    <tr key={s.proveedor_id}><td>{s.proveedor}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{s.stock}</td><td style={{ textAlign: 'right' }}>S/ {money(s.costo_unit)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            {(provView.lotes || []).length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, margin: '14px 0 4px' }}>Lotes con stock (el primero sale primero)</div>
                <table className="pm-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Lote</th><th>Proveedor</th><th>Compra</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>Costo</th></tr></thead>
                  <tbody>{provView.lotes.map((l) => (
                    <tr key={l.id}><td>{l.codigo || '—'}</td><td>{l.proveedor}</td><td>{fmtFecha(l.fecha_compra)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{l.stock}</td><td style={{ textAlign: 'right' }}>S/ {money(l.costo_unit)}</td></tr>
                  ))}</tbody>
                </table>
              </>
            )}
            <p style={{ fontSize: 12, color: '#788A9B', marginTop: 12 }}>Costo real: con factura es sin IGV; con boleta, nota de venta o sin comprobante es lo que pagaste (IGV incluido). Las ventas descuentan primero el lote más antiguo; en la venta puedes elegir otro lote.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== LISTA DE BOXES Y PACKS ====================== */
function PackList({ onNew, onEdit, onContenido, onRevisar }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('habilitados');
  const [soloRevisar, setSoloRevisar] = useState(false);
  const [menu, setMenu] = useState(false);
  const [colMenu, setColMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [selected, setSelected] = useState([]);
  const [err, setErr] = useState('');
  const [allCols, vis, toggleCol, colApi] = useCols('cols_packs_v1', PACK_COLS);
  const [wrapRef, compact] = useCompact();
  const cols = compact ? allCols.filter((c) => ESENCIALES_PACK.includes(c.id)) : allCols;

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams({ estado });
      if (search.trim()) q.set('search', search.trim());
      const r = await productsAPI.packs(`?${q.toString()}`);
      const list = r.packs || [];
      setRows(list); setSelected([]);
      onRevisar(list.filter((p) => p.revisar).length);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, estado]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setActivo = async (ids, activo) => {
    try { await Promise.all(ids.map((id) => productsAPI.setActive(id, activo))); load(); } catch (e) { setErr(e.message); }
    setMenu(false); setRowMenu(null);
  };
  const revisar = async (id, actualizar) => {
    try { await productsAPI.reviewPack(id, actualizar); load(); } catch (e) { setErr(e.message); }
    setRowMenu(null);
  };

  const [notice, setNotice] = useState('');
  const eliminar = async (r) => {
    setRowMenu(null);
    if (!window.confirm(`¿Eliminar el pack "${r.nombre}"?\n\nSi ya se vendió o cotizó, solo se deshabilitará.`)) return;
    try { const res = await productsAPI.delete(r.id); setNotice(res.message || 'Listo'); load(); } catch (e) { setErr(e.message); }
  };
  const shown = soloRevisar ? rows.filter((r) => r.revisar) : rows;
  const nRev = rows.filter((r) => r.revisar).length;
  const allSel = shown.length > 0 && selected.length === shown.length;

  const cell = (c, r) => {
    switch (c.id) {
      case 'contenido': return <button className="pm-doc-btn" style={{ background: '#4F8EF7', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'auto' }} onClick={() => onContenido(r.id)}><Eye size={14} /> Ver ({r.total_componentes})</button>;
      case 'codigo': return r.codigo;
      case 'unidad': return UNI[r.unidad] || 'UND';
      case 'nombre': return (<>{r.nombre}{r.revisar && <span className="pm-tag" style={{ background: '#FEF3C7', color: '#92400E', marginLeft: 6 }}><AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> Revisar precios</span>}</>);
      case 'descripcion': return r.descripcion || '';
      case 'precio_venta': return `S/ ${money(r.precio_venta)}`;
      case 'costo': return `S/ ${money(r.costo_total)}`;
      case 'ganancia': return <span style={{ fontWeight: 700, color: r.ganancia >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(r.ganancia)} <span style={{ fontWeight: 500, color: '#788A9B' }}>({Math.round(r.margen)}%)</span></span>;
      case 'stock': return r.stock;
      case 'estado': return r.activo ? <span className="pm-state on"><CheckCircle2 size={16} /> HABILITADO</span> : <span className="pm-state off"><XCircle size={16} /> DESHABILITADO</span>;
      default: return '';
    }
  };

  return (
    <div className="pm-card" style={{ paddingBottom: 6 }}>
      <div className="pm-toolbar">
        <select className="pm-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="habilitados">Habilitados</option><option value="deshabilitados">Deshabilitados</option><option value="todos">Todos</option>
        </select>
        <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 260px' }}>
          <input placeholder="Buscar pack por nombre o código…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" aria-label="Buscar"><Search size={18} /></button>
        </div>
        <div className="pm-head-r">
          <div className="pm-colsel">
            <button className="pm-btn-outline" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }}>Columnas</button>
            {colMenu && (
              <ColMenu api={colApi} vis={vis} toggle={toggleCol} anchor={colMenu} onClose={() => setColMenu(false)} />
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="pm-btn-outline" onClick={() => setMenu((v) => !v)}><MoreVertical size={16} /> Más acciones</button>
            {menu && (
              <div className="pm-menu" onMouseLeave={() => setMenu(false)}>
                <button disabled={!selected.length} onClick={() => setActivo(selected, 1)}><CheckCircle2 size={15} /> Habilitar seleccionados</button>
                <button disabled={!selected.length} onClick={() => setActivo(selected, 0)}><XCircle size={15} /> Deshabilitar seleccionados</button>
                <button onClick={() => {
                  exportCsv(shown, [
                    { h: 'Código', v: (r) => r.codigo }, { h: 'Pack', v: (r) => r.nombre }, { h: 'P. venta', v: (r) => r.precio_venta },
                    { h: 'Costo real', v: (r) => r.costo_total }, { h: 'Ganancia', v: (r) => r.ganancia }, { h: 'Margen %', v: (r) => r.margen }, { h: 'Revisar', v: (r) => (r.revisar ? 'SI' : '') }
                  ], 'packs.csv'); setMenu(false);
                }}><Download size={15} /> Exportar lista (CSV)</button>
              </div>
            )}
          </div>
          <button className="pm-btn-green" onClick={onNew}><PlusCircle size={20} /> Nuevo pack</button>
        </div>
      </div>

      {nRev > 0 && (
        <div style={{ margin: '4px 20px 8px', background: '#FFF7E0', border: '1px solid #F5D77A', color: '#7A5B00', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <AlertTriangle size={18} />
          <span><strong>{nRev} pack(s)</strong> llevan productos cuyo precio o costo cambió. Revísalos y ajusta su precio de venta.</span>
          <button className="pm-btn-outline" style={{ fontSize: 12.5, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => setSoloRevisar((v) => !v)}>{soloRevisar ? 'Ver todos' : 'Ver solo los afectados'}</button>
        </div>
      )}
      {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
      {notice && <div className="pm-bulk" style={{ justifyContent: 'space-between' }}><span>{notice}</span><button onClick={() => setNotice('')}>OK</button></div>}

      <div className="pm-table-wrap pm-fit" ref={wrapRef} style={{ minHeight: 160 }}>
        <table className="pm-table">
          <thead>
            <tr>
              <th className="pm-sticky-l" style={{ width: 76 }}><input type="checkbox" className="pm-chk" checked={allSel} onChange={() => setSelected(allSel ? [] : shown.map((r) => r.id))} aria-label="Seleccionar todos" /></th>
              {cols.map((c) => <th key={c.id} {...dragProps(colApi, c.id, c.label)} />)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={r.activo ? undefined : { opacity: 0.6 }}>
                <td className="pm-sticky-l"><div className="pm-rowact"><input type="checkbox" className="pm-chk" checked={selected.includes(r.id)} onChange={() => setSelected(selected.includes(r.id) ? selected.filter((x) => x !== r.id) : [...selected, r.id])} aria-label="Seleccionar" />
                  <button className="pm-icon-btn" onClick={(e) => { const a = e.currentTarget.getBoundingClientRect(); setRowMenu(rowMenu?.id === r.id ? null : { id: r.id, anchor: a }); }} aria-label="Acciones"><MoreVertical size={18} /></button>
                  {rowMenu?.id === r.id && (
                    <FloatingMenu anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} width={240}>
                      <button onClick={() => { setRowMenu(null); onEdit(r.id); }}><Edit2 size={15} /> Editar / revisar precios</button>
                      {r.revisar && <button onClick={() => revisar(r.id, true)}><RefreshCw size={15} /> Actualizar a precios actuales</button>}
                      {r.revisar && <button onClick={() => revisar(r.id, false)}><CheckCircle2 size={15} /> Marcar como revisado</button>}
                      <button onClick={() => setActivo([r.id], r.activo ? 0 : 1)}><Power size={15} /> {r.activo ? 'Deshabilitar' : 'Habilitar'}</button>
                      <button style={{ color: '#B91C1C' }} onClick={() => eliminar(r)}><Trash2 size={15} /> Eliminar</button>
                    </FloatingMenu>
                  )}
                </div></td>
                {cols.map((c) => <td key={c.id}>{cell(c, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && shown.length === 0 && <div className="pm-empty"><Boxes size={40} />NO HAY PACKS PARA MOSTRAR</div>}
        {loading && <div className="pm-empty">Cargando…</div>}
      </div>
      <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{shown.length} pack(s)</div>
    </div>
  );
}

/* ====================== CONTENIDO DE UN PACK ====================== */
function ContenidoModal({ packId, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { productsAPI.getById(packId).then((r) => setP(r.product)).catch((e) => setErr(e.message)); }, [packId]);
  const comps = p?.componentes || [];
  const costo = comps.reduce((s, c) => s + Number(c.cantidad) * Number(c.costo_actual || 0), 0);
  const valor = comps.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unit || 0), 0);
  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm-modal" style={{ maxWidth: 640 }}>
        <button className="pm-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <h3>{p ? p.nombre : 'Contenido'}</h3>
        <div className="sub">Lo que lleva este pack · venta S/ {money(p?.precio_venta)}</div>
        {err && <div className="pm-err">{err}</div>}
        <table className="pm-table" style={{ minWidth: 0 }}>
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio insumo</th><th>Subtotal</th></tr></thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.componente_id}>
                <td>{c.nombre}{c.cambio && <span className="pm-tag" style={{ background: '#FEF3C7', color: '#92400E', marginLeft: 6 }}>cambió</span>}</td>
                <td>{Number(c.cantidad)}</td><td>S/ {money(c.precio_unit)}</td><td>S/ {money(Number(c.cantidad) * Number(c.precio_unit))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p && (
          <div style={{ marginTop: 12, fontSize: 13.5, display: 'grid', gap: 4 }}>
            <div>Valor de insumos: <strong>S/ {money(valor)}</strong> · Costo real: <strong>S/ {money(costo)}</strong></div>
            <div>Ganancia estimada: <strong style={{ color: Number(p.precio_venta) - costo >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(Number(p.precio_venta) - costo)}</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}

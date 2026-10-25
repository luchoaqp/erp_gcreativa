import React, { useState, useEffect } from 'react';
import { X, Package, Calculator, Boxes, Camera, Plus, ChevronDown, Trash2, Factory } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../api';
import { imageToDataUrls } from '../utils/image';
import { imgSrc } from '../utils/img';
import ComponentEditor, { totalsOf } from './ComponentEditor';
import './party.css';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UNIDADES = [
  ['NIU', 'UND'], ['KGM', 'KG'], ['MTR', 'M'], ['LTR', 'L'], ['BX', 'CAJA'], ['DZN', 'DOC'], ['PK', 'PQT'], ['SET', 'JGO']
];
const TABS = [
  { id: 'general', label: 'General', Icon: Package },
  { id: 'precios', label: 'Precios', Icon: Calculator },
  { id: 'produccion', label: 'Producción', Icon: Factory }
];

const emptyForm = () => ({
  codigo: '', codigo_barras: '', nombre: '', imagen_url: '', precio_venta: '', precio_costo: '', stock: '0', stock_minimo: '5',
  unidad: 'NIU', moneda: 'PEN', categoria_id: '', ocasion_id: '', marca_id: '', nombre_secundario: '', modelo: '', linea: '', codigo_fabrica: '',
  descripcion: '', categorias_ids: [], es_personalizable: true, destacado: false, activo: 1,
  precio_editable: true, precio_por_cantidad: false, proveedor_id: '', ganancia_pct: '', calcular_con_ganancia: false,
  es_insumo: false, precio_insumo: '', requiere_insumos: false
});

export default function ProductForm({ productId, duplicateFrom, categories, catalog, onClose, onSaved, onCategoryCreated }) {
  const [tab, setTab] = useState('general');
  const [f, setF] = useState(emptyForm());
  const [presentaciones, setPresentaciones] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cats, setCats] = useState(categories || []);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(!!(productId || duplicateFrom));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [newCat, setNewCat] = useState(null);
  const [ocasiones, setOcasiones] = useState([]);
  const [newOcc, setNewOcc] = useState(null);
  const [newBrand, setNewBrand] = useState(null);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => {
    categoriesAPI.getAll().then((r) => setOcasiones(r.occasions || [])).catch(() => {});
    productsAPI.brands().then((r) => setBrands(r.brands || [])).catch(() => {});
    productsAPI.suppliers().then((r) => setSuppliers(r.suppliers || [])).catch(() => {});
    if (productId || duplicateFrom) {
      productsAPI.getById(productId || duplicateFrom).then((r) => {
        const p = r.product;
        setF({
          ...emptyForm(), ...Object.fromEntries(Object.keys(emptyForm()).map((k) => [k, p[k] ?? emptyForm()[k]])),
          precio_editable: !!p.precio_editable, precio_por_cantidad: !!p.precio_por_cantidad, calcular_con_ganancia: !!p.calcular_con_ganancia,
          es_insumo: !!p.es_insumo, requiere_insumos: !!p.requiere_insumos, es_personalizable: !!p.es_personalizable, destacado: !!p.destacado,
          categorias_ids: p.categorias_ids || [], ocasion_id: p.ocasion_id || '', marca_id: p.marca_id || '', proveedor_id: p.proveedor_id || '',
          precio_insumo: p.precio_insumo ?? '', ganancia_pct: p.ganancia_pct ?? ''
        });
        setPresentaciones((p.presentaciones || []).map((x) => ({ etiqueta: x.etiqueta, descripcion: x.descripcion || '', factor: x.factor, precio: x.precio })));
        setComponentes(p.componentes || []);
        setMore(!!(p.nombre_secundario || p.modelo || p.linea || p.codigo_fabrica || p.descripcion));
        if (duplicateFrom) {
          // Copia: stock 0, código nuevo, sin código de barras y con el nombre marcado para que lo cambies (color, tamaño…)
          setF((prev) => ({ ...prev, nombre: `${p.nombre} (copia)`, stock: '0', codigo_barras: '', activo: 1 }));
          productsAPI.nextCode().then((c) => set({ codigo: c.codigo })).catch(() => {});
        }
      }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    } else {
      productsAPI.nextCode().then((r) => set({ codigo: r.codigo })).catch(() => {});
    }
  }, [productId, duplicateFrom]);

  // Venta calculada con la ganancia deseada sobre el precio de compra
  useEffect(() => {
    if (f.calcular_con_ganancia && f.ganancia_pct !== '' && Number(f.precio_costo) >= 0) {
      set({ precio_venta: String(r2(Number(f.precio_costo) * (1 + Number(f.ganancia_pct) / 100))) });
    }
  }, [f.calcular_con_ganancia, f.ganancia_pct, f.precio_costo]);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const r = await imageToDataUrls(file); set({ imagen_url: r.full, imagen_thumb: r.thumb }); } catch (ex) { setErr(ex.message); }
    e.target.value = '';
  };

  const saveCategory = async () => {
    const nombre = (newCat || '').trim();
    if (!nombre) { setNewCat(null); return; }
    try {
      const r = await categoriesAPI.create({ nombre });
      const res = await categoriesAPI.getAll();
      const list = res.categories || [];
      setCats(list);
      onCategoryCreated && onCategoryCreated(list);
      const newId = r.category?.id;
      const created = list.find((c) => c.id === newId) || list.find((c) => c.nombre === nombre);
      if (created) set({ categorias_ids: [...new Set([...(f.categorias_ids || []), created.id])] });
      setNewCat(null);
    } catch (ex) { setErr(ex.message); }
  };
  const saveOccasion = async () => {
    const nombre = (newOcc || '').trim();
    if (!nombre) { setNewOcc(null); return; }
    try {
      const r = await categoriesAPI.createOccasion({ nombre });
      const o = r.occasion;
      setOcasiones((prev) => [...prev, o]);
      set({ ocasion_id: o.id });
      setNewOcc(null);
    } catch (ex) { setErr(ex.message); }
  };
  const saveBrand = async () => {
    const nombre = (newBrand || '').trim();
    if (!nombre) { setNewBrand(null); return; }
    try {
      const r = await productsAPI.createBrand(nombre);
      const res = await productsAPI.brands();
      setBrands(res.brands || []);
      set({ marca_id: r.id });
      setNewBrand(null);
    } catch (ex) { setErr(ex.message); }
  };

  const addPresentacion = () => {
    const usados = presentaciones.map((p) => Number(p.factor));
    const sig = [1, 2, 3, 6, 12, 24, 50, 100].find((n) => !usados.includes(n)) || (Math.max(0, ...usados) + 1);
    setPresentaciones([...presentaciones, { etiqueta: sig === 1 ? 'UND' : `${sig} UND`, descripcion: '', factor: sig, precio: f.precio_venta || 0 }]);
  };
  const setPres = (i, patch) => setPresentaciones(presentaciones.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!f.nombre.trim()) { setTab('general'); setErr('Escribe el nombre del producto'); return; }
    if (f.precio_venta === '' || Number(f.precio_venta) < 0) { setTab('general'); setErr('El precio de venta es obligatorio'); return; }
    setSaving(true);
    try {
      const body = {
        ...f,
        es_pack: false,
        categoria_id: (f.categorias_ids || [])[0] || null,
        precio_costo: f.precio_costo === '' ? 0 : Number(f.precio_costo),
        precio_venta: Number(f.precio_venta),
        precio_insumo: f.es_insumo && f.precio_insumo !== '' ? Number(f.precio_insumo) : null,
        ganancia_pct: f.ganancia_pct === '' ? null : Number(f.ganancia_pct),
        presentaciones: presentaciones.map((p) => ({ ...p, factor: Number(p.factor), precio: Number(p.precio) })),
        componentes: f.requiere_insumos ? componentes.map((c) => ({ componente_id: c.componente_id, cantidad: Number(c.cantidad), precio_unit: Number(c.precio_unit) })) : []
      };
      if (productId) await productsAPI.update(productId, body); else await productsAPI.create(body);
      onSaved();
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };

  const tot = totalsOf(componentes);
  const margenVenta = Number(f.precio_venta) - Number(f.precio_costo || 0);

  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="pm-modal" style={{ maxWidth: 860, padding: 0 }} onSubmit={save}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid #E4EAF0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={22} color="var(--primary)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C2A38' }}>{productId ? 'Editar producto' : duplicateFrom ? 'Duplicar producto (variante)' : 'Nuevo producto'}</div>
            <div style={{ fontSize: 13, color: '#788A9B' }}>Todo lo del producto, por secciones.</div>
          </div>
          <button type="button" className="pm-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 24px 0' }}>
          <div className="pm-tabs" style={{ background: '#F3F5FA', borderRadius: 14, padding: 4, display: 'inline-flex' }}>
            {TABS.map(({ id, label, Icon }) => (
              <button type="button" key={id} className={tab === id ? 'on' : ''} style={{ border: 0, borderRadius: 10, display: 'inline-flex', gap: 6, alignItems: 'center', background: tab === id ? '#fff' : 'transparent', color: tab === id ? 'var(--primary)' : '#475569', boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }} onClick={() => setTab(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px 8px', minHeight: 320 }}>
          {err && <div className="pm-err">{err}</div>}
          {loading ? <div style={{ padding: 30, color: '#788A9B' }}>Cargando…</div> : (
            <>
              {/* ---------- GENERAL ---------- */}
              {tab === 'general' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Lo necesario para vender: nombre, precios, stock, categoría y código.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 18 }}>
                    <div>
                      <label className="pc-lab">Foto</label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 140, height: 140, border: '1.5px dashed #C9D2E5', borderRadius: 14, background: '#F7F9FB', cursor: 'pointer', overflow: 'hidden', color: '#788A9B', fontSize: 12, gap: 6 }}>
                        {f.imagen_url ? <img src={imgSrc(f.imagen_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><Camera size={22} />Foto</>}
                        <input type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
                      </label>
                      {f.imagen_url && <button type="button" style={{ fontSize: 12, color: '#E0245E', background: 'none', border: 0, cursor: 'pointer', marginTop: 4 }} onClick={() => set({ imagen_url: '', imagen_thumb: '' })}>Quitar foto</button>}
                    </div>
                    <div>
                      <div className="pm-f"><label>Nombre *</label>
                        <input className="pm-in" value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Taza blanca 11 oz" maxLength={120} /></div>
                      <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="pm-f"><label>Precio de venta *</label>
                          <div className="pm-row" style={{ gap: 0 }}><span className="pm-in" style={{ width: 44, textAlign: 'center', background: '#F3F5FA', borderRight: 0, borderRadius: '8px 0 0 8px', color: '#788A9B' }}>S/</span>
                            <input type="number" min="0" step="0.01" className="pm-in" style={{ borderRadius: '0 8px 8px 0' }} value={f.precio_venta} readOnly={f.calcular_con_ganancia && f.ganancia_pct !== ''} onChange={(e) => set({ precio_venta: e.target.value })} /></div></div>
                        <div className="pm-f"><label>Moneda *</label>
                          <select className="pm-in" value="PEN" onChange={() => {}}><option value="PEN">S/ Soles</option></select></div>
                        <div className="pm-f"><label>Unidad *</label>
                          <select className="pm-in" value={f.unidad} onChange={(e) => set({ unidad: e.target.value })}>{UNIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                      </div>
                    </div>
                  </div>
                  <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="pm-f"><label>Precio de compra</label>
                      <div className="pm-row" style={{ gap: 0 }}><span className="pm-in" style={{ width: 44, textAlign: 'center', background: '#F3F5FA', borderRight: 0, borderRadius: '8px 0 0 8px', color: '#788A9B' }}>S/</span>
                        <input type="number" min="0" step="0.01" className="pm-in" style={{ borderRadius: '0 8px 8px 0' }} value={f.precio_costo} onChange={(e) => set({ precio_costo: e.target.value })} /></div></div>
                    <div className="pm-f"><label>{productId ? 'Stock actual' : 'Stock inicial'}</label>
                      <input type="number" min="0" step="1" className="pm-in" value={f.stock} onChange={(e) => set({ stock: e.target.value })} /></div>
                    <div className="pm-f"><label>Almacén {productId ? '' : 'inicial'}</label>
                      <select className="pm-in" value="p" onChange={() => {}}><option value="p">ALMACÉN PRINCIPAL</option></select></div>
                  </div>
                  <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="pm-f" style={{ gridColumn: '1 / -1' }}><label>Categorías <span style={{ fontWeight: 400, color: '#788A9B', fontSize: 12 }}>(puede estar en más de una)</span> <button type="button" style={{ color: '#4F8EF7', background: 'none', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12 }} onClick={() => setNewCat('')}>+ Nueva</button></label>
                      {newCat !== null ? (
                        <div className="pm-row"><input autoFocus className="pm-in" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCategory(); } }} placeholder="Nombre" />
                          <button type="button" className="pm-plus" onClick={saveCategory} aria-label="Guardar categoría"><Plus size={18} /></button></div>
                      ) : (
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1.5px solid #B9BED3', borderRadius: 8, padding: '6px 8px', minHeight: 42 }}>
                          {cats.filter((c) => c.estado !== 0 || (f.categorias_ids || []).includes(c.id)).map((c) => {
                            const on = (f.categorias_ids || []).includes(c.id);
                            return (
                              <button type="button" key={c.id} aria-pressed={on}
                                onClick={() => set({ categorias_ids: on ? f.categorias_ids.filter((x) => x !== c.id) : [...(f.categorias_ids || []), c.id] })}
                                style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: on ? '1.5px solid var(--primary)' : '1.5px solid #E2E8F0', background: on ? 'var(--primary-light)' : '#fff', color: on ? 'var(--primary)' : '#475569' }}>
                                {on ? '✓ ' : ''}{c.nombre}
                              </button>
                            );
                          })}
                        </div>
                      )}</div>
                    <div className="pm-f"><label>Ocasión especial <button type="button" style={{ color: '#4F8EF7', background: 'none', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12 }} onClick={() => setNewOcc('')}>+ Nueva</button></label>
                      {newOcc !== null ? (
                        <div className="pm-row"><input autoFocus className="pm-in" value={newOcc} onChange={(e) => setNewOcc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveOccasion(); } }} placeholder="Nombre" />
                          <button type="button" className="pm-plus" onClick={saveOccasion} aria-label="Guardar ocasión"><Plus size={18} /></button></div>
                      ) : (
                        <select className="pm-in" value={f.ocasion_id} onChange={(e) => set({ ocasion_id: e.target.value })}><option value="">Sin ocasión</option>{ocasiones.map((o) => <option key={o.id} value={o.id}>{o.icono ? o.icono + ' ' : ''}{o.nombre}</option>)}</select>
                      )}</div>
                    <div className="pm-f"><label>Marca <button type="button" style={{ color: '#4F8EF7', background: 'none', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12 }} onClick={() => setNewBrand('')}>+ Nueva</button></label>
                      {newBrand !== null ? (
                        <div className="pm-row"><input autoFocus className="pm-in" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveBrand(); } }} placeholder="Nombre" />
                          <button type="button" className="pm-plus" onClick={saveBrand} aria-label="Guardar marca"><Plus size={18} /></button></div>
                      ) : (
                        <select className="pm-in" value={f.marca_id} onChange={(e) => set({ marca_id: e.target.value })}><option value="">Sin marca</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
                      )}</div>
                    <div className="pm-f"><label>Código de barras</label><input className="pm-in" value={f.codigo_barras} maxLength={50} onChange={(e) => set({ codigo_barras: e.target.value })} /></div>
                    <div className="pm-f"><label>Código interno</label><input className="pm-in" value={f.codigo} maxLength={30} onChange={(e) => set({ codigo: e.target.value })} /></div>
                  </div>
                  <div style={{ border: '1px solid #E4EAF0', borderRadius: 12, padding: '10px 14px' }}>
                    <button type="button" onClick={() => setMore((v) => !v)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                      <span><strong style={{ color: '#1C2A38' }}>Más datos</strong><br /><span style={{ fontSize: 12, color: '#788A9B' }}>Nombre secundario, modelo, línea, código de fábrica y descripción</span></span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{more ? 'Ocultar' : 'Mostrar'} <ChevronDown size={14} style={{ verticalAlign: 'middle', transform: more ? 'rotate(180deg)' : 'none' }} /></span>
                    </button>
                    {more && (
                      <div style={{ marginTop: 12 }}>
                        <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                          <div className="pm-f"><label>Nombre secundario</label><input className="pm-in" value={f.nombre_secundario || ''} onChange={(e) => set({ nombre_secundario: e.target.value })} /></div>
                          <div className="pm-f"><label>Modelo</label><input className="pm-in" value={f.modelo || ''} onChange={(e) => set({ modelo: e.target.value })} /></div>
                          <div className="pm-f"><label>Línea</label><input className="pm-in" value={f.linea || ''} onChange={(e) => set({ linea: e.target.value })} /></div>
                          <div className="pm-f"><label>Código de fábrica</label><input className="pm-in" value={f.codigo_fabrica || ''} onChange={(e) => set({ codigo_fabrica: e.target.value })} /></div>
                        </div>
                        <div className="pm-f"><label>Descripción</label><textarea rows={2} className="pm-in" value={f.descripcion || ''} onChange={(e) => set({ descripcion: e.target.value })} /></div>
                        <div className="pm-row wrap" style={{ alignItems: 'center', gap: 20 }}>
                          <label style={{ fontSize: 13 }}>Stock mínimo (alerta): <input type="number" min="0" className="pm-in" style={{ width: 80, display: 'inline-block', marginLeft: 6 }} value={f.stock_minimo} onChange={(e) => set({ stock_minimo: e.target.value })} /></label>
                          <label style={{ fontSize: 13 }}><input type="checkbox" checked={f.es_personalizable} onChange={(e) => set({ es_personalizable: e.target.checked })} /> Personalizable</label>
                          <label style={{ fontSize: 13 }}><input type="checkbox" checked={f.destacado} onChange={(e) => set({ destacado: e.target.checked })} /> Destacado</label>
                          {productId && <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!f.activo} onChange={(e) => set({ activo: e.target.checked ? 1 : 0 })} /> Habilitado</label>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- PRECIOS ---------- */}
              {tab === 'precios' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Ganancia, presentaciones (precio según cantidad) y precio como insumo para packs.</p>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: '4px 0 8px' }}>Al vender</h4>
                  <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginBottom: 6 }}><input type="checkbox" checked={f.precio_editable} onChange={(e) => set({ precio_editable: e.target.checked })} /> Permitir editar el precio al vender</label>
                  <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginBottom: 14 }}><input type="checkbox" checked={f.precio_por_cantidad} onChange={(e) => set({ precio_por_cantidad: e.target.checked })} /> Aplicar el precio por cantidad (presentaciones) en el POS y las cotizaciones</label>

                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: '4px 0 8px' }}>Al comprar</h4>
                  <div className="pm-row wrap pm-f" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 200 }}><label>Proveedor por defecto</label>
                      <select className="pm-in" value={f.proveedor_id} onChange={(e) => set({ proveedor_id: e.target.value })}><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
                    <div style={{ width: 150 }}><label>Ganancia (%)</label>
                      <input type="number" min="0" step="0.01" className="pm-in" disabled={!f.calcular_con_ganancia} value={f.ganancia_pct} onChange={(e) => set({ ganancia_pct: e.target.value })} /></div>
                    <label style={{ fontSize: 13.5, display: 'flex', gap: 8, paddingBottom: 10 }}><input type="checkbox" checked={f.calcular_con_ganancia} onChange={(e) => set({ calcular_con_ganancia: e.target.checked })} /> Calcular la venta con esta ganancia</label>
                  </div>
                  {Number(f.precio_costo) > 0 && (
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>Compra S/ {money(f.precio_costo)} → venta S/ {money(f.precio_venta)}: ganancia por unidad <strong style={{ color: margenVenta >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(margenVenta)}</strong> ({Number(f.precio_venta) > 0 ? Math.round((margenVenta / Number(f.precio_venta)) * 100) : 0}%).</div>
                  )}

                  <div className="pm-row" style={{ justifyContent: 'space-between', margin: '14px 0 6px' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800 }}>Presentaciones <span style={{ fontWeight: 400, color: '#788A9B', fontSize: 12 }}>· precio unitario desde esa cantidad</span></h4>
                    <button type="button" className="pm-btn-outline" onClick={addPresentacion}><Plus size={16} /> Agregar presentación</button>
                  </div>
                  <div className="pm-table-wrap" style={{ padding: 0 }}>
                    <table className="pm-table pc-table" style={{ minWidth: 560 }}>
                      <thead><tr><th>Presentación</th><th>Descripción</th><th style={{ width: 110 }}>Desde (cant.)</th><th style={{ width: 130 }}>Precio unitario</th><th style={{ width: 100 }}>Ganancia</th><th style={{ width: 36 }} /></tr></thead>
                      <tbody>
                        {presentaciones.map((p, i) => (
                          <tr key={i}>
                            <td><input value={p.etiqueta} onChange={(e) => setPres(i, { etiqueta: e.target.value })} /></td>
                            <td><input value={p.descripcion} onChange={(e) => setPres(i, { descripcion: e.target.value })} /></td>
                            <td><input type="number" min="1" step="1" value={p.factor} onChange={(e) => setPres(i, { factor: e.target.value })} /></td>
                            <td><input type="number" min="0" step="0.01" value={p.precio} onChange={(e) => setPres(i, { precio: e.target.value })} /></td>
                            <td style={{ color: Number(p.precio) - Number(f.precio_costo || 0) >= 0 ? '#047857' : '#B91C1C', fontWeight: 600 }}>{Number(f.precio_costo) > 0 ? `S/ ${money(Number(p.precio) - Number(f.precio_costo))}` : '—'}</td>
                            <td><button type="button" className="pm-icon-btn" onClick={() => setPresentaciones(presentaciones.filter((_, k) => k !== i))} aria-label="Quitar"><Trash2 size={15} color="#E0245E" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {presentaciones.length === 0 && <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12.5, padding: '14px 0' }}>Sin presentaciones. Ejemplo: "12 UNIDADES" desde 12 a S/ 6.80 cada una.</div>}
                  </div>

                  <div style={{ marginTop: 18, border: '1px solid #E4EAF0', borderRadius: 12, padding: '12px 14px' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Como insumo para packs y boxes</h4>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginBottom: 8 }}><input type="checkbox" checked={f.es_insumo} onChange={(e) => set({ es_insumo: e.target.checked })} /> Este producto se usa como insumo (dentro de packs o en producción)</label>
                    {f.es_insumo && (
                      <div className="pm-row wrap" style={{ alignItems: 'flex-end' }}>
                        <div style={{ width: 200 }}><label className="pc-lab">Precio como insumo (S/)</label>
                          <input type="number" min="0" step="0.01" className="pm-in" value={f.precio_insumo} placeholder={`Vacío = precio de venta (${money(f.precio_venta)})`} onChange={(e) => set({ precio_insumo: e.target.value })} /></div>
                        <div style={{ fontSize: 12.5, color: '#475569', flex: 1, minWidth: 220 }}>Es el precio con el que entra en los packs. Si lo cambias, los packs que lo llevan se marcarán como "Revisar precios".</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- PRODUCCIÓN ---------- */}
              {tab === 'produccion' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Insumos que consume al fabricarse (por ejemplo, una box personalizada).</p>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                    <button type="button" className={`pc-toggle ${f.requiere_insumos ? 'on' : ''}`} onClick={() => set({ requiere_insumos: !f.requiere_insumos })} aria-pressed={f.requiere_insumos} aria-label="Requiere insumos" />
                    Este producto requiere insumos
                  </label>
                  {f.requiere_insumos && (
                    <>
                      <ComponentEditor items={componentes} onChange={setComponentes} catalog={catalog} excludeId={productId} />
                      <div className="pc-totals" style={{ marginTop: 14, maxWidth: 420, marginLeft: 'auto' }}>
                        <div className="r"><span>Costo de insumos (compra)</span><span>S/ {money(tot.costo)}</span></div>
                        <div className="r"><span>Valor de insumos (precio insumo)</span><span>S/ {money(tot.valor)}</span></div>
                        <div className="r"><span>Precio de venta</span><span>S/ {money(f.precio_venta)}</span></div>
                        <div className="r t"><span>Ganancia estimada</span><span style={{ color: Number(f.precio_venta) - tot.costo >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(Number(f.precio_venta || 0) - tot.costo)}</span></div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => set({ precio_costo: String(tot.costo) })}>Usar como precio de compra</button>
                          <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => set({ precio_venta: String(tot.valor), calcular_con_ganancia: false })}>Usar valor de insumos como precio de venta</button>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#788A9B', marginTop: 10 }}>Los insumos sirven para calcular el costo y el precio. Para un pack que descuenta el stock de lo que lleva, usa la pestaña "Boxes y Packs".</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #E4EAF0' }}>
          <button type="button" className="pm-btn-outline" style={{ borderColor: '#E4EAF0', color: '#475569' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="pm-btn-green" disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

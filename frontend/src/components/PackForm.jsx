import React, { useState, useEffect } from 'react';
import { X, Boxes, Camera, AlertTriangle, Wand2, Package, Calculator, Plus, ChevronDown, Trash2 } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../api';
import { imageToDataUrls } from '../utils/image';
import { imgSrc } from '../utils/img';
import ComponentEditor, { totalsOf } from './ComponentEditor';
import ClientDescription, { sugerenciaDesdeComponentes } from './ClientDescription';
import './party.css';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UNIDADES = [
  ['NIU', 'UND'], ['KGM', 'KG'], ['MTR', 'M'], ['LTR', 'L'], ['BX', 'CAJA'], ['DZN', 'DOC'], ['PK', 'PQT'], ['SET', 'JGO']
];

// Mismas secciones que la ficha de Producto; "Qué lleva dentro" reemplaza a "Producción"
const TABS = [
  { id: 'general', label: 'General', Icon: Package },
  { id: 'contenido', label: 'Qué lleva dentro', Icon: Boxes },
  { id: 'precios', label: 'Precios', Icon: Calculator }
];

const emptyForm = () => ({
  nombre: '', precio_venta: '', codigo: '', codigo_barras: '', categorias_ids: [], ocasion_id: '', marca_id: '',
  imagen_url: '', descripcion: '', unidad: 'NIU', activo: 1, es_personalizable: true, destacado: false,
  precio_editable: true, precio_por_cantidad: false,
  web_descripcion: '', desc_cotizacion: true, desc_documentos: true, desc_web: true
});

const linkBtn = { color: '#4F8EF7', background: 'none', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12 };
const soles = { width: 44, textAlign: 'center', background: '#F3F5FA', borderRight: 0, borderRadius: '8px 0 0 8px', color: '#788A9B' };

export default function PackForm({ packId, catalog, categories, onClose, onSaved }) {
  const [tab, setTab] = useState('general');
  const [f, setF] = useState(emptyForm());
  const [items, setItems] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);
  const [cats, setCats] = useState(categories || []);
  const [ocasiones, setOcasiones] = useState([]);
  const [brands, setBrands] = useState([]);
  const [more, setMore] = useState(false);
  const [newCat, setNewCat] = useState(null);
  const [newOcc, setNewOcc] = useState(null);
  const [newBrand, setNewBrand] = useState(null);
  const [loading, setLoading] = useState(!!packId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [revisar, setRevisar] = useState(false);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => {
    categoriesAPI.getAll().then((r) => { setOcasiones(r.occasions || []); if (r.categories) setCats(r.categories); }).catch(() => {});
    productsAPI.brands().then((r) => setBrands(r.brands || [])).catch(() => {});
    if (packId) {
      productsAPI.getById(packId).then((r) => {
        const p = r.product;
        const base = emptyForm();
        setF({
          ...base, ...Object.fromEntries(Object.keys(base).map((k) => [k, p[k] ?? base[k]])),
          categorias_ids: p.categorias_ids?.length ? p.categorias_ids : (p.categoria_id ? [p.categoria_id] : []),
          ocasion_id: p.ocasion_id || '', marca_id: p.marca_id || '',
          es_personalizable: !!p.es_personalizable, destacado: !!p.destacado,
          precio_editable: p.precio_editable === undefined ? true : !!p.precio_editable, precio_por_cantidad: !!p.precio_por_cantidad
        });
        setPresentaciones((p.presentaciones || []).map((x) => ({ etiqueta: x.etiqueta, descripcion: x.descripcion || '', factor: x.factor, precio: x.precio })));
        const comps = p.componentes || [];
        setItems(comps);
        setRevisar(comps.some((c) => c.cambio));
        setMore(!!(p.descripcion));
      }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    } else {
      productsAPI.nextCode().then((r) => set({ codigo: r.codigo })).catch(() => {});
    }
  }, [packId]);

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
      const created = list.find((c) => c.id === r.category?.id) || list.find((c) => c.nombre === nombre);
      if (created) set({ categorias_ids: [...new Set([...(f.categorias_ids || []), created.id])] });
      setNewCat(null);
    } catch (ex) { setErr(ex.message); }
  };
  const saveOccasion = async () => {
    const nombre = (newOcc || '').trim();
    if (!nombre) { setNewOcc(null); return; }
    try {
      const r = await categoriesAPI.createOccasion({ nombre });
      setOcasiones((prev) => [...prev, r.occasion]);
      set({ ocasion_id: r.occasion.id });
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

  const tot = totalsOf(items);
  const venta = Number(f.precio_venta) || 0;
  const ganancia = r2(venta - tot.costo);
  const margen = venta > 0 ? Math.round((ganancia / venta) * 100) : 0;
  const descuento = tot.valor > 0 ? r2(tot.valor - venta) : 0;

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!f.nombre.trim()) { setTab('general'); setErr('Escribe el nombre del pack o promoción'); return; }
    if (f.precio_venta === '' || venta <= 0) { setTab('general'); setErr('Indica el precio de venta del pack'); return; }
    if (!items.length) { setTab('contenido'); setErr('Agrega al menos un producto a lo que lleva el pack'); return; }
    if (presentaciones.some((p) => !(Number(p.factor) >= 1) || !(Number(p.precio) >= 0))) { setTab('precios'); setErr('Revisa la lista de precios: cada fila necesita una cantidad desde 1 y un precio.'); return; }
    setSaving(true);
    try {
      const body = {
        ...f, es_pack: true, precio_venta: venta, precio_costo: tot.costo, stock: 0, stock_minimo: 0,
        categoria_id: (f.categorias_ids || [])[0] || null, ocasion_id: f.ocasion_id || null, marca_id: f.marca_id || null,
        presentaciones: presentaciones.map((p) => ({ ...p, factor: Number(p.factor), precio: Number(p.precio) })),
        componentes: items.map((c) => ({ componente_id: c.componente_id, cantidad: Number(c.cantidad), precio_unit: Number(c.precio_unit) }))
      };
      if (packId) await productsAPI.update(packId, body); else await productsAPI.create(body);
      onSaved();
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };

  const resumen = (
    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
      {[
        ['Valor de los insumos', `S/ ${money(tot.valor)}`, '#1C2A38'],
        ['Costo real (compra)', `S/ ${money(tot.costo)}`, '#1C2A38'],
        ['Precio final del pack', `S/ ${money(venta)}`, '#1C2A38'],
        ['Ganancia estimada', `S/ ${money(ganancia)}`, ganancia >= 0 ? '#047857' : '#B91C1C'],
        ['Margen', `${margen}%`, margen >= 0 ? '#047857' : '#B91C1C']
      ].map(([l, v, c]) => (
        <div key={l} style={{ background: '#F7F9FB', border: '1px solid #E4EAF0', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 11.5, color: '#788A9B', fontWeight: 700 }}>{l}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="pm-modal" style={{ maxWidth: 860, padding: 0 }} onSubmit={save}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid #E4EAF0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Boxes size={22} color="var(--primary)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C2A38' }}>{packId ? 'Editar pack' : 'Nuevo pack'}</div>
            <div style={{ fontSize: 13, color: '#788A9B' }}>Todo lo del pack, por secciones: datos, lo que lleva dentro y precios.</div>
          </div>
          <button type="button" className="pm-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 24px 0' }}>
          <div className="pm-tabs" style={{ background: '#F3F5FA', borderRadius: 14, padding: 4, display: 'inline-flex', flexWrap: 'wrap' }}>
            {TABS.map(({ id, label, Icon }) => (
              <button type="button" key={id} className={tab === id ? 'on' : ''} style={{ border: 0, borderRadius: 10, display: 'inline-flex', gap: 6, alignItems: 'center', background: tab === id ? '#fff' : 'transparent', color: tab === id ? 'var(--primary)' : '#475569', boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }} onClick={() => setTab(id)}>
                <Icon size={15} /> {label}
                {id === 'contenido' && items.length > 0 && <span style={{ fontSize: 11, background: '#E4EAF0', color: '#475569', borderRadius: 999, padding: '0 7px' }}>{items.length}</span>}
                {id === 'contenido' && revisar && <AlertTriangle size={13} color="#B45309" />}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px 8px', minHeight: 320 }}>
          {err && <div className="pm-err">{err}</div>}
          {revisar && tab !== 'contenido' && (
            <div style={{ marginBottom: 12, background: '#FFF7E0', border: '1px solid #F5D77A', color: '#7A5B00', borderRadius: 10, padding: '8px 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={16} style={{ flex: 'none' }} />
              <span>Cambió el precio o el costo de algún producto de este pack. <button type="button" style={linkBtn} onClick={() => setTab('contenido')}>Revisar en «Qué lleva dentro»</button></span>
            </div>
          )}
          {loading ? <div style={{ padding: 30, color: '#788A9B' }}>Cargando…</div> : (
            <>
              {/* ---------- GENERAL ---------- */}
              {tab === 'general' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Lo necesario para vender: nombre, precio, foto, categoría y código.</p>
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
                      <div className="pm-f"><label>Nombre del pack o promoción *</label>
                        <input className="pm-in" maxLength={120} value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Box Cumpleaños Premium" /></div>
                      <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="pm-f"><label>Precio de venta *</label>
                          <div className="pm-row" style={{ gap: 0 }}><span className="pm-in" style={soles}>S/</span>
                            <input type="number" min="0" step="0.01" className="pm-in" style={{ borderRadius: '0 8px 8px 0' }} value={f.precio_venta} onChange={(e) => set({ precio_venta: e.target.value })} /></div></div>
                        <div className="pm-f"><label>Moneda *</label>
                          <select className="pm-in" value="PEN" onChange={() => {}}><option value="PEN">S/ Soles</option></select></div>
                        <div className="pm-f"><label>Unidad *</label>
                          <select className="pm-in" value={f.unidad} onChange={(e) => set({ unidad: e.target.value })}>{UNIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#475569' }}>
                        Costo real según lo que lleva: <strong>S/ {money(tot.costo)}</strong> · ganancia <strong style={{ color: ganancia >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(ganancia)} ({margen}%)</strong>
                        {' '}· <button type="button" style={linkBtn} onClick={() => setTab('contenido')}>ver qué lleva</button>
                      </div>
                    </div>
                  </div>

                  <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
                    <div className="pm-f" style={{ gridColumn: '1 / -1' }}><label>Categorías <span style={{ fontWeight: 400, color: '#788A9B', fontSize: 12 }}>(puede estar en más de una)</span> <button type="button" style={linkBtn} onClick={() => setNewCat('')}>+ Nueva</button></label>
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
                    <div className="pm-f"><label>Ocasión especial <button type="button" style={linkBtn} onClick={() => setNewOcc('')}>+ Nueva</button></label>
                      {newOcc !== null ? (
                        <div className="pm-row"><input autoFocus className="pm-in" value={newOcc} onChange={(e) => setNewOcc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveOccasion(); } }} placeholder="Nombre" />
                          <button type="button" className="pm-plus" onClick={saveOccasion} aria-label="Guardar ocasión"><Plus size={18} /></button></div>
                      ) : (
                        <select className="pm-in" value={f.ocasion_id} onChange={(e) => set({ ocasion_id: e.target.value })}><option value="">Sin ocasión</option>{ocasiones.map((o) => <option key={o.id} value={o.id}>{o.icono ? o.icono + ' ' : ''}{o.nombre}</option>)}</select>
                      )}</div>
                    <div className="pm-f"><label>Marca <button type="button" style={linkBtn} onClick={() => setNewBrand('')}>+ Nueva</button></label>
                      {newBrand !== null ? (
                        <div className="pm-row"><input autoFocus className="pm-in" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveBrand(); } }} placeholder="Nombre" />
                          <button type="button" className="pm-plus" onClick={saveBrand} aria-label="Guardar marca"><Plus size={18} /></button></div>
                      ) : (
                        <select className="pm-in" value={f.marca_id} onChange={(e) => set({ marca_id: e.target.value })}><option value="">Sin marca</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
                      )}</div>
                    <div className="pm-f"><label>Código de barras</label><input className="pm-in" value={f.codigo_barras || ''} maxLength={50} onChange={(e) => set({ codigo_barras: e.target.value })} /></div>
                    <div className="pm-f"><label>Código interno</label><input className="pm-in" value={f.codigo} maxLength={30} onChange={(e) => set({ codigo: e.target.value })} /></div>
                  </div>

                  <div style={{ border: '1px solid #E4EAF0', borderRadius: 12, padding: '10px 14px' }}>
                    <button type="button" onClick={() => setMore((v) => !v)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                      <span><strong style={{ color: '#1C2A38' }}>Más datos</strong><br /><span style={{ fontSize: 12, color: '#788A9B' }}>Nota interna, personalizable, destacado y habilitado</span></span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{more ? 'Ocultar' : 'Mostrar'} <ChevronDown size={14} style={{ verticalAlign: 'middle', transform: more ? 'rotate(180deg)' : 'none' }} /></span>
                    </button>
                    {more && (
                      <div style={{ marginTop: 12 }}>
                        <div className="pm-f"><label>Nota interna (no la ve el cliente)</label><textarea rows={2} className="pm-in" value={f.descripcion || ''} onChange={(e) => set({ descripcion: e.target.value })} /></div>
                        <div className="pm-row wrap" style={{ alignItems: 'center', gap: 20 }}>
                          <label style={{ fontSize: 13 }}><input type="checkbox" checked={f.es_personalizable} onChange={(e) => set({ es_personalizable: e.target.checked })} /> Personalizable</label>
                          <label style={{ fontSize: 13 }}><input type="checkbox" checked={f.destacado} onChange={(e) => set({ destacado: e.target.checked })} /> Destacado (★ en la web)</label>
                          {packId && <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!Number(f.activo)} onChange={(e) => set({ activo: e.target.checked ? 1 : 0 })} /> Habilitado</label>}
                        </div>
                      </div>
                    )}
                  </div>
                  <ClientDescription value={f} onChange={set} sugerencia={sugerenciaDesdeComponentes(items)} />
                </div>
              )}

              {/* ---------- QUÉ LLEVA DENTRO ---------- */}
              {tab === 'contenido' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Productos y cantidades que lleva el pack. Al venderlo se descuenta el stock de cada uno. El precio de cada producto se ajusta solo según su lista de precios por cantidad; puedes fijarlo a mano.</p>
                  {revisar && (
                    <div style={{ marginBottom: 12, background: '#FFF7E0', border: '1px solid #F5D77A', color: '#7A5B00', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', gap: 8 }}>
                      <AlertTriangle size={18} style={{ flex: 'none' }} />
                      <span>Cambió el precio o el costo de algún producto de este pack. Revisa las filas marcadas, usa "Usar precio actual" si quieres actualizarlas y ajusta el precio de venta.</span>
                    </div>
                  )}
                  <ComponentEditor items={items} onChange={setItems} catalog={catalog} excludeId={packId} autoPrice />
                  {resumen}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, fontSize: 12.5, color: '#475569' }}>
                    {tot.valor > 0 && <span>{descuento > 0 ? `Descuento sobre el valor de insumos: S/ ${money(descuento)}` : descuento < 0 ? `Recargo sobre el valor de insumos: S/ ${money(-descuento)}` : 'Sin descuento'}</span>}
                    <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} disabled={!items.length} onClick={() => set({ precio_venta: String(r2(tot.valor)) })}><Wand2 size={14} /> Usar valor de insumos</button>
                    <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} disabled={!items.length} onClick={() => set({ precio_venta: String(r2(tot.costo * 1.5)) })}>Sugerir con 50% de ganancia</button>
                  </div>
                </div>
              )}

              {/* ---------- PRECIOS ---------- */}
              {tab === 'precios' && (
                <div>
                  <p style={{ fontSize: 13, color: '#788A9B', marginBottom: 14 }}>Cómo se cobra el pack y su lista de precios por cantidad (ej. precio especial desde 12 boxes para empresas).</p>
                  <h4 style={{ fontSize: 14, fontWeight: 800, margin: '4px 0 8px' }}>Al vender</h4>
                  <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginBottom: 6 }}><input type="checkbox" checked={f.precio_editable} onChange={(e) => set({ precio_editable: e.target.checked })} /> Permitir editar el precio al vender</label>
                  <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginBottom: 6 }}><input type="checkbox" checked={f.precio_por_cantidad} onChange={(e) => set({ precio_por_cantidad: e.target.checked })} /> Aplicar la lista de precios por cantidad en el POS y las cotizaciones</label>
                  <div style={{ fontSize: 13, color: '#475569', margin: '4px 0 12px' }}>Precio base S/ {money(venta)} · costo real S/ {money(tot.costo)} · ganancia por pack <strong style={{ color: ganancia >= 0 ? '#047857' : '#B91C1C' }}>S/ {money(ganancia)}</strong> ({margen}%).</div>

                  <div className="pm-row" style={{ justifyContent: 'space-between', margin: '14px 0 6px' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800 }}>Lista de precios <span style={{ fontWeight: 400, color: '#788A9B', fontSize: 12 }}>· precio unitario desde esa cantidad</span></h4>
                    <button type="button" className="pm-btn-outline" onClick={addPresentacion}><Plus size={16} /> Agregar precio</button>
                  </div>
                  <div className="pm-table-wrap" style={{ padding: 0 }}>
                    <table className="pm-table pc-table" style={{ minWidth: 560 }}>
                      <thead><tr><th>Presentación</th><th>Descripción</th><th style={{ width: 110 }}>Desde (cant.)</th><th style={{ width: 130 }}>Precio unitario</th><th style={{ width: 110 }}>Ganancia</th><th style={{ width: 36 }} /></tr></thead>
                      <tbody>
                        {presentaciones.map((p, i) => {
                          const g = Number(p.precio) - tot.costo;
                          return (
                            <tr key={i}>
                              <td><input value={p.etiqueta} onChange={(e) => setPres(i, { etiqueta: e.target.value })} /></td>
                              <td><input value={p.descripcion} onChange={(e) => setPres(i, { descripcion: e.target.value })} /></td>
                              <td><input type="number" min="1" step="1" value={p.factor} onChange={(e) => setPres(i, { factor: e.target.value })} /></td>
                              <td><input type="number" min="0" step="0.01" value={p.precio} onChange={(e) => setPres(i, { precio: e.target.value })} /></td>
                              <td style={{ color: g >= 0 ? '#047857' : '#B91C1C', fontWeight: 600 }}>{tot.costo > 0 ? `S/ ${money(g)}` : '—'}</td>
                              <td><button type="button" className="pm-icon-btn" onClick={() => setPresentaciones(presentaciones.filter((_, k) => k !== i))} aria-label="Quitar"><Trash2 size={15} color="#E0245E" /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {presentaciones.length === 0 && <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12.5, padding: '14px 0' }}>Sin lista de precios: se cobra siempre el precio de venta. Ejemplo: "DOCENA" desde 12 a S/ 17.00 cada uno.</div>}
                  </div>
                  {presentaciones.length > 0 && !f.precio_por_cantidad && (
                    <div style={{ fontSize: 12.5, color: '#B45309', marginTop: 8 }}>Marca «Aplicar la lista de precios por cantidad» para que el POS y las cotizaciones la usen.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #E4EAF0' }}>
          <button type="button" className="pm-btn-outline" style={{ borderColor: '#E4EAF0', color: '#475569' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="pm-btn-green" disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar pack'}</button>
        </div>
      </form>
    </div>
  );
}

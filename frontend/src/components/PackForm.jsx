import React, { useState, useEffect } from 'react';
import { X, Boxes, Camera, AlertTriangle, Wand2 } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../api';
import { imageToDataUrls } from '../utils/image';
import { imgSrc } from '../utils/img';
import ComponentEditor, { totalsOf } from './ComponentEditor';
import './party.css';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Step = ({ n, title, sub }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0 10px' }}>
    <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
    <div><div style={{ fontWeight: 800, color: '#1C2A38' }}>{title}</div><div style={{ fontSize: 12.5, color: '#788A9B' }}>{sub}</div></div>
  </div>
);

export default function PackForm({ packId, catalog, categories, onClose, onSaved }) {
  const [f, setF] = useState({ nombre: '', precio_venta: '', codigo: '', codigo_barras: '', categoria_id: '', ocasion_id: '', marca_id: '', imagen_url: '', descripcion: '', unidad: 'NIU', activo: 1 });
  const [ocasiones, setOcasiones] = useState([]);
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(!!packId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [revisar, setRevisar] = useState(false);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => {
    categoriesAPI.getAll().then((r) => setOcasiones(r.occasions || [])).catch(() => {});
    productsAPI.brands().then((r) => setBrands(r.brands || [])).catch(() => {});
    if (packId) {
      productsAPI.getById(packId).then((r) => {
        const p = r.product;
        setF({
          nombre: p.nombre || '', precio_venta: p.precio_venta ?? '', codigo: p.codigo || '', codigo_barras: p.codigo_barras || '',
          categoria_id: p.categoria_id || '', ocasion_id: p.ocasion_id || '', marca_id: p.marca_id || '', imagen_url: p.imagen_url || '', descripcion: p.descripcion || '',
          unidad: p.unidad || 'NIU', activo: p.activo
        });
        const comps = p.componentes || [];
        setItems(comps);
        setRevisar(comps.some((c) => c.cambio));
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

  const tot = totalsOf(items);
  const venta = Number(f.precio_venta) || 0;
  const ganancia = r2(venta - tot.costo);
  const margen = venta > 0 ? Math.round((ganancia / venta) * 100) : 0;
  const descuento = tot.valor > 0 ? r2(tot.valor - venta) : 0;

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!f.nombre.trim()) { setErr('Escribe el nombre del pack o promoción'); return; }
    if (f.precio_venta === '' || venta <= 0) { setErr('Indica el precio de venta del pack'); return; }
    if (!items.length) { setErr('Agrega al menos un producto a lo que lleva el pack'); return; }
    setSaving(true);
    try {
      const body = {
        ...f, es_pack: true, precio_venta: venta, precio_costo: tot.costo, stock: 0, stock_minimo: 0,
        categoria_id: f.categoria_id || null, ocasion_id: f.ocasion_id || null, marca_id: f.marca_id || null,
        componentes: items.map((c) => ({ componente_id: c.componente_id, cantidad: Number(c.cantidad), precio_unit: Number(c.precio_unit) }))
      };
      if (packId) await productsAPI.update(packId, body); else await productsAPI.create(body);
      onSaved();
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };

  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="pm-modal" style={{ maxWidth: 820, padding: 0 }} onSubmit={save}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid #E4EAF0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Boxes size={22} color="var(--primary)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C2A38' }}>{packId ? 'Editar pack' : 'Nuevo pack'}</div>
            <div style={{ fontSize: 13, color: '#788A9B' }}>Arma un pack con varios productos y fija su precio.</div>
          </div>
          <button type="button" className="pm-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div style={{ padding: '4px 24px 10px' }}>
          {err && <div className="pm-err" style={{ marginTop: 12 }}>{err}</div>}
          {revisar && (
            <div style={{ marginTop: 12, background: '#FFF7E0', border: '1px solid #F5D77A', color: '#7A5B00', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', gap: 8 }}>
              <AlertTriangle size={18} style={{ flex: 'none' }} />
              <span>Cambió el precio o el costo de algún producto de este pack. Revisa las filas marcadas, usa "Usar precio actual" si quieres actualizarlas y ajusta el precio de venta.</span>
            </div>
          )}
          {loading ? <div style={{ padding: 30, color: '#788A9B' }}>Cargando…</div> : (
            <>
              <Step n={1} title="Lo básico" sub="¿Cómo se llama y a qué precio lo vendes?" />
              <div className="pm-grid2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="pm-f"><label>Nombre del pack o promoción *</label>
                  <input className="pm-in" maxLength={120} value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Box Cumpleaños Premium" /></div>
                <div className="pm-f"><label>Precio de venta del pack *</label>
                  <div className="pm-row" style={{ gap: 0 }}><span className="pm-in" style={{ width: 44, textAlign: 'center', background: '#F3F5FA', borderRight: 0, borderRadius: '8px 0 0 8px', color: '#788A9B' }}>S/</span>
                    <input type="number" min="0" step="0.01" className="pm-in" style={{ borderRadius: '0 8px 8px 0' }} value={f.precio_venta} onChange={(e) => set({ precio_venta: e.target.value })} /></div></div>
              </div>

              <Step n={2} title="Qué lleva dentro" sub="Productos y cantidades. El precio de cada uno se ajusta solo según tu lista de precios por cantidad; puedes fijarlo a mano." />
              <ComponentEditor items={items} onChange={setItems} catalog={catalog} excludeId={packId} autoPrice />

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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, fontSize: 12.5, color: '#475569' }}>
                {tot.valor > 0 && <span>{descuento > 0 ? `Descuento sobre el valor de insumos: S/ ${money(descuento)}` : descuento < 0 ? `Recargo sobre el valor de insumos: S/ ${money(-descuento)}` : 'Sin descuento'}</span>}
                <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} disabled={!items.length} onClick={() => set({ precio_venta: String(r2(tot.valor)) })}><Wand2 size={14} /> Usar valor de insumos</button>
                <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} disabled={!items.length} onClick={() => set({ precio_venta: String(r2(tot.costo * 1.5)) })}>Sugerir con 50% de ganancia</button>
              </div>

              <Step n={3} title="Datos adicionales" sub="Opcional: códigos, categoría, marca e imagen." />
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, border: '1.5px dashed #C9D2E5', borderRadius: 14, background: '#F7F9FB', cursor: 'pointer', overflow: 'hidden', color: '#788A9B', fontSize: 12, gap: 6 }}>
                  {f.imagen_url ? <img src={imgSrc(f.imagen_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><Camera size={22} />Imagen</>}
                  <input type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
                </label>
                <div>
                  <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="pm-f"><label>Código interno</label><input className="pm-in" value={f.codigo} maxLength={30} onChange={(e) => set({ codigo: e.target.value })} /></div>
                    <div className="pm-f"><label>Código de barras</label><input className="pm-in" value={f.codigo_barras} maxLength={50} onChange={(e) => set({ codigo_barras: e.target.value })} /></div>
                    <div className="pm-f"><label>Categoría</label>
                      <select className="pm-in" value={f.categoria_id} onChange={(e) => set({ categoria_id: e.target.value })}><option value="">Sin categoría</option>{(categories || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                    <div className="pm-f"><label>Ocasión especial</label>
                      <select className="pm-in" value={f.ocasion_id} onChange={(e) => set({ ocasion_id: e.target.value })}><option value="">Sin ocasión</option>{ocasiones.map((o) => <option key={o.id} value={o.id}>{o.icono ? o.icono + ' ' : ''}{o.nombre}</option>)}</select></div>
                    <div className="pm-f"><label>Marca</label>
                      <select className="pm-in" value={f.marca_id} onChange={(e) => set({ marca_id: e.target.value })}><option value="">Sin marca</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select></div>
                  </div>
                  <div className="pm-f"><label>Descripción</label><textarea rows={2} className="pm-in" value={f.descripcion || ''} onChange={(e) => set({ descripcion: e.target.value })} /></div>
                </div>
              </div>
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

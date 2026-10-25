import React, { useState, useEffect } from 'react';
import { X, Truck, Printer, Camera, Trash2, Save } from 'lucide-react';
import { shippingAPI } from '../api';
import { imageToDataUrl } from '../utils/image';
import { buildRotuloHTML } from '../utils/rotuloPrint';
import PrintModal from './PrintModal';
import '../components/party.css';

const FORMATS = [{ id: 'a4', label: 'A4 horizontal' }, { id: 'a5', label: 'A5 horizontal (media hoja)' }];

// order: { id, numero_pedido, cliente_nombre, ciudad_envio, tipo_entrega, envio_* }
export default function ShippingModal({ order, store = {}, onClose, onSaved = () => {} }) {
  // Valores iniciales: los datos del pedido (comprador). Se pueden editar si recibe otra persona.
  const compradorNombre = order.nombre_destinatario || (order.cliente_nombre && order.cliente_nombre !== 'Cliente Varios' ? order.cliente_nombre : '');
  const compradorTel = order.telefono_destinatario || order.cliente_telefono || '';
  const compradorDoc = String(order.cliente_documento || '').replace(/\D/g, '');
  const docTipoDe = (d) => (d.length === 11 ? 'RUC' : 'DNI');
  const delPedido = () => ({
    envio_origen: order.envio_origen || 'Arequipa',
    envio_destino: order.ciudad_envio || '',
    envio_dest_nombre: compradorNombre,
    envio_dest_doc: compradorDoc,
    envio_dest_doc_tipo: docTipoDe(compradorDoc),
    envio_dest_telefono: compradorTel
  });
  const [f, setF] = useState({
    envio_datos: !!Number(order.envio_datos) || order.tipo_entrega === 'envio',
    envio_origen: order.envio_origen || 'Arequipa',
    envio_destino: order.envio_destino || order.ciudad_envio || '',
    envio_dest_nombre: order.envio_dest_nombre || compradorNombre,
    envio_dest_doc: order.envio_dest_doc || compradorDoc,
    envio_dest_doc_tipo: order.envio_dest_doc_tipo || docTipoDe(order.envio_dest_doc || compradorDoc),
    envio_dest_telefono: order.envio_dest_telefono || compradorTel
  });
  const [guia, setGuia] = useState({ numero: '', foto: '' });
  const [agencias, setAgencias] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [printing, setPrinting] = useState(false);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => { shippingAPI.agencies('?estado=activas').then((r) => setAgencias(r.agencias || [])).catch(() => {}); }, []);
  useEffect(() => { shippingAPI.getGuide(order.id).then((r) => setGuia({ numero: r.guia?.numero || '', foto: r.guia?.foto || '' })).catch(() => {}); }, [order.id]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { setGuia((g) => ({ ...g, foto: '' })); const url = await imageToDataUrl(file, 1400, 0.8); setGuia((g) => ({ ...g, foto: url })); } catch (ex) { setMsg({ type: 'err', text: ex.message }); }
    e.target.value = '';
  };

  const saveAll = async (silent = false) => {
    setSaving(true); setMsg({ type: '', text: '' });
    try {
      await shippingAPI.saveData(order.id, f);
      await shippingAPI.saveGuide(order.id, guia);
      if (!silent) setMsg({ type: 'ok', text: 'Guardado' });
      onSaved();
      return true;
    } catch (e) { setMsg({ type: 'err', text: e.message }); return false; } finally { setSaving(false); }
  };

  const openRotulo = async () => {
    if (!f.envio_datos) { setMsg({ type: 'err', text: 'Activa "Llenar datos de envío" para generar el rótulo' }); return; }
    if (!f.envio_dest_nombre.trim()) { setMsg({ type: 'err', text: 'Escribe el nombre completo del destinatario' }); return; }
    if (await saveAll(true)) setPrinting(true);
  };

  const envio = { origen: f.envio_origen, destino: f.envio_destino, nombre: f.envio_dest_nombre, doc: f.envio_dest_doc, docTipo: f.envio_dest_doc_tipo, telefono: f.envio_dest_telefono };
  const lab = { fontSize: 12.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 };

  return (
    <div className="pm-modal-bg" style={{ zIndex: 1100 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm-modal" style={{ maxWidth: 640, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid #E4EAF0' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Truck size={21} color="#1D4ED8" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C2A38' }}>Datos de envío</div>
            <div style={{ fontSize: 12.5, color: '#788A9B' }}>{order.numero_pedido || `PD-${String(order.id).padStart(6, '0')}`} · {order.cliente_nombre}</div>
          </div>
          <button className="pm-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div style={{ padding: '16px 22px' }}>
          {msg.text && <div className={msg.type === 'err' ? 'pm-err' : ''} style={msg.type === 'ok' ? { background: '#E6F7EE', color: '#047857', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 } : undefined}>{msg.text}</div>}

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700, fontSize: 14, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" className="pm-chk" checked={f.envio_datos} onChange={(e) => set({ envio_datos: e.target.checked })} />
            Llenar datos de envío (para el rótulo)
          </label>

          {f.envio_datos && (
            <>
              <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="pm-f"><label style={lab}>Origen</label><input className="pm-in" value={f.envio_origen} maxLength={100} onChange={(e) => set({ envio_origen: e.target.value })} /></div>
                <div className="pm-f"><label style={lab}>Destino</label><input className="pm-in" value={f.envio_destino} maxLength={150} onChange={(e) => set({ envio_destino: e.target.value })} placeholder="Ciudad o agencia de destino" /></div>
              </div>
              {agencias.length > 0 && (
                <div className="pm-f"><label style={lab}>Elegir una agencia registrada (opcional)</label>
                  <select className="pm-in" value="" onChange={(e) => {
                    const a = agencias.find((x) => String(x.id) === e.target.value);
                    if (a) set({ envio_destino: `${a.courier} - ${a.nombre}${a.distrito || a.provincia ? ` (${[a.distrito, a.provincia].filter(Boolean).join(', ')})` : ''}`.slice(0, 150) });
                  }}>
                    <option value="">Buscar en el catálogo de agencias…</option>
                    {agencias.map((a) => <option key={a.id} value={a.id}>{a.courier} · {a.nombre} · {[a.provincia, a.departamento].filter(Boolean).join(', ')}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#788A9B', textTransform: 'uppercase' }}>Datos del destinatario</div>
                <button type="button" onClick={() => set(delPedido())} style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', border: 0, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Usar datos del pedido</button>
              </div>
              <div className="pm-f" style={{ width: '100%' }}><label style={lab}>Nombre completo *</label><input className="pm-in" style={{ width: '100%' }} value={f.envio_dest_nombre} maxLength={150} onChange={(e) => set({ envio_dest_nombre: e.target.value })} /></div>
              <div className="pm-f" style={{ width: '100%' }}>
                <label style={lab}>Documento (aparece en el rótulo)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="pm-in" style={{ width: 110, flex: 'none' }} value={f.envio_dest_doc_tipo} onChange={(e) => set({ envio_dest_doc_tipo: e.target.value, envio_dest_doc: String(f.envio_dest_doc).slice(0, e.target.value === 'DNI' ? 8 : 11) })}>
                    <option value="DNI">DNI</option><option value="RUC">RUC</option>
                  </select>
                  <input className="pm-in" style={{ flex: 1 }} inputMode="numeric" value={f.envio_dest_doc} maxLength={f.envio_dest_doc_tipo === 'DNI' ? 8 : 11} onChange={(e) => set({ envio_dest_doc: e.target.value.replace(/\D/g, '') })} placeholder={f.envio_dest_doc_tipo === 'DNI' ? '8 dígitos' : '11 dígitos'} />
                </div>
              </div>
              <div className="pm-f" style={{ width: '100%' }}><label style={lab}>Teléfono</label><input className="pm-in" style={{ width: '100%' }} value={f.envio_dest_telefono} maxLength={30} onChange={(e) => set({ envio_dest_telefono: e.target.value })} /></div>
            </>
          )}

          <div style={{ borderTop: '1px solid #E4EAF0', marginTop: 10, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#788A9B', textTransform: 'uppercase', marginBottom: 8 }}>Guía de envío</div>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 130, height: 130, border: '1.5px dashed #C9D2E5', borderRadius: 12, background: '#F7F9FB', cursor: 'pointer', overflow: 'hidden', color: '#788A9B', fontSize: 12, gap: 6 }}>
                {guia.foto ? <img src={guia.foto} alt="Guía" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><Camera size={22} />Foto de la guía</>}
                <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
              </label>
              <div>
                <label style={lab}>N° de guía (opcional)</label>
                <input className="pm-in" value={guia.numero} maxLength={60} onChange={(e) => setGuia({ ...guia, numero: e.target.value })} />
                {guia.foto && <button type="button" onClick={() => setGuia({ ...guia, foto: '' })} style={{ marginTop: 8, color: '#E0245E', background: 'none', border: 0, cursor: 'pointer', fontSize: 12.5, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Trash2 size={14} /> Quitar foto</button>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #E4EAF0', flexWrap: 'wrap' }}>
          <button type="button" className="pm-btn-outline" onClick={openRotulo} disabled={saving}><Printer size={16} /> Generar rótulo</button>
          <button type="button" className="pm-btn-green" onClick={() => saveAll(false)} disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      {printing && (
        <PrintModal title="Rótulo de envío" subtitle={`${order.numero_pedido || ''} · ${f.envio_dest_nombre}`} formats={FORMATS} showWhatsApp={false}
          docs={[{ key: 'rotulo', label: 'Rótulo', build: (fmt) => buildRotuloHTML({ envio, store, format: fmt }), message: '' }]}
          onClose={() => setPrinting(false)} />
      )}
    </div>
  );
}

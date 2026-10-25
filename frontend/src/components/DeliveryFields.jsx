import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../api';
import { imageToDataUrl } from '../utils/image';

export const FRANJAS = ['09:00 AM - 11:00 AM', '11:00 AM - 01:00 PM', '01:00 PM - 03:00 PM', '03:00 PM - 05:00 PM', '05:00 PM - 08:00 PM'];
const ESPECIFICA = '__hora__';
const chk = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#6D28D9', marginTop: 6, cursor: 'pointer' };

const to12h = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const to24h = (txt) => {
  const m = String(txt).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

export const emptyDelivery = () => ({
  tipo_entrega: 'tienda',
  ciudad_envio: '',
  fecha_entrega: new Date().toLocaleDateString('en-CA'),
  fecha_entrega_diseno: new Date().toLocaleDateString('en-CA'),
  franja_horaria: FRANJAS[0],
  fecha_por_confirmar: false,
  hora_por_confirmar: false,
  direccion_entrega: '',
  cargos: [],
  diseno_link: '',
  diseno_foto: ''
});
// Campos de entrega listos para enviar al servidor (fecha/hora "por confirmar" incluidas)
export const entregaPayload = (d) => ({
  tipo_entrega: d.tipo_entrega,
  ciudad_envio: d.ciudad_envio,
  direccion_entrega: d.tipo_entrega === 'delivery' ? (d.direccion_entrega || '') : undefined,
  fecha_por_confirmar: !!d.fecha_por_confirmar,
  hora_por_confirmar: !!d.hora_por_confirmar || !!d.fecha_por_confirmar,
  fecha_entrega: d.fecha_por_confirmar ? null : d.fecha_entrega,
  franja_horaria: d.fecha_por_confirmar || d.hora_por_confirmar ? 'Por confirmar' : d.franja_horaria
});
export const sumCargos = (cargos) => Math.round((cargos || []).reduce((a, c) => a + (Number(c.monto) || 0), 0) * 100) / 100;
export const parseCargosJson = (raw) => {
  try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a.map((c) => ({ nombre: c.nombre, monto: Number(c.monto) || 0 })) : []; } catch (e) { return []; }
};

// Cargos configurados en Configuración Empresa (embalaje, traslado a agencia...)
export function useCharges() {
  const [charges, setCharges] = useState([]);
  useEffect(() => {
    settingsAPI.get().then((r) => {
      if (!r.success) return;
      let z = r.settings.zonas_reparto;
      try { z = typeof z === 'string' ? JSON.parse(z) : z; } catch (e) { z = []; }
      setCharges((Array.isArray(z) ? z : []).filter((x) => x.visible !== false).map((x) => ({ nombre: x.zona, monto: Number(x.costo) || 0 })));
    }).catch(() => {});
  }, []);
  return charges;
}

const inp = { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const lab = { fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' };

// Selector de cargos (embalaje, traslado a agencia...) con monto editable
export function ChargesPicker({ selected = [], onChange, charges = [], sym = 'S/.' }) {
  const isOn = (nombre) => selected.some((c) => c.nombre === nombre);
  const toggle = (c) => onChange(isOn(c.nombre) ? selected.filter((x) => x.nombre !== c.nombre) : [...selected, { nombre: c.nombre, monto: c.monto }]);
  const setMonto = (nombre, monto) => onChange(selected.map((x) => (x.nombre === nombre ? { ...x, monto } : x)));
  // incluye cargos ya guardados que ya no están en la configuración
  const lista = [...charges, ...selected.filter((x) => !charges.some((c) => c.nombre === x.nombre)).map((x) => ({ nombre: x.nombre, monto: x.monto }))];
  return (
    <div style={{ marginTop: '12px', background: '#F8FAFC', border: '1px solid #EEF3F0', borderRadius: '12px', padding: '10px 12px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1C2A38', marginBottom: '6px' }}>Cargos por embalaje y traslado a agencia</div>
      {lista.length === 0 && <div style={{ fontSize: '12px', color: '#94A3B8' }}>No hay cargos configurados (Configuración Empresa).</div>}
      {lista.map((c) => (
        <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
          <input type="checkbox" checked={isOn(c.nombre)} onChange={() => toggle(c)} />
          <span style={{ flex: 1, fontSize: '13px' }}>{c.nombre}</span>
          {isOn(c.nombre) ? (
            <input type="number" min="0" step="0.01" style={{ ...inp, width: '95px', padding: '5px 8px' }}
              value={selected.find((x) => x.nombre === c.nombre).monto}
              onChange={(e) => setMonto(c.nombre, e.target.value === '' ? 0 : Number(e.target.value))} />
          ) : (
            <span style={{ fontSize: '12.5px', color: '#788A9B' }}>{sym} {Number(c.monto).toFixed(2)}</span>
          )}
        </div>
      ))}
      {sumCargos(selected) > 0 && (
        <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
          Cargos: {sym} {sumCargos(selected).toFixed(2)} (se suman al saldo)
        </div>
      )}
    </div>
  );
}

// value: { tipo_entrega, ciudad_envio, fecha_entrega, franja_horaria, cargos }
// chargesMode: 'envio' (solo si es Envío) | 'always' | 'none'
/** Diseño del pedido: foto de referencia y/o link (Canva, Drive...) */
export function DesignFields({ link, links, foto, onChange }) {
  const [err, setErr] = useState('');
  const list = Array.isArray(links) && links.length ? links : (link ? [{ url: link, comentario: '' }] : []);
  const rows = list.length ? list : [{ url: '', comentario: '' }];
  const pick = async (file) => {
    if (!file) return;
    try { setErr(''); onChange({ diseno_foto: await imageToDataUrl(file, 1100, 0.8) }); } catch (e) { setErr(e.message); }
  };
  const emit = (arr) => onChange({ diseno_links: arr, diseno_link: (arr.find((x) => (x.url || '').trim()) || {}).url || '' });
  const upd = (i, patch) => emit(rows.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const del = (i) => emit(rows.filter((_, k) => k !== i));
  const add = () => emit([...rows, { url: '', comentario: '' }]);
  return (
    <div style={{ marginTop: '12px', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', background: '#FAFBFC' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>Diseño del pedido</div>
      <label style={lab}>Links del diseño (Canva, Drive...) · uno por producto</label>
      <div style={{ display: 'grid', gap: '8px' }}>
        {rows.map((r, i) => {
          const bad = r.url && !/^https?:\/\//i.test(r.url.trim());
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 30px', gap: '8px', alignItems: 'start' }}>
              <div>
                <input style={{ ...inp, borderColor: bad ? '#EF4444' : undefined }} value={r.url || ''} placeholder="https://www.canva.com/design/..." onChange={(e) => upd(i, { url: e.target.value })} />
                {bad && <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '3px' }}>Debe empezar con http:// o https://</div>}
              </div>
              <input style={inp} maxLength={120} value={r.comentario || ''} placeholder="Ej: Link para diseño de tazas" onChange={(e) => upd(i, { comentario: e.target.value })} />
              <button type="button" title="Quitar link" onClick={() => del(i)} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#B91C1C', fontSize: 18, lineHeight: '34px' }}>×</button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={add} style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>+ Agregar otro link</button>
      <div style={{ marginTop: 10 }}>
        <label style={lab}>Foto del diseño</label>
        {foto ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <img src={foto} alt="Diseño" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />
            <button type="button" onClick={() => onChange({ diseno_foto: '' })} style={{ fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: 0, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Quitar</button>
          </div>
        ) : (
          <label style={{ display: 'inline-block', fontSize: 13, background: '#F1F5F9', color: '#334155', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontWeight: 600 }}>
            Subir foto
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
          </label>
        )}
        {err && <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 3 }}>{err}</div>}
      </div>
    </div>
  );
}

export default function DeliveryFields({ value, onChange, charges = [], chargesMode = 'always', sym = 'S/.', showDesign = true }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  const specific = String(v.franja_horaria || '').startsWith('A las');
  const fechaPC = v.tipo_entrega === 'por_confirmar' || !!v.fecha_por_confirmar;
  const horaPC = fechaPC || !!v.hora_por_confirmar;
  const showCharges = chargesMode === 'always' || (chargesMode === 'envio' && v.tipo_entrega === 'envio');

  const setTipo = (tipo) => set({
    tipo_entrega: tipo,
    ciudad_envio: tipo === 'envio' ? v.ciudad_envio : '',
    cargos: chargesMode === 'envio' && tipo !== 'envio' ? [] : v.cargos
  });
  const setFranja = (sel) => {
    if (sel === ESPECIFICA) set({ franja_horaria: `A las ${to12h('10:00')}` });
    else set({ franja_horaria: sel });
  };

  const selected = v.cargos || [];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        <div>
          <label style={lab}>Tipo de entrega</label>
          <select style={inp} value={v.tipo_entrega} onChange={(e) => setTipo(e.target.value)}>
            <option value="tienda">Recojo en tienda</option>
            <option value="envio">Envío (agencia / otra ciudad)</option>
            <option value="delivery">Delivery</option>
            {v.tipo_entrega === 'por_confirmar' && <option value="por_confirmar">Por confirmar (anterior)</option>}
          </select>
        </div>
        {v.tipo_entrega === 'envio' && (
          <div>
            <label style={lab}>Ciudad de envío</label>
            <input style={inp} value={v.ciudad_envio} placeholder="Ej. Cusco" onChange={(e) => set({ ciudad_envio: e.target.value })} />
          </div>
        )}
        {v.tipo_entrega === 'delivery' && (
          <div>
            <label style={lab}>Dirección de delivery (opcional)</label>
            <input style={inp} value={v.direccion_entrega || ''} placeholder="Calle, número, distrito" onChange={(e) => set({ direccion_entrega: e.target.value })} />
          </div>
        )}
        <div>
          <label style={lab} title="Fecha límite para entregar el borrador del diseño al cliente">Entrega de diseño</label>
          <input type="date" style={inp} value={v.fecha_entrega_diseno || ''} onChange={(e) => set({ fecha_entrega_diseno: e.target.value })} />
        </div>
        <div>
          <label style={lab}>Fecha de entrega</label>
          {!fechaPC && <input type="date" style={inp} value={v.fecha_entrega || ''} onChange={(e) => set({ fecha_entrega: e.target.value })} />}
          <label style={chk}><input type="checkbox" checked={fechaPC} onChange={(e) => set({ fecha_por_confirmar: e.target.checked })} /> Fecha por confirmar</label>
        </div>
        <div>
          <label style={lab}>Horario de entrega</label>
          {!horaPC && (
            <>
              <select style={inp} value={specific ? ESPECIFICA : v.franja_horaria} onChange={(e) => setFranja(e.target.value)}>
                {FRANJAS.map((f) => <option key={f} value={f}>{f}</option>)}
                {!specific && v.franja_horaria && !FRANJAS.includes(v.franja_horaria) && <option value={v.franja_horaria}>{v.franja_horaria}</option>}
                <option value={ESPECIFICA}>Hora específica…</option>
              </select>
              {specific && (
                <input type="time" style={{ ...inp, marginTop: '6px' }} value={to24h(v.franja_horaria) || '10:00'}
                  onChange={(e) => e.target.value && set({ franja_horaria: `A las ${to12h(e.target.value)}` })} />
              )}
            </>
          )}
          <label style={{ ...chk, opacity: fechaPC ? 0.6 : 1 }}><input type="checkbox" checked={horaPC} disabled={fechaPC} onChange={(e) => set({ hora_por_confirmar: e.target.checked })} /> Hora por confirmar</label>
        </div>
      </div>
      {(fechaPC || horaPC) && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6D28D9', background: '#F5F3FF', borderRadius: '8px', padding: '7px 10px' }}>
          {fechaPC ? 'La fecha y el horario' : 'El horario'} de entrega se confirmarán después; el pedido aparecerá como “POR CONFIRMAR” en el tablero.
        </div>
      )}

      {showDesign && <DesignFields link={v.diseno_link} links={v.diseno_links} foto={v.diseno_foto} onChange={set} />}

      {showCharges && <ChargesPicker selected={selected} onChange={(cargos) => set({ cargos })} charges={charges} sym={sym} />}
    </div>
  );
}

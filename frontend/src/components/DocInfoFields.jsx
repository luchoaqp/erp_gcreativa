import React, { useEffect, useState } from 'react';
import { Save, Check, FileText } from 'lucide-react';
import { quotesAPI } from '../api';
import { PRESETS } from '../utils/theme';

const inp = { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13.5px', background: '#fff', boxSizing: 'border-box' };
const lab = { fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block' };

export const DOC_KEYS = [
  'doc_razon_social', 'doc_color_nombre', 'doc_ruc', 'doc_direccion', 'doc_telefono', 'doc_email', 'doc_web',
  'atendido_etiqueta', 'atendido_modo', 'atendido_texto',
  'doc_mostrar_logo', 'doc_mostrar_ruc', 'doc_mostrar_direccion', 'doc_mostrar_telefono', 'doc_mostrar_email', 'doc_mostrar_web',
  'doc_mostrar_atendido', 'doc_mostrar_cliente_doc', 'doc_mostrar_cliente_tel', 'doc_mostrar_codigo', 'doc_mostrar_vigencia'
];

export const pickDocInfo = (c) => {
  const o = {};
  DOC_KEYS.forEach((k) => {
    if (k.startsWith('doc_mostrar_')) o[k] = !!Number(c[k]);
    else o[k] = c[k] || '';
  });
  return o;
};

/** Campos controlados: c = config, set(k,v) */
export function DocInfoFields({ c, set, store = {} }) {
  const chk = (key, label) => (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!Number(c[key])} onChange={(e) => set(key, e.target.checked ? 1 : 0)} /> {label}
    </label>
  );
  const field = (k, label, ph) => (
    <div>
      <label style={lab}>{label}</label>
      <input style={inp} value={c[k] || ''} placeholder={ph || ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
        <div style={{ fontWeight: 800, fontSize: '13.5px', marginBottom: '4px' }}>Datos de la empresa en los documentos</div>
        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
          Si dejas un campo vacío se usa el valor de “Configuración Empresa”. Aplica a cotizaciones, tickets y comprobantes.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {field('doc_razon_social', 'Razón social / nombre comercial', store.nombre_tienda)}
          {field('doc_ruc', 'RUC', store.ruc)}
          {field('doc_direccion', 'Dirección', store.direccion)}
          {field('doc_telefono', 'Teléfono / WhatsApp', store.telefono_whatsapp)}
          {field('doc_email', 'Correo', store.email_contacto)}
          {field('doc_web', 'Web / redes', 'ej. @regalodeensueno')}
        </div>
        <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap', marginTop: '12px' }}>
          {chk('doc_mostrar_logo', 'Logo')}
          {chk('doc_mostrar_ruc', 'RUC')}
          {chk('doc_mostrar_direccion', 'Dirección')}
          {chk('doc_mostrar_telefono', 'Teléfono')}
          {chk('doc_mostrar_email', 'Correo')}
          {chk('doc_mostrar_web', 'Web / redes')}
        </div>
      </div>

      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
        <div style={{ fontWeight: 800, fontSize: '13.5px', marginBottom: '10px' }}>Información de la cotización / venta</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {field('atendido_etiqueta', 'Etiqueta', 'Atendido por')}
          <div>
            <label style={lab}>Quién aparece</label>
            <select style={inp} value={c.atendido_modo || 'usuario'} onChange={(e) => set('atendido_modo', e.target.value)}>
              <option value="usuario">El usuario que emite el documento</option>
              <option value="fijo">Un nombre fijo</option>
            </select>
          </div>
          {(c.atendido_modo === 'fijo') && field('atendido_texto', 'Nombre fijo', 'ej. Luisa Quispe')}
        </div>
        <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap', marginTop: '12px' }}>
          {chk('doc_mostrar_atendido', 'Mostrar “Atendido por”')}
          {chk('doc_mostrar_cliente_doc', 'Documento del cliente')}
          {chk('doc_mostrar_cliente_tel', 'Teléfono del cliente')}
          {chk('doc_mostrar_codigo', 'Código de producto')}
          {chk('doc_mostrar_vigencia', 'Vigencia (cotización)')}
        </div>
      </div>
    </div>
  );
}

/** Panel autónomo para la pestaña "Documentos" de Configuración */
export default function DocConfigPanel({ store = {} }) {
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { quotesAPI.getConfig().then((r) => setC(r.config || r)).catch(() => setC({})); }, []);
  if (!c) return <div style={{ padding: 20, color: '#64748B' }}>Cargando…</div>;
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const save = async () => {
    try {
      setBusy(true);
      const r = await quotesAPI.updateConfig({ ...pickDocInfo(c), color_acento: c.color_acento || '#FF5E36' });
      if (r.success) { setC(r.config); setOk(true); setTimeout(() => setOk(false), 2500); }
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EEF3F0', padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <FileText size={20} color="var(--primary)" />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Información de documentos</h3>
      </div>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Colores de los documentos (cotización, nota de venta, boleta, factura)</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <label style={lab}>Color del nombre de la empresa</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={c.doc_color_nombre || c.color_acento || '#FF5E36'} onChange={(e) => set('doc_color_nombre', e.target.value)} style={{ width: 54, height: 38, padding: 2, border: '1px solid #E2E8F0', borderRadius: 8 }} />
              <button type="button" onClick={() => set('doc_color_nombre', '')} style={{ border: 0, background: 'none', color: '#4F8EF7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Igual que el acento</button>
            </div>
          </div>
          <div>
            <label style={lab}>Color de acento (títulos de tabla y líneas)</label>
            <input type="color" value={c.color_acento || '#FF5E36'} onChange={(e) => set('color_acento', e.target.value)} style={{ width: 54, height: 38, padding: 2, border: '1px solid #E2E8F0', borderRadius: 8 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {PRESETS.map((x) => (
            <button type="button" key={x.hex} title={x.name} onClick={() => { set('color_acento', x.hex); set('doc_color_nombre', x.hex); }}
              style={{ width: 26, height: 26, borderRadius: 999, background: x.hex, border: '2px solid #fff', boxShadow: '0 0 0 1px #CBD5E1', cursor: 'pointer' }} aria-label={x.name} />
          ))}
          <span style={{ fontSize: 12, color: '#788A9B', alignSelf: 'center' }}>Atajos: aplican el mismo color al nombre y al acento.</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: c.doc_color_nombre || c.color_acento || '#FF5E36' }}>{c.doc_razon_social || store.nombre_tienda || 'Nombre de la empresa'}
          <span style={{ display: 'inline-block', marginLeft: 14, fontSize: 12, background: c.color_acento || '#FF5E36', color: '#fff', padding: '4px 10px', borderRadius: 6 }}>Cant. · Descripción · Total</span></div>
      </div>
      <DocInfoFields c={c} set={set} store={store} />
      <button onClick={save} disabled={busy} className="btn-primary" style={{ marginTop: 16, width: 'auto', padding: '10px 24px', borderRadius: 12, fontSize: 14 }}>
        {ok ? <Check size={17} /> : <Save size={17} />} {busy ? 'Guardando...' : ok ? 'Guardado' : 'Guardar información'}
      </button>
    </div>
  );
}

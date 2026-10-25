import React from 'react';
import { FileText, Globe, Receipt, ListChecks } from 'lucide-react';

/**
 * Descripción para clientes: lo que ve el cliente debajo del nombre del producto
 * (ej. qué incluye un box) y en qué lugares se muestra.
 * value: { web_descripcion, desc_cotizacion, desc_documentos, desc_web }
 * sugerencia: texto opcional para el botón "Armar desde lo que lleva" (packs)
 */
export default function ClientDescription({ value, onChange, sugerencia = '', titulo = true }) {
  const v = value || {};
  const flag = (k) => v[k] === undefined || v[k] === null ? true : !!Number(v[k]);
  const chk = (k, Icon, label) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '5px 10px', borderRadius: 999, border: '1px solid #E4EAF0', background: flag(k) ? 'var(--primary-light)' : '#fff' }}>
      <input type="checkbox" checked={flag(k)} onChange={(e) => onChange({ [k]: e.target.checked })} />
      <Icon size={14} /> {label}
    </label>
  );
  return (
    <div style={{ border: '1px solid #E4EAF0', borderRadius: 12, padding: '12px 14px', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          {titulo && <strong style={{ color: '#1C2A38' }}>Descripción para clientes</strong>}
          <div style={{ fontSize: 12, color: '#788A9B' }}>Se muestra debajo del nombre del producto. Empieza una línea con • o - para que salga como lista.</div>
        </div>
        {sugerencia && (
          <button type="button" className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }}
            onClick={() => onChange({ web_descripcion: v.web_descripcion ? `${v.web_descripcion}\n${sugerencia}` : sugerencia })}>
            <ListChecks size={14} /> Armar desde lo que lleva
          </button>
        )}
      </div>
      <textarea rows={5} className="pm-in" style={{ marginTop: 8, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }}
        maxLength={2000} value={v.web_descripcion || ''} onChange={(e) => onChange({ web_descripcion: e.target.value })}
        placeholder={'Incluye:\n• 2 tazas 11 Oz. blancas personalizadas\n• Caja decorada (papel picado, lazo y tarjeta en tapa)\n*Regalo: 2 minichocolates'} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 700 }}>Mostrar en:</span>
        {chk('desc_cotizacion', FileText, 'Cotizaciones')}
        {chk('desc_documentos', Receipt, 'Documentos de venta')}
        {chk('desc_web', Globe, 'Página web')}
      </div>
    </div>
  );
}

/** "Incluye:\n• 2 x Taza…" a partir de los componentes de un pack */
export function sugerenciaDesdeComponentes(items) {
  const lista = (items || []).filter((c) => c && (c.nombre || c.componente_nombre));
  if (!lista.length) return '';
  return ['Incluye:', ...lista.map((c) => `• ${Number(c.cantidad) > 1 ? `${Number(c.cantidad)} x ` : ''}${c.nombre || c.componente_nombre}`)].join('\n');
}

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, MessageCircle, ExternalLink } from 'lucide-react';
import { openHtmlWindow } from '../utils/docPrint';

const ALL_FORMATS = [
  { id: 'a4', label: 'A4' },
  { id: 'a5', label: 'A5' },
  { id: 'ticket', label: 'Ticket 80 mm' }
];

// docs: [{ key, label, build: (format) => htmlString, message: 'texto para WhatsApp' }]
export default function PrintModal({ title, subtitle = 'Ver, imprimir o enviar', docs, phone = '', onClose, formats = null, showWhatsApp = true, actions = null }) {
  const FORMATS = formats || ALL_FORMATS;
  const [docKey, setDocKey] = useState(docs[0].key);
  const [format, setFormat] = useState((formats || ALL_FORMATS)[0].id);
  const [wa, setWa] = useState(String(phone || '').replace(/\D/g, '').replace(/^51(?=\d{9}$)/, ''));
  const frame = useRef(null);
  const doc = docs.find((d) => d.key === docKey) || docs[0];
  const html = doc.build(format);

  const printNow = () => {
    const w = frame.current && frame.current.contentWindow;
    if (!w) return;
    // El nombre del PDF sale del título: se usa el código del documento (COT-00100, B001-000012, PD-000005...)
    const m = /<title>([^<]*)<\/title>/i.exec(html);
    const nombre = m ? m[1].replace(/&amp;/g, '&').trim() : '';
    const prevTop = document.title;
    let prevFrame = '';
    try { prevFrame = w.document.title; if (nombre) w.document.title = nombre; } catch (e) { /* ignorar */ }
    if (nombre) document.title = nombre;
    const restore = () => { document.title = prevTop; try { w.document.title = prevFrame; } catch (e) { /* ignorar */ } };
    w.addEventListener('afterprint', restore, { once: true });
    w.focus(); w.print();
    setTimeout(restore, 60000);
  };
  const sendWhatsApp = () => {
    let p = wa.replace(/\D/g, '');
    if (p.length === 9) p = '51' + p;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(doc.message || '')}`, '_blank');
  };

  const chip = (active) => ({
    padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
    border: active ? '2px solid var(--primary)' : '1px solid #E2E8F0', background: active ? 'var(--primary-light)' : '#fff', color: active ? 'var(--primary)' : '#475569'
  });

  // Se monta fuera del contenedor del tema para que el modo oscuro no altere los colores del documento
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1200 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 980, width: '96%', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1C2A38' }}>{title}</div>
            <div style={{ fontSize: '12.5px', color: '#788A9B' }}>{subtitle}</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '10px', background: '#F1F5F9' }} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          {FORMATS.map((f) => (
            <button key={f.id} onClick={() => setFormat(f.id)} style={chip(format === f.id)}>{f.label}</button>
          ))}
          {docs.length > 1 && (
            <select value={docKey} onChange={(e) => setDocKey(e.target.value)}
              style={{ marginLeft: 'auto', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', fontWeight: 600 }}>
              {docs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <iframe ref={frame} title="Vista previa" srcDoc={html}
            style={{ flex: '1 1 520px', height: '60vh', minHeight: '360px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#fff' }} />
          <div style={{ flex: '0 1 260px', display: 'grid', gap: '10px', width: '100%' }}>
            {actions}
            <button onClick={printNow} className="btn-primary" style={{ padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
              <Printer size={17} /> Imprimir {FORMATS.find((f) => f.id === format).label}
            </button>
            <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '-4px' }}>
              Para guardar en PDF elige “Guardar como PDF” como impresora.
            </div>
            <button onClick={() => openHtmlWindow(doc.build(format))}
              style={{ padding: '9px', borderRadius: '10px', background: '#F1F5F9', fontWeight: 700, fontSize: '13px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
              <ExternalLink size={15} /> Abrir en otra pestaña
            </button>
            {showWhatsApp && <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Enviar al cliente por WhatsApp</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ padding: '9px 10px', borderRadius: '10px', background: '#F1F5F9', fontSize: '13px' }}>+51</span>
                <input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="987654321"
                  style={{ flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '13px' }} />
              </div>
              <button onClick={sendWhatsApp} style={{ marginTop: '8px', width: '100%', padding: '9px', borderRadius: '10px', background: '#25D366', color: '#fff', fontWeight: 700, display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                <MessageCircle size={16} /> Enviar mensaje
              </button>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                Abre WhatsApp con el resumen; adjunta el PDF guardado si lo deseas.
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

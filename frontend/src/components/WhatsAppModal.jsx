import React, { useState, useMemo } from 'react';
import { X, Copy, Check, RotateCcw, MessageCircle } from 'lucide-react';
import { pdNumber } from '../utils/docPrint';
import { entregaLabel, fechaPorConfirmar, horaPorConfirmar } from '../utils/entrega';

const WA_ICON = <MessageCircle size={18} />;

// Mensaje inicial según la etapa del pedido
export function mensajeInicial(order, store = {}, etapaId) {
  const tienda = store.nombre_tienda || 'nuestra tienda';
  const nombre = order.cliente_nombre && order.cliente_nombre !== 'Cliente Varios' ? ` ${order.cliente_nombre}` : '';
  const num = pdNumber(order.id);
  const entrega = fechaPorConfirmar(order) ? 'por confirmar' : entregaLabel(order.fecha_entrega, order.tipo_entrega).toLowerCase() + (horaPorConfirmar(order) ? ' (hora por confirmar)' : '');
  let links = [];
  try { const j = JSON.parse(order.diseno_links); if (Array.isArray(j)) links = j; } catch (e) { /* sin lista */ }
  if (!links.length && order.diseno_link) links = [{ url: order.diseno_link, comentario: '' }];
  links = links.filter((x) => /^https?:\/\//i.test(x.url || ''));
  const link = links.length === 1 && !links[0].comentario ? links[0].url : '';
  const bloqueLinks = links.length === 0 ? '' : (link ? `Puedes revisarlo aquí: ${link}\n` : `Puedes revisar los diseños aquí:\n${links.map((x) => `${x.comentario ? `• ${x.comentario}: ` : '• '}${x.url}`).join('\n')}\n`);
  const hola = `¡Hola${nombre}! 🎁 Te saludamos de ${tienda}.`;
  switch (etapaId) {
    case 'pendiente_diseno':
      return `${hola}\nRecibimos tu pedido ${num} y ya estamos trabajando en tu diseño. En cuanto esté listo te lo enviamos para tu aprobación. ¡Gracias por tu preferencia!`;
    case 'pendiente_aprobacion':
      return `${hola}\nYa tenemos listo el diseño de tu pedido ${num} ✨\n${bloqueLinks || 'Te lo compartimos en este chat para que lo revises.\n'}Por favor confírmanos si lo apruebas o si deseas algún cambio para pasarlo a producción.`;
    case 'en_produccion':
      return `${hola}\nTu pedido ${num} ya está en producción 🛠️. Fecha de entrega: ${entrega}. Te avisaremos cuando esté listo.`;
    case 'listo':
      return `${hola}\nTu pedido ${num} ya está listo ✅. ${order.tipo_entrega === 'envio' ? 'Lo estamos preparando para el envío.' : 'Puedes recogerlo en nuestro taller.'} Entrega: ${entrega}.`;
    case 'en_ruta':
      return `${hola}\nTu pedido ${num} va en camino 🚚. Entrega: ${entrega}. ¡Estate atento a tu teléfono!`;
    case 'entregado':
      return `${hola}\nTu pedido ${num} fue entregado 🎉. ¡Gracias por confiar en nosotros! Si te gustó, cuéntales a tus amigos.`;
    default:
      return `${hola}\nTe escribimos por tu pedido ${num}.`;
  }
}

export default function WhatsAppModal({ order, store, etapaTitulo, onClose }) {
  const inicial = useMemo(() => mensajeInicial(order, store, order.estado_pedido), [order, store]);
  const [msg, setMsg] = useState(inicial);
  const [tel, setTel] = useState(String(order.cliente_telefono || order.telefono_destinatario || '').replace(/\D/g, '').replace(/^51(?=\d{9}$)/, ''));
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); } catch (e) {
      const t = document.createElement('textarea'); t.value = msg; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const send = () => {
    let p = tel.replace(/\D/g, '');
    if (p.length === 9) p = '51' + p;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 560, width: '96%', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1C2A38' }}>Mensaje por WhatsApp</div>
            <div style={{ fontSize: 12.5, color: '#788A9B' }}>{pdNumber(order.id)} · {order.cliente_nombre} · Etapa: {etapaTitulo}</div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 10, background: '#F1F5F9' }} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Teléfono del cliente</label>
        <div style={{ display: 'flex', gap: 6, margin: '5px 0 12px' }}>
          <span style={{ padding: '9px 10px', borderRadius: 10, background: '#F1F5F9', fontSize: 13 }}>+51</span>
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="987654321"
            style={{ flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13 }} />
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Mensaje (puedes editarlo)</label>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={8}
          style={{ width: '100%', marginTop: 5, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13.5, lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        {order.estado_pedido === 'pendiente_aprobacion' && !order.diseno_link && (
          <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', borderRadius: 8, padding: '6px 10px', marginTop: 8 }}>
            Este pedido no tiene link de diseño. Agrégalo desde el ícono de diseño de la tarjeta para incluirlo en el mensaje.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setMsg(inicial)} style={{ padding: '10px 14px', borderRadius: 10, background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><RotateCcw size={15} /> Restablecer</button>
          <button onClick={copy} style={{ padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid #E2E8F0', color: '#1C2A38', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar mensaje'}
          </button>
          <button onClick={send} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            {WA_ICON} Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

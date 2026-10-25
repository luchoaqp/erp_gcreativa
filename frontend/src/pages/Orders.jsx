import React, { useState, useEffect } from 'react';
import { Truck, MessageCircle, FileText, Palette, X, Send } from 'lucide-react';
import WhatsAppModal from '../components/WhatsAppModal';
import { buildTallerHTML, ETAPAS_PRODUCCION } from '../utils/tallerPrint';
import ShippingModal from '../components/ShippingModal';
import { ordersAPI, salesAPI, settingsAPI } from '../api';
import PrintModal from '../components/PrintModal';
import { buildSaleDocHTML, pdNumber } from '../utils/docPrint';
import { money } from '../utils/quotePrint';
import { DesignFields } from '../components/DeliveryFields';
import { ComprobanteModal } from './Reports';
import { PaymentsModal } from './Reports';
import { entregaLabel, entregaTone, semanaActual, localISO, fechaPorConfirmar, horaPorConfirmar, entregaTexto } from '../utils/entrega';

const columns = [
  { id: 'pendiente_diseno', title: 'Pendientes de diseño', color: '#64748B', badgeBg: '#F1F5F9' },
  { id: 'pendiente_aprobacion', title: 'Pendientes de aprobación', color: '#EC4899', badgeBg: '#FCE7F3' },
  { id: 'en_produccion', title: 'En producción', color: '#F59E0B', badgeBg: '#FEF3C7' },
  { id: 'listo', title: 'Listo para despacho', color: '#8B5CF6', badgeBg: '#EDE9FE' },
  { id: 'en_ruta', title: 'En ruta con repartidor', color: '#3B82F6', badgeBg: '#DBEAFE' },
  { id: 'entregado', title: 'Entregado', color: '#10B981', badgeBg: '#D1FAE5' }
];

// Flujo de trabajo: a qué etapa avanza cada pedido y con qué botón
const flow = {
  pendiente_diseno: { next: 'pendiente_aprobacion', label: 'Enviar a aprobación ➔', bg: '#EC4899' },
  pendiente_aprobacion: { next: 'en_produccion', label: 'Aprobado · A producción ➔', bg: '#F59E0B' },
  en_produccion: { next: 'listo', label: 'Empacar & Listo ➔', bg: '#8B5CF6' },
  listo: { next: 'en_ruta', label: 'Asignar Ruta ➔', bg: '#3B82F6' },
  en_ruta: { next: 'entregado', label: '✓ Confirmar Entrega', bg: '#10B981' }
};
const previousStage = {
  pendiente_aprobacion: 'pendiente_diseno',
  en_produccion: 'pendiente_aprobacion',
  listo: 'en_produccion',
  en_ruta: 'listo',
  entregado: 'en_ruta'
};

const saldoDe = (o) => Math.max(0, Math.round((Number(o.total) - Number(o.pagado || 0)) * 100) / 100);
const productosDe = (o) => (o.productos_resumen ? String(o.productos_resumen).split('||') : []);

export default function Orders({ user }) {
  const [payFor, setPayFor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('all'); // 'all' | 'today' | 'week'
  const [printData, setPrintData] = useState(null);
  const [notesFor, setNotesFor] = useState(null); // { order, detail, loading }
  const [dis, setDis] = useState({ link: '', links: [], foto: '' });
  const [disBusy, setDisBusy] = useState(false);
  const saveDis = async () => {
    try {
      setDisBusy(true);
      const ls = (dis.links || []).filter((x) => (x.url || '').trim()).map((x) => ({ url: x.url.trim(), comentario: (x.comentario || '').trim() }));
      await ordersAPI.saveDiseno(notesFor.order.id, { links: ls, foto: dis.foto || '' });
      setOrders((p) => p.map((x) => x.id === notesFor.order.id ? { ...x, diseno_link: ls[0]?.url || null, diseno_links: ls.length ? JSON.stringify(ls) : null, diseno_tiene_foto: dis.foto ? 1 : 0 } : x));
      setNotesFor(null);
    } catch (e) { alert(e.message); } finally { setDisBusy(false); }
  };
  const [shipFor, setShipFor] = useState(null);
  const [compFor, setCompFor] = useState(null);
  const [waFor, setWaFor] = useState(null);
  const [docCfg, setDocCfg] = useState({});
  const [store, setStore] = useState({});

  useEffect(() => {
    salesAPI.docConfig().then((r) => { if (r.success) setDocCfg(r.config); }).catch(() => {});
    settingsAPI.get().then((r) => { if (r.success) setStore(r.settings || {}); }).catch(() => {});
  }, []);

  useEffect(() => { loadOrders(); }, [filterDate]);

  const openNotes = async (order) => {
    setNotesFor({ order, detail: null, loading: true });
    setDis({ link: '', links: [], foto: '' });
    ordersAPI.getDiseno(order.id).then((r) => { if (r.success) setDis({ link: r.link || '', links: r.links || [], foto: r.foto || '' }); }).catch(() => {});
    try {
      const r = await ordersAPI.getById(order.id);
      setNotesFor({ order, detail: r.success ? r.order : null, loading: false });
    } catch (e) {
      setNotesFor({ order, detail: null, loading: false });
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = filterDate === 'today' ? `?fecha_entrega=${localISO()}` : '';
      const res = await ordersAPI.getAll(params);
      if (res.success) setOrders(res.orders.filter((o) => o.estado_pedido !== 'cancelado'));
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, { estado_pedido: newStatus });
      loadOrders();
    } catch (err) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  const openWhatsApp = (order) => setWaFor(order);

  // Ticket para el taller (80 mm): datos del pedido sin precios, notas y QR del diseño en producción
  const openTaller = async (order) => {
    try {
      const [res, dis] = await Promise.all([ordersAPI.getById(order.id), ordersAPI.getDiseno(order.id).catch(() => ({}))]);
      if (!res.success) return;
      const o = res.order;
      const links = (dis && dis.links) || [];
      setPrintData({
        title: `Ticket de taller ${pdNumber(o.id)}`,
        subtitle: ETAPAS_PRODUCCION.includes(o.estado_pedido) ? 'Incluye el QR del diseño si el pedido tiene link' : 'El QR del diseño aparece cuando el pedido pasa a producción',
        formats: [{ id: 'ticket', label: 'Ticket 80 mm' }],
        showWhatsApp: false,
        docs: [{ key: 'taller', label: `Taller ${pdNumber(o.id)}`, build: () => buildTallerHTML({ order: o, links, store, cfg: docCfg, toolbar: false }) }]
      });
    } catch (err) {
      alert('No se pudo generar el ticket de taller: ' + err.message);
    }
  };

  const IconBtn = ({ onClick, title, bg, color, children }) => (
    <button onClick={onClick} title={title} style={{ color, padding: '4px', background: bg, borderRadius: '6px' }}>{children}</button>
  );

  const stageButtons = (order, colId) => (flow[colId] || previousStage[colId]) && (
    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
      {previousStage[colId] && (
        <button
          onClick={() => handleStatusChange(order.id, previousStage[colId])}
          title={`Devolver a: ${columns.find((c) => c.id === previousStage[colId]).title}`}
          style={{ padding: '6px 9px', fontSize: '11px', borderRadius: '6px', background: '#F1F5F9', color: '#475569', fontWeight: '700' }}
        >
          ↩ Devolver
        </button>
      )}
      {flow[colId] && (
        <button
          onClick={() => handleStatusChange(order.id, flow[colId].next)}
          className="btn-primary"
          style={{ padding: '6px', fontSize: '11px', borderRadius: '6px', background: flow[colId].bg }}
        >
          {flow[colId].label}
        </button>
      )}
    </div>
  );

  // ---------- Entregas programadas de la semana (lista agrupada por día) ----------
  const renderWeek = () => {
    const dias = semanaActual();
    const delSemana = orders.filter((o) => !fechaPorConfirmar(o) && dias.includes(String(o.fecha_entrega).slice(0, 10)));
    const porConfirmar = orders.filter((o) => fechaPorConfirmar(o) && o.estado_pedido !== 'entregado');
    const row = (o) => {
      const col = columns.find((c) => c.id === o.estado_pedido);
      const saldo = saldoDe(o);
      return (
        <div key={o.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid #EEF3F0' }}>
          <span style={{ fontWeight: 800, color: '#788A9B', fontSize: '12px', minWidth: '84px' }}>{pdNumber(o.id)}</span>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#1C2A38', fontSize: '14px' }}>{o.cliente_nombre}</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>{productosDe(o).join(' · ') || '—'}</div>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', minWidth: '110px' }}>
            {horaPorConfirmar(o) ? 'HORA POR CONFIRMAR' : (o.franja_horaria || '')}{o.tipo_entrega === 'delivery' ? <div style={{ color: '#0F766E', fontWeight: 600 }}>Delivery</div> : null}{o.tipo_entrega === 'envio' && o.ciudad_envio ? <div style={{ color: '#1D4ED8', fontWeight: 600 }}>Envío a {o.ciudad_envio}</div> : null}
          </div>
          <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: col?.badgeBg, color: col?.color }}>{col?.title}</span>
          {saldo > 0.009 && <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309' }}>Saldo S/. {saldo.toFixed(2)}</span>}
          <span style={{ fontWeight: 800, color: 'var(--primary)', minWidth: '78px', textAlign: 'right' }}>S/. {Number(o.total).toFixed(2)}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <IconBtn onClick={() => openTaller(o)} title="Ticket para el taller" bg={o.notas_taller ? '#FEF3C7' : '#F4F7F6'} color={o.notas_taller ? '#B45309' : '#788A9B'}><FileText size={14} /></IconBtn>
            <IconBtn onClick={() => openNotes(o)} title="Diseño (link / foto) y notas" bg="#F4F7F6" color="#788A9B"><Palette size={14} /></IconBtn>
            {o.tipo_entrega === 'envio' && ETAPAS_PRODUCCION.includes(o.estado_pedido) && <IconBtn onClick={() => setShipFor(o)} title="Datos de envío y rótulo" bg={Number(o.envio_datos) ? '#DBEAFE' : '#F4F7F6'} color={Number(o.envio_datos) ? '#1D4ED8' : '#788A9B'}><Send size={14} /></IconBtn>}
            <IconBtn onClick={() => openWhatsApp(o)} title="WhatsApp" bg="#25D366" color="#fff"><MessageCircle size={14} /></IconBtn>
          </div>
        </div>
      );
    };
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {dias.map((iso) => {
          const lista = delSemana.filter((o) => String(o.fecha_entrega).slice(0, 10) === iso);
          const tone = entregaTone(iso, 'tienda');
          return (
            <div key={iso} style={{ background: '#fff', border: '1px solid #EEF3F0', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: tone.bg, color: tone.color, fontWeight: 800, fontSize: '13px' }}>
                <span>{entregaLabel(iso, 'tienda')}</span>
                <span>{lista.length} {lista.length === 1 ? 'entrega' : 'entregas'}</span>
              </div>
              {lista.length === 0
                ? <div style={{ padding: '10px 14px', fontSize: '12.5px', color: '#94A3B8' }}>Sin entregas programadas</div>
                : lista.map(row)}
            </div>
          );
        })}
        {porConfirmar.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #EEF3F0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#EDE9FE', color: '#6D28D9', fontWeight: 800, fontSize: '13px' }}>
              POR CONFIRMAR · {porConfirmar.length} {porConfirmar.length === 1 ? 'pedido' : 'pedidos'} sin fecha de entrega
            </div>
            {porConfirmar.map(row)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="content-body animate-fade-in">
      <div className="page-header-responsive">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Truck size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Pedidos</h2>
        </div>

        <div className="header-actions-responsive">
          <button className={`cat-chip ${filterDate === 'today' ? 'active' : ''}`} onClick={() => setFilterDate('today')}>📅 Entregas de hoy</button>
          <button className={`cat-chip ${filterDate === 'week' ? 'active' : ''}`} onClick={() => setFilterDate('week')}>🗓 Esta semana</button>
          <button className={`cat-chip ${filterDate === 'all' ? 'active' : ''}`} onClick={() => setFilterDate('all')}>
            Todos los pedidos {filterDate !== 'week' ? `(${orders.length})` : ''}
          </button>
        </div>
      </div>

      {filterDate === 'week' ? renderWeek() : (
        <div className="kanban-board" style={{ gridTemplateColumns: 'repeat(6, minmax(270px, 1fr))' }}>
          {columns.map((col) => {
            // Más próximas primero (las de mañana antes que las del viernes); sin fecha o por confirmar al final
            const keyF = (o) => (fechaPorConfirmar(o) ? '9999-99-99' : String(o.fecha_entrega).slice(0, 10));
            // Prioridad: en etapas de diseño manda la fecha de entrega del diseño; de Producción en adelante, la fecha de entrega del pedido
            const esDiseno = col.id === 'pendiente_diseno' || col.id === 'pendiente_aprobacion';
            const keyD = (o) => (o.fecha_entrega_diseno ? String(o.fecha_entrega_diseno).slice(0, 10) : keyF(o));
            const prio = esDiseno ? keyD : keyF;
            const colOrders = orders.filter((o) => o.estado_pedido === col.id && !(col.id === 'entregado' && Number(o.comprobantes_emitidos) > 0))
              .sort((x, y) => prio(x).localeCompare(prio(y)) || keyF(x).localeCompare(keyF(y)) || String(x.franja_horaria || '').localeCompare(String(y.franja_horaria || '')) || x.id - y.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-col-header" style={{ borderTop: `4px solid ${col.color}` }}>
                  <span>{col.title}<small style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#94A3B8' }}>Orden: {esDiseno ? 'entrega de diseño' : 'fecha de entrega'}</small></span>
                  <span className="kanban-col-count" style={{ background: col.badgeBg, color: col.color }}>{colOrders.length}</span>
                </div>

                <div className="kanban-col-body">
                  {colOrders.map((order) => {
                    const tone = entregaTone(order.fecha_entrega, order.tipo_entrega);
                    const saldo = saldoDe(order);
                    const prods = productosDe(order);
                    return (
                      <div key={order.id} className="kanban-order-card">
                        {/* Código de pedido + entrega programada */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#788A9B', whiteSpace: 'nowrap' }}>{pdNumber(order.id)}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', background: tone.bg, color: tone.color }}>
                              {entregaLabel(order.fecha_entrega, order.tipo_entrega)}
                            </span>
                            {!fechaPorConfirmar(order) && order.franja_horaria && (
                              <div style={{ fontSize: '10.5px', color: horaPorConfirmar(order) ? '#6D28D9' : '#788A9B', fontWeight: horaPorConfirmar(order) ? 700 : 400, marginTop: '2px' }}>{horaPorConfirmar(order) ? 'HORA POR CONFIRMAR' : order.franja_horaria}</div>
                            )}
                          </div>
                        </div>

                        {/* Entrega de diseño: se oculta al pasar a producción */}
                        {esDiseno && (() => {
                          if (!order.fecha_entrega_diseno) {
                            return (
                              <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: '#F1F5F9', color: '#64748B' }} title="Pedido sin fecha de diseño: se ordena por su fecha de entrega">
                                <Palette size={12} /> Diseño: sin fecha
                              </div>
                            );
                          }
                          const dt = entregaTone(order.fecha_entrega_diseno, 'tienda');
                          return (
                            <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px', background: dt.bg, color: dt.color }} title="Fecha límite para entregar el borrador del diseño">
                              <Palette size={12} /> Diseño: {entregaLabel(order.fecha_entrega_diseno, 'tienda')}
                            </div>
                          );
                        })()}

                        {/* Cliente */}
                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#1C2A38', margin: '4px 0 2px' }}>{order.cliente_nombre}</h4>

                        {/* Producto adquirido y cantidad */}
                        <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                          {prods.slice(0, 3).map((p, i) => <div key={i}>{p}</div>)}
                          {prods.length > 3 && <div style={{ color: '#94A3B8' }}>+ {prods.length - 3} más</div>}
                          {prods.length === 0 && <div style={{ color: '#94A3B8' }}>Sin productos</div>}
                        </div>

                        {col.id === 'listo' ? (
                          <button onClick={() => setPayFor(order)} title="Registrar o gestionar pagos"
                            style={{ marginTop: '4px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '11.5px', fontWeight: 800, borderRadius: '8px', padding: '5px 9px',
                              border: `1px solid ${saldo > 0.009 ? '#FDE68A' : '#A7F3D0'}`, background: saldo > 0.009 ? '#FFFBEB' : '#ECFDF5', color: saldo > 0.009 ? '#B45309' : '#047857' }}>
                            {saldo > 0.009 ? `● Pendiente S/. ${saldo.toFixed(2)} · Registrar pago` : '● Pagado'}
                          </button>
                        ) : saldo > 0.009 && (
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '3px 8px', marginTop: '4px' }}>
                            Saldo pendiente: S/. {saldo.toFixed(2)}
                          </div>
                        )}

                        {/* Monto, imprimir y WhatsApp */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0F4F2', paddingTop: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>S/. {Number(order.total).toFixed(2)}</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <IconBtn onClick={() => openTaller(order)} title="Ticket para el taller" bg={order.notas_taller ? '#FEF3C7' : '#F4F7F6'} color={order.notas_taller ? '#B45309' : '#788A9B'}><FileText size={14} /></IconBtn>
                            <IconBtn onClick={() => openNotes(order)} title="Diseño (link / foto) y notas" bg={(order.diseno_link || Number(order.diseno_tiene_foto)) ? '#DBEAFE' : '#F4F7F6'} color={(order.diseno_link || Number(order.diseno_tiene_foto)) ? '#1D4ED8' : '#788A9B'}><Palette size={14} /></IconBtn>
                            {order.tipo_entrega === 'envio' && (ETAPAS_PRODUCCION.includes(order.estado_pedido)
                              ? <IconBtn onClick={() => setShipFor(order)} title="Datos de envío y rótulo" bg={Number(order.envio_datos) ? '#DBEAFE' : '#F4F7F6'} color={Number(order.envio_datos) ? '#1D4ED8' : '#788A9B'}><Send size={14} /></IconBtn>
                              : <span title="Disponible desde la etapa En producción" style={{ padding: '4px', borderRadius: '6px', background: '#F8FAFC', color: '#CBD5E1', cursor: 'not-allowed', display: 'inline-flex' }}><Send size={14} /></span>)}
                            <IconBtn onClick={() => openWhatsApp(order)} title="Avisar por WhatsApp" bg="#25D366" color="#FFFFFF"><MessageCircle size={14} /></IconBtn>
                          </div>
                        </div>

                        {/* Entregado: emitir el comprobante; al generarlo la tarjeta sale del tablero */}
                        {col.id === 'entregado' && (saldo > 0.009
                          ? <button onClick={() => setPayFor(order)} title="Para emitir el comprobante el pedido debe estar pagado"
                              style={{ marginTop: '4px', padding: '7px', fontSize: '11.5px', borderRadius: '8px', fontWeight: 800, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309', cursor: 'pointer' }}>
                              Cobrar saldo S/. {saldo.toFixed(2)} para facturar
                            </button>
                          : <button onClick={() => setCompFor(order)} className="btn-primary" style={{ marginTop: '4px', padding: '7px', fontSize: '12px', borderRadius: '8px', background: '#6D28D9' }}>
                              <FileText size={13} /> Generar comprobante
                            </button>)}

                        {/* Devolver / avanzar de etapa */}
                        {stageButtons(order, col.id)}
                      </div>
                    );
                  })}
                  {colOrders.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', padding: '14px 4px' }}>Sin pedidos</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {compFor && (
        <ComprobanteModal sale={compFor} cfg={docCfg} store={store} onClose={() => setCompFor(null)}
          onDone={() => { setCompFor(null); loadOrders(); }} />
      )}

      {notesFor && (() => {
        const o = notesFor.order;
        const d = notesFor.detail || o;
        const items = notesFor.detail?.items || [];
        const conDetalle = items.filter((i) => i.detalles_personalizacion);
        const row = (label, val) => val ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#788A9B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', color: '#1C2A38', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{val}</div>
          </div>
        ) : null;
        const hayAlgo = d.notas_taller || d.mensaje_dedicatoria || d.de_parte_de || conDetalle.length > 0;
        return (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setNotesFor(null); }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '520px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EBF1EE', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={20} color="#F59E0B" /> Notas para el taller</h3>
                  <div style={{ fontSize: '12.5px', color: '#788A9B', marginTop: '2px' }}>{pdNumber(o.id)} · {o.cliente_nombre}</div>
                </div>
                <button onClick={() => setNotesFor(null)} style={{ color: '#788A9B' }} aria-label="Cerrar"><X size={20} /></button>
              </div>
              {notesFor.loading ? <div style={{ color: '#788A9B', padding: '12px 0' }}>Cargando…</div> : (
                <>
                  {row('Notas para el taller', d.notas_taller)}
                  {conDetalle.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#788A9B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Personalización por producto</div>
                      {conDetalle.map((i) => (
                        <div key={i.id} style={{ fontSize: '14px', color: '#1C2A38', marginBottom: '4px' }}><strong>{i.cantidad} × {i.producto_nombre || i.descripcion}:</strong> {i.detalles_personalizacion}</div>
                      ))}
                    </div>
                  )}
                  {row('Mensaje de dedicatoria', d.mensaje_dedicatoria)}
                  {row('De parte de', d.de_parte_de)}
                  {d.fecha_entrega_diseno && row('Entrega de diseño', entregaLabel(d.fecha_entrega_diseno, 'tienda'))}
                  {row('Entrega del pedido', entregaTexto(d))}
                  <DesignFields link={dis.link} links={dis.links} foto={dis.foto} onChange={(p) => setDis((x) => ({ ...x, ...('diseno_links' in p ? { links: p.diseno_links, link: p.diseno_link } : {}), ...('diseno_foto' in p ? { foto: p.diseno_foto } : {}) }))} />
                  <button onClick={saveDis} disabled={disBusy} className="btn-primary" style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 12, fontSize: 14 }}>{disBusy ? 'Guardando...' : 'Guardar diseño'}</button>
                  {!hayAlgo && <div style={{ color: '#94A3B8', fontSize: '13.5px', padding: '6px 0 10px' }}>Este pedido no tiene notas ni detalles para el taller.</div>}
                </>
              )}
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button onClick={() => setNotesFor(null)} className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {payFor && <PaymentsModal sale={payFor} isAdmin={user?.rol === 'admin'} sym={store.moneda_simbolo || 'S/'} store={store} onClose={() => { setPayFor(null); loadOrders(); }} onChanged={loadOrders} />}
      {shipFor && <ShippingModal order={shipFor} store={store} onClose={() => setShipFor(null)} onSaved={loadOrders} />}

      {printData && <PrintModal title={printData.title} subtitle={printData.subtitle} formats={printData.formats} showWhatsApp={printData.showWhatsApp !== false} docs={printData.docs} phone={printData.phone} onClose={() => setPrintData(null)} />}
      {waFor && <WhatsAppModal order={waFor} store={store} etapaTitulo={columns.find((c) => c.id === waFor.estado_pedido)?.title || ''} onClose={() => setWaFor(null)} />}
    </div>
  );
}

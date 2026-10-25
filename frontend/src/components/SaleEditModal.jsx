import { precioPorCantidad } from '../utils/precios';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Package, Check } from 'lucide-react';
import { salesAPI, productsAPI, customersAPI } from '../api';
import DeliveryFields, { entregaPayload, useCharges, sumCargos, parseCargosJson } from './DeliveryFields';
import { money, r2 } from '../utils/quotePrint';
import { pdNumber } from '../utils/docPrint';

const inp = { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const lab = { fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' };

// Edición de una venta/pedido (solo administrador, mientras no tenga comprobante emitido)
export default function SaleEditModal({ saleId, sym = 'S/', onClose, onSaved }) {
  const charges = useCharges();
  const [sale, setSale] = useState(null);
  const [cfgIgv, setCfgIgv] = useState(18);
  const [products, setProducts] = useState([]);
  const [prodQuery, setProdQuery] = useState('');
  const [cliQuery, setCliQuery] = useState('');
  const [cliResults, setCliResults] = useState([]);
  const [cli, setCli] = useState({ cliente_id: null, cliente_telefono: '', cliente_documento: '' });
  const [delivery, setDelivery] = useState(null);
  const [lines, setLines] = useState([]);
  const [aplicarIgv, setAplicarIgv] = useState(false);
  const [notas, setNotas] = useState('');
  const [dtoGlobal, setDtoGlobal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, c, p] = await Promise.all([salesAPI.getById(saleId), salesAPI.docConfig(), productsAPI.getAll()]);
        if (c.success) setCfgIgv(Number(c.config.igv_porcentaje) || 18);
        if (p.success) setProducts(p.products || []);
        if (r.success) {
          const s = r.sale;
          setSale(s);
          setCliQuery(s.cliente_nombre !== 'Cliente Varios' ? s.cliente_nombre : '');
          setCli({ cliente_id: s.cliente_id || null, cliente_telefono: s.cliente_telefono || s.telefono_destinatario || '', cliente_documento: s.cliente_documento || '' });
          let cargos = s.cargos_json ? parseCargosJson(s.cargos_json) : [];
          if (!cargos.length && Number(s.costo_envio) > 0) cargos = [{ nombre: 'Envío', monto: Number(s.costo_envio) }];
          setDelivery({
            tipo_entrega: s.tipo_entrega || 'tienda',
            ciudad_envio: s.ciudad_envio || '',
            fecha_entrega: s.fecha_entrega ? String(s.fecha_entrega).slice(0, 10) : new Date().toLocaleDateString('en-CA'),
            fecha_entrega_diseno: s.fecha_entrega_diseno ? String(s.fecha_entrega_diseno).slice(0, 10) : '',
            franja_horaria: s.franja_horaria && s.franja_horaria !== 'Por confirmar' ? s.franja_horaria : '09:00 AM - 11:00 AM',
            fecha_por_confirmar: s.tipo_entrega === 'por_confirmar' || !s.fecha_entrega,
            hora_por_confirmar: !s.franja_horaria || /^por (confirmar|definir)$/i.test(s.franja_horaria),
            direccion_entrega: s.tipo_entrega === 'delivery' && s.direccion_entrega !== 'Delivery' ? (s.direccion_entrega || '') : '',
            cargos
          });
          // El precio es "manual" solo si difiere del que corresponde a la cantidad según la lista de precios del producto
          const catalogo = p.success ? (p.products || []) : [];
          setLines(s.items.map((i) => {
            const pr = catalogo.find((x) => x.id === i.producto_id);
            const tiene = pr && pr.precio_por_cantidad && pr.escalas?.length;
            const manual = !tiene || Math.abs(Number(i.precio_unitario) - precioPorCantidad(pr, i.cantidad)) > 0.009;
            return {
              producto_id: i.producto_id, descripcion: i.descripcion, codigo: i.codigo,
              cantidad: i.cantidad, precio_unitario: String(i.precio_unitario), detalles_personalizacion: i.detalles_personalizacion || '', proveedor_id: i.proveedor_id || '', lote_id: i.lote_id || '', descuento: Number(i.descuento) > 0 ? String(i.descuento) : '', precio_manual: manual
            };
          }));
          setAplicarIgv(!!Number(s.aplica_igv));
          setNotas(s.notas_taller || '');
          setDtoGlobal(Number(s.descuento_global) > 0 ? String(s.descuento_global) : '');
        }
      } catch (e) { alert(e.message); onClose(); }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (cliQuery.trim().length < 2 || cli.cliente_id) { setCliResults([]); return; }
      try {
        const r = await customersAPI.getAll(`?estado=activo&search=${encodeURIComponent(cliQuery.trim())}`);
        if (r.success) setCliResults(r.customers.slice(0, 6));
      } catch (e) { /* ignorar */ }
    }, 250);
    return () => clearTimeout(t);
  }, [cliQuery]);

  const matches = useMemo(() => {
    const t = prodQuery.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p) => p.activo !== 0 && (String(p.nombre).toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t))).slice(0, 8);
  }, [prodQuery, products]);

  if (!sale || !delivery) return null;

  const prodOf = (l) => products.find((x) => x.id === l.producto_id);
  const setLine = (i, patch) => setLines((prev) => prev.map((l, k) => {
    if (k !== i) return l;
    const next = { ...l, ...patch };
    if (patch.precio_unitario !== undefined) next.precio_manual = true;
    const p = prodOf(next);
    // Precio por cantidad automático (presentaciones), salvo que el precio se haya escrito a mano
    if (patch.cantidad !== undefined && patch.precio_unitario === undefined && !next.precio_manual && p) next.precio_unitario = String(precioPorCantidad(p, next.cantidad));
    return next;
  }));
  const addProduct = (p) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.producto_id === p.id);
      if (i >= 0) return prev.map((l, k) => (k === i ? { ...l, cantidad: Number(l.cantidad) + 1, ...(l.precio_manual ? {} : { precio_unitario: String(precioPorCantidad(p, Number(l.cantidad) + 1)) }) } : l));
      return [...prev, { producto_id: p.id, descripcion: p.nombre, codigo: p.codigo, cantidad: 1, precio_unitario: String(precioPorCantidad(p, 1)), detalles_personalizacion: '', proveedor_id: '', precio_manual: false }];
    });
    setProdQuery('');
  };

  const brutoL = (l) => r2((Number(l.precio_unitario) || 0) * (Number(l.cantidad) || 0));
  const dtoL = (l) => Math.min(brutoL(l), Math.max(0, r2(Number(l.descuento) || 0)));
  const bruto = r2(lines.reduce((s, l) => s + brutoL(l), 0));
  const descLineas = r2(lines.reduce((s, l) => s + dtoL(l), 0));
  const descGlobal = Math.min(r2(bruto - descLineas), Math.max(0, r2(Number(dtoGlobal) || 0)));
  const subtotal = r2(bruto - descLineas - descGlobal);
  const envio = sumCargos(delivery.cargos);
  const igv = aplicarIgv ? r2(subtotal * cfgIgv / 100) : 0; // embalaje/traslado no llevan IGV
  const total = r2(subtotal + envio + igv);
  const pagado = Number(sale.pagado || 0);

  const save = async () => {
    if (!lines.length) { alert('Agrega al menos un producto.'); return; }
    try {
      setSaving(true);
      await salesAPI.update(sale.id, {
        cliente_id: cli.cliente_id,
        cliente_nombre: cliQuery.trim() || 'Cliente Varios',
        cliente_telefono: cli.cliente_telefono,
        cliente_documento: cli.cliente_documento,
        tipo_entrega: delivery.tipo_entrega,
        ciudad_envio: delivery.ciudad_envio,
        fecha_entrega: delivery.fecha_entrega,
        fecha_entrega_diseno: delivery.fecha_entrega_diseno || null,
        franja_horaria: delivery.franja_horaria,
        ...entregaPayload(delivery),
        cargos: delivery.cargos,
        aplicar_igv: aplicarIgv,
        descuento_global: descGlobal,
        notas_taller: notas,
        items: lines.map((l) => ({ producto_id: l.producto_id, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario), descuento: dtoL(l), detalles_personalizacion: l.detalles_personalizacion, proveedor_id: l.lote_id ? null : (l.proveedor_id ? Number(l.proveedor_id) : null), lote_id: l.lote_id ? Number(l.lote_id) : null }))
      });
      onSaved();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 900, padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1C2A38' }}>Editar venta {pdNumber(sale.id)}</div>
            <div style={{ fontSize: '12.5px', color: '#788A9B' }}>Solo el administrador puede editar, y solo mientras no exista un comprobante emitido. Los pagos se gestionan aparte.</div>
          </div>
          <button aria-label="Cerrar" onClick={onClose} style={{ padding: '6px', borderRadius: '10px', background: '#F1F5F9' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
          <div style={{ gridColumn: 'span 2', position: 'relative' }}>
            <label style={lab}>Cliente</label>
            <input style={inp} value={cliQuery} placeholder="Buscar cliente o escribir un nombre..." onChange={(e) => { setCliQuery(e.target.value); setCli({ ...cli, cliente_id: null }); }} />
            {cliResults.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                {cliResults.map((c) => (
                  <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => { setCliQuery(c.nombre); setCli({ cliente_id: c.id, cliente_telefono: c.telefono || '', cliente_documento: cli.cliente_documento }); setCliResults([]); }}>
                    <strong>{c.nombre}</strong> <span style={{ color: '#788A9B' }}>· {c.telefono}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div><label style={lab}>Teléfono</label><input style={inp} value={cli.cliente_telefono} onChange={(e) => setCli({ ...cli, cliente_telefono: e.target.value })} /></div>
          <div><label style={lab}>DNI / RUC (opcional)</label><input style={inp} value={cli.cliente_documento} onChange={(e) => setCli({ ...cli, cliente_documento: e.target.value })} /></div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <DeliveryFields value={delivery} onChange={setDelivery} charges={charges} chargesMode="always" sym={sym} />
        </div>

        <div style={{ position: 'relative', marginTop: '14px' }}>
          <input style={inp} value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} placeholder="Buscar producto por nombre o código para agregar..." />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: '240px', overflowY: 'auto' }}>
              {matches.map((p) => (
                <div key={p.id} onClick={() => addProduct(p)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span><strong>{p.nombre}</strong> <span style={{ color: '#788A9B' }}>{p.codigo}</span></span>
                  <span>{money(p.precio_venta, sym)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto', marginTop: '10px' }}>
          <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Producto</th><th style={{ padding: '6px', width: '80px' }}>Cant.</th>
                <th style={{ padding: '6px', width: '120px' }}>P. unit. (sin IGV)</th><th style={{ padding: '6px', width: '90px' }}>Dto. S/.</th><th style={{ padding: '6px', width: '90px', textAlign: 'right' }}>Subtotal</th><th style={{ width: '34px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.producto_id} style={{ borderTop: '1px solid #EEF3F0' }}>
                  <td style={{ padding: '6px', fontSize: '13px' }}>{l.descripcion}
                    {(prodOf(l)?.lotes || []).length > 1 && (
                      <select value={l.lote_id || ''} onChange={(e) => setLine(i, { lote_id: e.target.value })} style={{ display: 'block', marginTop: 4, fontSize: 11.5, border: '1.5px solid #D6E0DB', borderRadius: 8, padding: '3px 4px', background: '#fff', maxWidth: 280 }}>
                        <option value="">Lote: automático (más antiguo)</option>
                        {prodOf(l).lotes.map((lt) => <option key={lt.id} value={lt.id}>{`${lt.codigo || 'Lote'} · ${lt.proveedor} · ${lt.stock} u. · S/ ${Number(lt.costo_unit).toFixed(2)}`}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '6px' }}><input type="number" min="1" style={inp} value={l.cantidad} onChange={(e) => setLine(i, { cantidad: e.target.value })} /></td>
                  <td style={{ padding: '6px' }}><input type="number" min="0" step="0.01" style={inp} value={l.precio_unitario} onChange={(e) => setLine(i, { precio_unitario: e.target.value })} />
                    {l.precio_manual && prodOf(l)?.precio_por_cantidad && prodOf(l)?.escalas?.length > 0 && (
                      <button type="button" onClick={() => setLines((prev) => prev.map((x, k) => (k === i ? { ...x, precio_manual: false, precio_unitario: String(precioPorCantidad(prodOf(x), x.cantidad)) } : x)))}
                        style={{ fontSize: '10.5px', color: '#B45309', background: 'none', border: 0, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}>Precio editado · restaurar automático</button>
                    )}
                  </td>
                  <td style={{ padding: '6px' }}><input type="number" min="0" step="0.01" style={inp} placeholder="0" value={l.descuento || ''} onChange={(e) => setLine(i, { descuento: e.target.value })} /></td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{r2(brutoL(l) - dtoL(l)).toFixed(2)}</td>
                  <td style={{ padding: '6px' }}><button onClick={() => setLines(lines.filter((_, k) => k !== i))} style={{ padding: '6px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} style={{ padding: '22px', textAlign: 'center', color: '#94A3B8' }}><Package size={26} style={{ opacity: 0.5 }} /><div style={{ fontSize: '13px' }}>Busca y agrega productos</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '12px', alignItems: 'start' }}>
          <div>
            <label style={lab}>Notas para el taller</label>
            <textarea style={{ ...inp, minHeight: '64px', resize: 'vertical' }} value={notas} onChange={(e) => setNotas(e.target.value)} />
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: 700, marginTop: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={aplicarIgv} onChange={(e) => setAplicarIgv(e.target.checked)} /> Agregar IGV ({cfgIgv}%) al total
            </label>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(bruto, sym)}</span></div>
            {descLineas > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B91C1C' }}><span>Descuentos por producto</span><span>− {money(descLineas, sym)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>Descuento al total (S/.)</span>
              <input type="number" min="0" step="0.01" style={{ ...inp, width: 90, padding: '4px 8px' }} placeholder="0" value={dtoGlobal} onChange={(e) => setDtoGlobal(e.target.value)} />
            </div>
            {aplicarIgv && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IGV ({cfgIgv}%)</span><span>{money(igv, sym)}</span></div>}
            {delivery.cargos.map((c) => <div key={c.nombre} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{c.nombre}</span><span>{money(c.monto, sym)}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '19px', fontWeight: 800, borderTop: '2px solid #1C2A38', marginTop: '6px', paddingTop: '6px' }}><span>Total</span><span>{money(total, sym)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginTop: '4px' }}><span>Pagado</span><span>{money(pagado, sym)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: total - pagado > 0.009 ? '#B45309' : '#047857' }}><span>Saldo</span><span>{money(Math.max(0, total - pagado), sym)}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '10px', background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', borderRadius: '12px', fontSize: '14px' }}>
            <Check size={17} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

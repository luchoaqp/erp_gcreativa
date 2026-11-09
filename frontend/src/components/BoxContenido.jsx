import React, { useState } from 'react';
import { X } from 'lucide-react';
import { productsAPI } from '../api';

// Contenido de un box (lo que lleva dentro) editable en una venta o cotización: quitar, cambiar cantidades,
// agregar productos y restaurar el original. Un "box" es un pack (Boxes y Packs) o un producto armado con
// insumos (pestaña Producción). contenido: [{ producto_id, nombre, cantidad, precio }] por cada box.

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const esBox = (p) => !!p && (!!Number(p.es_pack) || !!Number(p.requiere_insumos));
export const precioInsumo = (p) => (p && p.precio_insumo !== null && p.precio_insumo !== undefined && p.precio_insumo !== '' ? Number(p.precio_insumo) : Number(p?.precio_venta) || 0);
export const valorContenido = (arr) => r2((arr || []).reduce((a, c) => a + (Number(c.cantidad) || 0) * (Number(c.precio) || 0), 0));

/** Lo que lleva el box según su ficha (null si no lleva nada) */
export async function contenidoDeFicha(productoId) {
  const r = await productsAPI.getById(productoId);
  const cont = (r.product?.componentes || []).map((c) => ({ producto_id: c.componente_id, nombre: c.nombre, cantidad: Number(c.cantidad), precio: Number(c.precio_unit) }));
  return cont.length ? cont : null;
}

/** Para enviar al servidor: solo si se cambió (si no, queda el contenido de la ficha) */
export const contenidoPayload = (cont, editado) => (editado && Array.isArray(cont)
  ? cont.map((c) => ({ producto_id: c.producto_id, nombre: c.nombre, cantidad: Number(c.cantidad) || 0, precio: Number(c.precio) || 0 }))
  : undefined);

export default function BoxContenido({ contenido, editado, products = [], onChange, onRestaurar, compact = false, nota }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const usados = new Set(contenido.map((c) => c.producto_id));
  const resultados = t ? products.filter((p) => !Number(p.es_pack) && p.activo !== 0 && !usados.has(p.id) && (String(p.nombre).toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t))).slice(0, 6) : [];
  const fs = compact ? '11.5px' : '12.5px';
  const mini = { padding: '3px 6px', fontSize: fs, border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: '#1C2A38' };
  return (
    <div style={{ marginTop: '6px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: compact ? '6px 8px' : '8px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '.03em' }}>
          Contenido del box {editado && <span style={{ color: '#B45309', textTransform: 'none', letterSpacing: 0 }}>· personalizado</span>}
        </span>
        {editado && onRestaurar && <button type="button" onClick={onRestaurar} style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 0, cursor: 'pointer', fontWeight: 700, padding: 0 }}>Restaurar original</button>}
      </div>
      {contenido.length === 0 && <div style={{ fontSize: '12px', color: '#94A3B8', padding: '4px 0' }}>El box quedó vacío. Agrega productos abajo.</div>}
      {contenido.map((c, k) => (
        <div key={c.producto_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: fs, color: '#334155', padding: '2px 0' }}>
          <input type="number" min="0.01" step="any" value={c.cantidad} aria-label={`Cantidad de ${c.nombre}`} style={{ ...mini, width: '50px' }}
            onChange={(e) => onChange(contenido.map((x, j) => (j === k ? { ...x, cantidad: e.target.value } : x)))} />
          <span style={{ flex: 1, minWidth: 0 }}>{c.nombre}</span>
          <span style={{ color: '#64748B', whiteSpace: 'nowrap' }}>S/ {r2((Number(c.cantidad) || 0) * (Number(c.precio) || 0)).toFixed(2)}</span>
          <button type="button" title="Quitar del box" aria-label={`Quitar ${c.nombre}`} onClick={() => onChange(contenido.filter((_, j) => j !== k))}
            style={{ background: 'none', border: 0, cursor: 'pointer', color: '#B91C1C', padding: '2px', display: 'flex' }}><X size={14} /></button>
        </div>
      ))}
      <div style={{ position: 'relative', marginTop: '4px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="+ Agregar producto al box…" style={{ ...mini, width: '100%', padding: '5px 8px' }} />
        {resultados.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', marginTop: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            {resultados.map((p) => (
              <div key={p.id} onClick={() => { onChange([...contenido, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio: precioInsumo(p) }]); setQ(''); }}
                style={{ padding: '6px 10px', cursor: 'pointer', fontSize: fs, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span>{p.nombre}</span><span style={{ color: '#64748B' }}>S/ {precioInsumo(p).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
        Valor del contenido: S/ {valorContenido(contenido).toFixed(2)} · {nota || 'al quitar o agregar, el precio del box se ajusta con la diferencia (puedes cambiarlo a mano). En el documento se lista sin precios.'}
      </div>
    </div>
  );
}

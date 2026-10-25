import React, { useState, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { precioPorCantidad } from '../utils/precios';

const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Lista editable de componentes (insumos de un producto o contenido de un pack/box).
// items: [{ componente_id, nombre, cantidad, precio_unit, costo_actual, precio_insumo_actual, cambio, stock }]
// catalog: productos disponibles (se excluyen packs y el propio producto)
// autoPrice: el precio de cada fila se ajusta solo según la cantidad (misma lista de precios por cantidad que usa el POS)
// y se puede fijar a mano; "Restaurar automático" vuelve al precio de la lista.
export default function ComponentEditor({ items, onChange, catalog = [], excludeId = null, unitLabel = 'Precio como insumo', autoPrice = false }) {
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);

  const usados = new Set(items.map((i) => i.componente_id));
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return catalog
      .filter((p) => !p.es_pack && p.id !== excludeId && !usados.has(p.id) && (!t || String(p.nombre).toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t)))
      .slice(0, 30);
  }, [q, catalog, excludeId, items]);

  const insumoDe = (p) => (p.precio_insumo !== null && p.precio_insumo !== undefined ? Number(p.precio_insumo) : Number(p.precio_venta));
  const prodOf = (id) => catalog.find((x) => x.id === id);
  // Precio de lista para una cantidad: escalas del producto si las usa; si no, su precio como insumo
  const listPrice = (p, cantidad) => (p && p.precio_por_cantidad && Array.isArray(p.escalas) && p.escalas.length ? precioPorCantidad(p, cantidad) : (p ? insumoDe(p) : 0));
  const tieneEscalas = (p) => !!(p && p.precio_por_cantidad && Array.isArray(p.escalas) && p.escalas.length);
  const isManual = (i) => { const p = prodOf(i.componente_id); if (!p) return false; return typeof i.manual === 'boolean' ? i.manual : Math.abs(Number(i.precio_unit) - listPrice(p, i.cantidad)) > 0.009; };
  const add = (p) => {
    const cant = Number(qty) > 0 ? Number(qty) : 1;
    onChange([...items, {
      componente_id: p.id, nombre: p.nombre, codigo: p.codigo, stock: p.stock, cantidad: cant, manual: false,
      precio_unit: autoPrice ? listPrice(p, cant) : insumoDe(p), costo_actual: Number(p.precio_costo) || 0, precio_insumo_actual: insumoDe(p), cambio: false
    }]);
    setQ(''); setQty(1); setOpen(false);
  };
  const set = (id, patch) => onChange(items.map((i) => (i.componente_id === id ? { ...i, ...patch } : i)));
  const setQtyOf = (i, v) => {
    const patch = { cantidad: v };
    if (autoPrice && !isManual(i)) { const p = prodOf(i.componente_id); if (p) { patch.precio_unit = listPrice(p, Number(v) || 0); patch.manual = false; } }
    set(i.componente_id, patch);
  };
  const restoreAuto = (i) => { const p = prodOf(i.componente_id); set(i.componente_id, { precio_unit: listPrice(p, Number(i.cantidad) || 0), manual: false }); };
  const useCurrent = (i) => set(i.componente_id, { precio_unit: i.precio_insumo_actual, cambio: false });

  return (
    <div>
      <div className="pm-row wrap" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <label className="pc-lab">Producto</label>
          <input className="pm-in" placeholder="Busca un producto…" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
          {open && results.length > 0 && (
            <div className="pc-suggest" onMouseLeave={() => setOpen(false)}>
              {results.map((p) => (
                <button type="button" key={p.id} onClick={() => add(p)}>
                  {p.nombre}<small>{p.codigo} · stock {p.stock} · compra S/ {money(p.precio_costo)} · insumo S/ {money(insumoDe(p))}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 100 }}>
          <label className="pc-lab">Cantidad</label>
          <input type="number" min="0.01" step="any" className="pm-in" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <button type="button" className="pm-btn-outline" onClick={() => results[0] && add(results[0])} disabled={!results.length} title="Agrega el primer resultado de la búsqueda"><Plus size={16} /> Agregar</button>
      </div>

      {items.length === 0 ? (
        <div style={{ border: '1.5px dashed #D0D6E6', borderRadius: 12, padding: '22px 12px', textAlign: 'center', color: '#788A9B', fontSize: 13 }}>
          Todavía no hay nada en la lista. Busca un producto arriba y elígelo.
        </div>
      ) : (
        <div className="pm-table-wrap" style={{ padding: 0 }}>
          <table className="pm-table pc-table" style={{ minWidth: 640 }}>
            <thead>
              <tr><th>Producto</th><th style={{ width: 90 }}>Cant.</th><th style={{ width: 110 }}>Costo de compra</th><th style={{ width: 130 }}>{unitLabel}</th><th style={{ width: 100, textAlign: 'right' }}>Subtotal</th><th style={{ width: 40 }} /></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <React.Fragment key={i.componente_id}>
                  <tr>
                    <td>{i.nombre}<span className="pm-extra">{i.codigo} · stock {i.stock}</span></td>
                    <td><input type="number" min="0.01" step="any" value={i.cantidad} onChange={(e) => setQtyOf(i, e.target.value)} /></td>
                    <td>S/ {money(i.costo_actual)}</td>
                    <td>
                      <input type="number" min="0" step="0.01" value={i.precio_unit} onChange={(e) => set(i.componente_id, { precio_unit: e.target.value, manual: true })} />
                      {autoPrice && prodOf(i.componente_id) && (
                        isManual(i)
                          ? <button type="button" onClick={() => restoreAuto(i)} style={{ display: 'block', fontSize: 11, color: '#B45309', background: 'none', border: 0, cursor: 'pointer', padding: 0, marginTop: 2 }}>Manual · restaurar automático</button>
                          : <span style={{ display: 'block', fontSize: 11, color: '#788A9B', marginTop: 2 }}>{tieneEscalas(prodOf(i.componente_id)) ? 'Automático por cantidad' : 'Precio de lista'}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>S/ {money((Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0))}</td>
                    <td><button type="button" className="pm-icon-btn" title="Quitar" onClick={() => onChange(items.filter((x) => x.componente_id !== i.componente_id))}><Trash2 size={16} color="#E0245E" /></button></td>
                  </tr>
                  {i.cambio && (
                    <tr>
                      <td colSpan={6} style={{ paddingTop: 0 }}>
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, color: '#92400E', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <AlertTriangle size={14} /> El precio de este producto cambió (ahora insumo S/ {money(i.precio_insumo_actual)}, compra S/ {money(i.costo_actual)}). Revisa si ajustas el precio del pack.
                          <button type="button" className="pm-btn-outline" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => useCurrent(i)}><RefreshCw size={12} /> Usar precio actual</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Totales de una lista de componentes
export function totalsOf(items) {
  const costo = items.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.costo_actual) || 0), 0);
  const valor = items.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0), 0);
  return { costo: Math.round(costo * 100) / 100, valor: Math.round(valor * 100) / 100 };
}

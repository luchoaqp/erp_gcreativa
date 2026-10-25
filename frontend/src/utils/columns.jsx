import React, { useState } from 'react';

/** Columnas configurables: visibles + orden. Se guarda en este navegador. */
export function useCols(key, defs) {
  const [st, setSt] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (s && Array.isArray(s.vis)) return { vis: s.vis, order: Array.isArray(s.order) ? s.order : [] };
    } catch (e) { /* sin guardado */ }
    return { vis: defs.filter((c) => c.def !== false).map((c) => c.id), order: [] };
  });
  const save = (next) => { setSt(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) { /* sin guardado */ } };
  const ids = [...st.order.filter((id) => defs.some((d) => d.id === id)), ...defs.map((d) => d.id).filter((id) => !st.order.includes(id))];
  const ordered = ids.map((id) => defs.find((d) => d.id === id));
  const toggle = (id) => save({ ...st, vis: st.vis.includes(id) ? st.vis.filter((x) => x !== id) : [...st.vis, id] });
  const moveTo = (from, to) => {
    if (!from || from === to || !ids.includes(from)) return;
    const arr = ids.filter((x) => x !== from);
    arr.splice(Math.max(0, arr.indexOf(to) + (ids.indexOf(from) < ids.indexOf(to) ? 1 : 0)), 0, from);
    save({ ...st, order: arr });
  };
  const nudge = (id, d) => {
    const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const arr = [...ids]; [arr[i], arr[j]] = [arr[j], arr[i]];
    save({ ...st, order: arr });
  };
  const reset = () => save({ vis: defs.filter((c) => c.def !== false).map((c) => c.id), order: [] });
  return { cols: ordered.filter((c) => c.always || st.vis.includes(c.id)), vis: st.vis, ordered, toggle, moveTo, nudge, reset };
}

/** Lista para el menú de columnas: marcar/ocultar y subir/bajar */
export function ColList({ api }) {
  const arrow = { border: 0, background: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 12, color: '#64748B' };
  return (
    <div style={{ minWidth: 230 }}>
      <div style={{ fontSize: 11.5, color: '#788A9B', padding: '2px 4px 6px', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
        Marca las visibles y reordénalas con ▲▼ (o arrastra el encabezado de la tabla).
      </div>
      {api.ordered.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0 }}>
          <label style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', padding: '4px 6px', fontSize: 13, fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!c.always || api.vis.includes(c.id)} disabled={!!c.always} onChange={() => api.toggle(c.id)} /> {c.label}
          </label>
          <button type="button" style={arrow} disabled={i === 0} onClick={() => api.nudge(c.id, -1)} aria-label="Subir">▲</button>
          <button type="button" style={arrow} disabled={i === api.ordered.length - 1} onClick={() => api.nudge(c.id, 1)} aria-label="Bajar">▼</button>
        </div>
      ))}
      <button type="button" onClick={api.reset} style={{ ...arrow, color: '#4F8EF7', fontWeight: 700, marginTop: 6, fontSize: 12 }}>Restablecer columnas</button>
    </div>
  );
}

/** Props para encabezados arrastrables */
export const dragProps = (api, id) => ({
  draggable: true, title: 'Arrastra para mover la columna',
  onDragStart: (e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; },
  onDragOver: (e) => e.preventDefault(),
  onDrop: (e) => { e.preventDefault(); api.moveTo(e.dataTransfer.getData('text/plain'), id); }
});

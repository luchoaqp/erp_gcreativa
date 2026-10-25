import React, { useState, useEffect, useMemo } from 'react';
import { Cog, Plus, Printer, Scissors, Coffee, Flame, Layers, Monitor, Wrench, Pencil, Trash2, X, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { workshopAPI } from '../api';
import { Modal, money, today, fmtDMY } from '../components/CompraUI';
import '../components/compras.css';

const CATS = {
  impresora: { label: 'Impresoras', one: 'Impresora', icon: Printer, color: '#2563EB', fields: ['Tipo de tinta', 'Colores / botellas', 'Tamaño máximo de papel', 'Código de tinta', 'Contador de impresiones'] },
  plotter_corte: { label: 'Plotter de corte', one: 'Plotter de corte', icon: Scissors, color: '#DB2777', fields: ['Ancho de corte', 'Tipo de cuchilla', 'Fuerza / velocidad habitual', 'Software'] },
  sublimadora_tazas: { label: 'Sublimación de tazas', one: 'Máquina de sublimación', icon: Coffee, color: '#EA580C', fields: ['Temperatura (°C)', 'Tiempo (seg)', 'Presión', 'Tamaño de taza (oz)', 'Voltaje'] },
  plancha_calor: { label: 'Planchas de calor', one: 'Plancha de calor', icon: Flame, color: '#DC2626', fields: ['Dimensiones del plato', 'Temperatura habitual', 'Tiempo habitual', 'Voltaje'] },
  enmicadora: { label: 'Enmicadoras', one: 'Enmicadora', icon: Layers, color: '#0D9488', fields: ['Ancho máximo', 'Grosor de mica', 'Temperatura', 'Velocidad'] },
  computadora: { label: 'Computadoras', one: 'Computadora', icon: Monitor, color: '#7C3AED', fields: ['Procesador', 'Memoria RAM', 'Almacenamiento', 'Sistema operativo', 'Software de diseño'] },
  otro: { label: 'Otros equipos', one: 'Equipo', icon: Wrench, color: '#64748B', fields: [] }
};
const ESTADOS = { operativa: ['Operativa', 'green'], mantenimiento: ['En mantenimiento', 'amber'], fuera_servicio: ['Fuera de servicio', 'red'] };
const TIPOS_REG = { mantenimiento: 'Mantenimiento', reparacion: 'Reparación', repuesto: 'Compra de repuesto', insumo: 'Compra de insumo' };

const addDays = (iso, n) => { const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const diasPara = (m) => {
  if (!m.mantenimiento_cada_dias) return null;
  const base = m.fecha_ultimo_mantenimiento || m.fecha_compra;
  if (!base) return null;
  const due = new Date(`${addDays(base, Number(m.mantenimiento_cada_dias))}T00:00:00`);
  const hoy = new Date(`${today()}T00:00:00`);
  return Math.round((due - hoy) / 86400000);
};
const mantChip = (m) => {
  const d = diasPara(m);
  if (d === null) return null;
  if (d < 0) return <span className="cx-chip red">Mantenimiento vencido ({-d} d)</span>;
  if (d <= 7) return <span className="cx-chip amber">Mantenimiento en {d} d</span>;
  return <span className="cx-chip green">Próx. mantenimiento en {d} d</span>;
};

function MachineForm({ initial, onClose, onSaved }) {
  const I = initial || {};
  const [f, setF] = useState({
    nombre: I.nombre || '', categoria: I.categoria || 'impresora', marca: I.marca || '', modelo: I.modelo || '', serie: I.serie || '',
    fecha_compra: I.fecha_compra ? String(I.fecha_compra).slice(0, 10) : '', precio_compra: I.precio_compra || '', proveedor: I.proveedor || '',
    fecha_ultimo_mantenimiento: I.fecha_ultimo_mantenimiento ? String(I.fecha_ultimo_mantenimiento).slice(0, 10) : '', mantenimiento_cada_dias: I.mantenimiento_cada_dias || '',
    estado: I.estado || 'operativa', notas: I.notas || ''
  });
  const [car, setCar] = useState(I.caracteristicas || {});
  const [extraKey, setExtraKey] = useState('');
  const [insumos, setInsumos] = useState(I.insumos?.length ? I.insumos : []);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const preset = CATS[f.categoria].fields;
  const custom = Object.keys(car).filter((k) => !preset.includes(k));

  const save = async () => {
    setErr('');
    if (!f.nombre.trim()) return setErr('Escribe el nombre de la máquina.');
    setBusy(true);
    try {
      const data = { ...f, caracteristicas: car, insumos: insumos.filter((x) => x.nombre.trim()) };
      if (I.id) await workshopAPI.update(I.id, data); else await workshopAPI.create(data);
      onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={I.id ? 'Editar máquina' : 'Nueva máquina'} onClose={onClose} width={760}>
      {err && <div className="cx-err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="cx-grid2">
        <div className="cx-f"><label className="cx-lab">Tipo de máquina</label>
          <select className="cx-in" value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.one}</option>)}</select></div>
        <div className="cx-f"><label className="cx-lab">Nombre <i>*</i></label><input className="cx-in" maxLength={120} placeholder="Ej: Epson L4160 (sublimación)" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} /></div>
      </div>
      <div className="cx-grid2" style={{ marginTop: 14 }}>
        <div className="cx-f"><label className="cx-lab">Marca</label><input className="cx-in" value={f.marca} onChange={(e) => set('marca', e.target.value)} /></div>
        <div className="cx-f"><label className="cx-lab">Modelo</label><input className="cx-in" value={f.modelo} onChange={(e) => set('modelo', e.target.value)} /></div>
      </div>
      <div className="cx-grid2" style={{ marginTop: 14 }}>
        <div className="cx-f"><label className="cx-lab">N° de serie</label><input className="cx-in" value={f.serie} onChange={(e) => set('serie', e.target.value)} /></div>
        <div className="cx-f"><label className="cx-lab">Estado</label>
          <select className="cx-in" value={f.estado} onChange={(e) => set('estado', e.target.value)}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
      </div>
      <div className="cx-grid2" style={{ marginTop: 14 }}>
        <div className="cx-f"><label className="cx-lab">Fecha de compra</label><input type="date" className="cx-in" value={f.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} /></div>
        <div className="cx-f"><label className="cx-lab">Precio de compra (S/)</label><input type="number" min="0" step="0.01" className="cx-in" value={f.precio_compra} onChange={(e) => set('precio_compra', e.target.value)} /></div>
      </div>
      <div className="cx-f" style={{ marginTop: 14 }}><label className="cx-lab">Comprada en (proveedor / tienda)</label><input className="cx-in" value={f.proveedor} onChange={(e) => set('proveedor', e.target.value)} /></div>
      <div className="cx-grid2" style={{ marginTop: 14 }}>
        <div className="cx-f"><label className="cx-lab">Último mantenimiento</label><input type="date" className="cx-in" value={f.fecha_ultimo_mantenimiento} onChange={(e) => set('fecha_ultimo_mantenimiento', e.target.value)} /></div>
        <div className="cx-f"><label className="cx-lab">Mantener cada (días)</label><input type="number" min="1" className="cx-in" placeholder="Ej: 90" value={f.mantenimiento_cada_dias} onChange={(e) => set('mantenimiento_cada_dias', e.target.value)} /></div>
      </div>

      <div className="cx-title" style={{ marginTop: 20 }}>Características de {CATS[f.categoria].one.toLowerCase()}</div>
      <div className="cx-grid2" style={{ rowGap: 12 }}>
        {preset.map((k) => (
          <div key={k} className="cx-f"><label className="cx-lab">{k}</label><input className="cx-in" value={car[k] || ''} onChange={(e) => setCar((c) => ({ ...c, [k]: e.target.value }))} /></div>
        ))}
        {custom.map((k) => (
          <div key={k} className="cx-f"><label className="cx-lab">{k} <button type="button" onClick={() => setCar((c) => { const n = { ...c }; delete n[k]; return n; })} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#E0245E' }}>quitar</button></label>
            <input className="cx-in" value={car[k] || ''} onChange={(e) => setCar((c) => ({ ...c, [k]: e.target.value }))} /></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input className="cx-in" placeholder="Agregar otra característica (ej: Resolución)" value={extraKey} onChange={(e) => setExtraKey(e.target.value)} />
        <button type="button" className="cx-btn-soft" onClick={() => { const k = extraKey.trim(); if (k && !(k in car)) { setCar((c) => ({ ...c, [k]: ' ' })); setExtraKey(''); } }}><Plus size={15} /> Añadir</button>
      </div>

      <div className="cx-title" style={{ marginTop: 20 }}>Insumos necesarios para su funcionamiento</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {insumos.map((x, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr) 32px', gap: 8 }}>
            <input className="cx-in" placeholder="Insumo (ej: Tinta sublimación negra)" value={x.nombre} onChange={(e) => setInsumos((l) => l.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))} />
            <input className="cx-in" placeholder="Detalle (ej: Botella 100 ml, cód. 664)" value={x.detalle} onChange={(e) => setInsumos((l) => l.map((y, k) => (k === i ? { ...y, detalle: e.target.value } : y)))} />
            <button type="button" aria-label="Quitar" onClick={() => setInsumos((l) => l.filter((_, k) => k !== i))} style={{ background: 'none', border: 0, cursor: 'pointer' }}><X size={16} color="#E0245E" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="cx-btn-soft" style={{ marginTop: 8 }} onClick={() => setInsumos((l) => [...l, { nombre: '', detalle: '' }])}><Plus size={15} /> Agregar insumo</button>

      <div className="cx-f" style={{ marginTop: 16 }}><label className="cx-lab">Notas</label><textarea className="cx-in" style={{ height: 'auto', padding: 12 }} rows={2} value={f.notas} onChange={(e) => set('notas', e.target.value)} /></div>
      <div className="cx-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="cx-btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="cx-btn-main" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar máquina'}</button>
      </div>
    </Modal>
  );
}

function MachineDetail({ id, canEdit, isAdmin, onClose, onChanged, onEdit }) {
  const [m, setM] = useState(null);
  const [rec, setRec] = useState({ tipo: 'mantenimiento', fecha: today(), descripcion: '', costo: '', responsable: '' });
  const [err, setErr] = useState('');
  const load = () => workshopAPI.getById(id).then((r) => { if (r.success) setM(r.machine); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);
  const add = async () => {
    setErr('');
    try { await workshopAPI.addRecord(id, rec); setRec({ ...rec, descripcion: '', costo: '' }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const del = async (r) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try { await workshopAPI.removeRecord(id, r.id); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  if (!m) return null;
  const C = CATS[m.categoria] || CATS.otro;
  const car = Object.entries(m.caracteristicas || {});
  const gasto = (m.registros || []).reduce((a, r) => a + (Number(r.costo) || 0), 0);
  const row = (k, v) => (v ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid #F0F1F7', fontSize: 13.5 }}><span style={{ color: '#7B8497' }}>{k}</span><strong style={{ textAlign: 'right' }}>{v}</strong></div> : null);
  return (
    <Modal title={m.nombre} onClose={onClose} width={780}>
      {err && <div className="cx-err" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className={`cx-chip ${ESTADOS[m.estado][1]}`}>{ESTADOS[m.estado][0]}</span>{mantChip(m)}
        {canEdit && <button type="button" className="cx-btn-soft" style={{ padding: '3px 12px', marginLeft: 'auto' }} onClick={() => onEdit(m)}><Pencil size={14} /> Editar</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <div>
          {row('Tipo', C.one)}{row('Marca', m.marca)}{row('Modelo', m.modelo)}{row('N° de serie', m.serie)}
          {row('Fecha de compra', m.fecha_compra && fmtDMY(m.fecha_compra))}{row('Precio de compra', m.precio_compra && `S/ ${money(m.precio_compra)}`)}{row('Comprada en', m.proveedor)}
          {row('Último mantenimiento', m.fecha_ultimo_mantenimiento && fmtDMY(m.fecha_ultimo_mantenimiento))}{row('Frecuencia', m.mantenimiento_cada_dias && `cada ${m.mantenimiento_cada_dias} días`)}
          {row('Gasto acumulado (mant./repuestos)', gasto > 0 && `S/ ${money(gasto)}`)}
        </div>
        <div>
          {car.length > 0 && <><div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>Características</div>{car.map(([k, v]) => row(k, v))}</>}
          {m.insumos?.length > 0 && <><div style={{ fontWeight: 800, fontSize: 13, margin: '12px 0 4px' }}>Insumos necesarios</div>{m.insumos.map((x, i) => row(x.nombre, x.detalle || '—'))}</>}
          {m.notas && <p style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{m.notas}</p>}
        </div>
      </div>

      <div className="cx-title" style={{ marginTop: 20 }}>Historial: mantenimientos, repuestos e insumos</div>
      {canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: '150px 140px minmax(0,1fr) 110px 36px', gap: 8, marginBottom: 10 }} className="cx-reggrid">
          <select className="cx-in" value={rec.tipo} onChange={(e) => setRec({ ...rec, tipo: e.target.value })}>{Object.entries(TIPOS_REG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input type="date" className="cx-in" value={rec.fecha} onChange={(e) => setRec({ ...rec, fecha: e.target.value })} />
          <input className="cx-in" maxLength={300} placeholder="Descripción (ej: Limpieza de cabezal)" value={rec.descripcion} onChange={(e) => setRec({ ...rec, descripcion: e.target.value })} />
          <input type="number" min="0" step="0.01" className="cx-in" placeholder="Costo S/" value={rec.costo} onChange={(e) => setRec({ ...rec, costo: e.target.value })} />
          <button type="button" className="cx-btn-main" style={{ padding: 0, width: 36, justifyContent: 'center' }} title="Agregar registro" onClick={add}><Plus size={16} /></button>
        </div>
      )}
      <div className="cx-table-wrap">
        <table className="cx-table" style={{ minWidth: 0 }}>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th className="r">Costo</th><th style={{ width: 36 }} /></tr></thead>
          <tbody>
            {m.registros.map((r) => (
              <tr key={r.id}><td>{fmtDMY(r.fecha)}</td><td><span className="cx-chip violet">{TIPOS_REG[r.tipo] || r.tipo}</span></td><td>{r.descripcion}</td><td className="r">{r.costo ? `S/ ${money(r.costo)}` : '—'}</td>
                <td>{canEdit && <button type="button" aria-label="Eliminar" onClick={() => del(r)} style={{ background: 'none', border: 0, cursor: 'pointer' }}><Trash2 size={15} color="#E0245E" /></button>}</td></tr>
            ))}
          </tbody>
        </table>
        {m.registros.length === 0 && <div className="cx-empty" style={{ margin: 12 }}>Aún no hay registros.</div>}
      </div>
      {isAdmin && <div style={{ marginTop: 14, textAlign: 'right' }}><button type="button" className="cx-btn-ghost" style={{ color: '#B91C1C' }} onClick={async () => { if (window.confirm(`¿Eliminar la máquina "${m.nombre}"?`)) { try { await workshopAPI.remove(m.id); onChanged(); onClose(); } catch (e) { setErr(e.message); } } }}><Trash2 size={15} /> Eliminar máquina</button></div>}
    </Modal>
  );
}

export default function Workshop({ user }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todas');
  const [form, setForm] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [msg, setMsg] = useState('');
  const canEdit = user?.rol === 'admin' || user?.rol === 'vendedor';
  const load = async () => { try { const r = await workshopAPI.list(); if (r.success) setMachines(r.machines); } catch (e) { setMsg(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return machines.filter((m) => (cat === 'todas' || m.categoria === cat) && (!t || `${m.nombre} ${m.marca || ''} ${m.modelo || ''} ${m.serie || ''}`.toLowerCase().includes(t)));
  }, [machines, q, cat]);
  const groups = useMemo(() => {
    const map = {}; list.forEach((m) => { (map[m.categoria] = map[m.categoria] || []).push(m); });
    return Object.keys(CATS).filter((k) => map[k]).map((k) => [k, map[k]]);
  }, [list]);
  const alertas = machines.filter((m) => m.estado !== 'operativa' || (diasPara(m) !== null && diasPara(m) <= 7)).length;
  const usados = Object.keys(CATS).filter((k) => machines.some((m) => m.categoria === k));

  return (
    <div className="content-body animate-fade-in">
      <div className="cx">
        <div className="cx-card cx-pad cx-row" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cog size={22} color="#EA7A1A" /></div>
            <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Taller</h1>
              <div style={{ fontSize: 12.5, color: '#7B8497' }}>{machines.length} máquinas{alertas > 0 ? ` · ${alertas} requieren atención` : ''}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="cx-search"><Search size={16} color="#7C3AED" /><input placeholder="Buscar máquina, marca o serie…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {canEdit && <button type="button" className="cx-btn-main" onClick={() => setForm({})}><Plus size={17} /> Nueva máquina</button>}
          </div>
        </div>
        {msg && <div className="cx-err">{msg}</div>}

        {usados.length > 1 && (
          <div className="cx-tabs" style={{ flexWrap: 'wrap' }}>
            <button type="button" className={`cx-tab ${cat === 'todas' ? 'on' : ''}`} onClick={() => setCat('todas')}>Todas <em>{machines.length}</em></button>
            {usados.map((k) => <button key={k} type="button" className={`cx-tab ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{CATS[k].label} <em>{machines.filter((m) => m.categoria === k).length}</em></button>)}
          </div>
        )}

        {!loading && machines.length === 0 && (
          <div className="cx-card cx-pad"><div className="cx-empty">Aún no registras máquinas. Agrega tus impresoras, plotter de corte, máquina de sublimación, plancha, enmicadora y computadoras para controlar mantenimientos, repuestos e insumos.</div></div>
        )}

        {groups.map(([k, items]) => {
          const C = CATS[k]; const Icon = C.icon;
          return (
            <div key={k}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, margin: '4px 4px 8px', color: C.color }}><Icon size={17} /> {C.label} · {items.length}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
                {items.map((m) => (
                  <button key={m.id} type="button" className="cx-card cx-pad" onClick={() => setDetailId(m.id)} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `4px solid ${C.color}` }}>
                    <div className="cx-row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 15.5 }}>{m.nombre}</div>
                        <div style={{ fontSize: 12.5, color: '#7B8497' }}>{[m.marca, m.modelo].filter(Boolean).join(' · ') || C.one}{m.serie ? ` · S/N ${m.serie}` : ''}</div></div>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${C.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon size={19} color={C.color} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`cx-chip ${ESTADOS[m.estado][1]}`}>{m.estado === 'operativa' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {ESTADOS[m.estado][0]}</span>
                      {mantChip(m)}
                    </div>
                    <div style={{ fontSize: 12, color: '#7B8497' }}>
                      {m.fecha_compra ? `Compra: ${fmtDMY(m.fecha_compra)}` : 'Sin fecha de compra'} · {m.registros_count} registro{Number(m.registros_count) === 1 ? '' : 's'}
                      {Number(m.gasto_total) > 0 ? ` · S/ ${money(m.gasto_total)} invertidos` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {form && <MachineForm initial={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); setDetailId(null); load(); }} />}
      {detailId && !form && <MachineDetail id={detailId} canEdit={canEdit} isAdmin={user?.rol === 'admin'} onClose={() => setDetailId(null)} onChanged={load} onEdit={(m) => setForm(m)} />}
    </div>
  );
}

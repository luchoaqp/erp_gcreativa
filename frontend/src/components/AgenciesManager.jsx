import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Store, Search, PlusCircle, MoreVertical, Edit2, Power, Trash2, Upload, Download, X, Phone, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { shippingAPI } from '../api';
import FloatingMenu from './FloatingMenu';
import { downloadBlob } from '../utils/exporters';
import './party.css';

export const DEPARTAMENTOS = ['Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'];
const HEAD = ['courier', 'agencia', 'departamento', 'provincia', 'distrito', 'direccion', 'referencia', 'telefono', 'contacto', 'horario'];

// CSV simple con comillas ("a,b" y "" escapadas); detecta coma o punto y coma
function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && clean[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const emptyAgency = (courierId = '') => ({ courier_id: courierId, nombre: '', departamento: '', provincia: '', distrito: '', direccion: '', referencia: '', telefono: '', contacto: '', horario: '', notas: '', estado: 1 });

/* ====================== AGENCIAS ====================== */
export function AgenciesTab({ couriers, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [courier, setCourier] = useState('');
  const [depto, setDepto] = useState('');
  const [estado, setEstado] = useState('activas');
  const [menu, setMenu] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      if (courier) q.set('courier_id', courier);
      if (depto) q.set('departamento', depto);
      if (estado !== 'todas') q.set('estado', estado);
      const r = await shippingAPI.agencies(`?${q.toString()}`);
      setRows(r.agencias || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, courier, depto, estado]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      await shippingAPI.saveAgency(form.id, form);
      setForm(null); load(); onChanged();
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };
  const toggle = async (a) => { setMenu(null); try { await shippingAPI.saveAgency(a.id, { ...a, estado: a.estado ? 0 : 1 }); load(); } catch (e) { setErr(e.message); } };
  const remove = async (a) => {
    setMenu(null);
    if (!window.confirm(`¿Eliminar la agencia "${a.nombre}"?`)) return;
    try { await shippingAPI.deleteAgency(a.id); load(); onChanged(); } catch (e) { setErr(e.message); }
  };

  const template = () => {
    const sample = ['Shalom', 'Agencia Lima - Javier Prado', 'Lima', 'Lima', 'San Isidro', 'Av. Javier Prado 1234', 'Frente al grifo', '01 234 5678', 'Juan Pérez', 'Lun-Sáb 8:00-20:00'];
    downloadBlob(new Blob(['﻿' + [HEAD.join(','), sample.map((c) => `"${c}"`).join(',')].join('\n')], { type: 'text/csv;charset=utf-8' }), 'plantilla_agencias.csv');
  };
  const onFile = async (ev) => {
    const file = ev.target.files?.[0]; ev.target.value = '';
    if (!file) return;
    setImporting(true); setErr(''); setNotice('');
    try {
      const table = parseCsv(await file.text());
      if (table.length < 2) throw new Error('El archivo no tiene filas. Usa la plantilla (primera fila con los títulos).');
      const keys = table[0].map(norm);
      const idx = (names) => keys.findIndex((k) => names.includes(k));
      const map = { courier: idx(['courier', 'empresa']), nombre: idx(['agencia', 'nombre', 'sucursal']), departamento: idx(['departamento']), provincia: idx(['provincia']), distrito: idx(['distrito']), direccion: idx(['direccion']), referencia: idx(['referencia']), telefono: idx(['telefono', 'celular']), contacto: idx(['contacto']), horario: idx(['horario', 'horarioatencion']) };
      if (map.nombre < 0) throw new Error('No encuentro la columna "agencia" en el archivo. Usa la plantilla.');
      const filas = table.slice(1).map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, i >= 0 ? (r[i] || '').trim() : ''])));
      const res = await shippingAPI.importAgencies({ filas, courier_id: courier || undefined });
      setNotice(res.message); load(); onChanged();
    } catch (ex) { setErr(ex.message); } finally { setImporting(false); }
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const lab = { fontSize: 12.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 };

  return (
    <div className="pm-card" style={{ paddingBottom: 6 }}>
      <div className="pm-toolbar">
        <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 240px' }}>
          <input placeholder="Buscar agencia, dirección, distrito o contacto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" aria-label="Buscar"><Search size={18} /></button>
        </div>
        <select className="pm-select" value={courier} onChange={(e) => setCourier(e.target.value)}>
          <option value="">Courier: todos</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="pm-select" value={depto} onChange={(e) => setDepto(e.target.value)}>
          <option value="">Departamento: todos</option>{DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="pm-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activas">Activas</option><option value="inactivas">Inactivas</option><option value="todas">Todas</option>
        </select>
        <div className="pm-head-r" style={{ marginLeft: 'auto' }}>
          <button className="pm-btn-outline" onClick={template}><Download size={16} /> Plantilla CSV</button>
          <button className="pm-btn-outline" onClick={() => fileRef.current?.click()} disabled={importing}><Upload size={16} /> {importing ? 'Importando…' : 'Importar CSV'}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          <button className="pm-btn-green" onClick={() => { setErr(''); setForm(emptyAgency(courier || couriers[0]?.id || '')); }}><PlusCircle size={20} /> Nueva agencia</button>
        </div>
      </div>
      {err && !form && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
      {notice && <div className="pm-bulk" style={{ justifyContent: 'space-between' }}><span>{notice}</span><button onClick={() => setNotice('')}>OK</button></div>}

      <div className="pm-table-wrap" style={{ minHeight: 160 }}>
        <table className="pm-table">
          <thead><tr><th>#</th><th>Agencia</th><th>Ubicación</th><th>Dirección</th><th>Teléfono / contacto</th><th>Horario</th><th>Estado</th><th style={{ width: 44 }} /></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} style={a.estado ? undefined : { opacity: 0.6 }}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{a.nombre}<span className="pm-tag" style={{ marginLeft: 6 }}>{a.courier}</span></td>
                <td>{[a.distrito, a.provincia, a.departamento].filter(Boolean).join(', ') || '—'}</td>
                <td>{a.direccion || '—'}{a.referencia && <span className="pm-extra">{a.referencia}</span>}</td>
                <td>{a.telefono || '—'}{a.contacto && <span className="pm-extra">{a.contacto}</span>}</td>
                <td>{a.horario || '—'}</td>
                <td>{a.estado ? <span className="pm-state on"><CheckCircle2 size={16} /> ACTIVA</span> : <span className="pm-state off"><XCircle size={16} /> INACTIVA</span>}</td>
                <td>
                  <button className="pm-icon-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu(menu?.id === a.id ? null : { id: a.id, anchor: r }); }} aria-label="Acciones"><MoreVertical size={18} /></button>
                  {menu?.id === a.id && (
                    <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} width={190}>
                      <button onClick={() => { setMenu(null); setErr(''); setForm({ ...emptyAgency(), ...a }); }}><Edit2 size={15} /> Editar</button>
                      <button onClick={() => toggle(a)}><Power size={15} /> {a.estado ? 'Desactivar' : 'Activar'}</button>
                      <button style={{ color: '#B91C1C' }} onClick={() => remove(a)}><Trash2 size={15} /> Eliminar</button>
                    </FloatingMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && <div className="pm-empty"><Store size={40} />NO HAY AGENCIAS. AGREGA UNA O IMPORTA UN CSV.</div>}
        {loading && <div className="pm-empty">Cargando…</div>}
      </div>
      <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{rows.length} agencia(s)</div>

      {form && (
        <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form className="pm-modal" style={{ maxWidth: 680 }} onSubmit={save}>
            <button type="button" className="pm-close" onClick={() => setForm(null)} aria-label="Cerrar"><X size={20} /></button>
            <h3>{form.id ? 'Editar agencia' : 'Nueva agencia'}</h3>
            <div className="sub">Sedes de los couriers para tus envíos a provincia.</div>
            {err && <div className="pm-err">{err}</div>}
            <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 2fr' }}>
              <div className="pm-f"><label style={lab}>Courier *</label>
                <select className="pm-in" value={form.courier_id} onChange={(e) => set({ courier_id: e.target.value })}><option value="">Elegir…</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              <div className="pm-f"><label style={lab}>Nombre de la agencia *</label><input className="pm-in" maxLength={150} value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Agencia Alto Trujillo" /></div>
            </div>
            <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="pm-f"><label style={lab}>Departamento</label>
                <select className="pm-in" value={form.departamento || ''} onChange={(e) => set({ departamento: e.target.value })}><option value="">—</option>{DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
              <div className="pm-f"><label style={lab}>Provincia</label><input className="pm-in" maxLength={80} value={form.provincia || ''} onChange={(e) => set({ provincia: e.target.value })} /></div>
              <div className="pm-f"><label style={lab}>Distrito</label><input className="pm-in" maxLength={80} value={form.distrito || ''} onChange={(e) => set({ distrito: e.target.value })} /></div>
            </div>
            <div className="pm-f"><label style={lab}><MapPin size={12} /> Dirección</label><input className="pm-in" maxLength={255} value={form.direccion || ''} onChange={(e) => set({ direccion: e.target.value })} /></div>
            <div className="pm-f"><label style={lab}>Referencia</label><input className="pm-in" maxLength={255} value={form.referencia || ''} onChange={(e) => set({ referencia: e.target.value })} /></div>
            <div className="pm-grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="pm-f"><label style={lab}><Phone size={12} /> Teléfono</label><input className="pm-in" maxLength={60} value={form.telefono || ''} onChange={(e) => set({ telefono: e.target.value })} /></div>
              <div className="pm-f"><label style={lab}>Persona de contacto</label><input className="pm-in" maxLength={120} value={form.contacto || ''} onChange={(e) => set({ contacto: e.target.value })} /></div>
            </div>
            <div className="pm-f"><label style={lab}><Clock size={12} /> Horario de atención</label><input className="pm-in" maxLength={160} value={form.horario || ''} onChange={(e) => set({ horario: e.target.value })} placeholder="Lun-Sáb 8:00-20:00" /></div>
            <div className="pm-f"><label style={lab}>Notas</label><input className="pm-in" maxLength={255} value={form.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></div>
            <label style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 14 }}><input type="checkbox" className="pm-chk" checked={!!form.estado} onChange={(e) => set({ estado: e.target.checked ? 1 : 0 })} /> Agencia activa</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="pm-btn-outline" style={{ borderColor: '#E4EAF0', color: '#475569' }} onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="pm-btn-green" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ====================== COURIERS ====================== */
export function CouriersTab({ couriers, onChanged }) {
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try { await shippingAPI.saveCourier(form.id, form); setForm(null); onChanged(); } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };
  return (
    <div className="pm-card" style={{ paddingBottom: 6 }}>
      <div className="pm-toolbar">
        <div style={{ fontSize: 13.5, color: '#475569' }}>Empresas de transporte con las que envías (Shalom, Olva Courier, etc.).</div>
        <div className="pm-head-r" style={{ marginLeft: 'auto' }}>
          <button className="pm-btn-green" onClick={() => { setErr(''); setForm({ nombre: '', notas: '', estado: 1 }); }}><PlusCircle size={20} /> Nuevo courier</button>
        </div>
      </div>
      <div className="pm-table-wrap">
        <table className="pm-table" style={{ minWidth: 520 }}>
          <thead><tr><th>#</th><th>Courier</th><th>Notas</th><th style={{ textAlign: 'right' }}>Agencias</th><th>Estado</th><th style={{ width: 44 }} /></tr></thead>
          <tbody>
            {couriers.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td><td style={{ fontWeight: 600 }}>{c.nombre}</td><td>{c.notas || '—'}</td><td style={{ textAlign: 'right' }}>{c.agencias}</td>
                <td>{c.estado ? <span className="pm-state on"><CheckCircle2 size={16} /> ACTIVO</span> : <span className="pm-state off"><XCircle size={16} /> INACTIVO</span>}</td>
                <td><button className="pm-icon-btn" onClick={() => { setErr(''); setForm({ ...c }); }} aria-label="Editar"><Edit2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form className="pm-modal" style={{ maxWidth: 460 }} onSubmit={save}>
            <button type="button" className="pm-close" onClick={() => setForm(null)} aria-label="Cerrar"><X size={20} /></button>
            <h3>{form.id ? 'Editar courier' : 'Nuevo courier'}</h3>
            {err && <div className="pm-err">{err}</div>}
            <div className="pm-f"><label>Nombre *</label><input className="pm-in" maxLength={80} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="pm-f"><label>Notas</label><input className="pm-in" maxLength={255} value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <label style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 14 }}><input type="checkbox" className="pm-chk" checked={!!form.estado} onChange={(e) => setForm({ ...form, estado: e.target.checked ? 1 : 0 })} /> Courier activo</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="pm-btn-outline" style={{ borderColor: '#E4EAF0', color: '#475569' }} onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="pm-btn-green" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

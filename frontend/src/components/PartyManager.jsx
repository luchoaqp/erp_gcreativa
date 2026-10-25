import FloatingMenu from './FloatingMenu';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, MoreVertical, Search, Eye, EyeOff, CheckCircle2, XCircle, PlusCircle, UserRound, X, Pencil, Trash2,
  Minus, Download, MessageCircle, Bot, Info
} from 'lucide-react';
import { lookupAPI } from '../api';
import './party.css';

const DOC_TIPOS = [
  { v: 'DNI', l: 'DNI' }, { v: 'RUC', l: 'RUC' }, { v: 'CE', l: 'Carnet de extranjería' },
  { v: 'PASAPORTE', l: 'Pasaporte' }, { v: 'OTRO', l: 'Otro' }
];
const DOC_PLACEHOLDER = { DNI: 'Ej. 12345678', RUC: 'Ej. 20123456789', CE: 'Ej. 001234567', PASAPORTE: 'Ej. A1234567', OTRO: 'Número de documento' };

const BASE_COLS = [
  { id: 'nombre', label: 'Nombre / Razón Social', always: true },
  { id: 'tipo_documento', label: 'Tipo de documento', def: true },
  { id: 'numero_documento', label: 'N° de documento', def: true },
  { id: 'codigo', label: 'Código', def: true },
  { id: 'direccion', label: 'Dirección', def: true },
  { id: 'telefono', label: 'Teléfono', def: true },
  { id: 'email', label: 'Email' },
  { id: 'departamento', label: 'Departamento' },
  { id: 'provincia', label: 'Provincia' },
  { id: 'estado', label: 'Estado', always: true }
];

function emptyForm(cfg) {
  const f = {
    tipo_documento: cfg.defaultDoc || 'DNI', numero_documento: '', nombre: '', codigo_modo: 'auto', codigo: '',
    direccion: '', direcciones_extra: [], telefono: '', telefonos_extra: [], email: '', estado: 1,
    departamento: '', provincia: ''
  };
  (cfg.extraFields || []).forEach((x) => { f[x.col] = x.def !== undefined ? x.def : ''; });
  return f;
}

function exportCsv(rows, filename) {
  const cols = ['codigo', 'nombre', 'tipo_documento', 'numero_documento', 'direccion', 'telefono', 'email', 'departamento', 'provincia', 'estado'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(',')].concat(rows.map((r) => cols.map((c) => esc(c === 'estado' ? (r.estado ? 'Activo' : 'Inactivo') : r[c])).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * cfg: { api, listKey, singular, plural, Icon, defaultDoc, extraFields:[{col,label,type,placeholder,def,optional}],
 *        extraCols:[{id,label,render}], types (tipos de cliente, opcional), isAdmin, whatsapp(row) }
 */
export default function PartyManager({ cfg, isAdmin, types = [], onTypesChanged }) {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, activos: 0, inactivos: 0, nuevos_mes: 0, nuevos_mes_anterior: 0 });
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [search, setSearch] = useState('');
  const [showAdv, setShowAdv] = useState(false);
  const [adv, setAdv] = useState({ tipo_documento: '', departamento: '', provincia: '', tipo_cliente_id: '' });
  const [selected, setSelected] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colOpen, setColOpen] = useState(false);
  const allCols = useMemo(() => {
    const cols = [...BASE_COLS];
    const at = cols.findIndex((c) => c.id === 'estado');
    cols.splice(at, 0, ...(cfg.extraCols || []));
    return cols;
  }, [cfg]);
  const colKey = `pm_cols_${cfg.listKey}`;
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(colKey)); if (Array.isArray(s)) return s; } catch (e) { /* sin guardado */ }
    return allCols.filter((c) => c.def || c.always).map((c) => c.id);
  });
  const [modal, setModal] = useState(null); // null | { id?, form }
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [formInfo, setFormInfo] = useState('');
  const [looking, setLooking] = useState(false);
  const [pageMsg, setPageMsg] = useState('');
  const first = useRef(true);

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (estado) p.set('estado', estado);
    Object.entries(adv).forEach(([k, v]) => { if (v) p.set(k, v); });
    const q = p.toString();
    return q ? `?${q}` : '';
  };

  const load = async () => {
    try {
      const res = await cfg.api.getAll(buildQuery());
      if (res.success) { setRows(res[cfg.listKey] || []); setStats(res.stats || stats); setSelected([]); }
    } catch (e) { setPageMsg(e.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, first.current ? 0 : 300);
    first.current = false;
    return () => clearTimeout(t);
  }, [search, estado, adv.tipo_documento, adv.departamento, adv.provincia, adv.tipo_cliente_id]);

  const toggleCol = (id) => {
    const next = visibleCols.includes(id) ? visibleCols.filter((x) => x !== id) : [...visibleCols, id];
    setVisibleCols(next);
    try { localStorage.setItem(colKey, JSON.stringify(next)); } catch (e) { /* sin guardado */ }
  };
  const shownCols = allCols.filter((c) => c.always || visibleCols.includes(c.id));

  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);
  const diffMes = stats.nuevos_mes - stats.nuevos_mes_anterior;

  /* ---------- Formulario ---------- */
  const openNew = () => { setFormErr(''); setFormInfo(''); setModal({ form: emptyForm(cfg) }); };
  const openEdit = (r) => {
    setFormErr(''); setFormInfo('');
    const f = emptyForm(cfg);
    Object.keys(f).forEach((k) => { if (r[k] !== undefined && r[k] !== null) f[k] = r[k]; });
    (cfg.extraFields || []).forEach((x) => { f[x.col] = r[x.col] ?? ''; });
    f.fecha_especial = r.fecha_especial ? String(r.fecha_especial).slice(0, 10) : '';
    f.codigo_modo = 'manual';
    f.direcciones_extra = r.direcciones_extra || [];
    f.telefonos_extra = r.telefonos_extra || [];
    setModal({ id: r.id, form: f });
  };
  const setF = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const updList = (key, i, v) => setF({ [key]: modal.form[key].map((x, k) => (k === i ? v : x)) });
  const addList = (key) => { if (modal.form[key].length < 5) setF({ [key]: [...modal.form[key], ''] }); };
  const delList = (key, i) => setF({ [key]: modal.form[key].filter((_, k) => k !== i) });

  const f = modal?.form;
  const canLookup = f && ['DNI', 'RUC'].includes(f.tipo_documento) &&
    ((f.tipo_documento === 'DNI' && /^\d{8}$/.test(f.numero_documento)) || (f.tipo_documento === 'RUC' && /^\d{11}$/.test(f.numero_documento)));

  const lookup = async () => {
    setLooking(true); setFormErr(''); setFormInfo('');
    try {
      const r = await lookupAPI.document(f.tipo_documento, f.numero_documento);
      const d = r.data || {};
      setF({
        nombre: d.nombre || f.nombre,
        direccion: d.direccion || f.direccion,
        departamento: d.departamento || f.departamento,
        provincia: d.provincia || f.provincia
      });
      setFormInfo('Datos completados desde ' + (f.tipo_documento === 'RUC' ? 'SUNAT' : 'RENIEC'));
    } catch (e) { setFormErr(e.message); } finally { setLooking(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setFormErr('');
    setSaving(true);
    try {
      const body = { ...modal.form };
      if (body.codigo_modo === 'auto') delete body.codigo;
      if (modal.id) await cfg.api.update(modal.id, body);
      else await cfg.api.create(body);
      setModal(null);
      setPageMsg('');
      await load();
    } catch (err) { setFormErr(err.message); } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!window.confirm(`¿Eliminar a "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
    try { await cfg.api.delete(r.id); setPageMsg(''); await load(); } catch (err) { setPageMsg(err.message); }
  };

  const bulk = async (estadoNuevo) => {
    try { await cfg.api.bulkEstado(selected, estadoNuevo); setMenuOpen(false); await load(); } catch (err) { setPageMsg(err.message); }
  };

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const Icon = cfg.Icon;
  const extraFieldsOptional = (cfg.extraFields || []).filter((x) => x.optional);
  const [extraShown, setExtraShown] = useState([]);
  useEffect(() => {
    if (!modal) return;
    setExtraShown(extraFieldsOptional.filter((x) => modal.form[x.col]).map((x) => x.col));
  }, [modal?.id, !!modal]);

  const renderCell = (r, c, idx) => {
    switch (c.id) {
      case 'nombre': return (
        <>
          {r.nombre}
          {(r.telefonos_extra?.length > 0 || r.direcciones_extra?.length > 0) && (
            <span className="pm-extra">
              {r.direcciones_extra?.length > 0 ? `+${r.direcciones_extra.length} dirección(es) ` : ''}
              {r.telefonos_extra?.length > 0 ? `+${r.telefonos_extra.length} teléfono(s)` : ''}
            </span>
          )}
        </>
      );
      case 'estado': return r.estado
        ? <span className="pm-state on"><CheckCircle2 size={16} /> ACTIVO</span>
        : <span className="pm-state off"><XCircle size={16} /> INACTIVO</span>;
      default:
        if (c.render) return c.render(r);
        return r[c.id] || '';
    }
  };

  return (
    <div className="pm">
      <div className="pm-card pm-head">
        <div className="pm-head-l">
          <Icon size={38} color="#FF7A3C" strokeWidth={1.7} />
          <div>
            <h2>Gestión de {cfg.plural}</h2>
            <p>Creación y modificación de datos de tus {cfg.plural}</p>
          </div>
        </div>
        <div className="pm-head-r">
          <button className="pm-btn-green" onClick={openNew}><PlusCircle size={20} /> Crear {cfg.singular}</button>
          <button className="pm-btn-dots" onClick={() => setMenuOpen((v) => !v)} aria-label="Más acciones"><MoreVertical size={18} /></button>
          {menuOpen && (
            <div className="pm-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button disabled={!selected.length} onClick={() => bulk(1)}><CheckCircle2 size={15} /> Activar seleccionados</button>
              <button disabled={!selected.length} onClick={() => bulk(0)}><XCircle size={15} /> Inactivar seleccionados</button>
              <button onClick={() => { exportCsv(rows, `${cfg.listKey}.csv`); setMenuOpen(false); }}><Download size={15} /> Exportar lista (CSV)</button>
            </div>
          )}
        </div>
      </div>

      <div className="pm-card pm-kpis">
        <div className="pm-kpi-total">
          Total de {cfg.plural}
          <strong><UserRound size={24} fill="#FF7A3C" /> {stats.total}</strong>
        </div>
        <div className="pm-kpi-group">
          <div className="pm-kpi">{cfg.Plural} activos<div className="ok"><CheckCircle2 size={16} /> {stats.activos} ({pct(stats.activos)}%)</div></div>
          <div className="pm-kpi">{cfg.Plural} inactivos<div className="no"><XCircle size={16} /> {stats.inactivos} ({pct(stats.inactivos)}%)</div></div>
          <div className="pm-kpi">Nuevos {cfg.plural} de este mes
            <div className="nw"><PlusCircle size={16} /> {stats.nuevos_mes}
              {stats.nuevos_mes > 0 && <span>({diffMes >= 0 ? '↑' : '↓'}{Math.abs(diffMes)})</span>}
              <span title="Comparado con el mes anterior" style={{ display: 'inline-flex' }}><Info size={14} color="#64748B" /></span>
            </div>
          </div>
        </div>
        {stats.total === 0 && cfg.emptyHint && <div className="pm-hint">{cfg.emptyHint}</div>}
      </div>

      <div className="pm-card">
        <div className="pm-toolbar">
          <label>Estado</label>
          <select className="pm-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
          </select>
          <button className="pm-btn-outline" onClick={() => setShowAdv((v) => !v)}>
            {showAdv ? <EyeOff size={18} /> : <Eye size={18} />} {showAdv ? 'Ocultar filtros' : 'Ver filtros avanzados'}
          </button>
          <div className="pm-search">
            <input placeholder="Buscar por nombre, N° de documento, código o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" aria-label="Buscar" onClick={load}><Search size={20} /></button>
          </div>
        </div>

        {showAdv && (
          <div className="pm-adv">
            <div><label>Tipo de documento</label>
              <select className="pm-select" value={adv.tipo_documento} onChange={(e) => setAdv({ ...adv, tipo_documento: e.target.value })}>
                <option value="">Todos</option>{DOC_TIPOS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
              </select></div>
            {cfg.useTypes && (
              <div><label>Tipo de cliente</label>
                <select className="pm-select" value={adv.tipo_cliente_id} onChange={(e) => setAdv({ ...adv, tipo_cliente_id: e.target.value })}>
                  <option value="">Todos</option>{types.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select></div>
            )}
            <div><label>Departamento</label><input value={adv.departamento} onChange={(e) => setAdv({ ...adv, departamento: e.target.value })} placeholder="Ej. Arequipa" /></div>
            <div><label>Provincia</label><input value={adv.provincia} onChange={(e) => setAdv({ ...adv, provincia: e.target.value })} placeholder="Ej. Arequipa" /></div>
            <button className="pm-btn-outline" onClick={() => setAdv({ tipo_documento: '', departamento: '', provincia: '', tipo_cliente_id: '' })}>Limpiar</button>
          </div>
        )}

        {pageMsg && <div className="pm-err" style={{ margin: '4px 20px' }}>{pageMsg}</div>}
        {selected.length > 0 && (
          <div className="pm-bulk">
            {selected.length} seleccionado(s)
            <button onClick={() => bulk(1)}>Activar</button>
            <button onClick={() => bulk(0)}>Inactivar</button>
            <button onClick={() => setSelected([])}>Quitar selección</button>
          </div>
        )}

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" className="pm-chk" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} aria-label="Seleccionar todos" />
                </th>
                <th style={{ width: 44 }}>N°</th>
                {shownCols.map((c) => <th key={c.id}>{c.id === 'codigo' ? `Código de ${cfg.singular}` : c.label}</th>)}
                <th style={{ width: 96, textAlign: 'right' }}>
                  <span className="pm-colsel">
                    <button className="pm-icon-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColOpen((v) => (v ? false : r)); }} title="Elegir columnas" aria-label="Elegir columnas"><Plus size={22} color="#1C2A38" /></button>
                    {colOpen && (
                      <FloatingMenu anchor={colOpen} onClose={() => setColOpen(false)} keepOpen width={230}>
                        {allCols.filter((c) => !c.always).map((c) => (
                          <label key={c.id}><input type="checkbox" checked={visibleCols.includes(c.id)} onChange={() => toggleCol(c.id)} /> {c.label}</label>
                        ))}
                      </FloatingMenu>
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td><input type="checkbox" className="pm-chk" checked={selected.includes(r.id)} onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} /></td>
                  <td>{rows.length - i}</td>
                  {shownCols.map((c) => <td key={c.id}>{renderCell(r, c, i)}</td>)}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {cfg.whatsapp && r.telefono && (
                      <button className="pm-icon-btn" title="Escribir por WhatsApp" onClick={() => cfg.whatsapp(r)}><MessageCircle size={16} color="#25A55F" /></button>
                    )}
                    <button className="pm-icon-btn" title="Editar" onClick={() => openEdit(r)}><Pencil size={16} /></button>
                    {isAdmin && <button className="pm-icon-btn" title="Eliminar" onClick={() => remove(r)}><Trash2 size={16} color="#E0245E" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="pm-empty">
              <Bot size={96} color="#E02424" strokeWidth={1.4} />
              {stats.total === 0 ? `AÚN NO TIENES ${cfg.plural.toUpperCase()}` : 'NO HAY RESULTADOS PARA ESTA BÚSQUEDA'}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <form className="pm-modal" onSubmit={save}>
            <button type="button" className="pm-close" onClick={() => setModal(null)} aria-label="Cerrar"><X size={20} /></button>
            <h3>{modal.id ? `Editar ${cfg.singular}` : `Nuevo ${cfg.Singular}`}</h3>
            <p className="sub">{modal.id ? `Modifica los datos de este ${cfg.singular}` : `Agrega los datos de tu nuevo ${cfg.singular}`}</p>

            {formErr && <div className="pm-err">{formErr}</div>}
            {formInfo && <div className="pm-ok">{formInfo}</div>}

            <div className="pm-row wrap pm-f">
              <div style={{ flex: '0 0 150px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Tipo de documento</label>
                <select className="pm-in" value={f.tipo_documento} onChange={(e) => setF({ tipo_documento: e.target.value })}>
                  {DOC_TIPOS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>N° de documento</label>
                <input className="pm-in" value={f.numero_documento} placeholder={DOC_PLACEHOLDER[f.tipo_documento]}
                  onChange={(e) => setF({ numero_documento: e.target.value.replace(/\s/g, '') })} maxLength={20} />
              </div>
              <button type="button" className="pm-doc-btn" disabled={!canLookup || looking} onClick={lookup}
                title={canLookup ? 'Completar datos desde SUNAT/RENIEC' : 'Ingresa un DNI (8 dígitos) o RUC (11 dígitos)'}>
                {looking ? 'Consultando…' : <>Consultar<br />SUNAT/RENIEC</>}
              </button>
            </div>

            <div className="pm-f">
              <label>Nombre / Razón Social *</label>
              <input className="pm-in" value={f.nombre} required onChange={(e) => setF({ nombre: e.target.value })}
                placeholder="Ej. Ladrillería Distribuidora Mayorista Jose Luis" />
            </div>

            <div className="pm-f">
              <label>Código de {cfg.singular}</label>
              <div className="pm-code">
                <select value={f.codigo_modo} onChange={(e) => setF({ codigo_modo: e.target.value })}>
                  <option value="auto">Automático</option><option value="manual">Manual</option>
                </select>
                <input disabled={f.codigo_modo === 'auto'} value={f.codigo_modo === 'auto' ? '' : f.codigo}
                  onChange={(e) => setF({ codigo: e.target.value })} maxLength={30}
                  placeholder={f.codigo_modo === 'auto' ? 'Se generará al guardar' : 'Escribe el código'} />
              </div>
            </div>

            {cfg.useTypes && (
              <div className="pm-f">
                <label>Tipo de cliente</label>
                <select className="pm-in" value={f.tipo_cliente_id || ''} onChange={(e) => setF({ tipo_cliente_id: e.target.value })}>
                  <option value="">Sin tipo</option>
                  {types.filter((t) => t.estado || t.id === Number(f.tipo_cliente_id)).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="pm-f">
              <label>Dirección</label>
              <div className="pm-row">
                <input className="pm-in" value={f.direccion} onChange={(e) => setF({ direccion: e.target.value })} placeholder="Ej. Calle Los Manzanos 120, Selva Alegre, Arequipa" />
                <button type="button" className="pm-plus" title="Agregar otra dirección" onClick={() => addList('direcciones_extra')}><Plus size={20} /></button>
              </div>
              {f.direcciones_extra.map((d, i) => (
                <div className="pm-row" key={i} style={{ marginTop: 8 }}>
                  <input className="pm-in" value={d} onChange={(e) => updList('direcciones_extra', i, e.target.value)} placeholder={`Dirección adicional ${i + 1}`} />
                  <button type="button" className="pm-minus" title="Quitar" onClick={() => delList('direcciones_extra', i)}><Minus size={18} /></button>
                </div>
              ))}
            </div>

            <div className="pm-grid2 pm-f">
              <div><label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Departamento</label>
                <input className="pm-in" value={f.departamento} onChange={(e) => setF({ departamento: e.target.value })} placeholder="Ej. Arequipa" /></div>
              <div><label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Provincia</label>
                <input className="pm-in" value={f.provincia} onChange={(e) => setF({ provincia: e.target.value })} placeholder="Ej. Arequipa" /></div>
            </div>

            <div className="pm-f">
              <label>Teléfono</label>
              <div className="pm-row">
                <input className="pm-in" value={f.telefono} onChange={(e) => setF({ telefono: e.target.value })} placeholder="Ej. 987 654 321" />
                <button type="button" className="pm-plus" title="Agregar otro teléfono" onClick={() => addList('telefonos_extra')}><Plus size={20} /></button>
              </div>
              {f.telefonos_extra.map((d, i) => (
                <div className="pm-row" key={i} style={{ marginTop: 8 }}>
                  <input className="pm-in" value={d} onChange={(e) => updList('telefonos_extra', i, e.target.value)} placeholder={`Teléfono adicional ${i + 1}`} />
                  <button type="button" className="pm-minus" title="Quitar" onClick={() => delList('telefonos_extra', i)}><Minus size={18} /></button>
                </div>
              ))}
            </div>

            <div className="pm-f">
              <label>Email</label>
              <input type="email" className="pm-in" value={f.email} onChange={(e) => setF({ email: e.target.value })} placeholder="Ej. usuario@correo.com" />
            </div>

            {(cfg.extraFields || []).filter((x) => !x.optional || extraShown.includes(x.col)).map((x) => (
              <div className="pm-f" key={x.col}>
                <label>{x.label}</label>
                {x.type === 'textarea'
                  ? <textarea className="pm-in" rows={2} value={f[x.col] || ''} onChange={(e) => setF({ [x.col]: e.target.value })} placeholder={x.placeholder} />
                  : <input type={x.type || 'text'} className="pm-in" value={f[x.col] || ''} onChange={(e) => setF({ [x.col]: e.target.value })} placeholder={x.placeholder} />}
              </div>
            ))}

            <div className="pm-row pm-f" style={{ alignItems: 'center' }}>
              <label style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Estado</label>
              <select className="pm-in" style={{ width: 150, borderColor: '#3DB87F' }} value={f.estado ? 1 : 0} onChange={(e) => setF({ estado: Number(e.target.value) })}>
                <option value={1}>Activo</option><option value={0}>Inactivo</option>
              </select>
            </div>

            {extraFieldsOptional.length > 0 && (
              <select className="pm-add-field" value="" onChange={(e) => { if (e.target.value) setExtraShown((s) => [...s, e.target.value]); }}>
                <option value="">Nuevo campo adicional</option>
                {extraFieldsOptional.filter((x) => !extraShown.includes(x.col)).map((x) => <option key={x.col} value={x.col}>{x.label}</option>)}
              </select>
            )}

            <div className="pm-foot">
              <button type="button" className="c" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="s" disabled={saving}>{saving ? 'Guardando…' : modal.id ? 'Guardar cambios' : `Crear ${cfg.singular}`}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

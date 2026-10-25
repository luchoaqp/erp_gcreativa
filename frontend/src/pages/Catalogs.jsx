import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Share2, Copy, Check, Pencil, Trash2, ExternalLink, Search, MessageCircle, X, Save, RotateCcw } from 'lucide-react';
import { catalogsAPI, settingsAPI } from '../api';
import { Modal } from '../components/CompraUI';
import '../components/compras.css';

const OCASIONES_BASE = ['Día del Padre', 'Día de la Madre', 'Navidad', 'Graduaciones', 'Profesiones', 'San Valentín', 'Cumpleaños', 'Aniversario', 'Bodas', 'Baby shower', 'Día del Maestro', 'Fiestas Patrias'];

const chip = (on) => ({ padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: on ? '2px solid #7C3AED' : '1px solid #DDD6FE', background: on ? '#F3EEFF' : '#fff', color: on ? '#6D28D9' : '#5B6478' });

const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); } catch (e) {
    const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
  }
};

const TPL_KEY = 'catalogo_mensaje_predeterminado';
const tplDefault = (tienda) => `¡Hola! 🎁 Te saludamos de ${tienda}.\nTe comparto nuestro catálogo "{nombre}"{ocasion}:\n{enlaces}\n\nCuéntame cuál te gusta y te ayudo con tu pedido ✨`;
const readTpl = () => { try { return localStorage.getItem(TPL_KEY) || ''; } catch (e) { return ''; } };

function ShareModal({ catalog, store, onClose }) {
  const tienda = store.nombre_tienda || 'nuestra tienda';
  const enlaces = catalog.links.map((l) => `${l.titulo ? `• ${l.titulo}: ` : '• '}${l.url}`).join('\n');
  const ocasionTxt = catalog.ocasion ? ` para ${catalog.ocasion}` : '';
  const fill = (tpl) => tpl.split('{nombre}').join(catalog.nombre).split('{ocasion}').join(ocasionTxt).split('{enlaces}').join(enlaces);
  const [saved, setSaved] = useState(readTpl());
  const base = saved || tplDefault(tienda);
  const [msg, setMsg] = useState(fill(base));
  const [tel, setTel] = useState('');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');

  // Guarda el texto actual como predeterminado, volviendo a poner las partes propias de este catálogo como variables
  const saveDefault = () => {
    let t = msg;
    if (enlaces) t = t.split(enlaces).join('{enlaces}');
    if (ocasionTxt) t = t.split(ocasionTxt).join('{ocasion}');
    t = t.split(catalog.nombre).join('{nombre}');
    try { localStorage.setItem(TPL_KEY, t); setSaved(t); setNote('Guardado: será el mensaje predeterminado al compartir cualquier catálogo.'); } catch (e) { setNote('No se pudo guardar en este navegador.'); }
  };
  const restoreOriginal = () => {
    try { localStorage.removeItem(TPL_KEY); } catch (e) { /* sin guardado */ }
    setSaved('');
    setMsg(fill(tplDefault(tienda)));
    setNote('Se restauró el mensaje original.');
  };
  const wa = () => {
    let p = tel.replace(/\D/g, '');
    if (p.length === 9) p = `51${p}`;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  return (
    <Modal title="Compartir catálogo" onClose={onClose} width={540}>
      <div className="cx-f"><label className="cx-lab">Teléfono del cliente (opcional)</label>
        <div style={{ display: 'flex', gap: 6 }}><span className="cx-in" style={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3EEFF' }}>+51</span>
          <input className="cx-in" placeholder="987654321" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
        <small style={{ color: '#7B8497' }}>Si lo dejas vacío, WhatsApp te deja elegir el contacto.</small></div>
      <div className="cx-f"><label className="cx-lab">Mensaje (puedes editarlo)</label>
        <textarea className="cx-in" style={{ height: 'auto', padding: 12, lineHeight: 1.5 }} rows={8} value={msg} onChange={(e) => { setMsg(e.target.value); setNote(''); }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="cx-btn-soft" style={{ padding: '5px 12px' }} onClick={saveDefault}><Save size={14} /> Guardar como mensaje predeterminado</button>
          <button type="button" className="cx-btn-ghost" style={{ padding: '5px 12px' }} onClick={restoreOriginal}><RotateCcw size={14} /> Volver al mensaje original</button>
        </div>
        <small style={{ display: 'block', marginTop: 6, color: note ? '#15803d' : '#7B8497' }}>{note || 'Si no pulsas “Guardar”, los cambios solo se usan en este envío y se conserva tu mensaje predeterminado.'}</small></div>
      <div className="cx-actions">
        <button type="button" className="cx-btn-ghost" onClick={async () => { await copyText(msg); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar mensaje'}</button>
        <button type="button" className="cx-btn-main" style={{ background: '#25D366', boxShadow: 'none' }} onClick={wa}><MessageCircle size={16} /> Enviar por WhatsApp</button>
      </div>
    </Modal>
  );
}

function CatalogForm({ initial, ocasiones, onClose, onSaved }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [ocasion, setOcasion] = useState(initial?.ocasion || '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion || '');
  const [links, setLinks] = useState(initial?.links?.length ? initial.links : [{ titulo: '', url: '' }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setL = (i, patch) => setLinks((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const save = async () => {
    setErr('');
    const clean = links.filter((l) => l.url.trim()).map((l) => ({ titulo: l.titulo.trim(), url: l.url.trim() }));
    if (!nombre.trim()) return setErr('Escribe el nombre del catálogo.');
    if (!clean.length) return setErr('Agrega al menos un enlace de Canva.');
    if (clean.some((l) => !/^https?:\/\//i.test(l.url))) return setErr('Cada enlace debe empezar con http:// o https://');
    setBusy(true);
    try {
      const data = { nombre, ocasion, descripcion, links: clean };
      if (initial) await catalogsAPI.update(initial.id, data); else await catalogsAPI.create(data);
      onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const lista = [...new Set([...OCASIONES_BASE, ...ocasiones])];
  return (
    <Modal title={initial ? 'Editar catálogo' : 'Nuevo catálogo'} onClose={onClose} width={620}>
      {err && <div className="cx-err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="cx-grid2">
        <div className="cx-f"><label className="cx-lab">Nombre <i>*</i></label><input className="cx-in" maxLength={120} placeholder="Ej: Catálogo Día del Padre 2026" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div className="cx-f"><label className="cx-lab">Ocasión especial</label><input className="cx-in" list="ocasiones-cat" maxLength={80} placeholder="Elige o escribe" value={ocasion} onChange={(e) => setOcasion(e.target.value)} />
          <datalist id="ocasiones-cat">{lista.map((o) => <option key={o} value={o} />)}</datalist></div>
      </div>
      <div className="cx-f" style={{ marginTop: 14 }}><label className="cx-lab">Descripción</label><input className="cx-in" maxLength={300} placeholder="Opcional: qué incluye, precios desde…" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
      <label className="cx-lab">Enlaces de Canva <i>*</i></label>
      <div style={{ display: 'grid', gap: 8 }}>
        {links.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr) 32px', gap: 8 }}>
            <input className="cx-in" maxLength={100} placeholder="Título (ej: Tazas)" value={l.titulo} onChange={(e) => setL(i, { titulo: e.target.value })} />
            <input className="cx-in" placeholder="https://www.canva.com/design/..." value={l.url} onChange={(e) => setL(i, { url: e.target.value })} />
            <button type="button" aria-label="Quitar" onClick={() => setLinks((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : [{ titulo: '', url: '' }]))} style={{ background: 'none', border: 0, cursor: 'pointer' }}><X size={16} color="#E0245E" /></button>
          </div>
        ))}
      </div>
      <div className="cx-actions">
        <button type="button" className="cx-btn-soft" onClick={() => setLinks((ls) => [...ls, { titulo: '', url: '' }])}><Plus size={15} /> Agregar otro enlace</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="cx-btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="cx-btn-main" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  );
}

export default function Catalogs({ user }) {
  const [data, setData] = useState({ catalogs: [], ocasiones: [] });
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fOc, setFOc] = useState(''); // filtro por ocasión ('' = todas)
  const [orden, setOrden] = useState('ocasion'); // ocasion | nombre | recientes
  const [form, setForm] = useState(null); // {} nuevo | catálogo
  const [share, setShare] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [msg, setMsg] = useState('');
  const canEdit = user?.rol === 'admin' || user?.rol === 'vendedor';

  const load = async () => {
    try { const r = await catalogsAPI.list(); if (r.success) setData(r); } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); settingsAPI.get().then((r) => { if (r.success) setStore(r.settings || {}); }).catch(() => {}); }, []);

  const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ocConteo = useMemo(() => {
    const m = {};
    data.catalogs.forEach((c) => { const k = c.ocasion || 'Sin ocasión'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((x, y) => x[0].localeCompare(y[0], 'es'));
  }, [data]);
  const filtrados = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return data.catalogs.filter((c) => {
      if (fOc && (c.ocasion || 'Sin ocasión') !== fOc) return false;
      if (!terms.length) return true;
      const hay = norm(`${c.nombre} ${c.ocasion || ''} ${c.descripcion || ''} ${(c.links || []).map((l) => `${l.titulo || ''} ${l.url || ''}`).join(' ')}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [data, q, fOc]);
  const groups = useMemo(() => {
    const list = [...filtrados];
    if (orden === 'nombre') list.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    else if (orden === 'recientes') list.sort((x, y) => Number(y.id) - Number(x.id));
    if (orden !== 'ocasion') return [[orden === 'nombre' ? 'Todos (A-Z)' : 'Más recientes', list]].filter(([, l]) => l.length);
    const map = {};
    list.forEach((c) => { const k = c.ocasion || 'Sin ocasión'; (map[k] = map[k] || []).push(c); });
    return Object.entries(map);
  }, [filtrados, orden]);

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar el catálogo "${c.nombre}"?`)) return;
    try { await catalogsAPI.remove(c.id); load(); } catch (e) { setMsg(e.message); }
  };
  const copyLink = async (key, url) => { await copyText(url); setCopiedId(key); setTimeout(() => setCopiedId(''), 1500); };

  return (
    <div className="content-body animate-fade-in">
      <div className="cx">
        <div className="cx-card cx-pad cx-row" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: '#F3EEFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={22} color="#7C3AED" /></div>
            <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Catálogos</h1><div style={{ fontSize: 12.5, color: '#7B8497' }}>Tus catálogos de Canva por ocasión especial, listos para compartir.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="cx-search"><Search size={16} color="#7C3AED" /><input placeholder="Buscar por nombre, ocasión, descripción o enlace…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {canEdit && <button type="button" className="cx-btn-main" onClick={() => setForm({})}><Plus size={17} /> Nuevo catálogo</button>}
          </div>
        </div>
        {data.catalogs.length > 0 && (
          <div className="cx-card cx-pad" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setFOc('')} style={chip(!fOc)}>Todas · {data.catalogs.length}</button>
              {ocConteo.map(([o, n]) => <button key={o} type="button" onClick={() => setFOc(fOc === o ? '' : o)} style={chip(fOc === o)}>{o} · {n}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#7B8497' }}>
              <span>Mostrando {filtrados.length} de {data.catalogs.length}</span>
              <select className="cx-in" style={{ width: 'auto', height: 34, padding: '0 10px' }} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
                <option value="ocasion">Agrupar por ocasión</option><option value="nombre">Ordenar A-Z</option><option value="recientes">Más recientes primero</option>
              </select>
              {(q || fOc) && <button type="button" className="cx-btn-ghost" style={{ padding: '4px 12px' }} onClick={() => { setQ(''); setFOc(''); }}>Limpiar filtros</button>}
            </div>
          </div>
        )}
        {msg && <div className="cx-err">{msg}</div>}

        {!loading && groups.length === 0 && (
          <div className="cx-card cx-pad"><div className="cx-empty">{data.catalogs.length ? 'No hay catálogos con esos filtros.' : 'Aún no tienes catálogos. Crea uno por ocasión (Día del Padre, Navidad, Graduaciones…) con sus enlaces de Canva.'}</div></div>
        )}

        {groups.map(([ocasion, items]) => (
          <div key={ocasion}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#5B6CF2', margin: '4px 4px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{ocasion} · {items.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {items.map((c) => (
                <div key={c.id} className="cx-card cx-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="cx-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{c.nombre}</div>
                      {c.descripcion && <div style={{ fontSize: 12.5, color: '#7B8497', marginTop: 2 }}>{c.descripcion}</div>}
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" title="Editar" onClick={() => setForm(c)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 5 }}><Pencil size={16} color="#64748B" /></button>
                        <button type="button" title="Eliminar" onClick={() => remove(c)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 5 }}><Trash2 size={16} color="#E0245E" /></button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {c.links.map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F7F5FF', borderRadius: 10, padding: '6px 10px', fontSize: 13 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={l.url}>{l.titulo || l.url}</span>
                        <button type="button" title="Copiar enlace" onClick={() => copyLink(`${c.id}-${i}`, l.url)} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex' }}>{copiedId === `${c.id}-${i}` ? <Check size={15} color="#16A34A" /> : <Copy size={15} color="#7C3AED" />}</button>
                        <a href={l.url} target="_blank" rel="noreferrer" title="Abrir" style={{ display: 'flex' }}><ExternalLink size={15} color="#7C3AED" /></a>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="cx-btn-main" style={{ alignSelf: 'flex-start' }} onClick={() => setShare(c)}><Share2 size={15} /> Compartir</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {form && <CatalogForm initial={form.id ? form : null} ocasiones={data.ocasiones} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {share && <ShareModal catalog={share} store={store} onClose={() => setShare(null)} />}
    </div>
  );
}

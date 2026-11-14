import React, { useState, useEffect, useMemo } from 'react';
import { PackageMinus, Plus, Search, MoreVertical, Trash2, X, ClipboardList, Boxes } from 'lucide-react';
import { inventoryExitsAPI, productsAPI } from '../api';
import FloatingMenu from '../components/FloatingMenu';
import { Modal, money, today, fmtDMY } from '../components/CompraUI';
import '../components/compras.css';

// Salidas de inventario: merma, productos fallados, errores de producción… Descuentan stock de los lotes
// (del más antiguo al más nuevo), quedan en el Kardex con su motivo y su costo se resta de la utilidad neta.
const MOTIVOS = [
  { v: 'merma', l: 'Merma' }, { v: 'fallado', l: 'Producto fallado' }, { v: 'produccion', l: 'Error de producción' },
  { v: 'muestra', l: 'Muestra / uso interno' }, { v: 'vencido', l: 'Dañado / vencido' }, { v: 'otro', l: 'Otro' }
];
const MOTIVO_L = Object.fromEntries(MOTIVOS.map((m) => [m.v, m.l]));
const COLOR = { merma: 'amber', fallado: 'red', produccion: 'violet', muestra: 'blue', vencido: 'gray', otro: 'gray' };
const num = (n) => Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 });
let seq = 0;

function NuevaSalida({ onDone, onCancel }) {
  const [code, setCode] = useState('');
  const [fecha, setFecha] = useState(today());
  const [motivo, setMotivo] = useState('merma');
  const [nota, setNota] = useState('');
  const [items, setItems] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const cargarCatalogo = () => productsAPI.getAll('?estado=todos&tipo=producto').then((r) => setCatalogo((r.products || []).filter((p) => !Number(p.es_pack)))).catch(() => {});
  useEffect(() => { inventoryExitsAPI.nextCode().then((r) => setCode(r.codigo || '')).catch(() => {}); cargarCatalogo(); }, []);

  const usados = new Set(items.map((i) => i.producto.id));
  const t = q.trim().toLowerCase();
  const resultados = t ? catalogo.filter((p) => !usados.has(p.id) && (String(p.nombre).toLowerCase().includes(t) || String(p.codigo || '').toLowerCase().includes(t))).slice(0, 8) : [];
  const costoDe = (p) => Number(p.precio_costo) || 0;
  const total = items.reduce((a, i) => a + (Number(i.cantidad) || 0) * costoDe(i.producto), 0);
  const setI = (k, patch) => setItems((l) => l.map((x) => (x.key === k ? { ...x, ...patch } : x)));

  const save = async () => {
    setErr('');
    if (!items.length) return setErr('Agrega al menos un producto.');
    for (const i of items) {
      const c = Number(i.cantidad);
      if (!(c > 0) || !Number.isInteger(c)) return setErr(`Indica una cantidad entera mayor a 0 para «${i.producto.nombre}».`);
      if (c > Number(i.producto.stock)) return setErr(`«${i.producto.nombre}» solo tiene ${num(i.producto.stock)} en stock.`);
    }
    if (motivo === 'otro' && !nota.trim()) return setErr('Con el motivo «Otro», explica en el detalle qué pasó.');
    if (!window.confirm(`¿Registrar la salida? Se descontará el stock de ${items.length} producto${items.length === 1 ? '' : 's'}.`)) return;
    setSaving(true);
    try {
      const r = await inventoryExitsAPI.create({ fecha, motivo, nota, items: items.map((i) => ({ producto_id: i.producto.id, cantidad: Number(i.cantidad) })) });
      onDone(r.message || 'Salida registrada.');
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="cx">
      {err && <div className="cx-err">{err}</div>}
      <div className="cx-card cx-pad">
        <div className="cx-title" style={{ justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ClipboardList size={18} /> Datos de la salida</span>{code && <span className="cx-chip violet">Próximo: {code}</span>}</div>
        <div className="cx-grid2">
          <div className="cx-f"><label className="cx-lab">Motivo <i>*</i></label>
            <select className="cx-in" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
          <div className="cx-f"><label className="cx-lab">Fecha <i>*</i></label><input type="date" className="cx-in tint" max={today()} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        </div>
        <div className="cx-f" style={{ marginBottom: 0 }}><label className="cx-lab">Detalle {motivo === 'otro' && <i>*</i>}</label>
          <textarea className="cx-in" rows={2} maxLength={1000} placeholder="Ej: tazas que salieron con la sublimación corrida, llegaron rotas del proveedor, pedido #123 se imprimió mal…" value={nota} onChange={(e) => setNota(e.target.value)} /></div>
      </div>

      <div className="cx-card cx-pad">
        <div className="cx-title"><Boxes size={18} /> Productos que salen</div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div className="cx-search"><Search size={16} color="#7C3AED" /><input placeholder="Buscar producto o insumo por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button type="button" onClick={() => setQ('')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex' }}><X size={15} /></button>}</div>
          {resultados.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, marginTop: 4, boxShadow: '0 10px 28px rgba(0,0,0,.1)', overflow: 'hidden' }}>
              {resultados.map((p) => {
                const sin = !(Number(p.stock) > 0);
                return (
                  <button type="button" key={p.id} disabled={sin} onClick={() => { setItems((l) => [...l, { key: ++seq, producto: p, cantidad: '1' }]); setQ(''); }}
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: 0, borderBottom: '1px solid #F1F5F9', background: '#fff', cursor: sin ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: sin ? 0.5 : 1, fontSize: 13 }}>
                    <span>{p.nombre}{p.codigo && <small style={{ color: '#94A3B8', marginLeft: 6 }}>{p.codigo}</small>}</span>
                    <span style={{ color: sin ? '#B42318' : '#64748B', whiteSpace: 'nowrap' }}>{sin ? 'Sin stock' : `Stock ${num(p.stock)}`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {items.length === 0 ? <div className="cx-empty">Busca arriba los productos o insumos que se perdieron.</div> : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Producto</th><th className="r">Stock actual</th><th style={{ width: 120 }}>Cantidad</th><th className="r">Costo unit.</th><th className="r">Costo perdido</th><th style={{ width: 40 }} /></tr></thead>
              <tbody>
                {items.map((i) => {
                  const c = Number(i.cantidad) || 0; const excede = c > Number(i.producto.stock);
                  return (
                    <tr key={i.key}>
                      <td><strong>{i.producto.nombre}</strong>{i.producto.codigo && <small>{i.producto.codigo}</small>}</td>
                      <td className="r">{num(i.producto.stock)}{c > 0 && !excede && <small>queda {num(Number(i.producto.stock) - c)}</small>}</td>
                      <td><input className="cx-in" type="number" min="1" step="1" value={i.cantidad} onChange={(e) => setI(i.key, { cantidad: e.target.value })} style={excede ? { borderColor: '#E0245E' } : undefined} aria-label={`Cantidad de ${i.producto.nombre}`} /></td>
                      <td className="r">S/ {money(costoDe(i.producto))}</td>
                      <td className="r"><strong>S/ {money(c * costoDe(i.producto))}</strong></td>
                      <td><button type="button" aria-label="Quitar" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} style={{ background: 'none', border: 0, cursor: 'pointer' }}><Trash2 size={17} color="#E0245E" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 12, color: '#7B8497', marginTop: 10 }}>El stock se descuenta de los lotes más antiguos primero; el costo final sale de esos lotes (aquí se muestra el precio de compra de la ficha como referencia).</div>
      </div>

      <div className="cx-bar">
        <div className="tot"><small>Costo perdido (aprox.)</small><b>S/ {money(total)}</b></div>
        <div className="kv">Motivo<b>{MOTIVO_L[motivo]}</b></div>
        <div className="kv">Productos<b>{items.length}</b></div>
        <div className="sp" />
        <button type="button" className="cx-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="cx-btn-main" disabled={saving || !items.length} onClick={save}>{saving ? 'Guardando…' : 'Registrar salida'}</button>
      </div>
    </div>
  );
}

function ListaSalidas({ isAdmin, flash }) {
  const [data, setData] = useState({ salidas: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [motivo, setMotivo] = useState('');
  const [mes, setMes] = useState('mes');
  const [msg, setMsg] = useState('');
  const [menu, setMenu] = useState(null);
  const [detail, setDetail] = useState(null);

  const rango = () => {
    const d = new Date(); const iso = (x) => x.toLocaleDateString('en-CA');
    if (mes === 'mes') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)];
    if (mes === 'mes_ant') return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
    if (mes === 'anio') return [iso(new Date(d.getFullYear(), 0, 1)), iso(d)];
    return ['2000-01-01', iso(d)];
  };
  const load = async () => {
    try {
      const [desde, hasta] = rango();
      const r = await inventoryExitsAPI.list(`?desde=${desde}&hasta=${hasta}${motivo ? `&motivo=${motivo}` : ''}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`);
      if (r.success) setData(r);
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [mes, motivo, search]);

  const annul = async (s) => {
    setMenu(null);
    if (!window.confirm(`¿Anular la salida ${s.codigo}? El stock vuelve a los lotes de los que salió.`)) return;
    try { const r = await inventoryExitsAPI.annul(s.id); setMsg(''); window.alert(r.message || 'Salida anulada'); load(); } catch (e) { setMsg(e.message); }
  };
  const open = async (s) => { setMenu(null); try { const r = await inventoryExitsAPI.getById(s.id); if (r.success) setDetail(r.salida); } catch (e) { setMsg(e.message); } };
  const top = useMemo(() => Object.entries(data.totals?.por_motivo || {}).sort((a, b) => b[1] - a[1]), [data]);

  return (
    <div>
      {(msg || flash) && <div className={msg ? 'cx-err' : 'cx-ok'}>{msg || flash}</div>}
      <div className="cx-card">
        <div className="cx-toolbar">
          <div className="cx-search"><Search size={16} color="#7C3AED" /><input placeholder="Buscar por código, producto o detalle…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex' }}><X size={15} /></button>}</div>
          <select className="cx-sel" value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Todos los motivos</option>{MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select>
          <select className="cx-sel" value={mes} onChange={(e) => setMes(e.target.value)}><option value="mes">Este mes</option><option value="mes_ant">Mes anterior</option><option value="anio">Este año</option><option value="todo">Todas</option></select>
        </div>
        <div className="cx-sum">
          <span>{data.totals?.cantidad || 0} salidas</span><span>•</span><span>Costo perdido: <b>S/ {money(data.totals?.total || 0)}</b></span>
          {top.map(([k, v]) => <React.Fragment key={k}><span>•</span><span>{MOTIVO_L[k] || k}: <b>S/ {money(v)}</b></span></React.Fragment>)}
        </div>
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Fecha</th><th>Código</th><th>Motivo</th><th>Productos</th><th>Registró</th><th>Estado</th><th className="r">Costo perdido</th><th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {data.salidas.map((s) => (
                <tr key={s.id} style={{ opacity: s.estado === 'anulado' ? 0.55 : 1 }}>
                  <td>{fmtDMY(s.fecha)}</td><td><strong>{s.codigo}</strong></td>
                  <td><span className={`cx-chip ${COLOR[s.motivo] || 'gray'}`} style={{ cursor: 'default' }}>{MOTIVO_L[s.motivo] || s.motivo}</span></td>
                  <td style={{ maxWidth: 360 }}>{s.resumen}{s.nota && <small style={{ whiteSpace: 'normal' }}>{s.nota}</small>}</td>
                  <td>{s.usuario_nombre || '—'}</td>
                  <td>{s.estado === 'anulado' ? <span className="cx-chip red">● Anulada</span> : <span className="cx-chip blue">● Registrada</span>}</td>
                  <td className="r"><strong>S/ {money(s.total_costo)}</strong></td>
                  <td><button type="button" aria-label="Acciones" onClick={(e) => setMenu({ anchor: e.currentTarget.getBoundingClientRect(), s })} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6 }}><MoreVertical size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && data.salidas.length === 0 && <div className="cx-empty" style={{ margin: 20 }}>No hay salidas de inventario en este periodo.</div>}
        </div>
      </div>
      {menu && (
        <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} width={190}>
          <button onClick={() => open(menu.s)}>Ver detalle</button>
          {isAdmin && <button style={{ color: '#B91C1C' }} disabled={menu.s.estado === 'anulado'} onClick={() => annul(menu.s)}>Anular salida</button>}
        </FloatingMenu>
      )}
      {detail && (
        <Modal title={`Salida ${detail.codigo}`} onClose={() => setDetail(null)} width={600}>
          <p style={{ fontSize: 13.5, color: '#475569', marginTop: -6 }}>{MOTIVO_L[detail.motivo] || detail.motivo} · {fmtDMY(detail.fecha)} · {detail.usuario_nombre || '—'}{detail.estado === 'anulado' && <b style={{ color: '#B42318' }}> · ANULADA</b>}</p>
          {detail.items.map((i) => (
            <div key={i.id} className="cx-row" style={{ padding: '6px 0', borderBottom: '1px solid #EEF0F6', gap: 10 }}>
              <span>{num(i.cantidad)} × {i.nombre}{i.codigo && <small style={{ color: '#94A3B8', marginLeft: 6 }}>{i.codigo}</small>}</span>
              <b>S/ {money(Number(i.cantidad) * Number(i.costo_unit))}</b>
            </div>
          ))}
          <div className="cx-row" style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}><span>Costo perdido</span><span>S/ {money(detail.total_costo)}</span></div>
          {detail.nota && <p style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}><b>Detalle:</b> {detail.nota}</p>}
        </Modal>
      )}
    </div>
  );
}

export default function InventoryExits({ user }) {
  const [tab, setTab] = useState('lista');
  const [flash, setFlash] = useState('');
  return (
    <div className="content-body animate-fade-in">
      <div className="cx">
        <div className="cx-card cx-pad cx-row" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: '#FFE9E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PackageMinus size={22} color="#B42318" /></div>
            <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Salidas de inventario</h1><div style={{ fontSize: 12.5, color: '#7B8497' }}>Merma, productos fallados y errores de producción. Descuentan stock y quedan en el Kardex.</div></div>
          </div>
          <div className="cx-tabs">
            <button type="button" className={`cx-tab ${tab === 'lista' ? 'on' : ''}`} onClick={() => setTab('lista')}>Salidas</button>
            <button type="button" className={`cx-tab ${tab === 'nuevo' ? 'on' : ''}`} onClick={() => { setFlash(''); setTab('nuevo'); }}><Plus size={14} /> Nueva salida</button>
          </div>
        </div>
      </div>
      {tab === 'nuevo'
        ? <NuevaSalida onCancel={() => setTab('lista')} onDone={(m) => { setFlash(m); setTab('lista'); }} />
        : <ListaSalidas isAdmin={user?.rol === 'admin'} flash={flash} />}
    </div>
  );
}

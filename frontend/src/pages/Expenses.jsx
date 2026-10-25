import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, ArrowLeft, Building2, FileText, Trash2, Search, MoreVertical, Receipt, CreditCard, RefreshCw, X } from 'lucide-react';
import { expensesAPI } from '../api';
import FloatingMenu from '../components/FloatingMenu';
import { ProviderPicker, Modal, money, r2, today, fmtDMY, sym } from '../components/CompraUI';
import '../components/compras.css';

const MOTIVOS = [
  { v: 'varios', l: 'Varios' }, { v: 'movilidad', l: 'Movilidad' }, { v: 'combustible', l: 'Combustible' }, { v: 'inmuebles', l: 'Alquiler / Inmuebles' },
  { v: 'servicios', l: 'Servicios (luz, agua, internet)' }, { v: 'sueldos', l: 'Sueldos y personal' }, { v: 'marketing', l: 'Publicidad / Marketing' },
  { v: 'mantenimiento', l: 'Mantenimiento' }, { v: 'impuestos', l: 'Impuestos y tasas' }, { v: 'otro', l: 'Otro' }
];
const MOTIVO_L = Object.fromEntries(MOTIVOS.map((m) => [m.v, m.l]));
const TIPOS = [
  { v: 'sin_comprobante', l: 'SIN COMPROBANTE' }, { v: 'recibo', l: 'RECIBO' }, { v: 'boleta', l: 'BOLETA DE VENTA' }, { v: 'factura', l: 'FACTURA ELECTRÓNICA' },
  { v: 'ticket', l: 'TICKET' }, { v: 'planilla', l: 'PLANILLA' }, { v: 'recibo_honorarios', l: 'RECIBO POR HONORARIOS' }
];
const TIPO_L = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));
const METODOS = [
  { v: 'efectivo', l: 'EFECTIVO' }, { v: 'yape', l: 'YAPE' }, { v: 'plin', l: 'PLIN' }, { v: 'transferencia', l: 'TRANSFERENCIA' },
  { v: 'tarjeta', l: 'TARJETA' }, { v: 'caja_general', l: 'CAJA GENERAL' }
];
let seq = 0;

function NewExpense({ onDone, editing, onCancel }) {
  const [code, setCode] = useState('');
  const E = editing || null;
  const [prov, setProv] = useState(E ? (E.proveedor_id ? { id: E.proveedor_id, nombre: E.proveedor_nombre, numero_documento: E.proveedor_documento } : (E.proveedor_nombre ? { id: null, nombre: E.proveedor_nombre, varios: true } : null)) : null);
  const [motivo, setMotivo] = useState(E ? E.motivo : 'varios');
  const [tipo, setTipo] = useState(E ? E.tipo_comprobante : 'sin_comprobante');
  const [fecha, setFecha] = useState(E ? String(E.fecha_emision).slice(0, 10) : today());
  const [serie, setSerie] = useState(E ? (E.serie || '') : '');
  const [numero, setNumero] = useState(E ? (E.correlativo || '') : '');
  const [moneda, setMoneda] = useState(E ? E.moneda : 'PEN');
  const [tc, setTc] = useState(() => { if (E && E.tipo_cambio) return String(Number(E.tipo_cambio)); try { return localStorage.getItem('compras_tc') || ''; } catch (e) { return ''; } });
  const [obs, setObs] = useState(E ? (E.observaciones || '') : '');
  const [det, setDet] = useState(E ? E.detalles.map((d) => ({ key: ++seq, descripcion: d.descripcion, importe: String(Number(E.moneda === 'USD' ? d.importe : d.importe)) })) : []);
  const [pagos, setPagos] = useState(E ? E.pagos.map((p) => ({ key: ++seq, metodo: p.metodo, origen: p.origen || '', referencia: p.referencia || '', monto: String(Number(p.monto)) })) : []);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const ms = sym(moneda);

  useEffect(() => { if (E) { setCode(E.codigo); return; } expensesAPI.nextCode().then((r) => setCode(r.codigo || '')).catch(() => {}); }, []);

  const total = r2(det.reduce((a, d) => a + (Number(d.importe) || 0), 0));
  const pagado = r2(pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0));
  const setD = (k, patch) => setDet((l) => l.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const setP = (k, patch) => setPagos((l) => l.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const addPago = () => setPagos((l) => [...l, { key: ++seq, metodo: 'caja_general', origen: '', referencia: '', monto: l.length === 0 ? (total || '') : '' }]);

  const reset = () => {
    setProv(null); setMotivo('varios'); setTipo('sin_comprobante'); setFecha(today()); setSerie(''); setNumero(''); setObs(''); setDet([]); setPagos([]); setErr('');
    expensesAPI.nextCode().then((r) => setCode(r.codigo || '')).catch(() => {});
  };

  const save = async () => {
    setErr('');
    const fail = (m) => { setErr(m); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (!det.length) return fail('Agrega al menos un detalle del gasto.');
    if (det.some((d) => !String(d.descripcion).trim() || !(Number(d.importe) > 0))) return fail('Cada detalle necesita descripción e importe mayor a 0.');
    if (moneda === 'USD' && !(Number(tc) > 0)) return fail('Ingresa el tipo de cambio.');
    if (pagado > total + 0.001) return fail('Los pagos superan el total del gasto.');
    setSaving(true);
    try {
      if (moneda === 'USD') { try { localStorage.setItem('compras_tc', String(tc)); } catch (e) { /* sin guardado */ } }
      const payload = {
        proveedor_id: prov?.id || null, proveedor_nombre: prov?.nombre || '', motivo, tipo_comprobante: tipo, serie, correlativo: numero, fecha_emision: fecha,
        moneda, tipo_cambio: moneda === 'USD' ? Number(tc) : null, observaciones: obs,
        detalles: det.map((d) => ({ descripcion: d.descripcion, importe: Number(d.importe) })),
        pagos: pagos.map((p) => ({ metodo: p.metodo, origen: p.origen, referencia: p.referencia, monto: Number(p.monto) }))
      };
      const r = E ? await expensesAPI.update(E.id, payload) : await expensesAPI.create(payload);
      if (!E) reset();
      onDone(`Gasto ${r.codigo || E.codigo} ${E ? 'actualizado' : 'registrado'}.`);
    } catch (e) { fail(e.message); } finally { setSaving(false); }
  };

  const sinComp = tipo === 'sin_comprobante';
  return (
    <div className="cx">
      {err && <div className="cx-err">{err}</div>}
      <div className="cx-card cx-split">
        <div>
          <div className="cx-title"><Building2 size={18} /> Proveedor</div>
          <ProviderPicker value={prov} onChange={setProv} required={false} allowVarios />
          <div className="cx-f" style={{ marginBottom: 0 }}>
            <label className="cx-lab">Motivo <i>*</i></label>
            <select className="cx-in" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select>
          </div>
        </div>
        <div>
          <div className="cx-title" style={{ justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Receipt size={18} /> Gasto</span>{code && <span className="cx-chip violet">{E ? 'Editando' : 'Próximo'}: {code}</span>}</div>
          <div className="cx-grid2">
            <div className="cx-f"><label className="cx-lab">Tipo de comprobante</label>
              <select className="cx-in" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            <div className="cx-f"><label className="cx-lab">Emisión <i>*</i></label><input type="date" className="cx-in tint" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          </div>
          <div className="cx-f"><label className="cx-lab">Comprobante del proveedor</label>
            <div className="cx-grid2">
              <input className="cx-in tint" disabled={sinComp} placeholder="Serie" maxLength={10} value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} />
              <input className="cx-in tint" disabled={sinComp} placeholder="Número" maxLength={20} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\s/g, ''))} />
            </div></div>
          <div className="cx-grid2">
            <div className="cx-f" style={{ marginBottom: 0 }}><label className="cx-lab">Moneda</label>
              <select className="cx-in" value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="PEN">Soles</option><option value="USD">Dólares americanos</option></select></div>
            <div className="cx-f" style={{ marginBottom: 0 }}><label className="cx-lab">T. cambio{moneda === 'USD' && <i> *</i>}</label>
              <div style={{ position: 'relative' }}><RefreshCw size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#7C3AED' }} />
                <input className="cx-in tint" style={{ paddingLeft: 34 }} disabled={moneda !== 'USD'} type="number" step="0.001" min="0" value={tc} onChange={(e) => setTc(e.target.value)} /></div></div>
          </div>
        </div>
      </div>

      <div className="cx-card cx-pad">
        <div className="cx-title"><FileText size={18} /> Detalle</div>
        {det.length === 0 ? <div className="cx-empty">Escribe qué se pagó… y su importe</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {det.map((d) => (
              <div key={d.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 36px', gap: 10, alignItems: 'center' }}>
                <input className="cx-in" placeholder="Ej: Taxi a proveedor, gasolina, alquiler del local…" maxLength={200} value={d.descripcion} onChange={(e) => setD(d.key, { descripcion: e.target.value })} />
                <input className="cx-in" type="number" min="0" step="0.01" placeholder={`Importe (${ms})`} value={d.importe} onChange={(e) => setD(d.key, { importe: e.target.value })} />
                <button type="button" aria-label="Quitar" onClick={() => setDet((l) => l.filter((x) => x.key !== d.key))} style={{ background: 'none', border: 0, cursor: 'pointer' }}><Trash2 size={17} color="#E0245E" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="cx-actions"><button type="button" className="cx-btn-main" onClick={() => setDet((l) => [...l, { key: ++seq, descripcion: '', importe: '' }])}><Plus size={16} /> Agregar detalle</button></div>
        <div className="cx-f" style={{ marginTop: 14, marginBottom: 0 }}><label className="cx-lab">Observaciones</label><textarea className="cx-in" rows={2} maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      </div>

      <div className="cx-card cx-pad">
        <div className="cx-title"><CreditCard size={18} /> Pagos</div>
        {pagos.length === 0 ? <div className="cx-empty">Aún no registras pagos (el gasto quedará sin pago asociado).</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {pagos.map((p) => (
              <div key={p.key} className="cx-paygrid">
                <div><label className="cx-lab">Método de gasto</label><select className="cx-in" value={p.metodo} onChange={(e) => setP(p.key, { metodo: e.target.value })}>{METODOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
                <div><label className="cx-lab">Sale de</label><input className="cx-in" placeholder="Ej: Caja chica, BCP…" maxLength={60} value={p.origen} onChange={(e) => setP(p.key, { origen: e.target.value })} /></div>
                <div><label className="cx-lab">Referencia</label><input className="cx-in" maxLength={80} value={p.referencia} onChange={(e) => setP(p.key, { referencia: e.target.value })} /></div>
                <div><label className="cx-lab">Monto ({ms})</label><input className="cx-in" type="number" min="0" step="0.01" value={p.monto} onChange={(e) => setP(p.key, { monto: e.target.value })} /></div>
                <button type="button" aria-label="Quitar" onClick={() => setPagos((l) => l.filter((x) => x.key !== p.key))} style={{ background: 'none', border: 0, cursor: 'pointer', alignSelf: 'end', height: 42 }}><Trash2 size={17} color="#E0245E" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="cx-actions"><button type="button" className="cx-btn-soft" onClick={addPago}><Plus size={15} /> Agregar pago</button>
          {pagos.length > 0 && <span style={{ alignSelf: 'center', fontSize: 13, color: '#7B8497' }}>Pagado {ms} {money(pagado)} de {ms} {money(total)}</span>}</div>
      </div>

      <div className="cx-bar">
        <div className="tot"><small>Total</small><b>{ms} {money(total)}</b></div>
        <div className="kv">Detalles<b>{det.length} detalle{det.length === 1 ? '' : 's'}</b></div>
        <div className="kv">Proveedor<b>{prov ? prov.nombre.slice(0, 28) : 'Sin proveedor'}</b></div>
        <div className="sp" />
        <button type="button" className="cx-btn-ghost" onClick={E ? onCancel : reset}>Cancelar</button>
        <button type="button" className="cx-btn-main" disabled={saving || !det.length} onClick={save}>{saving ? 'Guardando…' : (E ? 'Guardar cambios' : 'Registrar gasto')}</button>
      </div>
    </div>
  );
}

function ExpenseList({ isAdmin, flash, onEdit }) {
  const [data, setData] = useState({ expenses: [], totals: {} });
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
    if (mes === 'hoy') return [iso(d), iso(d)];
    return ['2000-01-01', iso(new Date(d.getFullYear() + 1, 11, 31))];
  };
  const load = async () => {
    try {
      const [desde, hasta] = rango();
      const q = `?desde=${desde}&hasta=${hasta}${motivo ? `&motivo=${motivo}` : ''}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
      const r = await expensesAPI.list(q); if (r.success) setData(r);
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [mes, motivo, search]);
  useEffect(() => { if (flash) load(); }, [flash]);

  const annul = async (g) => {
    setMenu(null);
    if (!window.confirm(`¿Anular el gasto ${g.codigo}?`)) return;
    try { await expensesAPI.annul(g.id); setMsg(''); load(); } catch (e) { setMsg(e.message); }
  };
  const open = async (g) => { setMenu(null); try { const r = await expensesAPI.getById(g.id); if (r.success) setDetail(r.expense); } catch (e) { setMsg(e.message); } };
  const top = useMemo(() => Object.entries(data.totals?.por_motivo || {}).sort((a, b) => b[1] - a[1]).slice(0, 4), [data]);

  return (
    <div>
      {(msg || flash) && <div className={msg ? 'cx-err' : 'cx-ok'}>{msg || flash}</div>}
      <div className="cx-card">
        <div className="cx-toolbar">
          <div className="cx-search"><Search size={16} color="#7C3AED" /><input placeholder="Buscar por código, proveedor o detalle…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex' }}><X size={15} /></button>}</div>
          <select className="cx-sel" value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Todos los motivos</option>{MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select>
          <select className="cx-sel" value={mes} onChange={(e) => setMes(e.target.value)}><option value="hoy">Hoy</option><option value="mes">Este mes</option><option value="mes_ant">Mes anterior</option><option value="todo">Todos</option></select>
        </div>
        <div className="cx-sum">
          <span>{data.totals?.cantidad || 0} gastos</span><span>•</span><span>Total: <b>S/ {money(data.totals?.total || 0)}</b></span>
          {top.map(([k, v]) => <React.Fragment key={k}><span>•</span><span>{MOTIVO_L[k] || k}: <b>S/ {money(v)}</b></span></React.Fragment>)}
        </div>
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>#</th><th>Emisión</th><th>Código</th><th>Proveedor</th><th>Motivo</th><th>Comprobante</th><th>Estado</th><th className="r">Total</th><th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {data.expenses.map((g, i) => (
                <tr key={g.id} style={{ opacity: g.estado === 'anulado' ? 0.55 : 1 }}>
                  <td style={{ color: '#7B8497' }}>{i + 1}</td><td>{fmtDMY(g.fecha_emision)}</td><td><strong>{g.codigo}</strong></td>
                  <td>{g.proveedor_nombre || '—'}{g.proveedor_documento && <small>{g.proveedor_documento}</small>}</td>
                  <td><span className="cx-chip violet">{MOTIVO_L[g.motivo] || g.motivo}</span></td>
                  <td>{g.serie ? `${g.serie}-${g.correlativo}` : '—'}<small>{TIPO_L[g.tipo_comprobante]}</small></td>
                  <td>{g.estado === 'anulado' ? <span className="cx-chip red">● Anulado</span> : <span className="cx-chip blue">● Registrado</span>}</td>
                  <td className="r"><strong>{g.moneda === 'USD' ? `$ ${money(g.total_moneda)}` : `S/ ${money(g.total)}`}</strong>{g.moneda === 'USD' && <small>S/ {money(g.total)}</small>}</td>
                  <td><button type="button" aria-label="Acciones" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ anchor: r, g }); }} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6 }}><MoreVertical size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && data.expenses.length === 0 && <div className="cx-empty" style={{ margin: 20 }}>No hay gastos en este periodo.</div>}
        </div>
      </div>
      {menu && (
        <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} width={190}>
          <button onClick={() => open(menu.g)}>Ver detalle</button>
          <button disabled={menu.g.estado === 'anulado'} onClick={async () => { const g = menu.g; setMenu(null); try { const r = await expensesAPI.getById(g.id); if (r.success) onEdit(r.expense); } catch (e) { setMsg(e.message); } }}>Editar gasto</button>
          {isAdmin && <button style={{ color: '#B91C1C' }} disabled={menu.g.estado === 'anulado'} onClick={() => annul(menu.g)}>Anular gasto</button>}
        </FloatingMenu>
      )}
      {detail && (
        <Modal title={`Gasto ${detail.codigo}`} onClose={() => setDetail(null)} width={560}>
          <p style={{ fontSize: 13.5, color: '#475569', marginTop: -6 }}>{MOTIVO_L[detail.motivo] || detail.motivo} · {detail.proveedor_nombre || 'Sin proveedor'} · {fmtDMY(detail.fecha_emision)}</p>
          {detail.detalles.map((d) => <div key={d.id} className="cx-row" style={{ padding: '5px 0', borderBottom: '1px solid #EEF0F6' }}><span>{d.descripcion}</span><b>{sym(detail.moneda)} {money(d.importe)}</b></div>)}
          <div className="cx-row" style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}><span>Total</span><span>{sym(detail.moneda)} {money(detail.moneda === 'USD' ? detail.total_moneda : detail.total)}</span></div>
          {detail.pagos.length > 0 && <div style={{ marginTop: 12, fontSize: 13, color: '#475569' }}><b>Pagos:</b> {detail.pagos.map((p) => `${(METODOS.find((m) => m.v === p.metodo) || {}).l || p.metodo}${p.origen ? ` (${p.origen})` : ''} ${money(p.monto)}`).join(' · ')}</div>}
          {detail.observaciones && <p style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}><b>Obs.:</b> {detail.observaciones}</p>}
        </Modal>
      )}
    </div>
  );
}

export default function Expenses({ user }) {
  const [tab, setTab] = useState('lista');
  const [flash, setFlash] = useState('');
  const [editing, setEditing] = useState(null);
  return (
    <div className="content-body animate-fade-in">
      <div className="cx">
        <div className="cx-card cx-pad cx-row" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={22} color="#EA7A1A" /></div>
            <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Gastos</h1><div style={{ fontSize: 12.5, color: '#7B8497' }}>Movilidad, combustible, inmuebles y otros gastos del negocio.</div></div>
          </div>
          <div className="cx-tabs">
            <button type="button" className={`cx-tab ${tab === 'lista' ? 'on' : ''}`} onClick={() => { setEditing(null); setTab('lista'); }}>Gastos diversos</button>
            <button type="button" className={`cx-tab ${tab === 'nuevo' ? 'on' : ''}`} onClick={() => { setFlash(''); setEditing(null); setTab('nuevo'); }}><Plus size={14} /> Nuevo gasto</button>
          </div>
        </div>
      </div>
      {tab === 'nuevo' ? <NewExpense key={editing ? editing.id : 'nuevo'} editing={editing} onCancel={() => { setEditing(null); setTab('lista'); }} onDone={(m) => { setFlash(m); setEditing(null); setTab('lista'); }} /> : <ExpenseList isAdmin={user?.rol === 'admin'} flash={flash} onEdit={(g) => { setFlash(''); setEditing(g); setTab('nuevo'); }} />}
    </div>
  );
}

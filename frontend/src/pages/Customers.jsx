import React, { useState, useEffect } from 'react';
import { UserRoundCheck, Pencil, Trash2, Plus, X, CheckCircle2, XCircle } from 'lucide-react';
import { customersAPI, customerTypesAPI } from '../api';
import PartyManager from '../components/PartyManager';
import '../components/party.css';

const whatsapp = (c) => {
  const phone = (c.telefono || '').replace(/[^0-9]/g, '');
  if (!phone) return;
  const msg = c.fecha_especial
    ? `¡Hola ${c.nombre}! Te saludamos de Genia Creativa 🎁. Recordamos que se acerca una fecha muy especial: "${c.tipo_fecha_especial || 'Aniversario / Cumpleaños'}". ¿Deseas que preparemos con anticipación un regalo mágico para sorprender a esa persona querida? ✨`
    : `¡Hola ${c.nombre}! Te saludamos de Genia Creativa 🎁. ¿Te ayudamos a elegir un detalle especial? ✨`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

function CustomerTypes({ isAdmin, types, reload }) {
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (modal.id) await customerTypesAPI.update(modal.id, modal);
      else await customerTypesAPI.create(modal);
      setModal(null);
      reload();
    } catch (ex) { setErr(ex.message); }
  };
  const remove = async (t) => {
    if (!window.confirm(`¿Eliminar el tipo "${t.nombre}"?`)) return;
    try { await customerTypesAPI.delete(t.id); setMsg(''); reload(); } catch (ex) { setMsg(ex.message); }
  };

  return (
    <div className="pm">
      <div className="pm-card pm-head">
        <div className="pm-head-l">
          <UserRoundCheck size={38} color="#FF7A3C" strokeWidth={1.7} />
          <div>
            <h2>Tipos de cliente</h2>
            <p>Clasifica a tus clientes (Minorista, Mayorista, Corporativo…)</p>
          </div>
        </div>
        {isAdmin && (
          <button className="pm-btn-green" onClick={() => { setErr(''); setModal({ nombre: '', descripcion: '', estado: 1 }); }}>
            <Plus size={20} /> Crear tipo
          </button>
        )}
      </div>

      <div className="pm-card">
        {!isAdmin && <div className="pm-hint" style={{ margin: 16, background: '#F3F5FA', color: '#475569' }}>Solo un administrador puede crear, editar o eliminar tipos de cliente.</div>}
        {msg && <div className="pm-err" style={{ margin: '16px 20px 0' }}>{msg}</div>}
        <div className="pm-table-wrap" style={{ paddingTop: 12 }}>
          <table className="pm-table" style={{ minWidth: 520 }}>
            <thead>
              <tr><th style={{ width: 44 }}>N°</th><th>Nombre</th><th>Descripción</th><th>Clientes</th><th>Estado</th>{isAdmin && <th style={{ width: 90 }} />}</tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td><span className="pm-tag">{t.nombre}</span></td>
                  <td>{t.descripcion || ''}</td>
                  <td>{t.total_clientes}</td>
                  <td>{t.estado
                    ? <span className="pm-state on"><CheckCircle2 size={16} /> ACTIVO</span>
                    : <span className="pm-state off"><XCircle size={16} /> INACTIVO</span>}</td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="pm-icon-btn" title="Editar" onClick={() => { setErr(''); setModal({ ...t }); }}><Pencil size={16} /></button>
                      <button className="pm-icon-btn" title="Eliminar" onClick={() => remove(t)}><Trash2 size={16} color="#E0245E" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {types.length === 0 && <div className="pm-empty">AÚN NO HAY TIPOS DE CLIENTE</div>}
        </div>
      </div>

      {modal && (
        <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <form className="pm-modal" style={{ maxWidth: 460 }} onSubmit={save}>
            <button type="button" className="pm-close" onClick={() => setModal(null)} aria-label="Cerrar"><X size={20} /></button>
            <h3>{modal.id ? 'Editar tipo' : 'Nuevo tipo'}</h3>
            <p className="sub">Tipo de cliente</p>
            {err && <div className="pm-err">{err}</div>}
            <div className="pm-f"><label>Nombre *</label>
              <input className="pm-in" required value={modal.nombre} onChange={(e) => setModal({ ...modal, nombre: e.target.value })} placeholder="Ej. Mayorista" /></div>
            <div className="pm-f"><label>Descripción</label>
              <input className="pm-in" value={modal.descripcion || ''} onChange={(e) => setModal({ ...modal, descripcion: e.target.value })} placeholder="Opcional" /></div>
            <div className="pm-row pm-f" style={{ alignItems: 'center' }}>
              <label style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Estado</label>
              <select className="pm-in" style={{ width: 150 }} value={modal.estado ? 1 : 0} onChange={(e) => setModal({ ...modal, estado: Number(e.target.value) })}>
                <option value={1}>Activo</option><option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="pm-foot">
              <button type="button" className="c" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="s">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Customers({ user, initialTab = 'clientes' }) {
  const [tab, setTab] = useState(initialTab);
  const [types, setTypes] = useState([]);
  const isAdmin = user?.rol === 'admin';

  const loadTypes = async () => {
    try { const r = await customerTypesAPI.getAll(); if (r.success) setTypes(r.types); } catch (e) { /* se reintenta al abrir */ }
  };
  useEffect(() => { loadTypes(); }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const cfg = {
    api: customersAPI,
    listKey: 'customers',
    singular: 'cliente', Singular: 'Cliente', plural: 'clientes', Plural: 'Clientes',
    Icon: UserRoundCheck,
    defaultDoc: 'DNI',
    useTypes: true,
    whatsapp,
    emptyHint: 'Registra a tu primer cliente para empezar a cuidar sus fechas especiales.',
    extraFields: [
      { col: 'tipo_fecha_especial', label: 'Ocasión o fecha especial', placeholder: 'Ej. Cumpleaños de novia', optional: true },
      { col: 'fecha_especial', label: 'Día de la fecha especial', type: 'date', optional: true },
      { col: 'notas', label: 'Notas o preferencias de regalo', type: 'textarea', placeholder: 'Ej. Prefiere arreglos con chocolates y globos pastel', optional: true }
    ],
    extraCols: [
      { id: 'tipo_cliente', label: 'Tipo de cliente', render: (r) => (r.tipo_cliente_nombre ? <span className="pm-tag">{r.tipo_cliente_nombre}</span> : '') },
      { id: 'total_pedidos', label: 'Pedidos', render: (r) => r.total_pedidos || 0 },
      { id: 'total_gastado', label: 'Total comprado', render: (r) => `S/ ${Number(r.total_gastado || 0).toFixed(2)}` },
      { id: 'fecha_especial', label: 'Fecha especial', render: (r) => (r.fecha_especial ? `${r.tipo_fecha_especial || ''} ${String(r.fecha_especial).slice(0, 10)}`.trim() : '') }
    ]
  };

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-tabs">
          <button className={tab === 'clientes' ? 'on' : ''} onClick={() => setTab('clientes')}>Clientes</button>
          <button className={tab === 'tipos' ? 'on' : ''} onClick={() => setTab('tipos')}>Tipo de cliente</button>
        </div>
        {tab === 'clientes'
          ? <PartyManager cfg={cfg} isAdmin={isAdmin} types={types} />
          : <CustomerTypes isAdmin={isAdmin} types={types} reload={loadTypes} />}
      </div>
    </div>
  );
}

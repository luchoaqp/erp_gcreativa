import React, { useState, useEffect, useCallback } from 'react';
import { Send, Search, Truck, Camera, CheckCircle2, Clock } from 'lucide-react';
import { shippingAPI, settingsAPI } from '../api';
import ShippingModal from '../components/ShippingModal';
import { AgenciesTab, CouriersTab } from '../components/AgenciesManager';
import '../components/party.css';

const fmt = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '—');
const ESTADOS = { pendiente_diseno: 'Pendiente de diseño', pendiente_aprobacion: 'Pendiente de aprobación', en_produccion: 'En producción', listo_despacho: 'Listo para despacho', en_ruta: 'En ruta', entregado: 'Entregado' };

export default function Shipments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [guia, setGuia] = useState('todos');
  const [store, setStore] = useState({});
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('envios');
  const [couriers, setCouriers] = useState([]);
  const loadCouriers = useCallback(() => shippingAPI.couriers().then((r) => setCouriers(r.couriers || [])).catch(() => {}), []);
  useEffect(() => { loadCouriers(); }, [loadCouriers]);
  const totalAgencias = couriers.reduce((a, c) => a + Number(c.agencias || 0), 0);

  useEffect(() => { settingsAPI.get().then((r) => setStore(r.settings || {})).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      if (guia !== 'todos') q.set('guia', guia);
      const r = await shippingAPI.list(`?${q.toString()}`);
      setRows(r.envios || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [search, guia]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const sinGuia = rows.filter((r) => !r.tiene_foto).length;

  return (
    <div className="content-body animate-fade-in">
      <div className="pm">
        <div className="pm-card pm-head">
          <div className="pm-head-l">
            <Send size={38} color="#FF7A3C" strokeWidth={1.7} />
            <div><h2>Envíos</h2><p>Pedidos para envío: datos del destinatario, rótulo y foto de la guía</p></div>
          </div>
          <div className="pm-tabs" style={{ margin: 0 }}>
            <button className={tab === 'envios' ? 'on' : ''} onClick={() => setTab('envios')}>Envíos {sinGuia > 0 && <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{sinGuia}</span>}</button>
            <button className={tab === 'agencias' ? 'on' : ''} onClick={() => setTab('agencias')}>Agencias <span style={{ opacity: 0.8, marginLeft: 4 }}>{totalAgencias}</span></button>
            <button className={tab === 'couriers' ? 'on' : ''} onClick={() => setTab('couriers')}>Couriers <span style={{ opacity: 0.8, marginLeft: 4 }}>{couriers.length}</span></button>
          </div>
        </div>

        {tab === 'agencias' && <AgenciesTab couriers={couriers.filter((c) => c.estado)} onChanged={loadCouriers} />}
        {tab === 'couriers' && <CouriersTab couriers={couriers} onChanged={loadCouriers} />}

        {tab === 'envios' && <div className="pm-card" style={{ paddingBottom: 6 }}>
          <div className="pm-toolbar">
            <div className="pm-search" style={{ marginLeft: 0, flex: '1 1 260px' }}>
              <input placeholder="Buscar por pedido, cliente, destino, destinatario o N° de guía…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" aria-label="Buscar"><Search size={18} /></button>
            </div>
            <div className="pm-tabs" style={{ margin: 0 }}>
              {[['todos', 'Todos'], ['sin', 'Sin guía'], ['con', 'Con guía']].map(([id, l]) => <button key={id} className={guia === id ? 'on' : ''} onClick={() => setGuia(id)}>{l}</button>)}
            </div>
          </div>
          {err && <div className="pm-err" style={{ margin: '0 20px' }}>{err}</div>}
          <div className="pm-table-wrap" style={{ minHeight: 160 }}>
            <table className="pm-table">
              <thead><tr><th>#</th><th>Pedido</th><th>Cliente</th><th>Origen → Destino</th><th>Destinatario</th><th>Entrega</th><th>Estado</th><th>Guía</th><th style={{ width: 120 }} /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{r.numero_pedido}</td>
                    <td>{r.cliente_nombre}</td>
                    <td>{r.envio_origen || 'Arequipa'} → {r.envio_destino || r.ciudad_envio || '—'}</td>
                    <td>{r.envio_dest_nombre ? (<>{r.envio_dest_nombre}<span className="pm-extra">{[r.envio_dest_doc, r.envio_dest_telefono].filter(Boolean).join(' · ')}</span></>) : <span style={{ color: '#B45309', fontWeight: 600 }}>Sin datos</span>}</td>
                    <td>{fmt(r.fecha_entrega)}</td>
                    <td>{ESTADOS[r.estado_pedido] || r.estado_pedido}</td>
                    <td>{r.tiene_foto
                      ? <span className="pm-state on"><CheckCircle2 size={16} /> {r.guia_numero || 'Foto cargada'}</span>
                      : <span className="pm-state" style={{ color: '#B45309' }}><Clock size={16} /> Pendiente</span>}</td>
                    <td><button className="pm-btn-outline" style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => setSel(r)}><Camera size={14} /> Gestionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <div className="pm-empty"><Truck size={40} />NO HAY PEDIDOS PARA ENVÍO</div>}
            {loading && <div className="pm-empty">Cargando…</div>}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#788A9B', fontWeight: 600 }}>{rows.length} envío(s)</div>
        </div>}
      </div>
      {sel && <ShippingModal order={sel} store={store} onClose={() => setSel(null)} onSaved={load} />}
    </div>
  );
}

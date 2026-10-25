import React, { useState, useEffect } from 'react';
import { UserPlus, X, ChevronDown } from 'lucide-react';
import { purchasesAPI } from '../api';
import './compras.css';

export const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const today = () => new Date().toLocaleDateString('en-CA');
export const fmtDMY = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const sym = (moneda) => (moneda === 'USD' ? '$' : 'S/');

export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div className="cx-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cx-modal" style={{ maxWidth: width }}>
        <button type="button" className="x" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function NewSupplierModal({ onClose, onCreated }) {
  const [f, setF] = useState({ tipo_documento: 'RUC', numero_documento: '', nombre: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr('');
    if (!f.nombre.trim()) { setErr('Escribe el nombre o razón social'); return; }
    try { setBusy(true); const r = await purchasesAPI.quickSupplier(f); if (r.success) onCreated(r.supplier); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Nuevo proveedor" onClose={onClose} width={460}>
      {err && <div className="cx-err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="cx-grid2">
        <div className="cx-f"><label className="cx-lab">Tipo de documento</label>
          <select className="cx-in" value={f.tipo_documento} onChange={(e) => setF({ ...f, tipo_documento: e.target.value, numero_documento: '' })}><option>RUC</option><option>DNI</option></select></div>
        <div className="cx-f"><label className="cx-lab">Número</label>
          <input className="cx-in" inputMode="numeric" maxLength={f.tipo_documento === 'RUC' ? 11 : 8} value={f.numero_documento} onChange={(e) => setF({ ...f, numero_documento: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <div className="cx-f" style={{ marginTop: 14 }}><label className="cx-lab">Nombre o razón social <i>*</i></label>
        <input className="cx-in" maxLength={120} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
      <div className="cx-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="cx-btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="cx-btn-main" disabled={busy} onClick={go}>{busy ? 'Guardando…' : 'Crear proveedor'}</button>
      </div>
    </Modal>
  );
}

// Selector de proveedor con búsqueda por RUC o nombre y botón "Nuevo proveedor"
export function ProviderPicker({ value, onChange, required = true, allowVarios = false }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => { purchasesAPI.searchSuppliers(q.trim()).then((r) => setList(r.suppliers || [])).catch(() => setList([])); }, 200);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <div className="cx-f">
      <div className="cx-row" style={{ marginBottom: 6 }}>
        <label className="cx-lab" style={{ margin: 0 }}>Proveedor{required && <i> *</i>}</label>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {allowVarios && <button type="button" className="cx-btn-soft" style={{ padding: '5px 12px' }} onClick={() => onChange({ id: null, nombre: 'PROVEEDORES VARIOS', varios: true })}>Proveedores varios</button>}
          <button type="button" className="cx-btn-soft" style={{ padding: '5px 12px' }} onClick={() => setShowNew(true)}><UserPlus size={14} /> Nuevo proveedor</button>
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        {value ? (
          <div className="cx-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.nombre}{value.numero_documento ? ` · ${value.numero_documento}` : ''}</span>
            <button type="button" aria-label="Quitar" onClick={() => { onChange(null); setQ(''); }} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#7B8497', display: 'flex' }}><X size={16} /></button>
          </div>
        ) : (
          <>
            <input className="cx-in" placeholder="Busca por RUC o nombre" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 180)} />
            <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: 12, color: '#7B8497', pointerEvents: 'none' }} />
            {open && list.length > 0 && (
              <div className="cx-suggest">
                {list.map((p) => (
                  <button type="button" key={p.id} onMouseDown={() => { onChange(p); setOpen(false); }}>
                    {p.nombre}<small>{p.tipo_documento} {p.numero_documento || 'sin documento'} · {p.codigo}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {showNew && <NewSupplierModal onClose={() => setShowNew(false)} onCreated={(s) => { setShowNew(false); onChange(s); }} />}
    </div>
  );
}

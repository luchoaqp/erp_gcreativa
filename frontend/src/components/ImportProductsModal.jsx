import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { productsAPI } from '../api';

const toBase64 = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
  fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
  fr.readAsDataURL(file);
});
const money = (n) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportProductsModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [b64, setB64] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inp = useRef(null);

  const pick = async (f) => {
    if (!f) return;
    setErr(''); setRes(null); setFile(f);
    if (!/\.xlsx$/i.test(f.name)) { setErr('Usa un archivo de Excel .xlsx (si tienes .xls o .csv, ábrelo en Excel y guárdalo como .xlsx).'); setB64(''); return; }
    try {
      const data = await toBase64(f); setB64(data);
      setBusy(true);
      setRes(await productsAPI.importExcel(data, true));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const confirmar = async () => {
    setBusy(true); setErr('');
    try {
      const r = await productsAPI.importExcel(b64, false);
      if (r.guardado) onDone(r); else setRes(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const rs = res?.resumen;
  const nuevos = rs ? [['categorías', rs.categorias_nuevas], ['ocasiones', rs.ocasiones_nuevas], ['marcas', rs.marcas_nuevas]].filter(([, l]) => l.length) : [];

  return (
    <div className="pm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="pm-modal" style={{ maxWidth: 760 }}>
        <button className="pm-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <h3>Importar productos desde Excel</h3>
        <div className="sub">Carga masiva con precios por cantidad y packs. Primero se revisa el archivo; no se guarda nada hasta que confirmes.</div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="pm-btn-outline" onClick={() => productsAPI.downloadExcel('plantilla', 'plantilla_productos.xlsx').catch((e) => setErr(e.message))}><Download size={15} /> Descargar plantilla</button>
          <button className="pm-btn-outline" onClick={() => productsAPI.downloadExcel('exportar', 'productos.xlsx').catch((e) => setErr(e.message))}><FileSpreadsheet size={15} /> Exportar productos actuales</button>
        </div>

        <div onClick={() => inp.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          style={{ border: '2px dashed #9CA3AF', borderRadius: 12, padding: '22px 14px', textAlign: 'center', cursor: 'pointer', background: '#F9FAFB' }}>
          <Upload size={26} color="#2F8F6B" />
          <div style={{ fontWeight: 700, marginTop: 6 }}>{file ? file.name : 'Toca aquí para elegir tu archivo .xlsx'}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>o arrástralo y suéltalo</div>
          <input ref={inp} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {busy && <div style={{ marginTop: 14, color: '#6B7280' }}>Procesando…</div>}
        {err && <div className="pm-err" style={{ marginTop: 12 }}>{err}</div>}

        {res && !busy && (
          <div style={{ marginTop: 16 }}>
            {res.errores.length === 0 ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#15803D', fontWeight: 700 }}><CheckCircle2 size={18} /> Archivo correcto: {rs.creados} por crear, {rs.actualizados} por actualizar{rs.packs ? ` (${rs.packs} pack/s)` : ''}{rs.escalas ? `, ${rs.escalas} precio(s) por cantidad` : ''}.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#B91C1C', fontWeight: 700 }}><AlertTriangle size={18} /> {res.errores.length} error(es). Corrige el archivo y vuelve a subirlo; no se guardó nada.</div>
            )}
            {nuevos.length > 0 && res.errores.length === 0 && (
              <div style={{ fontSize: 12.5, color: '#374151', marginTop: 8 }}>
                Se crearán automáticamente: {nuevos.map(([n, l]) => `${l.length} ${n} (${l.slice(0, 6).join(', ')}${l.length > 6 ? '…' : ''})`).join(' · ')}.
              </div>
            )}
            {res.errores.length > 0 && (
              <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 10, border: '1px solid #FECACA', borderRadius: 10 }}>
                <table className="pm-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Hoja</th><th>Fila</th><th>Código</th><th>Problema</th></tr></thead>
                  <tbody>{res.errores.map((e, i) => (<tr key={i}><td>{e.hoja}</td><td>{e.fila}</td><td>{e.codigo}</td><td>{e.mensaje}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            {res.errores.length === 0 && res.vista.length > 0 && (
              <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 10, border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <table className="pm-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>Fila</th><th>Acción</th><th>Código</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Escalas</th></tr></thead>
                  <tbody>{res.vista.map((v) => (
                    <tr key={v.fila}><td>{v.fila}</td><td>{v.accion}{v.tipo === 'PACK' ? ' · pack' : ''}</td><td>{v.codigo}</td><td>{v.nombre}</td><td>S/ {money(v.precio)}</td><td>{v.stock}</td><td>{v.escalas || '—'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="pm-btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="pm-btn-green" disabled={busy || !res || res.errores.length > 0 || (res.resumen.creados + res.resumen.actualizados === 0)} onClick={confirmar}>
            Confirmar e importar
          </button>
        </div>
      </div>
    </div>
  );
}

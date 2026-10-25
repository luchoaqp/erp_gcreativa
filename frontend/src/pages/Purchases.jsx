import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart, MoreVertical, Search, Plus, ArrowLeft, Building2, FileText, Package, Trash2, Columns3,
  PenLine, FileSpreadsheet, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Settings2, Receipt, RefreshCw, Calendar, X
} from 'lucide-react';
import { purchasesAPI, productsAPI, quotesAPI } from '../api';
import FloatingMenu from '../components/FloatingMenu';
import { ProviderPicker, Modal, money, r2, today, fmtDMY, sym } from '../components/CompraUI';
import { openHtmlWindow } from '../utils/docPrint';
import '../components/compras.css';

const TIPOS = [
  { v: 'sin_comprobante', l: 'SIN COMPROBANTE', s: 'Sin comprobante' }, { v: 'factura', l: 'FACTURA ELECTRÓNICA', s: 'Factura' },
  { v: 'boleta', l: 'BOLETA DE VENTA', s: 'Boleta' }, { v: 'nota_venta', l: 'NOTA DE VENTA', s: 'Nota de venta' }
];
const TIPO_SHORT = Object.fromEntries(TIPOS.map((t) => [t.v, t.s]));
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));
const MOTIVOS = [
  { v: 'abastecimiento', l: 'COMPRA POR ABASTECIMIENTO' }, { v: 'regular', l: 'COMPRA REGULAR' },
  { v: 'extraordinaria', l: 'COMPRA EXTRAORDINARIA' }
];
const AFECT = [{ v: 'gravado', l: 'Gravado' }, { v: 'exonerado', l: 'Exonerado' }, { v: 'inafecto', l: 'Inafecto' }];
const defaultAfect = (tipo) => (tipo === 'factura' || tipo === 'boleta' ? 'gravado' : 'inafecto');
const fmtDT = (v) => { if (!v) return ''; const s = String(v).replace('T', ' '); return `${fmtDMY(s)} ${s.slice(11, 16)}`; };
let lineSeq = 0;

/* ======================= NUEVA COMPRA ======================= */
function NewPurchase({ onDone, onBack }) {
  const [prov, setProv] = useState(null);
  const [tipo, setTipo] = useState('factura');
  const [serie, setSerie] = useState('');
  const [correlativo, setCorrelativo] = useState('');
  const [fecha, setFecha] = useState(today());
  const [venc, setVenc] = useState(today());
  const [moneda, setMoneda] = useState('PEN');
  const [tc, setTc] = useState(() => { try { return localStorage.getItem('compras_tc') || ''; } catch (e) { return ''; } });
  const [motivo, setMotivo] = useState('abastecimiento');
  const [noSumar, setNoSumar] = useState(false);
  const [actCosto, setActCosto] = useState(true);
  const [extra, setExtra] = useState({ referencia: '', guia_remision: '' });
  const [obs, setObs] = useState('');
  const [lines, setLines] = useState([]);
  const [dg, setDg] = useState('');
  const [pct, setPct] = useState(18);
  const [saving, setSaving] = useState(false);
  const [regMenu, setRegMenu] = useState(false);
  const [err, setErr] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [prodQuery, setProdQuery] = useState('');
  const [prodList, setProdList] = useState([]);
  const [colMenu, setColMenu] = useState(false);
  const fileRef = useRef(null);
  const [hiddenCols, setHiddenCols] = useState(() => { try { return JSON.parse(localStorage.getItem('compras_cols_ocultas')) || ['codigo', 'igv', 'descuento']; } catch (e) { return ['codigo', 'igv', 'descuento']; } });
  const showCol = (id) => !hiddenCols.includes(id);
  const toggleCol = (id) => {
    const next = hiddenCols.includes(id) ? hiddenCols.filter((x) => x !== id) : [...hiddenCols, id];
    setHiddenCols(next);
    try { localStorage.setItem('compras_cols_ocultas', JSON.stringify(next)); } catch (e) { /* sin guardado */ }
  };
  const ms = sym(moneda);

  useEffect(() => { quotesAPI.getConfig().then((r) => { const n = Number(r?.config?.igv_porcentaje); if (n > 0) setPct(n); }).catch(() => {}); }, []);
  useEffect(() => {
    if (prodQuery.trim().length < 2) { setProdList([]); return undefined; }
    const t = setTimeout(() => { productsAPI.getAll(`?search=${encodeURIComponent(prodQuery.trim())}`).then((r) => setProdList((r.products || []).slice(0, 12))).catch(() => setProdList([])); }, 250);
    return () => clearTimeout(t);
  }, [prodQuery]);

  const changeTipo = (v) => { setTipo(v); setLines((ls) => ls.map((l) => ({ ...l, afectacion: defaultAfect(v) }))); };
  const addProduct = (p) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.producto_id === p.id);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, cantidad: Number(l.cantidad) + 1 } : l));
      return [...ls, { key: ++lineSeq, producto_id: p.id, nombre: p.nombre, codigo: p.codigo || '', cantidad: 1, precio_base: Number(p.precio_costo) || 0, costo_previo: Number(p.precio_costo) || 0, precio_venta: Number(p.precio_venta) || 0, afectacion: defaultAfect(tipo), descuento: 0 }];
    });
    setProdQuery(''); setProdList([]);
  };
  const addManual = () => setLines((ls) => [...ls, { key: ++lineSeq, producto_id: null, nombre: '', codigo: '', cantidad: 1, precio_base: 0, afectacion: defaultAfect(tipo), descuento: 0 }]);
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Importar desde CSV (guardado desde Excel): columnas código, nombre, cantidad, precio
  const importCsv = async (file) => {
    if (!file) return;
    setErr('');
    try {
      const text = (await file.text()).replace(/^﻿/, '');
      const rows = text.split(/\r?\n/).filter((r) => r.trim());
      if (rows.length < 2) throw new Error('El archivo no tiene filas para importar.');
      const sep = rows[0].includes(';') ? ';' : ',';
      const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const head = rows[0].split(sep).map(norm);
      const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
      const iNom = idx(['nombre', 'producto', 'descripcion', 'item']); const iCan = idx(['cantidad', 'cant']);
      const iPre = idx(['precio', 'costo']); const iCod = idx(['codigo', 'cod']);
      if (iNom < 0 || iCan < 0 || iPre < 0) throw new Error('El archivo debe tener columnas: nombre, cantidad y precio (y opcionalmente código).');
      const nuevas = [];
      for (const r of rows.slice(1)) {
        const c = r.split(sep).map((x) => x.replace(/^"|"$/g, '').trim());
        const cantidad = Number(String(c[iCan]).replace(',', '.')); const precio = Number(String(c[iPre]).replace(',', '.'));
        if (!c[iNom] || !(cantidad > 0)) continue;
        let prod = null;
        const codigo = iCod >= 0 ? c[iCod] : '';
        if (codigo) {
          try { const res = await productsAPI.getAll(`?search=${encodeURIComponent(codigo)}`); prod = (res.products || []).find((p) => String(p.codigo).toLowerCase() === codigo.toLowerCase()) || null; } catch (e) { /* manual */ }
        }
        nuevas.push({ key: ++lineSeq, producto_id: prod ? prod.id : null, nombre: prod ? prod.nombre : c[iNom], codigo: prod ? (prod.codigo || '') : codigo, cantidad, precio_base: precio >= 0 ? precio : 0, costo_previo: prod ? Number(prod.precio_costo) || 0 : 0, precio_venta: prod ? Number(prod.precio_venta) || 0 : 0, afectacion: defaultAfect(tipo), descuento: 0 });
      }
      if (!nuevas.length) throw new Error('No se encontraron filas válidas.');
      setLines((ls) => [...ls, ...nuevas]);
    } catch (e) { setErr(e.message); }
  };

  const calc = useMemo(() => {
    const rows = lines.map((l) => {
      const neto = r2(Math.max(0, (Number(l.cantidad) || 0) * (Number(l.precio_base) || 0) - (Number(l.descuento) || 0)));
      const igv = l.afectacion === 'gravado' ? r2(neto * pct / 100) : 0;
      return { ...l, neto, igv, total: r2(neto + igv) };
    });
    const bruto = r2(rows.reduce((a, l) => a + l.neto, 0));
    const d = r2(Math.min(Math.max(0, Number(dg) || 0), bruto));
    const factor = bruto > 0 ? (bruto - d) / bruto : 1;
    const subtotal = r2(bruto - d);
    const igv = r2(rows.reduce((a, l) => a + l.igv, 0) * factor);
    return { rows, subtotal, igv, total: r2(subtotal + igv), d };
  }, [lines, dg, pct]);

  const reset = () => {
    setProv(null); setTipo('factura'); setSerie(''); setCorrelativo(''); setFecha(today()); setVenc(today()); setMotivo('abastecimiento');
    setNoSumar(false); setExtra({ referencia: '', guia_remision: '' }); setObs(''); setLines([]); setDg(''); setErr('');
  };

  const save = async (condicion) => {
    setRegMenu(false); setErr('');
    const fail = (m) => { setErr(m); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (!prov) return fail('Elige el proveedor (o créalo con “Nuevo proveedor”).');
    if (!lines.length) return fail('Agrega al menos un producto a la compra.');
    if (lines.find((l) => !String(l.nombre).trim())) return fail('Todos los ítems deben tener nombre.');
    const mala = lines.find((l) => !(Number(l.cantidad) > 0));
    if (mala) return fail(`La cantidad de "${mala.nombre}" debe ser mayor a 0.`);
    if (tipo !== 'sin_comprobante' && (!serie.trim() || !correlativo.trim())) return fail('Ingresa la serie y el número del comprobante.');
    if (moneda === 'USD' && !(Number(tc) > 0)) return fail('Ingresa el tipo de cambio para la compra en dólares.');
    const gratis = lines.filter((l) => !(Number(l.precio_base) > 0));
    if (gratis.length && !window.confirm(`${gratis.length} ítem(s) tienen precio 0 (${gratis.map((g) => g.nombre).slice(0, 3).join(', ')}). ¿Registrar de todas formas?`)) return;
    setSaving(true);
    try {
      if (moneda === 'USD') { try { localStorage.setItem('compras_tc', String(tc)); } catch (e) { /* sin guardado */ } }
      const r = await purchasesAPI.create({
        tipo_comprobante: tipo, serie, correlativo, fecha_emision: fecha, fecha_vencimiento: venc || null, ingreso_almacen: !noSumar, almacen: 'ALMACÉN PRINCIPAL', motivo,
        proveedor_id: prov.id, proveedor_nombre: prov.nombre, observaciones: obs, actualizar_costo: actCosto, ...extra,
        descuento_global: Number(dg) || 0, condicion_pago: condicion, moneda, tipo_cambio: moneda === 'USD' ? Number(tc) : null,
        items: lines.map((l) => ({ producto_id: l.producto_id, codigo: l.codigo, nombre: l.nombre, cantidad: Number(l.cantidad), precio_base: Number(l.precio_base), afectacion: l.afectacion, descuento: Number(l.descuento) || 0, lote: (l.lote || '').trim() }))
      });
      reset();
      onDone(`Compra ${r.codigo} registrada${noSumar ? '' : ' y stock actualizado'}.`);
    } catch (e) { fail(e.message); } finally { setSaving(false); }
  };

  const cols = [{ id: 'codigo', label: 'Código' }, { id: 'afectacion', label: 'Tipo de afectación' }, { id: 'igv', label: 'IGV' }, { id: 'precio_final', label: 'Precio final' }, { id: 'descuento', label: 'Descuento' }];
  const sinComp = tipo === 'sin_comprobante';

  return (
    <div className="cx">
      <div className="cx-head">
        <button type="button" className="cx-back" onClick={onBack} aria-label="Volver" title="Volver al listado"><ArrowLeft size={18} /></button>
        <h1>Nueva compra</h1>
      </div>
      {err && <div className="cx-err">{err}</div>}

      <div className="cx-card cx-split">
        <div>
          <div className="cx-title"><Building2 size={18} /> Proveedor</div>
          <ProviderPicker value={prov} onChange={setProv} />
          <div className="cx-f">
            <label className="cx-lab">Motivo de compra</label>
            <select className="cx-in" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select>
          </div>
          <div className="cx-opt">
            <div><strong>No sumar stock</strong><small>La compra se registra, pero el inventario no cambia.</small></div>
            <button type="button" className={`cx-switch ${noSumar ? 'on' : ''}`} aria-pressed={noSumar} aria-label="No sumar stock" onClick={() => setNoSumar((v) => !v)} />
          </div>
          <div className="cx-f" style={{ marginBottom: 0 }}>
            <label className="cx-lab">Observaciones</label>
            <textarea className="cx-in" rows={3} maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="cx-title"><FileText size={18} /> Comprobante del proveedor</div>
          <div className="cx-f">
            <label className="cx-lab">Tipo de comprobante</label>
            <select className="cx-in" value={tipo} onChange={(e) => changeTipo(e.target.value)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          </div>
          <div className="cx-grid2">
            <div className="cx-f"><label className="cx-lab">Serie{!sinComp && <i> *</i>}</label>
              <input className="cx-in tint" disabled={sinComp} placeholder="F001" maxLength={10} value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} /></div>
            <div className="cx-f"><label className="cx-lab">Número{!sinComp && <i> *</i>}</label>
              <input className="cx-in tint" disabled={sinComp} placeholder="1234" maxLength={20} value={correlativo} onChange={(e) => setCorrelativo(e.target.value.replace(/\s/g, ''))} /></div>
          </div>
          <div className="cx-grid2">
            <div className="cx-f"><label className="cx-lab">Emisión <i>*</i></label><input type="date" className="cx-in tint" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            <div className="cx-f"><label className="cx-lab">Vencimiento</label><input type="date" className="cx-in tint" value={venc} min={fecha} onChange={(e) => setVenc(e.target.value)} /></div>
          </div>
          <div className="cx-grid2">
            <div className="cx-f"><label className="cx-lab">Moneda</label>
              <select className="cx-in" value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="PEN">Soles</option><option value="USD">Dólares americanos</option></select></div>
            <div className="cx-f"><label className="cx-lab">T. cambio{moneda === 'USD' && <i> *</i>}</label>
              <div style={{ position: 'relative' }}><RefreshCw size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#7C3AED' }} />
                <input className="cx-in tint" style={{ paddingLeft: 34 }} disabled={moneda !== 'USD'} type="number" step="0.001" min="0" placeholder="3.430" value={tc} onChange={(e) => setTc(e.target.value)} /></div></div>
          </div>
        </div>
      </div>

      <div className="cx-card cx-pad">
        <div className="cx-row" style={{ marginBottom: 14 }}>
          <div className="cx-title" style={{ margin: 0 }}>Productos</div>
          <div style={{ position: 'relative' }}>
            <button type="button" className="cx-btn-ghost" style={{ padding: '7px 14px', borderRadius: 999 }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColMenu((v) => (v ? false : r)); }}><Columns3 size={15} /> Columnas</button>
            {colMenu && (
              <FloatingMenu anchor={colMenu} onClose={() => setColMenu(false)} keepOpen width={230}>
                {cols.map((c) => <label key={c.id}><input type="checkbox" checked={showCol(c.id)} onChange={() => toggleCol(c.id)} /> {c.label}</label>)}
              </FloatingMenu>
            )}
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="cx-empty">Aún no hay productos en la compra.</div>
        ) : (
          <div className="cx-table-wrap">
            <table className="cx-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>N°</th><th style={{ width: 90 }}>Cantidad</th><th>Nombre de ítem</th><th style={{ width: 130 }} title="Número de lote que indica el proveedor (opcional). Cada compra crea un lote para controlar costo y stock por proveedor.">Lote del proveedor</th>
                  {showCol('codigo') && <th>Código</th>}
                  {showCol('afectacion') && <th>Afectación</th>}
                  <th style={{ width: 120 }}>Precio base ({ms})</th>
                  {showCol('igv') && <th>IGV</th>}
                  {showCol('precio_final') && <th>Precio final</th>}
                  {showCol('descuento') && <th>Descuento</th>}
                  <th className="r">Total ({ms})</th><th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {calc.rows.map((l, i) => {
                  const nuevo = Number(l.precio_base) || 0; const prev = Number(l.costo_previo) || 0; const pv = Number(l.precio_venta) || 0;
                  const dif = prev > 0 ? ((nuevo - prev) / prev) * 100 : 0;
                  return (
                    <tr key={l.key}>
                      <td>{i + 1}</td>
                      <td><input type="number" min="0.01" step="any" value={l.cantidad} onChange={(e) => setLine(l.key, { cantidad: e.target.value })} /></td>
                      <td>{l.producto_id ? l.nombre : <input value={l.nombre} placeholder="Nombre del ítem" onChange={(e) => setLine(l.key, { nombre: e.target.value })} />}
                        {l.producto_id && moneda === 'PEN' && (
                          <small style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {prev > 0 && Math.abs(dif) >= 0.5 && <span style={{ color: dif > 0 ? '#B45309' : '#15803d', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{dif > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} costo {dif > 0 ? '+' : ''}{dif.toFixed(1)}% vs. último (S/ {money(prev)})</span>}
                            {pv > 0 && nuevo > 0 && (nuevo >= pv ? <span style={{ color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={12} /> costo ≥ precio de venta</span> : <span>margen {(((pv - nuevo) / pv) * 100).toFixed(0)}%</span>)}
                          </small>
                        )}
                      </td>
                      <td><input value={l.lote || ''} placeholder={l.producto_id ? 'Opcional' : '—'} disabled={!l.producto_id} onChange={(e) => setLine(l.key, { lote: e.target.value })} /></td>
                      {showCol('codigo') && <td>{l.producto_id ? (l.codigo || '—') : <input value={l.codigo} onChange={(e) => setLine(l.key, { codigo: e.target.value })} />}</td>}
                      {showCol('afectacion') && <td><select value={l.afectacion} onChange={(e) => setLine(l.key, { afectacion: e.target.value })}>{AFECT.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></td>}
                      <td><input type="number" min="0" step="0.01" value={l.precio_base} onChange={(e) => setLine(l.key, { precio_base: e.target.value })} /></td>
                      {showCol('igv') && <td>{money(l.igv)}</td>}
                      {showCol('precio_final') && <td>{money((Number(l.cantidad) || 0) > 0 ? l.total / Number(l.cantidad) : 0)}</td>}
                      {showCol('descuento') && <td><input type="number" min="0" step="0.01" value={l.descuento} onChange={(e) => setLine(l.key, { descuento: e.target.value })} /></td>}
                      <td className="r" style={{ fontWeight: 700 }}>{money(l.total)}</td>
                      <td><button type="button" title="Quitar" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} style={{ background: 'none', border: 0, cursor: 'pointer' }}><Trash2 size={16} color="#E0245E" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showSearch && (
          <div style={{ position: 'relative', marginTop: 14 }}>
            <input className="cx-in" autoFocus placeholder="Busca por nombre o código del producto (mín. 2 letras)" value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} />
            {prodList.length > 0 && (
              <div className="cx-suggest">
                {prodList.map((p) => (
                  <button type="button" key={p.id} onClick={() => addProduct(p)}>{p.nombre}<small>{p.codigo || 'sin código'} · stock {p.stock} · costo S/ {money(p.precio_costo)}</small></button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="cx-actions">
          <button type="button" className="cx-btn-main" onClick={() => setShowSearch((v) => !v)}><Plus size={16} /> Agregar producto</button>
          <button type="button" className="cx-btn-soft" onClick={addManual}><PenLine size={15} /> Agregar insumo</button>
          <button type="button" className="cx-btn-soft" onClick={() => fileRef.current && fileRef.current.click()}><FileSpreadsheet size={15} /> Importar desde Excel (CSV)</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { importCsv(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16 }} className="cx-two">
        <div className="cx-card cx-pad">
          <div className="cx-title"><Settings2 size={18} /> Opciones de la compra</div>
          <div className="cx-opt">
            <div><strong>Actualizar el precio de compra de los productos</strong><small>El costo del producto se actualiza con esta compra.</small></div>
            <button type="button" className={`cx-switch ${actCosto ? 'on' : ''}`} aria-pressed={actCosto} aria-label="Actualizar costo" onClick={() => setActCosto((v) => !v)} />
          </div>
          <div className="cx-grid2">
            <div className="cx-f"><label className="cx-lab">Descuento global ({ms})</label><input type="number" min="0" step="0.01" className="cx-in" value={dg} placeholder="0.00" onChange={(e) => setDg(e.target.value)} /></div>
            <div className="cx-f"><label className="cx-lab">Referencia</label><input className="cx-in" maxLength={80} value={extra.referencia} onChange={(e) => setExtra({ ...extra, referencia: e.target.value })} /></div>
          </div>
          <div className="cx-f" style={{ marginTop: 14, marginBottom: 0 }}><label className="cx-lab">Guía de remisión</label><input className="cx-in" maxLength={40} value={extra.guia_remision} onChange={(e) => setExtra({ ...extra, guia_remision: e.target.value })} /></div>
        </div>
        <div className="cx-card cx-pad">
          <div className="cx-title"><Receipt size={18} /> Resumen</div>
          {[['Descuento global', calc.d], ['Subtotal', calc.subtotal], [`IGV (${pct}%)`, calc.igv]].map(([a, b]) => (
            <div key={a} className="cx-row" style={{ padding: '5px 0', fontSize: 14 }}><span style={{ color: '#7B8497' }}>{a}</span><span>{ms} {money(b)}</span></div>
          ))}
          <div className="cx-row" style={{ borderTop: '1px solid #E6E8F1', marginTop: 8, paddingTop: 10, fontSize: 20, fontWeight: 800 }}><span>Total</span><span>{ms} {money(calc.total)}</span></div>
          {moneda === 'USD' && Number(tc) > 0 && <div style={{ fontSize: 12.5, color: '#7B8497', marginTop: 6, textAlign: 'right' }}>≈ S/ {money(calc.total * Number(tc))} al T.C. {tc}</div>}
        </div>
      </div>

      <div className="cx-bar">
        <div className="tot"><small>Total</small><b>{ms} {money(calc.total)}</b></div>
        <div className="kv">Productos<b>{lines.length} producto{lines.length === 1 ? '' : 's'}</b></div>
        <div className="kv">Proveedor<b>{prov ? prov.nombre.slice(0, 28) : 'Sin elegir'}</b></div>
        <div className="sp" />
        <button type="button" className="cx-btn-ghost" onClick={onBack}>Cancelar</button>
        <div className="cx-pop">
          <button type="button" className="cx-btn-main" disabled={saving || lines.length === 0 || !prov} onClick={() => setRegMenu((v) => !v)}>
            {saving ? 'Registrando…' : <>Registrar compra <ChevronDown size={16} /></>}
          </button>
          {regMenu && (
            <div className="cx-menu-up">
              <button type="button" onClick={() => save('por_pagar')}>Registrar (por pagar)</button>
              <button type="button" onClick={() => save('pagado')}>Registrar como pagada</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================= LISTADO ======================= */
const PERIODOS = [
  { v: 'todas', l: 'Todas' }, { v: 'hoy', l: 'Hoy' }, { v: 'semana', l: 'Últimos 7 días' }, { v: 'mes', l: 'Este mes' },
  { v: 'mes_ant', l: 'Mes anterior' }, { v: '90', l: 'Últimos 90 días' }
];
const rangoPeriodo = (p) => {
  const d = new Date(); const iso = (x) => x.toLocaleDateString('en-CA');
  const t = iso(d);
  if (p === 'hoy') return { desde: t, hasta: t };
  if (p === 'semana') { const x = new Date(); x.setDate(x.getDate() - 6); return { desde: iso(x), hasta: t }; }
  if (p === '90') { const x = new Date(); x.setDate(x.getDate() - 89); return { desde: iso(x), hasta: t }; }
  if (p === 'mes') return { desde: iso(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: t };
  if (p === 'mes_ant') return { desde: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), hasta: iso(new Date(d.getFullYear(), d.getMonth(), 0)) };
  return { desde: '2000-01-01', hasta: iso(new Date(d.getFullYear() + 1, 11, 31)) };
};
const LIST_COLS = [
  { id: 'emision', label: 'Emisión', def: true }, { id: 'proveedor', label: 'Proveedor', def: true }, { id: 'numero', label: 'Número', def: true },
  { id: 'estado', label: 'Estado', def: true }, { id: 'total', label: 'Total', def: true }, { id: 'pagos', label: 'Pagos', def: true },
  { id: 'productos', label: 'Productos', def: true }, { id: 'pdf', label: 'PDF', def: true }, { id: 'moneda', label: 'Moneda', def: true },
  { id: 'registro', label: 'Fecha de registro' }, { id: 'motivo', label: 'Motivo de compra' }, { id: 'almacen', label: 'Almacén' }, { id: 'ingreso', label: 'Ingreso a almacén' }
];

function purchaseHTML(p) {
  const usd = p.moneda === 'USD';
  const rows = (p.items || []).map((i, k) => `<tr><td>${k + 1}</td><td>${String(i.nombre).replace(/</g, '&lt;')}</td><td class="r">${Number(i.cantidad)}</td><td class="r">${money(i.precio_base)}</td><td class="r">${money(i.igv)}</td><td class="r">${money(i.total)}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${p.codigo}</title><style>
    @page{size:A4;margin:14mm} body{font-family:Arial,sans-serif;color:#111;font-size:13px} h1{margin:0 0 4px;font-size:22px} .m{color:#666}
    table{width:100%;border-collapse:collapse;margin-top:14px} th{background:#6D28D9;color:#fff;text-align:left;padding:8px;font-size:12px} td{padding:8px;border-bottom:1px solid #eee} .r{text-align:right}
    .t{margin-left:auto;width:280px;margin-top:12px} .t div{display:flex;justify-content:space-between;padding:3px 0} .g{font-size:17px;font-weight:700;border-top:2px solid #111;margin-top:6px;padding-top:6px}
    .bar{text-align:center;margin-bottom:10px} @media print{.bar{display:none}}</style></head><body>
    <div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
    <h1>Compra ${p.codigo}</h1>
    <div class="m">${TIPO_LABEL[p.tipo_comprobante] || ''}${p.serie ? ` ${p.serie}-${p.correlativo}` : ''} · Emisión ${fmtDMY(p.fecha_emision)}${p.fecha_vencimiento ? ` · Vence ${fmtDMY(p.fecha_vencimiento)}` : ''}</div>
    <div><strong>Proveedor:</strong> ${String(p.proveedor_nombre || '—').replace(/</g, '&lt;')}${p.proveedor_documento ? ` · ${p.proveedor_documento}` : ''}</div>
    <table><thead><tr><th>#</th><th>Ítem</th><th class="r">Cant.</th><th class="r">Precio base (S/)</th><th class="r">IGV</th><th class="r">Total (S/)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="t">${Number(p.descuento_global) > 0 ? `<div><span>Descuento global</span><span>S/ ${money(p.descuento_global)}</span></div>` : ''}<div><span>Subtotal</span><span>S/ ${money(p.subtotal)}</span></div><div><span>IGV</span><span>S/ ${money(p.igv)}</span></div>
    <div class="g"><span>Total</span><span>S/ ${money(p.total)}</span></div>${usd ? `<div><span>Total en dólares (T.C. ${Number(p.tipo_cambio)})</span><span>$ ${money(p.total_moneda)}</span></div>` : ''}
    <div><span>Pagado</span><span>S/ ${money(p.monto_pagado)}</span></div></div>
    ${p.observaciones ? `<p><strong>Observaciones:</strong> ${String(p.observaciones).replace(/</g, '&lt;')}</p>` : ''}
    </body></html>`;
}

function PurchaseList({ isAdmin, onNew, flash }) {
  const [periodo, setPeriodo] = useState('todas');
  const [tab, setTab] = useState('todas');
  const [field, setField] = useState('numero');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ purchases: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [colOpen, setColOpen] = useState(false);
  const [visible, setVisible] = useState(() => { try { const v = JSON.parse(localStorage.getItem('compras_lista_cols_v2')); if (Array.isArray(v)) return v; } catch (e) { /* sin guardado */ } return LIST_COLS.filter((c) => c.def).map((c) => c.id); });
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [payFor, setPayFor] = useState(null);
  const [payAmt, setPayAmt] = useState('');

  const load = async () => {
    try {
      const { desde, hasta } = rangoPeriodo(periodo);
      const r = await purchasesAPI.list(`?desde=${desde}&hasta=${hasta}`);
      if (r.success) setData(r);
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [periodo]);
  useEffect(() => { setPage(1); }, [tab, search, field, periodo, perPage]);

  const toggleCol = (id) => {
    const next = visible.includes(id) ? visible.filter((x) => x !== id) : [...visible, id];
    setVisible(next);
    try { localStorage.setItem('compras_lista_cols_v2', JSON.stringify(next)); } catch (e) { /* sin guardado */ }
  };
  const shown = LIST_COLS.filter((c) => visible.includes(c.id));

  const pendiente = (c) => c.estado !== 'anulada' && (c.estado_pago === 'pendiente' || c.estado_pago === 'parcial');
  const counts = useMemo(() => {
    const all = data.purchases;
    return { todas: all.length, por_pagar: all.filter(pendiente).length, vencidas: all.filter((c) => c.vencida && c.estado !== 'anulada').length, pagadas: all.filter((c) => c.estado !== 'anulada' && c.estado_pago === 'pagado').length };
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data.purchases;
    if (tab === 'por_pagar') rows = rows.filter(pendiente);
    else if (tab === 'vencidas') rows = rows.filter((c) => c.vencida && c.estado !== 'anulada');
    else if (tab === 'pagadas') rows = rows.filter((c) => c.estado !== 'anulada' && c.estado_pago === 'pagado');
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => {
        const num = `${c.serie || ''}-${c.correlativo || ''} ${c.codigo || ''}`.toLowerCase();
        const prov = `${c.proveedor_nombre || ''} ${c.proveedor_documento || ''}`.toLowerCase();
        if (field === 'numero') return num.includes(q);
        if (field === 'proveedor') return prov.includes(q);
        return num.includes(q) || prov.includes(q);
      });
    }
    return rows;
  }, [data, tab, search, field]);

  const resumen = useMemo(() => {
    const vivas = filtered.filter((c) => c.estado !== 'anulada');
    const pen = vivas.filter((c) => c.moneda !== 'USD'); const usd = vivas.filter((c) => c.moneda === 'USD');
    const sum = (arr, f) => arr.reduce((a, c) => a + f(c), 0);
    return {
      totPen: sum(pen, (c) => c.total), totUsd: sum(usd, (c) => Number(c.total_moneda || 0)),
      pagPen: sum(pen, (c) => Math.max(0, c.total - c.monto_pagado)), pagUsd: sum(usd, (c) => c.pendiente_moneda)
    };
  }, [filtered]);

  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  const openDetail = async (c) => { setMenuFor(null); try { const r = await purchasesAPI.getById(c.id); if (r.success) setDetail(r.purchase); } catch (e) { setMsg(e.message); } };
  const openPdf = async (c) => { setMenuFor(null); try { const r = await purchasesAPI.getById(c.id); if (r.success) openHtmlWindow(purchaseHTML(r.purchase)); } catch (e) { setMsg(e.message); } };
  const annul = async (c) => {
    setMenuFor(null);
    if (!window.confirm(`¿Anular la compra ${c.codigo}? ${c.stock_ingresado ? 'Se descontará del stock lo que ingresó.' : ''}`)) return;
    try { await purchasesAPI.annul(c.id); setMsg(''); load(); } catch (e) { setMsg(e.message); }
  };
  const pay = async () => {
    try { await purchasesAPI.addPayment(payFor.id, { monto: payAmt === '' ? undefined : Number(payAmt) }); setPayFor(null); setMsg(''); load(); } catch (e) { setMsg(e.message); }
  };

  const totalTxt = (c) => (c.moneda === 'USD' ? `$ ${money(c.total_moneda)}` : `S/ ${money(c.total)}`);
  const pagosChip = (c) => {
    if (c.estado === 'anulada') return <span className="cx-chip gray">—</span>;
    const anchorMenu = (e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuFor(menuFor?.id === `p${c.id}` ? null : { id: `p${c.id}`, anchor: r, c }); };
    if (c.estado_pago === 'pagado') return <button type="button" className="cx-chip green" onClick={anchorMenu}>● Pagado <ChevronDown size={12} /></button>;
    return (
      <div>
        <button type="button" className="cx-chip amber" onClick={anchorMenu}>● {c.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente'} {sym(c.moneda)} {money(c.pendiente_moneda)} <ChevronDown size={12} /></button>
        {c.vencida && <span className="cx-venc">venció {fmtDMY(c.fecha_vencimiento)}</span>}
      </div>
    );
  };
  const cell = (c, id) => {
    switch (id) {
      case 'emision': return fmtDMY(c.fecha_emision);
      case 'proveedor': return <div style={{ maxWidth: 260, textTransform: 'uppercase' }}>{c.proveedor_nombre || '—'}{c.proveedor_documento && <small>{c.proveedor_documento}</small>}</div>;
      case 'numero': return <div><strong>{c.serie ? `${c.serie}-${c.correlativo}` : c.codigo}</strong><small>{TIPO_SHORT[c.tipo_comprobante]}</small></div>;
      case 'estado': return c.estado === 'anulada' ? <span className="cx-chip red">● Anulada</span> : <span className="cx-chip blue">● Registrado</span>;
      case 'total': return <strong style={{ whiteSpace: 'nowrap' }}>{totalTxt(c)}</strong>;
      case 'pagos': return pagosChip(c);
      case 'productos': return <button type="button" className="cx-chip violet" onClick={() => openDetail(c)}><Package size={12} /> {Number(c.items_count)} producto{Number(c.items_count) === 1 ? '' : 's'}</button>;
      case 'pdf': return <button type="button" className="cx-chip violet" onClick={() => openPdf(c)}><FileText size={12} /> PDF</button>;
      case 'moneda': return c.moneda === 'USD' ? 'Dólares Americanos' : 'Soles';
      case 'registro': return fmtDT(c.created_at);
      case 'motivo': return (MOTIVOS.find((m) => m.v === c.motivo) || {}).l || c.motivo;
      case 'almacen': return c.almacen;
      case 'ingreso': return c.ingreso_almacen ? 'Sí' : 'No';
      default: return '';
    }
  };

  const amt = (pen, usd) => [pen > 0 || usd <= 0 ? `S/ ${money(pen)}` : null, usd > 0 ? `$ ${money(usd)}` : null].filter(Boolean).join(' · ');

  return (
    <div className="cx">
      <div className="cx-card cx-pad cx-row" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: '#E7F8EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={22} color="#17A354" /></div>
          <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Compras</h1><div style={{ fontSize: 12.5, color: '#7B8497' }}>Todo lo que has comprado a tus proveedores.</div></div>
        </div>
        <button type="button" className="cx-btn-main" onClick={onNew}><Plus size={17} /> Nueva compra</button>
      </div>

      {(msg || flash) && <div className={msg ? 'cx-err' : 'cx-ok'}>{msg || flash}</div>}

      <div className="cx-card">
        <div className="cx-toolbar">
          <div className="cx-tabs">
            {[['todas', 'Todas'], ['por_pagar', 'Por pagar'], ['vencidas', 'Vencidas'], ['pagadas', 'Pagadas']].map(([id, l]) => (
              <button key={id} type="button" className={`cx-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{l} <em>{counts[id]}</em></button>
            ))}
          </div>
          <div className="cx-search">
            <Search size={16} color="#7C3AED" />
            <select value={field} onChange={(e) => setField(e.target.value)}><option value="numero">Número</option><option value="proveedor">Proveedor</option><option value="todo">Todo</option></select>
            <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex' }}><X size={15} /></button>}
          </div>
          <label className="cx-sel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} color="#7B8497" /><span style={{ color: '#7B8497', fontWeight: 500 }}>Periodo</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ border: 0, background: 'transparent', fontWeight: 700, cursor: 'pointer', outline: 'none' }}>{PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select>
          </label>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button type="button" className="cx-btn-ghost" style={{ borderRadius: 14 }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setColOpen((v) => (v ? false : r)); }}><Columns3 size={16} /> Columnas</button>
            {colOpen && (
              <FloatingMenu anchor={colOpen} onClose={() => setColOpen(false)} keepOpen width={230}>
                {LIST_COLS.map((c) => <label key={c.id}><input type="checkbox" checked={visible.includes(c.id)} onChange={() => toggleCol(c.id)} /> {c.label}</label>)}
              </FloatingMenu>
            )}
          </div>
        </div>
        <div className="cx-sum">
          <span>{filtered.length} resultados</span><span>•</span>
          <span>Total: <b>{amt(resumen.totPen, resumen.totUsd)}</b></span><span>•</span>
          <span>Por pagar: <b>{amt(resumen.pagPen, resumen.pagUsd)}</b></span>
        </div>

        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th style={{ width: 40 }}>#</th>{shown.map((c) => <th key={c.id} className={c.id === 'total' ? 'r' : ''}>{c.label}</th>)}<th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id} style={{ opacity: c.estado === 'anulada' ? 0.55 : 1 }}>
                  <td style={{ color: '#7B8497' }}>{(page - 1) * perPage + i + 1}</td>
                  {shown.map((col) => <td key={col.id} className={col.id === 'total' ? 'r' : ''}>{cell(c, col.id)}</td>)}
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" aria-label="Acciones" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuFor(menuFor?.id === c.id ? null : { id: c.id, anchor: r, c }); }} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6, borderRadius: 8 }}><MoreVertical size={17} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <div className="cx-empty" style={{ margin: 20 }}>{data.purchases.length ? 'No hay compras con estos filtros.' : 'Aún no tienes compras registradas.'}</div>}
        </div>

        <div className="cx-pager">
          <span>Mostrando {filtered.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="cx-sel" style={{ height: 36 }} value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>{[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}</select>
            <button type="button" className="cx-btn-ghost" style={{ padding: '7px 14px' }} disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Anterior</button>
            <button type="button" className="cx-btn-ghost" style={{ padding: '7px 14px' }} disabled={page * perPage >= filtered.length} onClick={() => setPage((x) => x + 1)}>Siguiente</button>
          </div>
        </div>
      </div>

      {menuFor && (() => {
        const c = menuFor.c;
        return (
          <FloatingMenu anchor={menuFor.anchor} onClose={() => setMenuFor(null)} width={200}>
            <button onClick={() => openDetail(c)}>Ver detalle</button>
            <button disabled={c.estado === 'anulada' || c.estado_pago === 'pagado'} onClick={() => { setMenuFor(null); setPayFor(c); setPayAmt(String(Number(c.pendiente_moneda).toFixed(2))); }}>Registrar pago</button>
            <button onClick={() => openPdf(c)}>Imprimir / PDF</button>
            {isAdmin && <button style={{ color: '#B91C1C' }} disabled={c.estado === 'anulada'} onClick={() => annul(c)}>Anular compra</button>}
          </FloatingMenu>
        );
      })()}

      {detail && (
        <Modal title={`Compra ${detail.codigo}`} onClose={() => setDetail(null)} width={760}>
          <p style={{ margin: '-6px 0 12px', fontSize: 13.5, color: '#475569' }}>{TIPO_LABEL[detail.tipo_comprobante]}{detail.serie ? ` ${detail.serie}-${detail.correlativo}` : ''} · {detail.proveedor_nombre || 'Sin proveedor'} · Emisión {fmtDMY(detail.fecha_emision)}</p>
          <div className="cx-table-wrap">
            <table className="cx-table" style={{ minWidth: 0 }}>
              <thead><tr><th>Cant.</th><th>Ítem</th><th>Precio base</th><th>IGV</th><th className="r">Total</th></tr></thead>
              <tbody>{detail.items.map((i) => (<tr key={i.id}><td>{Number(i.cantidad)}</td><td>{i.nombre}<small>{i.codigo || ''}</small></td><td>{money(i.precio_base)}</td><td>{money(i.igv)}</td><td className="r"><b>{money(i.total)}</b></td></tr>))}</tbody>
            </table>
          </div>
          <div style={{ textAlign: 'right', marginTop: 12, fontSize: 14 }}>
            {Number(detail.descuento_global) > 0 && <div>Descuento global: S/ {money(detail.descuento_global)}</div>}
            <div>Subtotal: S/ {money(detail.subtotal)} · IGV: S/ {money(detail.igv)}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Total: S/ {money(detail.total)}</div>
            {detail.moneda === 'USD' && <div>En dólares: $ {money(detail.total_moneda)} (T.C. {Number(detail.tipo_cambio)})</div>}
            <div style={{ color: '#475569' }}>Pagado: S/ {money(detail.monto_pagado)} · {detail.ingreso_almacen ? 'Ingresó a almacén' : 'Sin ingreso a almacén'}</div>
          </div>
          {detail.observaciones && <p style={{ marginTop: 12, fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}><strong>Observaciones:</strong> {detail.observaciones}</p>}
        </Modal>
      )}

      {payFor && (
        <Modal title="Registrar pago" onClose={() => setPayFor(null)} width={420}>
          <p style={{ margin: '-6px 0 12px', fontSize: 13.5, color: '#475569' }}>{payFor.codigo} · Total {totalTxt(payFor)} · Pendiente {sym(payFor.moneda)} {money(payFor.pendiente_moneda)}</p>
          <div className="cx-f"><label className="cx-lab">Monto a pagar ({sym(payFor.moneda)})</label><input type="number" min="0.01" step="0.01" className="cx-in" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></div>
          <div className="cx-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="cx-btn-ghost" onClick={() => setPayFor(null)}>Cancelar</button>
            <button type="button" className="cx-btn-main" onClick={pay}>Registrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function Purchases({ user }) {
  const [view, setView] = useState('lista');
  const [flash, setFlash] = useState('');
  return (
    <div className="content-body animate-fade-in">
      {view === 'nueva'
        ? <NewPurchase onBack={() => setView('lista')} onDone={(m) => { setFlash(m); setView('lista'); }} />
        : <PurchaseList isAdmin={user?.rol === 'admin'} onNew={() => { setFlash(''); setView('nueva'); }} flash={flash} />}
    </div>
  );
}

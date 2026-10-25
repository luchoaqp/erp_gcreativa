import React, { useEffect, useRef, useState } from 'react';

/**
 * Protección global contra pérdida de cambios en ventanas de edición.
 * - Detecta cuando el usuario modifica algo (teclea, elige, marca, sube un archivo) dentro de una ventana
 *   modal que tenga formulario o botón "Guardar".
 * - Si luego intenta cerrarla (clic fuera, X, Cancelar/Cerrar), pregunta: Guardar / Seguir editando / Salir sin guardar.
 * - Si no hubo cambios, la ventana se cierra normal.
 * Se monta una sola vez en App.jsx; no requiere cambios en cada formulario.
 */
const MODAL_SEL = '.pm-modal-bg, .modal-overlay';
const SAVE_RE = /^\s*(guardar|actualizar|vista previa y guardar)/i;
const CLOSE_RE = /^\s*(cancelar|cerrar|salir|volver)\s*$/i;

const isEditable = (modal) => !!modal.querySelector('form') || [...modal.querySelectorAll('button')].some((b) => SAVE_RE.test(b.textContent || ''));

const findSaveButton = (modal) => [...modal.querySelectorAll('button')].find((b) => SAVE_RE.test(b.textContent || '') && !b.disabled);

export default function UnsavedGuard() {
  const dirty = useRef(new WeakSet());
  const bypass = useRef(false);
  const [ask, setAsk] = useState(null); // { modal, retry }

  useEffect(() => {
    const mark = (e) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      const modal = e.target.closest(MODAL_SEL);
      if (modal && !e.target.closest('[data-noguard]')) dirty.current.add(modal);
    };
    const shouldBlock = (modal) => modal && !bypass.current && dirty.current.has(modal) && document.body.contains(modal) && isEditable(modal);

    const onMouseDown = (e) => {
      if (!(e.target instanceof Element) || !e.target.matches(MODAL_SEL)) return; // solo clic en el fondo
      const modal = e.target;
      if (!shouldBlock(modal)) return;
      e.stopPropagation(); e.preventDefault();
      setAsk({ modal, retry: () => { bypass.current = true; try { modal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); } finally { bypass.current = false; } } });
    };
    const onClick = (e) => {
      if (!(e.target instanceof Element)) return;
      const btn = e.target.closest('button');
      // Un <button> sin type cuenta como "submit" para el navegador aunque no esté en un formulario:
      // solo se deja pasar el que realmente envía un formulario (ese guarda).
      if (!btn || (btn.type === 'submit' && btn.form) || btn.closest('[data-guard-dialog]')) return;
      const modal = btn.closest(MODAL_SEL);
      if (!modal) return;
      const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || '').trim();
      const isClose = CLOSE_RE.test(label) || btn.classList.contains('pm-close');
      if (!isClose || !shouldBlock(modal)) return;
      e.stopPropagation(); e.preventDefault();
      setAsk({ modal, retry: () => { bypass.current = true; try { btn.click(); } finally { bypass.current = false; } } });
    };
    const onUnload = (e) => {
      const any = [...document.querySelectorAll(MODAL_SEL)].some((m) => dirty.current.has(m) && isEditable(m));
      if (any) { e.preventDefault(); e.returnValue = ''; }
    };
    document.addEventListener('input', mark, true);
    document.addEventListener('change', mark, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('input', mark, true);
      document.removeEventListener('change', mark, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  if (!ask) return null;
  const { modal, retry } = ask;
  const saveBtn = document.body.contains(modal) ? findSaveButton(modal) : null;
  const form = modal.querySelector('form');
  const canSave = !!(form || saveBtn);

  const guardar = () => {
    setAsk(null);
    if (form && typeof form.requestSubmit === 'function') form.requestSubmit(); else if (saveBtn) saveBtn.click();
  };
  const salir = () => { setAsk(null); dirty.current.delete(modal); setTimeout(retry, 0); };

  const btn = (bg, color, border) => ({ padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', background: bg, color, border: border || 0 });
  return (
    <div data-guard-dialog style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(20,30,40,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => e.stopPropagation()}>
      <div role="alertdialog" aria-modal="true" style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C2A38', marginBottom: 6 }}>Tienes cambios sin guardar</div>
        <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 18, lineHeight: 1.45 }}>
          Hiciste modificaciones en esta ventana. ¿Qué quieres hacer?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canSave && <button type="button" onClick={guardar} style={btn('var(--primary)', '#fff')}>Guardar cambios</button>}
          <button type="button" onClick={() => setAsk(null)} style={btn('#fff', '#1C2A38', '1.5px solid #CBD5E1')} autoFocus>Seguir editando</button>
          <button type="button" onClick={salir} style={btn('#FEF2F2', '#B91C1C', '1px solid #FECACA')}>Salir sin guardar</button>
        </div>
      </div>
    </div>
  );
}

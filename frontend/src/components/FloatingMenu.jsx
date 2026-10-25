import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Menú flotante anclado a un botón (rect = getBoundingClientRect()).
// Se abre hacia abajo o hacia arriba según el espacio disponible y nunca queda recortado por la tabla.
export default function FloatingMenu({ anchor, onClose, children, width = 230, keepOpen = false }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const h = ref.current ? ref.current.offsetHeight : 220;
    const vh = window.innerHeight; const vw = window.innerWidth;
    const below = vh - anchor.bottom;
    const goUp = below < h + 12 && anchor.top > below;
    const top = goUp ? Math.max(8, anchor.top - h - 4) : Math.max(8, Math.min(anchor.bottom + 4, vh - h - 8));
    const left = Math.max(8, Math.min(anchor.right - width, vw - width - 8));
    setPos({ top, left });
  }, [anchor, width, children]);

  useEffect(() => {
    const close = () => onClose();
    const onScroll = (e) => { if (keepOpen && ref.current && e.target instanceof Node && ref.current.contains(e.target)) return; onClose(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', onScroll, true); };
  }, [onClose, keepOpen]);

  const host = document.querySelector('.app-viewport') || document.body;
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
      <div ref={ref} className={keepOpen ? 'pm-pop' : 'pm-menu'} onClick={keepOpen ? undefined : onClose}
        style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto', width, minWidth: width, zIndex: 1001, maxHeight: '70vh', overflowY: 'auto' }}>
        {children}
      </div>
    </>,
    host
  );
}

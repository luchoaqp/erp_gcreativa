// Fotos de productos guardadas como archivos en el servidor (/uploads/productos/...)
import { API_ORIGIN } from '../api';

const isStored = (u) => typeof u === 'string' && u.startsWith('/uploads/productos/');

/** Foto completa (catálogo del POS, formularios) */
export const imgSrc = (u) => (isStored(u) ? `${API_ORIGIN}${u}` : u);

/** Miniatura liviana (listas, carrito, tablas); las fotos antiguas o externas se usan tal cual */
export const thumbSrc = (u) => (isStored(u) ? `${API_ORIGIN}/uploads/productos/thumb/${u.slice('/uploads/productos/'.length)}` : u);

/** onError: si la miniatura no existe aún, usa la foto completa */
export const thumbFallback = (u) => (e) => { const full = imgSrc(u); if (e.currentTarget.src !== full) e.currentTarget.src = full; };

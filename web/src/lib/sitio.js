// Textos, datos de contacto y portada (campaña activa) que publica el ERP en /data/sitio.json.
// Si el archivo no existe o falla, la web se queda con los textos con los que se compiló.
import { sitio } from '../data/sitio.js';

let pedido;
export function cargarSitio() {
  pedido ??= fetch('/data/sitio.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => {
      const t = d?.textos || {};
      // Datos de contacto: se actualiza el objeto compartido para que los botones de WhatsApp usen el número nuevo
      if (t.whatsapp) sitio.whatsapp = String(t.whatsapp).replace(/\D/g, '');
      if (t.telefono_visible) sitio.telefonoVisible = t.telefono_visible;
      if (t.email) sitio.email = t.email;
      if (t.direccion) sitio.direccion = t.direccion;
      if (t.horario) sitio.horario = t.horario;
      for (const red of ['instagram', 'facebook', 'tiktok']) if (t[red]) sitio.redes[red] = t[red];
      return d || { textos: {}, portada: null };
    });
  return pedido;
}

const wa = (msg) => `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(msg)}`;

/** Aplica textos [data-t], datos de contacto [data-contacto] y la portada del Inicio */
export function aplicarSitio(d) {
  const t = d.textos || {};
  for (const el of document.querySelectorAll('[data-t]')) {
    const v = t[el.dataset.t];
    if (typeof v === 'string' && v.trim()) el.textContent = v;
  }
  for (const el of document.querySelectorAll('[data-contacto]')) {
    const c = el.dataset.contacto;
    if (c === 'whatsapp') { el.href = `https://wa.me/${sitio.whatsapp}`; if (!el.dataset.soloEnlace) el.textContent = el.dataset.prefijo ? `${el.dataset.prefijo}${sitio.telefonoVisible}` : sitio.telefonoVisible; }
    else if (c === 'wa-mensaje') el.href = wa(el.dataset.mensaje || 'Hola Genia Creativa');
    else if (c === 'email') { el.href = `mailto:${sitio.email}`; el.textContent = sitio.email; }
    else if (c === 'direccion') el.textContent = sitio.direccion;
    else if (c === 'horario') el.textContent = sitio.horario;
    else if (sitio.redes[c]) el.href = sitio.redes[c];
  }
  const p = d.portada;
  const hero = document.getElementById('hero');
  if (hero && p) {
    const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
    if (p.titulo) set('hero-titulo', (el) => { el.textContent = p.titulo; });
    if (p.texto) set('hero-texto', (el) => { el.textContent = p.texto; });
    set('hero-boton', (el) => {
      if (p.boton_texto) el.textContent = p.boton_texto;
      el.href = p.boton_destino ? `/catalogo/?catalogo=${encodeURIComponent(p.boton_destino)}` : '/catalogo/';
    });
    set('hero-campana', (el) => { el.hidden = !p.campana; if (p.campana) el.textContent = `Campaña ${p.campana}`; });
    (p.imagenes || []).forEach((src, i) => {
      if (!src) return;
      set(`hero-img-${i + 1}`, (img) => { img.src = src; img.alt = p.titulo || ''; });
    });
  }
  hero?.classList.remove('hero--cargando');
}

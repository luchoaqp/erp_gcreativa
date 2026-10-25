// Datos generales del sitio. Cambia aquí y se actualiza en todas las páginas.
// ⚠️ Reemplaza los valores marcados con TODO por los reales.

export const sitio = {
  nombre: 'Genia Creativa',
  lema: 'Detalles personalizados',
  url: 'https://gcreativa.com',
  logo: '/img/logo-genia-creativa.png',
  whatsapp: '51921663818', // código de país + número, sin + ni espacios
  telefonoVisible: '+51 921 663 818',
  email: 'hola@gcreativa.com', // TODO
  direccion: 'Lima, Perú', // TODO: distrito o dirección de recojo
  horario: 'Lunes a sábado, 9:00 a 19:00', // TODO
  redes: {
    instagram: 'https://www.instagram.com/', // TODO
    facebook: 'https://www.facebook.com/', // TODO
    tiktok: 'https://www.tiktok.com/', // TODO
  },
  // Futuro: erp.gcreativa.com publicará el catálogo en /data/catalogo.json
  urlCatalogo: '/data/catalogo.json',
};

// Categorías del catálogo. El slug se usa en los filtros: /catalogo/?categoria=para-ellas
// Deben coincidir con los slugs del módulo "Categorías & Ocasiones" del ERP.
export const categorias = [
  { slug: 'para-ellas', nombre: 'Para ellas', color: '#B8327A' },
  { slug: 'para-ellos', nombre: 'Para ellos', color: '#2E4A7D' },
  { slug: 'padrinos', nombre: 'Padrinos', color: '#7A3F8F' },
  { slug: 'graduaciones', nombre: 'Graduaciones', color: '#2F6F5E' },
  { slug: 'profesiones', nombre: 'Profesiones', color: '#0F6E8C' },
  { slug: 'navidad', nombre: 'Navidad', color: '#B3261E' },
  { slug: 'dia-del-maestro', nombre: 'Día del Maestro', color: '#8A5A00' },
];

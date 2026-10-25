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

// Los CATÁLOGOS de la web (Para ellas, Navidad, Graduaciones…) ya no se escriben aquí:
// salen de las OCASIONES del ERP cada vez que pulsas "Publicar catálogo" (erp.gcreativa.com/catalogo-web).
// Estos son solo los tonos que se reparten entre ellos, en orden.
export const tonosCatalogos = ['#B8327A', '#2E4A7D', '#7A3F8F', '#2F6F5E', '#0F6E8C', '#B3261E', '#8A5A00', '#5B4FA8'];

// Datos del catálogo que publica el ERP en /data/catalogo.json.
// Los "catálogos" de la web son las OCASIONES del ERP que tienen al menos un producto publicado.
import { sitio, tonosCatalogos } from '../data/sitio.js';

let pedido;
/** Descarga el catálogo una sola vez por página (lo comparten cabecera, pie y contenido) */
export function cargarCatalogo() {
  pedido ??= fetch(sitio.urlCatalogo, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then(normalizar);
  return pedido;
}

/** Ordena los datos del ERP: catálogos con su tono, ícono, cantidad y foto de portada */
export function normalizar(datos) {
  const productos = Array.isArray(datos?.productos) ? datos.productos : [];
  const lista = (datos?.categorias || []).filter((c) => c && c.slug && c.tipo === 'ocasion');
  const catalogos = lista
    .map((c, i) => {
      const suyos = productos.filter((p) => (p.categorias || []).includes(c.slug));
      const portada = suyos.find((p) => p.destacado && p.imagen) || suyos.find((p) => p.imagen);
      return {
        slug: c.slug,
        nombre: c.nombre,
        icono: c.icono || '',
        tono: c.color || tonosCatalogos[i % tonosCatalogos.length],
        total: suyos.length,
        imagen: portada ? portada.imagen : null,
      };
    })
    .filter((c) => c.total > 0);
  const nombres = new Map((datos?.categorias || []).map((c) => [c.slug, c.nombre]));
  return { version: datos?.version || '', productos, catalogos, nombres };
}

// Genera /data/catalogo.json durante el build a partir de src/data/catalogo.json.
// Hoy lo editas a mano; mañana erp.gcreativa.com sobrescribirá ese archivo en el servidor
// con el botón "Publicar catálogo", y la web lo leerá sin necesidad de recompilar.
import catalogo from '../../data/catalogo.json';

export function GET() {
  return new Response(JSON.stringify(catalogo), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

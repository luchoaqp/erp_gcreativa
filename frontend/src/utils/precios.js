// Precio unitario según la cantidad (presentaciones). Si el producto no usa precio por cantidad, es su precio de venta.
export function precioPorCantidad(producto, cantidad) {
  const base = Number(producto?.precio_venta) || 0;
  const escalas = producto?.escalas;
  if (!producto?.precio_por_cantidad || !Array.isArray(escalas) || escalas.length === 0) return base;
  const qty = Number(cantidad) || 0;
  let elegido = null;
  for (const e of escalas) {
    if (Number(e.factor) <= qty && (!elegido || Number(e.factor) > Number(elegido.factor))) elegido = e;
  }
  return elegido ? Number(elegido.precio) : base;
}

import { comercios } from '../services/api';

export async function construirItemsParaCarrito(pedido) {
  const productosArr = Array.isArray(pedido.productos)
    ? pedido.productos
    : JSON.parse(pedido.productos || '[]');
  if (!productosArr.length) throw new Error('sin productos');

  let items = productosArr.map(p => ({
    id: p.id,
    comercioId: pedido.comercioId,
    nombre: p.nombre,
    cantidad: p.cantidad || 1,
    precio: p.precio,
    nota: p.nota || ''
  }));

  try {
    const { data: comercio } = await comercios.getById(pedido.comercioId);
    items = items.map(i => ({
      ...i,
      comercioNombre: comercio.nombreNegocio,
      cobraEmpaque: comercio.cobraEmpaque || 'no',
      tipoEmpaque: comercio.tipoEmpaque || 'pedido',
      valorEmpaque: comercio.valorEmpaque || '0'
    }));
  } catch {}

  return items;
}
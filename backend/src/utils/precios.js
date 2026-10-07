// Cálculo de totales del lado del servidor.
// El cliente NUNCA define precios: todo se recalcula con datos de BD.
const { esAbiertoAhora } = require('./horarios');

const METODOS_VALIDOS = ['efectivo', 'tarjeta', 'tarjeta_online', 'pse'];
const PAGA_WOMPI = (m) => m === 'pse' || m === 'tarjeta_online';

function esNeiva(ciudad) {
  return String(ciudad || '').toLowerCase().trim() === 'neiva';
}

async function validarCupon(repository, codigo, subtotal, clienteId) {
  if (!codigo) return { descuento: 0, cupon: null };
  const cupones = await repository.findAll('Cupones');
  const cupon = cupones.find(c => String(c.codigo || '').toUpperCase() === String(codigo).toUpperCase());
  if (!cupon || cupon.activo === 'false') return { descuento: 0, cupon: null };
  const now = new Date();
  if (cupon.fechaVencimiento && new Date(cupon.fechaVencimiento) < now) return { descuento: 0, cupon: null };
  if (cupon.fechaInicio && new Date(cupon.fechaInicio) > now) return { descuento: 0, cupon: null };
  if (cupon.limiteUsos && parseInt(cupon.usosActuales || 0) >= parseInt(cupon.limiteUsos)) return { descuento: 0, cupon: null };
  if (cupon.compraMinima && parseFloat(subtotal) < parseFloat(cupon.compraMinima)) return { descuento: 0, cupon: null };
  if (cupon.exclusivoUsuario && cupon.exclusivoUsuario !== clienteId) return { descuento: 0, cupon: null };
  let descuento = 0;
  if (cupon.tipo === 'porcentaje') {
    descuento = (parseFloat(subtotal) * parseFloat(cupon.valor)) / 100;
  } else if (cupon.tipo === 'valor_fijo' || cupon.tipo === 'domicilio_gratis') {
    descuento = parseFloat(cupon.valor || 0);
  }
  return { descuento: Math.max(0, descuento), cupon };
}

async function calcularTotal({ repository, items, comercio, metodoPago = 'efectivo', codigoCupon = '', clienteId = '' }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('El pedido no tiene productos');
    err.status = 400;
    throw err;
  }
  const metodo = METODOS_VALIDOS.includes(metodoPago) ? metodoPago : 'efectivo';
  const catalogo = await repository.findWhere('Productos', 'comercioId', comercio.id);
  const porId = new Map(catalogo.filter(p => p.activo !== 'false').map(p => [p.id, p]));

  let subtotal = 0;
  let unidades = 0;
  const detalle = [];
  for (const it of items) {
    const id = it.id || it.productoId || '';
    const prod = porId.get(id);
    if (!prod) {
      const err = new Error('Hay productos no válidos en el pedido');
      err.status = 400;
      throw err;
    }
    let cant = parseInt(it.cantidad || it.qty || 1, 10);
    if (Number.isNaN(cant) || cant < 1) cant = 1;
    cant = Math.min(cant, 50);
    const precio = parseFloat(prod.precio || 0);
    subtotal += precio * cant;
    unidades += cant;
    detalle.push({ id: prod.id, nombre: prod.nombre, precio, cantidad: cant });
  }

  let costoEmpaque = 0;
  let tipoEmpaque = comercio.tipoEmpaque || 'pedido';
  if (comercio.cobraEmpaque === 'si') {
    const valor = parseFloat(comercio.valorEmpaque || 0);
    costoEmpaque = tipoEmpaque === 'empaque' ? valor * unidades : valor;
  }

  const { descuento, cupon } = await validarCupon(repository, codigoCupon, subtotal, clienteId);

  const base = Math.max(0, subtotal - descuento + costoEmpaque);
  const costoDomicilio = esNeiva(comercio.ciudad) ? 30000 : 2600;
  let recargo = 0;
  if (PAGA_WOMPI(metodo)) {
    const comision = base * 0.0265 + 700;
    recargo = Math.round(comision * 1.19);
  } else if (metodo === 'tarjeta') {
    recargo = Math.round(base * 0.0329 + 300);
  }
  const total = Math.round(base + costoDomicilio + recargo);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    descuento: Math.round(descuento * 100) / 100,
    costoEmpaque: Math.round(costoEmpaque * 100) / 100,
    tipoEmpaque,
    costoDomicilio,
    recargo,
    total,
    metodo,
    cupon: cupon ? { id: cupon.id, codigo: cupon.codigo } : null,
    detalle,
  };
}

module.exports = { calcularTotal, METODOS_VALIDOS, esAbiertoAhora };

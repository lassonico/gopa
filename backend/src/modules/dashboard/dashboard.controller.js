const repository = require('../../repositories');

const ESTADOS_ACTIVOS = ['pendiente', 'confirmado', 'en preparación', 'recogido', 'en camino'];

function inSameMonth(pedido, year, month) {
  const d = new Date(pedido.fechaCreacion);
  return d.getMonth() === month && d.getFullYear() === year;
}

function inRange(dateStr, start, end) {
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function pct(now, before) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

const fmtCOP = (n) => Math.round(parseFloat(n || 0) * 100) / 100;

exports.getDashboard = async (req, res, next) => {
  try {
    const [pedidos, comercios, usuarios, productos, pedidosIniciales, pedidosCancelados, comerciosPendientes] = await Promise.all([
      repository.findAll('Pedidos'),
      repository.findAll('Comercios'),
      repository.findAll('Usuarios'),
      repository.findAll('Productos'),
      repository.findWhere('Pedidos', 'estado', 'pendiente'),
      repository.findWhere('Pedidos', 'estado', 'cancelado'),
      repository.findWhere('Comercios', 'estado', 'pendiente'),
    ]);
    const now = new Date();
    const aISO = (v) => (v instanceof Date ? v.toISOString() : String(v || ''));
    const today = now.toISOString().split('T')[0];
    const month = now.getMonth();
    const year = now.getFullYear();

    const pedidosHoy = pedidos.filter(p => aISO(p.fechaCreacion).startsWith(today));
    const pedidosMes = pedidos.filter(p => inSameMonth(p, year, month));
    const entregados = pedidos.filter(p => p.estado === 'entregado');
    const entregadosMes = entregados.filter(p => inSameMonth(p, year, month));
    const entregadosHoy = entregados.filter(p => aISO(p.fechaCreacion).startsWith(today));

    const sumar = (list) => list.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
    const ventasHoy = fmtCOP(sumar(entregadosHoy));
    const ventasMes = fmtCOP(sumar(entregadosMes));

    // Comparativo con el mes anterior
    const prevStart = new Date(year, month - 1, 1);
    const currStart = new Date(year, month, 1);
    const pedidosMesAnterior = pedidos.filter(p => inRange(p.fechaCreacion, prevStart, currStart));
    const entregadosMesAnterior = pedidosMesAnterior.filter(p => p.estado === 'entregado');
    const ventasMesAnterior = fmtCOP(sumar(entregadosMesAnterior));

    // Ventas por día últimos 14 días
    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dias.push(d.toISOString().slice(0, 10));
    }
    const ventasPorDia = dias.map(fecha => ({
      fecha: fecha.slice(5),
      total: fmtCOP(entregados.filter(p => aISO(p.fechaCreacion).startsWith(fecha)).reduce((s, p) => s + parseFloat(p.total || 0), 0))
    }));

    // Distribución por estado
    const estados = {};
    for (const p of pedidos) estados[p.estado] = (estados[p.estado] || 0) + 1;
    const distribucionEstados = Object.entries(estados)
      .map(([estado, cantidad]) => ({ estado, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const pedidosActivos = pedidos.filter(p => ESTADOS_ACTIVOS.includes(p.estado)).length;
    const ticketPromedio = entregados.length ? fmtCOP(sumar(entregados) / entregados.length) : 0;
    const ticketPromedioMes = entregadosMes.length ? fmtCOP(sumar(entregadosMes) / entregadosMes.length) : 0;

    // Top comercios por ventas del mes
    const ventasPorComercio = {};
    for (const p of entregadosMes) {
      ventasPorComercio[p.comercioId] = (ventasPorComercio[p.comercioId] || 0) + parseFloat(p.total || 0);
    }
    const topComerciosVentas = Object.entries(ventasPorComercio)
      .map(([comercioId, total]) => ({
        comercioId,
        nombre: comercios.find(c => c.id === comercioId)?.nombreNegocio || 'Comercio eliminado',
        ventas: fmtCOP(total),
        pedidos: entregadosMes.filter(p => p.comercioId === comercioId).length
      }))
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 8);

    // Crecimiento de usuarios y comercios
    const nuevosUsuariosMes = usuarios.filter(u => inSameMonth(u, year, month)).length;
    const nuevosComerciosMes = comercios.filter(c => inSameMonth(c, year, month)).length;

    const comerciosAprobados = comercios.filter(c => c.estado === 'aprobado');
    const productosOrdenados = productos
      .filter(p => p.activo !== 'false')
      .sort((a, b) => parseInt(b.pedidosCount || 0) - parseInt(a.pedidosCount || 0))
      .slice(0, 10);
    const comerciosCalificados = comerciosAprobados
      .filter(c => parseFloat(c.calificacionPromedio || 0) > 0)
      .sort((a, b) => parseFloat(b.calificacionPromedio || 0) - parseFloat(a.calificacionPromedio || 0))
      .slice(0, 5);
    const pedidosRecientes = [...pedidos]
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
      .slice(0, 15)
      .map(p => ({
        id: p.id,
        clienteNombre: p.clienteNombre,
        comercioNombre: comercios.find(c => c.id === p.comercioId)?.nombreNegocio || '',
        total: p.total,
        estado: p.estado,
        fechaCreacion: p.fechaCreacion,
      }));
    const tiemposPreparacion = entregados.map(p => {
      const creado = new Date(p.fechaCreacion);
      const entregado = new Date(p.fechaEntrega);
      return (entregado - creado) / (1000 * 60);
    }).filter(t => !isNaN(t) && t > 0);
    const tiempoPromedioPreparacion = tiemposPreparacion.length
      ? (tiemposPreparacion.reduce((a, b) => a + b, 0) / tiemposPreparacion.length).toFixed(1)
      : '0';

    res.json({
      ventasHoy,
      ventasMes,
      pedidosHoy: pedidosHoy.length,
      pedidosMes: pedidosMes.length,
      totalPedidos: pedidos.length,
      pedidosPendientes: pedidosIniciales.length,
      pedidosCancelados: pedidosCancelados.length,
      comerciosRegistrados: comercios.length,
      comerciosAprobados: comerciosAprobados.length,
      comerciosPendientes: comerciosPendientes.length,
      usuariosRegistrados: usuarios.length,
      productosMasVendidos: productosOrdenados,
      comerciosMejorCalificados: comerciosCalificados,
      pedidosRecientes,
      tiempoPromedioPreparacion: `${tiempoPromedioPreparacion} min`,
      totalProductos: productos.filter(p => p.activo !== 'false').length,
      // Métricas avanzadas
      ventasPorDia,
      distribucionEstados,
      comparativoMes: {
        ventasMes,
        ventasMesAnterior,
        pedidosMes: pedidosMes.length,
        pedidosMesAnterior: pedidosMesAnterior.length,
        crecimientoVentasPct: pct(ventasMes, ventasMesAnterior),
        crecimientoPedidosPct: pct(pedidosMes.length, pedidosMesAnterior.length),
      },
      pedidosActivos,
      ticketPromedio,
      ticketPromedioMes,
      topComerciosVentas,
      nuevosUsuariosMes,
      nuevosComerciosMes,
    });
  } catch (error) {
    next(error);
  }
};
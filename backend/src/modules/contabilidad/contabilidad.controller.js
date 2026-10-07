const repository = require('../../repositories');
const config = require('../../config');

const SHEET_PAGOS = 'Pagos';
const SHEET_PEDIDOS = 'Pedidos';
const SHEET_COMERCIOS = 'Comercios';
const IVA_RATE = config.contabilidad.ivaRate;
const COMISION_DEFAULT = config.contabilidad.comisionDefault;

function parseRange(desde, hasta) {
  const start = desde ? new Date(desde) : null;
  const end = hasta ? new Date(hasta) : null;
  if (start && isNaN(start)) throw new Error('Fecha "desde" inválida');
  if (end && isNaN(end)) throw new Error('Fecha "hasta" inválida');
  if (start && end && start > end) throw new Error('La fecha inicial no puede ser mayor que la final');
  return { start, end };
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  if (start && d < start) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (d > endOfDay) return false;
  }
  return true;
}

function fmtCOP(n) {
  return Math.round(n * 100) / 100;
}

async function loadData(desde, hasta) {
  const { start, end } = parseRange(desde, hasta);
  const [pagos, pedidos, comercios] = await Promise.all([
    repository.findAll(SHEET_PAGOS),
    repository.findAll(SHEET_PEDIDOS),
    repository.findAll(SHEET_COMERCIOS)
  ]);

  const pedidoById = new Map(pedidos.map(p => [p.id, p]));
  const comercioById = new Map(comercios.map(c => [c.id, c]));

  // Solo cuentan los pagos completados (ingreso realmente recibido)
  const pagosCompletados = pagos.filter(p => {
    if (p.estado !== 'completado') return false;
    const fecha = p.fechaPago || p.fechaCreacion;
    return inRange(fecha, start, end);
  });

  return { pagosCompletados, pedidoById, comercioById, start, end };
}

function calcularIVA(monto) {
  const base = monto / (1 + IVA_RATE);
  const iva = monto - base;
  return { base: fmtCOP(base), iva: fmtCOP(iva) };
}

exports.getResumen = async (req, res, next) => {
  try {
    const { pagosCompletados, pedidoById, comercioById, start, end } =
      await loadData(req.query.desde, req.query.hasta);

    let totalIngresos = 0;
    const ventasPorDia = {};
    const porMetodo = {};
    let contador = 0;

    for (const pago of pagosCompletados) {
      const valor = parseFloat(pago.valor || 0);
      totalIngresos += valor;
      contador += 1;
      const dia = (pago.fechaPago || pago.fechaCreacion || '').slice(0, 10);
      ventasPorDia[dia] = fmtCOP((ventasPorDia[dia] || 0) + valor);
      const metodo = pago.metodo || 'desconocido';
      porMetodo[metodo] = fmtCOP((porMetodo[metodo] || 0) + valor);
    }

    const { base, iva } = calcularIVA(totalIngresos);

    res.json({
      desde: start ? start.toISOString() : null,
      hasta: end ? end.toISOString() : null,
      totalIngresos: fmtCOP(totalIngresos),
      totalPagos: contador,
      ticketPromedio: contador ? fmtCOP(totalIngresos / contador) : 0,
      baseGravable: base,
      iva: iva,
      ivaRate: IVA_RATE,
      ventasPorDia: Object.entries(ventasPorDia)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, total]) => ({ fecha, total })),
      porMetodo: Object.entries(porMetodo).map(([metodo, total]) => ({ metodo, total })),
      pedidosVinculados: pagosCompletados.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getPorComercio = async (req, res, next) => {
  try {
    const { pagosCompletados, pedidoById, comercioById } =
      await loadData(req.query.desde, req.query.hasta);

    const comisiones = {};
    const resumenComercios = {};

    for (const pago of pagosCompletados) {
      const pedido = pedidoById.get(pago.pedidoId);
      const comercioId = pedido?.comercioId || 'sin-comercio';
      const comercio = comercioById.get(comercioId);
      const nombre = comercio?.nombreNegocio || (comercioId === 'sin-comercio' ? 'Sin comercio' : 'Comercio eliminado');
      const comisionPct = comercio?.comision != null ? parseFloat(comercio.comision) : COMISION_DEFAULT;

      const valor = parseFloat(pago.valor || 0);
      if (!resumenComercios[comercioId]) {
        resumenComercios[comercioId] = { comercioId, nombre, ventas: 0, comisionPct, pedidos: 0 };
      }
      resumenComercios[comercioId].ventas += valor;
      resumenComercios[comercioId].pedidos += 1;
      comisiones[comercioId] = comisionPct;
    }

    const lista = Object.values(resumenComercios).map(c => {
      const comision = c.ventas * (c.comisionPct / 100);
      return {
        ...c,
        ventas: fmtCOP(c.ventas),
        comision: fmtCOP(comision),
        neto: fmtCOP(c.ventas - comision),
        comisionPct: c.comisionPct
      };
    });

    const totalVentas = fmtCOP(lista.reduce((s, c) => s + c.ventas, 0));
    const totalComision = fmtCOP(lista.reduce((s, c) => s + c.comision, 0));

    res.json({
      comercios: lista,
      totalVentas,
      totalComision,
      totalNeto: fmtCOP(totalVentas - totalComision)
    });
  } catch (error) {
    next(error);
  }
};

exports.getIVA = async (req, res, next) => {
  try {
    const { pagosCompletados } = await loadData(req.query.desde, req.query.hasta);

    const total = pagosCompletados.reduce((s, p) => s + parseFloat(p.valor || 0), 0);
    const { base, iva } = calcularIVA(total);

    res.json({
      ivaRate: IVA_RATE,
      montoConIVA: fmtCOP(total),
      baseGravable: base,
      iva: iva,
      subtotalSinIva: base
    });
  } catch (error) {
    next(error);
  }
};

exports.exportCSV = async (req, res, next) => {
  try {
    const { pagosCompletados, pedidoById, comercioById } =
      await loadData(req.query.desde, req.query.hasta);

    const lines = [
      ['Fecha', 'Referencia', 'Monto', 'Comercio', 'Cliente', 'Método', 'Estado']
    ];
    for (const pago of pagosCompletados) {
      const pedido = pedidoById.get(pago.pedidoId);
      const comercio = comercioById.get(pedido?.comercioId);
      lines.push([
        pago.fechaPago || pago.fechaCreacion || '',
        pago.referencia || '',
        String(pago.valor || 0),
        comercio?.nombreNegocio || '',
        pedido?.clienteNombre || '',
        pago.metodo || '',
        pago.estado || ''
      ]);
    }

    const csv = lines
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-contable-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
};
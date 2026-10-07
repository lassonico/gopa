const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const { esAbiertoAhora } = require('../../utils/horarios');
const notificationService = require('../../services/notification.service');
const { cola } = require('../../services/cola.service');

const SHEET = 'Pedidos';

const ESTADOS = ['pendiente', 'programado', 'confirmado', 'en preparación', 'recogido', 'en camino', 'entregado', 'cancelado'];

// Job: activar programados cuya hora llegó (pasan a pendiente + avisa al comercio)
exports.activarProgramados = async () => {
  try {
    const lista = await repository.findWhere(SHEET, 'estado', 'programado');
    let activados = 0;
    for (const p of lista) {
      if (!p.fechaProgramada || new Date(p.fechaProgramada).getTime() > Date.now()) continue;
      await repository.update(SHEET, p.id, { estado: 'pendiente' });
      activados++;
      await notificarComercio(p.comercioId, 'Pedido programado listo 📅', `El pedido #${p.id.slice(0, 8)} programado ya entró a cocina`, { tipo: 'pedido', pedidoId: p.id });
    }
    if (activados) console.log(`[Pedidos] Programados activados: ${activados}`);
    return activados;
  } catch (e) {
    console.warn('[Pedidos] Error activando programados:', e.message);
    return 0;
  }
};

async function notificarComercio(comercioId, titulo, mensaje, data = {}) {
  const usuarios = await repository.findAll('Usuarios');
  const comercios = usuarios.filter(u => u.rol === 'comercio' && u.comercioId === comercioId);
  for (const c of comercios) {
    cola.encolar('push-usuario', { userId: c.id, title: titulo, body: mensaje, data });
  }
}

exports.getAll = async (req, res, next) => {
  try {
    let pedidos;
    const filters = {};

    if (req.user.rol === 'cliente') {
      filters.clienteId = req.user.id;
    } else if (req.user.rol === 'comercio') {
      filters.comercioId = req.user.comercioId;
    } else if (req.user.rol === 'domiciliario') {
      const asignados = await repository.findWhere(SHEET, 'domiciliarioId', req.user.id);
      const libres = await repository.findWhereIn(SHEET, 'estado', ['recogido', 'en camino']);
      pedidos = [
        ...libres.filter(p => !p.domiciliarioId),
        ...asignados
      ];
    }

    if (req.query.estado) {
      const estados = req.query.estado.split(',');
      if (estados.length === 1) {
        filters.estado = estados[0];
      } else if (!pedidos) {
        pedidos = await repository.findWhereIn(SHEET, 'estado', estados);
      }
    }

    if (!pedidos) {
      pedidos = await repository.findWithFilters(SHEET, filters);
    }

    pedidos.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
    res.json(pedidos);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const pedido = await repository.findById(SHEET, req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const u = req.user;
    const permitido = u.rol === 'admin'
      || pedido.clienteId === u.id
      || (u.rol === 'comercio' && pedido.comercioId === u.comercioId)
      || (u.rol === 'domiciliario' && (!pedido.domiciliarioId || pedido.domiciliarioId === u.id));
    if (!permitido) return res.status(403).json({ error: 'No tienes permisos para ver este pedido' });
    res.json(pedido);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { comercioId, productos, direccionEntrega, notas, metodoPago, lat, lng, codigoCupon, fechaProgramada } = req.body;
    if (!comercioId || !productos) {
      return res.status(400).json({ error: 'comercioId y productos son requeridos' });
    }
    const esCoordenada = v => v !== undefined && v !== null && v !== '' && isFinite(Number(v));
    const comercio = await repository.findById('Comercios', comercioId);
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' });
    // Pedido programado: se acepta aunque esté cerrado; entra a cocina a su hora
    let programadoPara = null;
    if (fechaProgramada) {
      programadoPara = new Date(fechaProgramada);
      if (isNaN(programadoPara.getTime())) {
        return res.status(400).json({ error: 'Fecha programada inválida' });
      }
      const ahora = Date.now();
      if (programadoPara.getTime() <= ahora + 30 * 60000) {
        return res.status(400).json({ error: 'Programa con al menos 30 minutos de anticipación' });
      }
      if (programadoPara.getTime() > ahora + 7 * 86400000) {
        return res.status(400).json({ error: 'Solo puedes programar dentro de los próximos 7 días' });
      }
    } else if (comercio.activo === 'false' || !esAbiertoAhora(comercio.horarios)) {
      return res.status(409).json({ error: 'Este comercio no está recibiendo pedidos en este momento' });
    }
    // El total SIEMPRE se calcula en servidor (precios de BD, empaque,
    // domicilio, cupón y recargos). Lo que envíe el cliente se ignora.
    const { calcularTotal } = require('../../utils/precios');
    const calc = await calcularTotal({
      repository,
      items: typeof productos === 'string' ? JSON.parse(productos) : productos,
      comercio,
      metodoPago,
      codigoCupon,
      clienteId: req.user.id,
    });
    const nuevo = {
      id: generateId(),
      clienteId: req.user.id,
      clienteNombre: req.user.nombre,
      comercioId,
      productos: JSON.stringify(calc.detalle),
      direccionEntrega: direccionEntrega || '',
      notas: notas || '',
      total: calc.total,
      subtotal: calc.subtotal,
      descuento: calc.descuento,
      codigoCupon: calc.cupon ? calc.cupon.codigo : '',
      costoEmpaque: String(calc.costoEmpaque),
      tipoEmpaque: calc.tipoEmpaque,
      costoDomicilio: String(calc.costoDomicilio),
      recargo: String(calc.recargo),
      metodoPago: calc.metodo,
      estado: programadoPara ? 'programado' : 'pendiente',
      fechaProgramada: programadoPara ? programadoPara.toISOString().slice(0, 19).replace('T', ' ') : null,
      fechaCreacion: formatDate(),
      fechaEntrega: '',
      pagoEstado: 'pendiente',
      lat: esCoordenada(lat) ? String(lat) : '',
      lng: esCoordenada(lng) ? String(lng) : ''
    };
    await repository.create(SHEET, nuevo);
    res.status(201).json(nuevo);

    if (programadoPara) {
      await notificarComercio(comercioId, 'Pedido programado 📅', `Pedido #${nuevo.id.slice(0, 8)} programado para ${programadoPara.toLocaleString('es-CO')}`, { tipo: 'pedido', pedidoId: nuevo.id, comercioNombre: comercio?.nombreNegocio || '' });
    } else {
      await notificarComercio(comercioId, 'Nuevo pedido 📦', `Tienes un nuevo pedido #${nuevo.id.slice(0, 8)} de ${req.user.nombre || 'un cliente'} por $${parseFloat(calc.total).toLocaleString('es-CO')}`, { tipo: 'pedido', pedidoId: nuevo.id, comercioNombre: comercio?.nombreNegocio || '' });
    }
  } catch (error) {
    next(error);
  }
};

exports.cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS.join(', ')}` });
    }
    const pedido = await repository.findById(SHEET, req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Un programado no se toca: entra solo a su hora y ahí sigue el flujo normal
    if (pedido.estado === 'programado') {
      return res.status(400).json({ error: 'El pedido programado aún no llega a su hora; se activará solo' });
    }

    if (req.user.rol === 'comercio' && !['confirmado', 'en preparación', 'recogido'].includes(estado)) {
      return res.status(403).json({ error: 'El comercio solo puede cambiar a: confirmado, en preparación, recogido' });
    }
    if (req.user.rol === 'domiciliario' && !['en camino', 'entregado'].includes(estado)) {
      return res.status(403).json({ error: 'El domiciliario solo puede cambiar a: en camino, entregado' });
    }
    if (req.user.rol === 'domiciliario' && pedido.domiciliarioId && pedido.domiciliarioId !== req.user.id) {
      return res.status(403).json({ error: 'Este pedido está asignado a otro domiciliario' });
    }

    const updates = { estado };
    if (req.user.rol === 'domiciliario' && !pedido.domiciliarioId) {
      updates.domiciliarioId = req.user.id;
    }
    if (estado === 'entregado') {
      updates.fechaEntrega = formatDate();
      if (pedido.metodoPago === 'efectivo' || pedido.metodoPago === 'tarjeta') {
        updates.pagoEstado = 'completado';
      }
    }
    await repository.update(SHEET, req.params.id, updates);
    res.json({ message: `Estado actualizado a "${estado}"` });

    const estadosMsj = {
      confirmado: { t: 'Pedido confirmado ✅', m: 'Tu pedido #' + pedido.id.slice(0, 8) + ' fue confirmado por el comercio' },
      'en preparación': { t: 'Tu pedido en preparación 👨‍🍳', m: 'El comercio está preparando tu pedido #' + pedido.id.slice(0, 8) },
      recogido: { t: 'Pedido en camino 🛵', m: 'Tu pedido #' + pedido.id.slice(0, 8) + ' fue recogido y va en camino' },
      'en camino': { t: 'Tu repartidor va en camino 🛵', m: 'Tu pedido #' + pedido.id.slice(0, 8) + ' está en camino a tu dirección' },
      entregado: { t: 'Pedido entregado 🎉', m: 'Tu pedido #' + pedido.id.slice(0, 8) + ' fue entregado. ¡Disfruta!' },
      cancelado: { t: 'Pedido cancelado ❌', m: 'Tu pedido #' + pedido.id.slice(0, 8) + ' fue cancelado' }
    };
    const msj = estadosMsj[estado];
    if (msj) {
      cola.encolar('push-usuario', { userId: pedido.clienteId, title: msj.t, body: msj.m, data: { tipo: 'pedido', pedidoId: pedido.id } });
    }

    if (estado === 'en camino' && updates.domiciliarioId) {
      const comercio = await repository.findById('Comercios', pedido.comercioId);
      const nombreComercio = comercio?.nombreNegocio || 'el comercio';
      const pid = pedido.id;
      const did = updates.domiciliarioId;
      cola.encolar('push-usuario', {
        userId: did,
        title: 'Pedido aceptado ✅',
        body: `Tomaste el pedido #${pid.slice(0, 8)} de ${nombreComercio}. Dirígete a recogerlo.`,
        data: { tipo: 'pedido', pedidoId: pid },
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.actualizarUbicacionDomiciliario = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const esCoordenada = v => v !== undefined && v !== null && v !== '' && isFinite(Number(v));
    if (!esCoordenada(lat) || !esCoordenada(lng)) {
      return res.status(400).json({ error: 'lat y lng son requeridos para actualizar la ubicación' });
    }
    const pedido = await repository.findById(SHEET, req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.domiciliarioId && pedido.domiciliarioId !== req.user.id) {
      return res.status(403).json({ error: 'Este pedido está asignado a otro domiciliario' });
    }

    const updates = {
      domiciliarioLat: String(lat),
      domiciliarioLng: String(lng),
      ultimaUbicacion: new Date().toISOString(),
    };
    if (!pedido.domiciliarioId) {
      updates.domiciliarioId = req.user.id;
    }
    await repository.update(SHEET, req.params.id, updates);
    res.json({ message: 'Ubicación actualizada', ultimaUbicacion: updates.ultimaUbicacion });
  } catch (error) {
    next(error);
  }
};

exports.asignarDomiciliario = async (req, res, next) => {
  try {
    const { domiciliarioId } = req.body;
    if (!domiciliarioId) {
      return res.status(400).json({ error: 'domiciliarioId requerido' });
    }
    await repository.update(SHEET, req.params.id, { domiciliarioId, estado: 'en camino' });
    res.json({ message: 'Domiciliario asignado' });

    const pedido = await repository.findById(SHEET, req.params.id);
    const pidCorto2 = (pedido?.id || '').slice(0, 8);
    const pidFull2 = pedido?.id || req.params.id;
    const cliId2 = pedido?.clienteId;
    cola.encolar('push-usuario', { userId: domiciliarioId, title: 'Nuevo pedido asignado 🛵', body: `Te asignaron el pedido #${pidCorto2} para entregar`, data: { tipo: 'pedido', pedidoId: pidFull2 } });
    cola.encolar('push-usuario', { userId: cliId2, title: 'Tu pedido va en camino 🛵', body: `El pedido #${pidCorto2} tiene repartidor asignado`, data: { tipo: 'pedido', pedidoId: pidFull2 } });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, req.body);
    res.json({ message: 'Pedido actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Pedido eliminado' });
  } catch (error) {
    next(error);
  }
};
const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');

const SHEET = 'Calificaciones';
const COMERCIOS = 'Comercios';

exports.getByDomiciliario = async (req, res, next) => {
  try {
    const calificaciones = await repository.findWhere(SHEET, 'domiciliarioId', req.params.domiciliarioId);
    res.json(calificaciones.filter(c => c.visible !== 'false'));
  } catch (error) {
    next(error);
  }
};

exports.getByComercio = async (req, res, next) => {
  try {
    const calificaciones = await repository.findWhere(SHEET, 'comercioId', req.params.comercioId);
    res.json(calificaciones.filter(c => c.visible !== 'false'));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const calificacion = await repository.findById(SHEET, req.params.id);
    if (!calificacion) return res.status(404).json({ error: 'Calificación no encontrada' });
    res.json(calificacion);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, req.body);
    res.json({ message: 'Calificación actualizada' });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      comercioId, pedidoId, domiciliarioId, calificacionGeneral, calidadProductos,
      tiempoPreparacion, tiempoEntrega, atencionComercio,
      atencionDomiciliario, comentario
    } = req.body;
    if (!comercioId || !pedidoId || !calificacionGeneral) {
      return res.status(400).json({ error: 'comercioId, pedidoId y calificacionGeneral requeridos' });
    }
    const enRango = (v, min, max) => {
      if (v === '' || v === undefined || v === null) return true;
      const n = Number(v);
      return !Number.isNaN(n) && n >= min && n <= max;
    };
    if (!enRango(calificacionGeneral, 1, 5)) {
      return res.status(400).json({ error: 'La calificación general debe estar entre 1 y 5' });
    }
    for (const [campo, valor] of Object.entries({ calidadProductos, tiempoPreparacion, tiempoEntrega, atencionComercio, atencionDomiciliario })) {
      if (!enRango(valor, 0, 5)) {
        return res.status(400).json({ error: `El campo ${campo} debe estar entre 0 y 5` });
      }
    }
    // Solo el dueño del pedido, cuando está entregado, y una sola vez
    const pedido = await repository.findById('Pedidos', pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (req.user.rol === 'cliente' && pedido.clienteId !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes calificar tus propios pedidos' });
    }
    if (pedido.estado !== 'entregado') {
      return res.status(400).json({ error: 'Solo puedes calificar pedidos entregados' });
    }
    const previas = await repository.findWhere(SHEET, 'pedidoId', pedidoId);
    if (previas.some(c => c.clienteId === req.user.id)) {
      return res.status(409).json({ error: 'Ya calificaste este pedido' });
    }
    const nueva = {
      id: generateId(),
      comercioId,
      pedidoId,
      domiciliarioId: domiciliarioId || '',
      clienteId: req.user.id,
      clienteNombre: req.user.nombre,
      calificacionGeneral,
      calidadProductos: calidadProductos || '',
      tiempoPreparacion: tiempoPreparacion || '',
      tiempoEntrega: tiempoEntrega || '',
      atencionComercio: atencionComercio || '',
      atencionDomiciliario: atencionDomiciliario || '',
      comentario: comentario || '',
      visible: 'true',
      fecha: formatDate()
    };
    await repository.create(SHEET, nueva);
    const calificaciones = await repository.findWhere(SHEET, 'comercioId', comercioId);
    const visibles = calificaciones.filter(c => c.visible !== 'false');
    const promedio = visibles.reduce((sum, c) => sum + parseFloat(c.calificacionGeneral || 0), 0) / (visibles.length || 1);
    await repository.update(COMERCIOS, comercioId, {
      calificacionPromedio: promedio.toFixed(1),
      totalCalificaciones: visibles.length.toString()
    });

    if (domiciliarioId) {
      const domicilioCalifs = calificaciones.filter(c => c.domiciliarioId === domiciliarioId && c.visible !== 'false' && c.atencionDomiciliario);
      if (domicilioCalifs.length > 0) {
        const promDomicilio = domicilioCalifs.reduce((sum, c) => sum + parseFloat(c.atencionDomiciliario || 0), 0) / domicilioCalifs.length;
        const userRepo = require('../../repositories');
        await userRepo.update('Usuarios', domiciliarioId, {
          calificacionPromedio: promDomicilio.toFixed(1),
          totalCalificaciones: domicilioCalifs.length.toString()
        });
      }
    }

    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { visible: 'false' });
    res.json({ message: 'Calificación ocultada' });
  } catch (error) {
    next(error);
  }
};

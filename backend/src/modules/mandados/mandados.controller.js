const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const notificationService = require('../../services/notification.service');
const { cola } = require('../../services/cola.service');

const SHEET = 'Mandados';

exports.create = async (req, res, next) => {
  try {
    const { direccion = '', lat = '', lng = '', enlace = '' } = req.body || {};
    const direccionValida = typeof direccion === 'string' && direccion.trim().length > 0;
    const esCoordenada = v => v !== undefined && v !== null && v !== '' && isFinite(Number(v));
    const ubicacionValida = esCoordenada(lat) && esCoordenada(lng);

    if (!direccionValida && !ubicacionValida) {
      return res.status(400).json({ error: 'Indica una dirección o comparte tu ubicación actual.' });
    }

    const nuevo = {
      id: generateId(),
      clienteId: req.user.id,
      clienteNombre: req.user.nombre || 'Cliente',
      clienteTelefono: req.user.telefono || '',
      direccion: direccion.trim(),
      enlace: enlace || '',
      lat: ubicacionValida ? String(lat) : '',
      lng: ubicacionValida ? String(lng) : '',
      estado: 'solicitado',
      fecha: formatDate()
    };
    await repository.create(SHEET, nuevo);

    const detalle = nuevo.direccion || (nuevo.enlace || `${nuevo.lat},${nuevo.lng}`);
    cola.encolar('push-rol', {
      role: 'domiciliario', title: '🚴 Mandado Express',
      body: `${nuevo.clienteNombre} solicita un mensajero. ${detalle}`,
      data: { tipo: 'mandado', mandadoId: nuevo.id },
    });

    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const mandados = await repository.findAll(SHEET);
    const filtrados = req.query.estado
      ? mandados.filter(m => m.estado === req.query.estado)
      : mandados;
    filtrados.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    res.json(filtrados);
  } catch (error) {
    next(error);
  }
};

// PUT /api/mandados/:id/tomar (domiciliario)
exports.tomar = async (req, res, next) => {
  try {
    const mandado = await repository.findById(SHEET, req.params.id);
    if (!mandado) return res.status(404).json({ error: 'Diligencia no encontrada' });
    if (mandado.estado !== 'solicitado') {
      return res.status(400).json({ error: `La diligencia ya está ${mandado.estado}` });
    }
    await repository.update(SHEET, mandado.id, {
      estado: 'tomado',
      domiciliarioId: req.user.id,
      domiciliarioNombre: req.user.nombre || ''
    });
    cola.encolar('push-usuario', {
      userId: mandado.clienteId, title: 'Mensajero en camino 🚴',
      body: `${req.user.nombre || 'Un domiciliario'} tomó tu mandado y va en camino.`,
      data: { tipo: 'mandado', mandadoId: mandado.id },
    });
    res.json({ message: 'Diligencia tomada' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/mandados/:id/entregar (domiciliario dueño o admin)
exports.entregar = async (req, res, next) => {
  try {
    const mandado = await repository.findById(SHEET, req.params.id);
    if (!mandado) return res.status(404).json({ error: 'Diligencia no encontrada' });
    if (req.user.rol === 'domiciliario' && mandado.domiciliarioId !== req.user.id) {
      return res.status(403).json({ error: 'Esta diligencia la tomó otro domiciliario' });
    }
    if (mandado.estado !== 'tomado') {
      return res.status(400).json({ error: `La diligencia está ${mandado.estado}` });
    }
    await repository.update(SHEET, mandado.id, {
      estado: 'entregado',
      fechaEntrega: new Date().toISOString()
    });
    cola.encolar('push-usuario', {
      userId: mandado.clienteId, title: 'Diligencia entregada ✅',
      body: 'Tu mandado fue entregado. ¡Gracias por usar GoPalermo!',
      data: { tipo: 'mandado', mandadoId: mandado.id },
    });
    res.json({ message: 'Diligencia entregada' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/mandados/:id/cancelar (cliente dueño o admin)
exports.cancelar = async (req, res, next) => {
  try {
    const mandado = await repository.findById(SHEET, req.params.id);
    if (!mandado) return res.status(404).json({ error: 'Diligencia no encontrada' });
    if (req.user.rol === 'cliente' && mandado.clienteId !== req.user.id) {
      return res.status(403).json({ error: 'No puedes cancelar esta diligencia' });
    }
    if (['entregado', 'cancelado'].includes(mandado.estado)) {
      return res.status(400).json({ error: `La diligencia ya está ${mandado.estado}` });
    }
    await repository.update(SHEET, mandado.id, { estado: 'cancelado' });
    res.json({ message: 'Diligencia cancelada' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/mandados/:id (admin)
exports.eliminar = async (req, res, next) => {
  try {
    const mandado = await repository.findById(SHEET, req.params.id);
    if (!mandado) return res.status(404).json({ error: 'Diligencia no encontrada' });
    await repository.delete(SHEET, mandado.id);
    res.json({ message: 'Diligencia eliminada' });
  } catch (error) {
    next(error);
  }
};

// Limpieza: borra entregadas/canceladas con más de 30 días
exports.limpiarAntiguos = async () => {
  try {
    const limite = Date.now() - 30 * 86400000;
    const mandados = await repository.findAll(SHEET);
    let borrados = 0;
    for (const m of mandados) {
      if (!['entregado', 'cancelado'].includes(m.estado)) continue;
      const f = new Date(m.fechaEntrega || m.fecha || 0).getTime();
      if (f && f < limite) {
        await repository.delete(SHEET, m.id);
        borrados++;
      }
    }
    if (borrados) console.log(`[Mandados] Limpieza: ${borrados} diligencias antiguas eliminadas`);
    return borrados;
  } catch (e) {
    console.warn('[Mandados] Limpieza fallida:', e.message);
    return 0;
  }
};
const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');

const SHEET = 'Servicios';

exports.getAll = async (req, res, next) => {
  try {
    const servicios = await repository.findAll(SHEET);
    res.json(servicios.filter(s => s.activo !== 'false' && s.estado !== 'pendiente'));
  } catch (error) {
    next(error);
  }
};

exports.getAllAdmin = async (req, res, next) => {
  try {
    const servicios = await repository.findAll(SHEET);
    res.json(servicios);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const servicio = await repository.findById(SHEET, req.params.id);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
    if (servicio.activo === 'false' || servicio.estado === 'pendiente') {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(servicio);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { tipoPersona, nombre, servicio, descripcion, telefono, logo, imagen } = req.body;
    if (!tipoPersona || !nombre || !servicio || !telefono) {
      return res.status(400).json({ error: 'tipoPersona, nombre, servicio y teléfono son requeridos' });
    }
    const nuevo = {
      id: generateId(),
      tipoPersona,
      nombre,
      servicio,
      descripcion: descripcion || '',
      telefono,
      whatsapp: telefono,
      logo: logo || '',
      imagen: imagen || '',
      precio: 0,
      categoria: 'Servicios',
      activo: 'true',
      estado: 'aprobado',
      fechaRegistro: formatDate()
    };
    await repository.create(SHEET, nuevo);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.registroProveedor = async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const { tipoPersona, nombre, servicio, descripcion, telefono, logo, imagen } = body;
    const nuevo = {
      id: generateId(),
      tipoPersona,
      nombre,
      servicio,
      descripcion: descripcion || '',
      telefono,
      logo: logo || '',
      imagen: imagen || '',
      precio: '',
      categoria: 'Servicios',
      activo: 'true',
      estado: 'pendiente',
      fechaRegistro: formatDate()
    };
    await repository.create(SHEET, nuevo);

    await repository.create('Notificaciones', {
      id: generateId(),
      titulo: 'Nueva solicitud de servicio',
      mensaje: `${nombre} solicitó aparecer ofreciendo: ${servicio}`,
      destinatarioId: '',
      dirigidoA: 'admin',
      tipo: 'solicitud',
      leida: 'false',
      fecha: formatDate()
    });

    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.aprobar = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { estado: 'aprobado' });
    res.json({ message: 'Servicio aprobado' });
  } catch (error) {
    next(error);
  }
};

exports.rechazar = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { estado: 'rechazado' });
    res.json({ message: 'Servicio rechazado' });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, req.body);
    res.json({ message: 'Servicio actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { activo: 'false' });
    res.json({ message: 'Servicio eliminado' });
  } catch (error) {
    next(error);
  }
};

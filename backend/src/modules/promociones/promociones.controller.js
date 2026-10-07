const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');

const SHEET = 'Promociones';

exports.getAll = async (req, res, next) => {
  try {
    const promos = await repository.findAll(SHEET);
    const now = new Date();
    res.json(promos.filter(p => {
      if (p.activo === 'false') return false;
      if (!p.fechaVencimiento) return true;
      const fecha = new Date(p.fechaVencimiento);
      return !isNaN(fecha.getTime()) && fecha >= now;
    }));
  } catch (error) {
    next(error);
  }
};

exports.getAllAdmin = async (req, res, next) => {
  try {
    const promos = await repository.findAll(SHEET);
    res.json(promos);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const promo = await repository.findById(SHEET, req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
    res.json(promo);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { titulo, descripcion, tipo, valor, comercioId, imagen, fechaVencimiento, link, activo } = req.body;
    if (!titulo || !tipo) return res.status(400).json({ error: 'Título y tipo requeridos' });
    const nueva = {
      id: generateId(),
      titulo,
      descripcion: descripcion || '',
      tipo,
      valor: valor || '',
      comercioId: comercioId || '',
      imagen: imagen || '',
      link: link || '',
      fechaVencimiento: fechaVencimiento || null,
      activo: activo || 'true',
      fechaCreacion: new Date().toISOString()
    };
    await repository.create(SHEET, nueva);
    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.fechaVencimiento !== undefined) {
      if (!body.fechaVencimiento) body.fechaVencimiento = null;
      else {
        const d = new Date(body.fechaVencimiento);
        body.fechaVencimiento = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    await repository.update(SHEET, req.params.id, body);
    res.json({ message: 'Promoción actualizada' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Promoción eliminada' });
  } catch (error) {
    next(error);
  }
};

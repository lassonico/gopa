const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');

const SHEET = 'Categorias';

exports.getAll = async (req, res, next) => {
  try {
    const categorias = await repository.findAll(SHEET);
    res.json(categorias.filter(c => c.activo !== 'false'));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const categoria = await repository.findById(SHEET, req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(categoria);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, descripcion, icono, grupo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const grupoNorm = ['consumo', 'tiendas', 'otros'].includes(grupo) ? grupo : 'otros';
    const nueva = {
      id: generateId(),
      nombre,
      descripcion: descripcion || '',
      icono: icono || '',
      grupo: grupoNorm,
      activo: 'true'
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
    if (body.grupo !== undefined && !['consumo', 'tiendas', 'otros'].includes(body.grupo)) {
      return res.status(400).json({ error: 'Grupo inválido (consumo, tiendas u otros)' });
    }
    await repository.update(SHEET, req.params.id, body);
    res.json({ message: 'Categoría actualizada' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    next(error);
  }
};

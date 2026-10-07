const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');

const SHEET = 'Subcategorias';

exports.getAll = async (req, res, next) => {
  try {
    const [subcategorias, categorias] = await Promise.all([
      repository.findAll(SHEET),
      repository.findAll('Categorias')
    ]);
    const catMap = {};
    categorias.forEach(c => { catMap[c.id] = c.nombre; });
    res.json(
      subcategorias
        .filter(s => s.activo !== 'false')
        .map(s => ({ ...s, categoriaNombre: catMap[s.categoriaId] || '' }))
    );
  } catch (error) {
    next(error);
  }
};

exports.getAllAdmin = async (req, res, next) => {
  try {
    const subcategorias = await repository.findAll(SHEET);
    const categorias = await repository.findAll('Categorias');
    const catMap = {};
    categorias.forEach(c => { catMap[c.id] = c.nombre; });
    const resultado = subcategorias.map(s => ({
      ...s,
      categoriaNombre: catMap[s.categoriaId] || ''
    }));
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

exports.getByCategoria = async (req, res, next) => {
  try {
    const subcategorias = await repository.findWhere(SHEET, 'categoriaId', req.params.categoriaId);
    res.json(subcategorias.filter(s => s.activo !== 'false'));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const subcategoria = await repository.findById(SHEET, req.params.id);
    if (!subcategoria) return res.status(404).json({ error: 'Subcategoría no encontrada' });
    res.json(subcategoria);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, categoriaId, descripcion } = req.body;
    if (!nombre || !categoriaId) {
      return res.status(400).json({ error: 'nombre y categoriaId son requeridos' });
    }
    const categoria = await repository.findById('Categorias', categoriaId);
    if (!categoria) {
      return res.status(400).json({ error: 'La categoría padre no existe' });
    }
    const nueva = {
      id: generateId(),
      nombre,
      categoriaId,
      descripcion: descripcion || '',
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
    await repository.update(SHEET, req.params.id, req.body);
    res.json({ message: 'Subcategoría actualizada' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Subcategoría eliminada' });
  } catch (error) {
    next(error);
  }
};

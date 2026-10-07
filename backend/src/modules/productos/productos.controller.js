const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');

const SHEET = 'Productos';

function esDueño(req, comercioId) {
  return req.user.rol === 'admin' || (req.user.rol === 'comercio' && req.user.comercioId === comercioId);
}

exports.getAll = async (req, res, next) => {
  try {
    const [productos, comercios, subcategorias] = await Promise.all([
      repository.findAll(SHEET),
      repository.findAll('Comercios'),
      repository.findAll('Subcategorias')
    ]);
    const result = productos.map(p => {
      const com = comercios.find(c => c.id === p.comercioId);
      const sub = subcategorias.find(s => s.id === p.subcategoriaId);
      return { ...p, nombreNegocio: com?.nombreNegocio || '', subcategoriaNombre: sub?.nombre || '' };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getByComercio = async (req, res, next) => {
  try {
    const [productos, subcategorias] = await Promise.all([
      repository.findWhere(SHEET, 'comercioId', req.params.comercioId),
      repository.findAll('Subcategorias')
    ]);
    const resultado = productos.filter(p => p.activo !== 'false').map(p => {
      const sub = subcategorias.find(s => s.id === p.subcategoriaId);
      return { ...p, subcategoriaNombre: sub?.nombre || '' };
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const producto = await repository.findById(SHEET, req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { comercioId, nombre, descripcion, precio, categoria, subcategoriaId, imagen, emoji, tallas, colores, derechos } = req.body;
    if (!comercioId || !nombre || !precio) {
      return res.status(400).json({ error: 'comercioId, nombre y precio son requeridos' });
    }
    if (!esDueño(req, comercioId)) {
      return res.status(403).json({ error: 'No tienes permisos para crear productos en este comercio' });
    }
    if (imagen && derechos !== true && derechos !== 'true') {
      return res.status(400).json({ error: 'Debes declarar que tienes derechos sobre la imagen' });
    }
    const aLista = (v) => {
      const arr = Array.isArray(v) ? v : String(v || '').split(',');
      return arr.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 20);
    };
    const nuevo = {
      id: generateId(),
      comercioId,
      nombre,
      descripcion: descripcion || '',
      precio,
      categoria: categoria || '',
      subcategoriaId: subcategoriaId || '',
      imagen: imagen || '',
      emoji: emoji ? String(emoji).slice(0, 10) : '',
      derechos: derechos === true || derechos === 'true' ? 'true' : 'false',
      tallas: JSON.stringify(aLista(tallas)),
      colores: JSON.stringify(aLista(colores)),
      activo: 'true',
      destacado: 'false'
    };
    await repository.create(SHEET, nuevo);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const producto = await repository.findById(SHEET, req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!esDueño(req, producto.comercioId)) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este producto' });
    }
    const body = { ...req.body };
    delete body.id; delete body.comercioId;
    const aLista = (v) => {
      const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
      return arr.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 20);
    };
    // Solo columnas conocidas; tallas/colores siempre como JSON
    const PERMITIDOS = ['nombre', 'descripcion', 'precio', 'categoria', 'subcategoriaId', 'imagen', 'emoji', 'tallas', 'colores', 'derechos', 'activo', 'destacado', 'menuDia', 'menuFecha'];
    const limpio = {};
    for (const k of PERMITIDOS) {
      if (body[k] === undefined) continue;
      limpio[k] = (k === 'tallas' || k === 'colores') ? JSON.stringify(aLista(body[k])) : body[k];
    }
    if (limpio.emoji !== undefined) limpio.emoji = String(limpio.emoji).slice(0, 10);
    await repository.update(SHEET, req.params.id, limpio);
    res.json({ message: 'Producto actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const producto = await repository.findById(SHEET, req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!esDueño(req, producto.comercioId)) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este producto' });
    }
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    next(error);
  }
};

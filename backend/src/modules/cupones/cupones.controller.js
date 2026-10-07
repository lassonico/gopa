const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');

const SHEET = 'Cupones';

exports.getAll = async (req, res, next) => {
  try {
    const cupones = await repository.findAll(SHEET);
    res.json(cupones.filter(c => c.activo !== 'false'));
  } catch (error) {
    next(error);
  }
};

exports.getAllAdmin = async (req, res, next) => {
  try {
    const cupones = await repository.findAll(SHEET);
    res.json(cupones);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const cupon = await repository.findById(SHEET, req.params.id);
    if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json(cupon);
  } catch (error) {
    next(error);
  }
};

exports.validar = async (req, res, next) => {
  try {
    const { codigo, totalCarrito, usuarioId } = req.body;
    const cupones = await repository.findAll(SHEET);
    const cupon = cupones.find(c => c.codigo === codigo && c.activo === 'true');
    if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' });
    const now = new Date();
    if (cupon.fechaVencimiento && new Date(cupon.fechaVencimiento) < now) {
      return res.status(400).json({ error: 'Cupón vencido' });
    }
    if (cupon.fechaInicio && new Date(cupon.fechaInicio) > now) {
      return res.status(400).json({ error: 'Cupón aún no válido' });
    }
    if (cupon.limiteUsos && parseInt(cupon.usosActuales || 0) >= parseInt(cupon.limiteUsos)) {
      return res.status(400).json({ error: 'Cupón agotado' });
    }
    if (cupon.compraMinima && parseFloat(totalCarrito) < parseFloat(cupon.compraMinima)) {
      return res.status(400).json({ error: `Compra mínima de $${cupon.compraMinima}` });
    }
    if (cupon.exclusivoUsuario && cupon.exclusivoUsuario !== usuarioId) {
      return res.status(400).json({ error: 'Cupón exclusivo para otro usuario' });
    }
    let descuento = 0;
    if (cupon.tipo === 'porcentaje') {
      descuento = (parseFloat(totalCarrito) * parseFloat(cupon.valor)) / 100;
    } else if (cupon.tipo === 'valor_fijo') {
      descuento = parseFloat(cupon.valor);
    } else if (cupon.tipo === 'domicilio_gratis') {
      descuento = parseFloat(cupon.valor || 0);
    }
    res.json({ valido: true, descuento, cupon });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      codigo, tipo, valor, compraMinima, fechaInicio,
      fechaVencimiento, limiteUsos, exclusivoUsuario, soloNuevos
    } = req.body;
    if (!codigo || !tipo || !valor) {
      return res.status(400).json({ error: 'código, tipo y valor requeridos' });
    }
    const fechaValida = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
    };
    const enteroValido = (v) => {
      if (v === '' || v == null) return 0;
      const n = parseInt(v, 10);
      return Number.isNaN(n) || n < 0 ? 0 : n;
    };
    const nuevo = {
      id: generateId(),
      codigo: codigo.toUpperCase(),
      tipo,
      valor,
      compraMinima: compraMinima === '' || compraMinima == null ? 0 : compraMinima,
      fechaInicio: fechaValida(fechaInicio),
      fechaVencimiento: fechaValida(fechaVencimiento),
      limiteUsos: enteroValido(limiteUsos),
      usosActuales: '0',
      exclusivoUsuario: exclusivoUsuario || '',
      soloNuevos: soloNuevos || 'false',
      activo: 'true'
    };
    await repository.create(SHEET, nuevo);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const body = { ...req.body };
    for (const f of ['fechaInicio', 'fechaVencimiento']) {
      if (body[f] !== undefined) {
        if (!body[f]) body[f] = null;
        else {
          const d = new Date(body[f]);
          body[f] = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
        }
      }
    }
    for (const f of ['limiteUsos', 'usosActuales']) {
      if (body[f] !== undefined) {
        const n = parseInt(body[f], 10);
        body[f] = (body[f] === '' || Number.isNaN(n) || n < 0) ? 0 : n;
      }
    }
    if (body.compraMinima !== undefined && body.compraMinima === '') body.compraMinima = 0;
    await repository.update(SHEET, req.params.id, body);
    res.json({ message: 'Cupón actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Cupón eliminado' });
  } catch (error) {
    next(error);
  }
};

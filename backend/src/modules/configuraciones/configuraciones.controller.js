const repository = require('../../repositories');
const { leerTarifas } = require('../../services/tarifas.service');

const SHEET = 'Configuraciones';
const CLAVES = { comisionVentas: 'comisionVentas', valorDomicilio: 'valorDomicilio' };

async function guardarClave(clave, valor) {
  const existente = await repository.findOne(SHEET, 'clave', clave);
  const fila = { id: clave, clave, valor: String(valor) };
  if (existente) await repository.update(SHEET, existente.id, { valor: String(valor) });
  else await repository.create(SHEET, fila);
}

exports.getTarifas = async (req, res, next) => {
  try {
    res.json(await leerTarifas(repository));
  } catch (error) {
    next(error);
  }
};

exports.getPublicas = async (req, res, next) => {
  try {
    const tarifas = await leerTarifas(repository);
    res.json({ valorDomicilio: tarifas.valorDomicilio });
  } catch (error) {
    next(error);
  }
};

exports.updateTarifas = async (req, res, next) => {
  try {
    const { comisionVentas, valorDomicilio } = req.body;

    if (comisionVentas !== undefined && comisionVentas !== null && comisionVentas !== '') {
      const pct = Number(String(comisionVentas).replace(',', '.'));
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'La comisión debe ser un número entre 0 y 100' });
      }
      await guardarClave(CLAVES.comisionVentas, pct);
      const comercios = await repository.findAll('Comercios');
      for (const c of comercios) {
        await repository.update('Comercios', c.id, { comision: pct });
      }
    }

    if (valorDomicilio !== undefined && valorDomicilio !== null && valorDomicilio !== '') {
      const v = Number(String(valorDomicilio).replace(',', '.'));
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ error: 'El valor del domicilio debe ser un número mayor o igual a 0' });
      }
      await guardarClave(CLAVES.valorDomicilio, v);
    }

    res.json(await leerTarifas(repository));
  } catch (error) {
    next(error);
  }
};

const repository = require('../../repositories');
const { cola } = require('../../services/cola.service');

const SHEET = 'TrabajosFallidos';

// GET /api/trabajos (admin) — Dead Letter Queue
exports.getAll = async (req, res, next) => {
  try {
    const trabajos = await repository.findAll(SHEET);
    trabajos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    res.json(trabajos);
  } catch (error) {
    next(error);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const trabajos = await repository.findAll(SHEET);
    res.json({ ...cola.stats(), enDLQ: trabajos.length });
  } catch (error) {
    next(error);
  }
};

// POST /api/trabajos/:id/reintentar (admin)
exports.reintentar = async (req, res, next) => {
  try {
    const trabajo = await repository.findById(SHEET, req.params.id);
    if (!trabajo) return res.status(404).json({ error: 'Trabajo no encontrado' });
    let payload = {};
    try { payload = JSON.parse(trabajo.payload || '{}'); } catch {}
    if (!cola.encolar(trabajo.tipo, payload)) {
      return res.status(400).json({ error: `Tipo de trabajo desconocido: ${trabajo.tipo}` });
    }
    await repository.delete(SHEET, trabajo.id);
    res.json({ message: 'Trabajo reencolado' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/trabajos/:id (admin)
exports.eliminar = async (req, res, next) => {
  try {
    const trabajo = await repository.findById(SHEET, req.params.id);
    if (!trabajo) return res.status(404).json({ error: 'Trabajo no encontrado' });
    await repository.delete(SHEET, trabajo.id);
    res.json({ message: 'Trabajo descartado' });
  } catch (error) {
    next(error);
  }
};

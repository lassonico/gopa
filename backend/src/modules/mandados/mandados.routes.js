const router = require('express').Router();
const controller = require('./mandados.controller');
const { authenticate, authorize, requireTelefonoVerificado } = require('../../middleware/auth.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.post('/', authenticate, authorize('cliente'), requireTelefonoVerificado, porUsuario(20), controller.create);
router.get('/', authenticate, authorize('domiciliario', 'admin'), controller.getAll);
router.put('/:id/tomar', authenticate, authorize('domiciliario'), controller.tomar);
router.put('/:id/entregar', authenticate, authorize('domiciliario', 'admin'), controller.entregar);
router.put('/:id/cancelar', authenticate, authorize('cliente', 'admin'), controller.cancelar);
router.delete('/:id', authenticate, authorize('admin'), controller.eliminar);

module.exports = router;

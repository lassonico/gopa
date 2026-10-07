const router = require('express').Router();
const controller = require('./pedidos.controller');
const { authenticate, authorize, requireTelefonoVerificado } = require('../../middleware/auth.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.get('/', authenticate, controller.getAll);
router.get('/:id', authenticate, controller.getById);
router.post('/', authenticate, requireTelefonoVerificado, porUsuario(60), controller.create);
router.put('/:id/estado', authenticate, authorize('admin', 'comercio', 'domiciliario'), controller.cambiarEstado);
router.put('/:id/ubicacion', authenticate, authorize('domiciliario'), controller.actualizarUbicacionDomiciliario);
router.put('/:id/asignar-domiciliario', authenticate, authorize('admin'), controller.asignarDomiciliario);
router.put('/:id', authenticate, authorize('admin', 'comercio'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

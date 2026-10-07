const router = require('express').Router();
const controller = require('./calificaciones.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.get('/comercio/:comercioId', controller.getByComercio);
router.get('/domiciliario/:domiciliarioId', controller.getByDomiciliario);
router.get('/:id', controller.getById);
router.post('/', authenticate, porUsuario(30), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

const router = require('express').Router();
const controller = require('./notificaciones.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, controller.getByUser);
router.get('/:id', authenticate, controller.getById);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id/leida', authenticate, controller.marcarLeida);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

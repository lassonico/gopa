const router = require('express').Router();
const controller = require('./domiciliarios.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, authorize('admin'), controller.getAll);
router.get('/:id', authenticate, authorize('admin'), controller.getById);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.put('/:id/toggle-disponible', authenticate, authorize('admin', 'domiciliario'), controller.toggleDisponible);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);
router.post('/:id/reset-password', authenticate, authorize('admin'), controller.resetPasswordAdmin);

module.exports = router;

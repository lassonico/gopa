const router = require('express').Router();
const controller = require('./trabajos.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, authorize('admin'), controller.getAll);
router.get('/stats', authenticate, authorize('admin'), controller.stats);
router.post('/:id/reintentar', authenticate, authorize('admin'), controller.reintentar);
router.delete('/:id', authenticate, authorize('admin'), controller.eliminar);

module.exports = router;

const router = require('express').Router();
const controller = require('./cupones.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { porIp } = require('../../middleware/limites.middleware');

router.get('/', controller.getAll);
router.get('/todos', authenticate, authorize('admin'), controller.getAllAdmin);
router.get('/:id', controller.getById);
router.post('/validar', porIp(20), controller.validar);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

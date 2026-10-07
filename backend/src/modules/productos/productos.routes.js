const router = require('express').Router();
const controller = require('./productos.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', controller.getAll);
router.get('/comercio/:comercioId', controller.getByComercio);
router.get('/:id', controller.getById);
router.post('/', authenticate, authorize('admin', 'comercio'), controller.create);
router.put('/:id', authenticate, authorize('admin', 'comercio'), controller.update);
router.delete('/:id', authenticate, authorize('admin', 'comercio'), controller.delete);

module.exports = router;

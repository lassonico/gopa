const router = require('express').Router();
const controller = require('./categorias.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

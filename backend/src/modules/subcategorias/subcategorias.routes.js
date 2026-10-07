const router = require('express').Router();
const controller = require('./subcategorias.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', controller.getAll);
router.get('/admin/todos', authenticate, authorize('admin'), controller.getAllAdmin);
router.get('/categoria/:categoriaId', controller.getByCategoria);
router.get('/:id', controller.getById);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;
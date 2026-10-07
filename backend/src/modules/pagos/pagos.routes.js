const router = require('express').Router();
const controller = require('./pagos.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.get('/', authenticate, authorize('admin'), controller.getAll);
router.get('/:id', authenticate, authorize('admin'), controller.getById);
router.get('/referencia/:referencia', authenticate, porUsuario(60), controller.consultarTransaccion);
router.post('/crear-transaccion', authenticate, porUsuario(20), controller.crearTransaccion);
router.post('/generar-enlace', authenticate, porUsuario(20), controller.generarEnlace);
router.post('/webhook', controller.webhook);

module.exports = router;

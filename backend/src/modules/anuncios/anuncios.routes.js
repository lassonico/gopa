const router = require('express').Router();
const controller = require('./anuncios.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.post('/', authenticate, authorize('comercio'), porUsuario(10), controller.crear);
router.get('/mios', authenticate, authorize('comercio'), controller.mios);
router.get('/consultar/:referencia', authenticate, authorize('comercio', 'admin'), controller.consultar);
router.post('/webhook', controller.webhook);

module.exports = router;

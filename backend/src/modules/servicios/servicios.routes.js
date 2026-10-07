const router = require('express').Router();
const controller = require('./servicios.controller');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize, requireTelefonoVerificado } = require('../../middleware/auth.middleware');
const verifyTurnstile = require('../../middleware/turnstile.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en una hora.' }
});

router.get('/', controller.getAll);
router.get('/todos', authenticate, authorize('admin'), controller.getAllAdmin);
router.get('/:id', controller.getById);
router.post('/registro', registroLimiter, verifyTurnstile('register'), validate(schemas.registroServicio), controller.registroProveedor);
router.post('/', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('admin'), controller.update);
router.put('/:id/aprobar', authenticate, authorize('admin'), controller.aprobar);
router.put('/:id/rechazar', authenticate, authorize('admin'), controller.rechazar);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

module.exports = router;

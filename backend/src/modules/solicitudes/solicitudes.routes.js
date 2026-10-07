const router = require('express').Router();
const controller = require('./solicitudes.controller');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const verifyTurnstile = require('../../middleware/turnstile.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

const solicitudLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en una hora.' }
});

router.get('/', authenticate, authorize('admin'), controller.getAll);
router.get('/:id', authenticate, authorize('admin'), controller.getById);
const cartaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiados análisis de carta. Intenta de nuevo en una hora.' }
});

router.post('/analizar-carta', cartaLimiter, controller.analizarCarta);
router.post('/registro-comercio', solicitudLimiter, verifyTurnstile('register'), validate(schemas.solicitarComercio), controller.solicitarRegistroComercio);
router.post('/registro-domiciliario', solicitudLimiter, verifyTurnstile('register'), validate(schemas.solicitarDomiciliario), controller.solicitarRegistroDomiciliario);
router.put('/:id/aprobar', authenticate, authorize('admin'), controller.aprobar);
router.put('/:id/rechazar', authenticate, authorize('admin'), controller.rechazar);

module.exports = router;

const router = require('express').Router();
const usersController = require('./users.controller');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Demasiadas solicitudes de verificación, intenta más tarde.' }
});

router.get('/', authenticate, authorize('admin'), usersController.getAll);
router.get('/:id', authenticate, usersController.getById);
router.post('/', authenticate, authorize('admin'), usersController.create);
router.put('/:id', authenticate, usersController.update);
router.delete('/:id', authenticate, authorize('admin'), usersController.delete);
router.delete('/:id/eliminar-cuenta', authenticate, usersController.eliminarCuenta);

router.post('/:id/sms/verificar-firebase', authenticate, smsLimiter, usersController.verificarCodigoFirebase);

module.exports = router;

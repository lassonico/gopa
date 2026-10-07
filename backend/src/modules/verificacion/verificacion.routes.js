const router = require('express').Router();
const controller = require('./verificacion.controller');
const rateLimit = require('express-rate-limit');

const codigoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados códigos solicitados, intente más tarde' }
});

router.post('/email/enviar', codigoLimiter, controller.enviarCodigoEmail);
router.post('/email/confirmar', codigoLimiter, controller.confirmarCodigoEmail);
router.post('/sms/confirmar', codigoLimiter, controller.confirmarSms);

module.exports = router;

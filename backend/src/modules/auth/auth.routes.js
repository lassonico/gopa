const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');
const verifyTurnstile = require('../../middleware/turnstile.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de autenticación, intente más tarde' }
});

// IP real del cliente (túnel Cloudflare pone CF-Connecting-IP;
// con 'trust proxy' req.ip ya viene correcta, esto es respaldo)
const clientIp = (req) =>
  req.headers['cf-connecting-ip'] || req.ip;

// Login: límite por IP + cuenta para que un atacante no agote
// el cupo global ni pruebe una cuenta desde muchas IPs sin freno
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 255) : '';
    return `${clientIp(req)}|${email}`;
  },
  message: { error: 'Demasiados intentos para esta cuenta, intente más tarde' }
});

const recoverLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de recuperación, intente más tarde' }
});

router.post('/register', authLimiter, verifyTurnstile('register'), validate(schemas.register), authController.register);
router.post('/login', loginLimiter, verifyTurnstile('login'), validate(schemas.login), authController.login);
router.post('/google', authLimiter, validate(schemas.googleLogin), authController.googleLogin);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.post('/recover-password', recoverLimiter, verifyTurnstile('recover-password'), validate(schemas.recoverPassword), authController.recoverPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), authController.resetPassword);
router.post('/crear-password-comercio', recoverLimiter, verifyTurnstile('register'), authController.crearPasswordComercio);
router.put('/fcm-token', authenticate, validate(schemas.updateFcmToken), authController.updateFcmToken);

module.exports = router;
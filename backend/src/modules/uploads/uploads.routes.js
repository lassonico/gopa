const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { upload } = require('../../middleware/upload.middleware');
const controller = require('./uploads.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Subidas públicas (solicitud de registro sin sesión): tope anti-abuso
const publicUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas imágenes subidas, intente más tarde' }
});

router.post('/', authenticate, authorize('admin', 'comercio'), upload.single('imagen'), controller.uploadImage);
router.post('/base64', publicUploadLimiter, controller.uploadBase64);

module.exports = router;
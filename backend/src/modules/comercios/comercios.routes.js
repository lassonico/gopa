const router = require('express').Router();
const controller = require('./comercios.controller');
const menuImport = require('./menuImport.controller');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { doubleSubmitCsrf } = require('../../middleware/csrf.middleware');
const verifyTurnstile = require('../../middleware/turnstile.middleware');
const multer = require('multer');
const { validate, schemas } = require('../../middleware/validation.middleware');

const solicitudLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en una hora.' }
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Solo PNG, JPG, WebP'), false);
    }
    cb(null, true);
  }
});

router.get('/', controller.getAll);
router.get('/todos', authenticate, authorize('admin'), controller.getAllAdmin);
router.get('/pendientes', authenticate, authorize('admin'), controller.getPendientes);
router.get('/:id', controller.getById);
router.post('/', solicitudLimiter, verifyTurnstile('register'), validate(schemas.solicitarComercio), controller.solicitarRegistro);
router.post('/admin', authenticate, authorize('admin'), controller.create);
router.put('/:id', authenticate, authorize('comercio', 'admin'), validate(schemas.updateComercio), controller.update);
router.put('/:id/aprobar', authenticate, authorize('admin'), controller.aprobar);
router.put('/:id/rechazar', authenticate, authorize('admin'), controller.rechazar);
router.put('/:id/toggle-activo', authenticate, authorize('admin', 'comercio'), controller.toggleActivo);
router.post('/:id/reset-password', authenticate, authorize('admin'), controller.resetPasswordAdmin);
router.put('/:id/horarios', authenticate, authorize('comercio', 'admin'), controller.updateHorarios);
router.delete('/:id', authenticate, authorize('admin'), controller.delete);

router.post('/:id/logo', authenticate, authorize('comercio', 'admin'), upload.single('logo'), doubleSubmitCsrf, controller.subirLogo);
router.delete('/:id/logo', authenticate, authorize('comercio', 'admin'), doubleSubmitCsrf, controller.eliminarLogo);

// IP Whitelist routes
router.get('/:id/ip-whitelist', authenticate, authorize('comercio', 'admin'), controller.getIpWhitelist);
router.put('/:id/ip-whitelist', authenticate, authorize('comercio', 'admin'), doubleSubmitCsrf, controller.updateIpWhitelist);
router.post('/:id/ip-whitelist/test', authenticate, authorize('comercio', 'admin'), controller.testIpWhitelist);

router.post('/menu/import', authenticate, authorize('comercio', 'admin'), doubleSubmitCsrf, menuImport.uploadMenu);
router.post('/menu/confirm', authenticate, authorize('comercio', 'admin'), doubleSubmitCsrf, menuImport.confirmMenuImport);
router.get('/menu/preview', authenticate, authorize('comercio', 'admin'), menuImport.getImportPreview);

module.exports = router;

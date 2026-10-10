const router = require('express').Router();
const controller = require('./configuraciones.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/tarifas', authenticate, authorize('admin'), controller.getTarifas);
router.put('/tarifas', authenticate, authorize('admin'), controller.updateTarifas);
router.get('/publicas', controller.getPublicas);

module.exports = router;

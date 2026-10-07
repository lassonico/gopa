const router = require('express').Router();
const controller = require('./contabilidad.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/resumen', authenticate, authorize('admin'), controller.getResumen);
router.get('/comercios', authenticate, authorize('admin'), controller.getPorComercio);
router.get('/iva', authenticate, authorize('admin'), controller.getIVA);
router.get('/export/csv', authenticate, authorize('admin'), controller.exportCSV);

module.exports = router;
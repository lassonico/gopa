const router = require('express').Router();
const controller = require('./dashboard.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, authorize('admin'), controller.getDashboard);

module.exports = router;

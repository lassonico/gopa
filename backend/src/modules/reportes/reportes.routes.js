const router = require('express').Router();
const controller = require('./reportes.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { doubleSubmitCsrf } = require('../../middleware/csrf.middleware');
const { porUsuario } = require('../../middleware/limites.middleware');

router.post('/', authenticate, doubleSubmitCsrf, porUsuario(10), controller.reportProblem);

module.exports = router;
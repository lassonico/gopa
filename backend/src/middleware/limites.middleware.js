// Límites por endpoint clave (anti-abuso / anti-DoS).
// Clave por usuario autenticado (o IP si no hay): un atacante no agota
// el cupo de los demás.
const rateLimit = require('express-rate-limit');

function porUsuario(max, windowMs = 15 * 60 * 1000, mensaje = 'Demasiadas solicitudes, intente más tarde') {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      const id = req.user?.id || req.headers['cf-connecting-ip'] || req.ip || 'anon';
      return `${req.baseUrl || ''}:${id}`;
    },
    message: { error: mensaje },
  });
}

function porIp(max, windowMs = 15 * 60 * 1000, mensaje = 'Demasiadas solicitudes, intente más tarde') {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip || 'anon',
    message: { error: mensaje },
  });
}

module.exports = { porUsuario, porIp };

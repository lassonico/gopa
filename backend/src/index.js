require('dotenv').config();
const express = require('express');

// Red de seguridad async: ninguna promesa suelta tumba el proceso sin dejar rastro
process.on('unhandledRejection', (razon) => {
  console.error('[Async] Promesa rechazada sin manejar:', razon instanceof Error ? razon.stack : razon);
});
process.on('uncaughtException', (err) => {
  console.error('[Async] Excepción no capturada:', err instanceof Error ? err.stack : err);
  process.exit(1); // Docker lo reinicia en estado limpio
});

const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { csrfProtection, doubleSubmitCsrf } = require('./middleware/csrf.middleware');

const app = express();
// Confiar en el primer proxy (túnel Cloudflare / nginx) para que
// req.ip y los rate-limiters vean la IP real del cliente
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://www.gstatic.com', 'https://accounts.google.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
  connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseio.com', 'wss://*.firebaseio.com', 'https://accounts.google.com'],
  frameSrc: ["'self'", 'https://accounts.google.com'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: isProduction ? [] : null,
};

app.use(helmet({
  contentSecurityPolicy: isProduction ? { directives: cspDirectives } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));
app.use(cookieParser());
app.use(csrfProtection);
app.use('/uploads', express.static(path.join(__dirname, '../data/images')));
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Observabilidad: request-id + log JSON + métricas (antes de las rutas)
const { middlewareObservabilidad } = require('./middleware/observabilidad.middleware');
app.use(middlewareObservabilidad);

// Saneado global de entradas: recorre todo body/query/params,
// recorta strings, quita nulos/control y claves peligrosas (__proto__).
// Cubre los 4 fronts + admin + recuperaciones en un solo punto.
function sanear(valor, prof = 0, clave = '') {
  if (prof > 20 || valor === null || valor === undefined) return valor;
  if (typeof valor === 'string') {
    // eslint-disable-next-line no-control-regex
    const limpio = valor.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Las contraseñas se limpian pero NO se recortan (los espacios cuentan)
    if (/password/i.test(clave)) return limpio;
    return limpio.trim();
  }
  if (Array.isArray(valor)) return valor.map(v => sanear(v, prof + 1, clave));
  if (typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = sanear(v, prof + 1, k);
    }
    return out;
  }
  return valor;
}
app.use((req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') req.body = sanear(req.body);
    if (req.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') req.query[k] = sanear(v);
      }
    }
    if (req.params && typeof req.params === 'object') {
      for (const [k, v] of Object.entries(req.params)) {
        if (typeof v === 'string') req.params[k] = sanear(v);
      }
    }
  } catch {}
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes, intente más tarde' }
});
app.use('/api/', limiter);

// Nota: los límites de login/register/google/recover viven en
// auth.routes.js para no contar doble. Aquí solo queda refresh.
app.use('/api/auth/refresh', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

// Caché de servidor para catálogo + invalidación total ante cualquier escritura
const { middlewareCache, clearApiCache } = require('./middleware/cache.middleware');
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') clearApiCache();
  next();
});
app.use('/api', middlewareCache);

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/comercios', require('./modules/comercios/comercios.routes'));
app.use('/api/productos', require('./modules/productos/productos.routes'));
app.use('/api/categorias', require('./modules/categorias/categorias.routes'));
app.use('/api/subcategorias', require('./modules/subcategorias/subcategorias.routes'));
app.use('/api/pedidos', require('./modules/pedidos/pedidos.routes'));
app.use('/api/calificaciones', require('./modules/calificaciones/calificaciones.routes'));
app.use('/api/notificaciones', require('./modules/notificaciones/notificaciones.routes'));
app.use('/api/cupones', require('./modules/cupones/cupones.routes'));
app.use('/api/pagos', require('./modules/pagos/pagos.routes'));
app.use('/api/promociones', require('./modules/promociones/promociones.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/contabilidad', require('./modules/contabilidad/contabilidad.routes'));
app.use('/api/reportes', require('./modules/reportes/reportes.routes'));
app.use('/api/servicios', require('./modules/servicios/servicios.routes'));
app.use('/api/domiciliarios', require('./modules/domiciliarios/domiciliarios.routes'));
app.use('/api/solicitudes', require('./modules/solicitudes/solicitudes.routes'));
app.use('/api/anuncios', require('./modules/anuncios/anuncios.routes'));
app.use('/api/mandados', require('./modules/mandados/mandados.routes'));
app.use('/api/verificacion', require('./modules/verificacion/verificacion.routes'));
app.use('/api/trabajos', require('./modules/trabajos/trabajos.routes'));
app.use('/api/configuraciones', require('./modules/configuraciones/configuraciones.routes'));
app.use('/api/upload', require('./modules/uploads/uploads.routes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Métricas internas: solo admin (memoria, latencias, errores, caché, cola)
app.get('/api/metricas', (req, res, next) => {
  const { authenticate, authorize } = require('./middleware/auth.middleware');
  authenticate(req, res, () => authorize('admin')(req, res, () => {
    try {
      const { resumenMetricas } = require('./middleware/observabilidad.middleware');
      const { cola } = require('./services/cola.service');
      const { cache } = require('./middleware/cache.middleware');
      res.json({ ...resumenMetricas(), cola: cola.stats(), cache: cache.stats() });
    } catch (e) { next(e); }
  }));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  // En producción no filtrar detalles internos en errores 500
  const isProd = process.env.NODE_ENV === 'production';
  const message = status >= 500 && isProd
    ? 'Error interno del servidor'
    : (err.message || 'Error interno del servidor');
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  // Limpieza diaria de diligencias entregadas/canceladas con +30 días
  try {
    const { limpiarAntiguos } = require('./modules/mandados/mandados.controller');
    limpiarAntiguos();
    setInterval(limpiarAntiguos, 24 * 60 * 60 * 1000).unref?.();
  } catch (e) {
    console.warn('No se pudo programar limpieza de mandados:', e.message);
  }
  // Activar pedidos programados cuya hora llegó (cada 10 min)
  try {
    const { activarProgramados } = require('./modules/pedidos/pedidos.controller');
    setInterval(activarProgramados, 10 * 60 * 1000).unref?.();
  } catch (e) {
    console.warn('No se pudo programar activación de programados:', e.message);
  }
});

module.exports = app;

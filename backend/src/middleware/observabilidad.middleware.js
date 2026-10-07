// Observabilidad: logging estructurado JSON, métricas en memoria y tracing
// por request-id. Sin dependencias externas.
const { randomUUID } = require('crypto');

const metricas = {
  inicio: Date.now(),
  peticiones: 0,
  errores4xx: 0,
  errores5xx: 0,
  latencias: [],
  porRuta: {},
  lagLoopMs: 0,
};

// Medir rezago del event loop cada 5s
(function medirLag() {
  const t0 = Date.now();
  setTimeout(() => {
    metricas.lagLoopMs = Date.now() - t0 - 5000;
    medirLag();
  }, 5000).unref?.();
})();

function registrar(res, ms) {
  metricas.peticiones++;
  if (res.statusCode >= 500) metricas.errores5xx++;
  else if (res.statusCode >= 400) metricas.errores4xx++;
  metricas.latencias.push(ms);
  if (metricas.latencias.length > 2000) metricas.latencias.splice(0, 1000);
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

function middleware(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID().slice(0, 8);
  req.requestId = id;
  res.set('X-Request-Id', id);
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    registrar(res, ms);
    const ruta = `${req.method} ${(req.originalUrl || '').split('?')[0]}`;
    const r = (metricas.porRuta[ruta] = metricas.porRuta[ruta] || { n: 0, errores: 0, msMax: 0 });
    r.n++;
    if (res.statusCode >= 400) r.errores++;
    if (ms > r.msMax) r.msMax = ms;
    // Log estructurado JSON (una línea por request)
    try {
      console.log(JSON.stringify({
        t: new Date().toISOString(), rid: id, m: req.method,
        ruta: (req.originalUrl || '').split('?')[0],
        s: res.statusCode, ms,
        ip: req.headers['cf-connecting-ip'] || req.ip,
        rol: req.user?.rol || '-',
      }));
    } catch {}
  });
  next();
}

function resumen() {
  const mem = process.memoryUsage();
  const topRutas = Object.entries(metricas.porRuta)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 10)
    .map(([ruta, r]) => ({ ruta, ...r }));
  return {
    uptimeSeg: Math.round((Date.now() - metricas.inicio) / 1000),
    peticiones: metricas.peticiones,
    errores4xx: metricas.errores4xx,
    errores5xx: metricas.errores5xx,
    latenciaMs: {
      p50: pct(metricas.latencias, 50),
      p95: pct(metricas.latencias, 95),
      p99: pct(metricas.latencias, 99),
    },
    memoriaMB: {
      rss: Math.round(mem.rss / 1048576),
      heapUsado: Math.round(mem.heapUsed / 1048576),
      heapTotal: Math.round(mem.heapTotal / 1048576),
    },
    lagLoopMs: metricas.lagLoopMs,
    topRutas,
  };
}

module.exports = { middlewareObservabilidad: middleware, resumenMetricas: resumen };

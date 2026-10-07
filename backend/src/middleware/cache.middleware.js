// Estrategia de caché del servidor (memoria; interfaz lista para Redis).
//
// Qué se repite por petición:
//  - Dashboard admin: 4 tablas + ~15 agregaciones idénticas para todo admin.
//  - Catálogo: comercios/productos/categorías/promociones/servicios en cada Home.
//  - Lookups de auth (ya optimizados con findOne + índice).
//
// TTL por tipo de dato (frescura vs costo):
//  - Referencia casi estática (categorías, subcategorías):      300s
//  - Catálogo con cambios ocasionales (productos, servicios):   120s
//  - Listas con estado (comercios+abierto, promociones/fechas):  60s
//  - NUNCA: dashboard admin (solo-admin; cachear antes del auth lo
//    expondría), pedidos, usuarios, notificaciones, rutas admin,
//    detalle de comercio (polling de abierto), auth, webhooks.
//
// Fallback: CUALQUIER error del caché (lectura, escritura, serialización)
// se traga en silencio y la petición sigue a BD. La app jamás depende
// del caché para responder.

const TTL_POR_RUTA = [
  { test: (u) => u === '/api/categorias' || u.startsWith('/api/subcategorias'), ttl: 300000, tipo: 'referencia' },
  { test: (u) => u === '/api/productos' || u.startsWith('/api/productos/') || u === '/api/servicios' || u.startsWith('/api/servicios/'), ttl: 120000, tipo: 'catalogo' },
  { test: (u) => u === '/api/comercios' || u === '/api/promociones', ttl: 60000, tipo: 'listas-con-estado' },
];

const MAX_ENTRADAS = 500;

class CacheMemoria {
  constructor() {
    this.datos = new Map();
    this.hits = 0;
    this.miss = 0;
    this.fallos = 0;
  }

  ttlPara(url) {
    try {
      const limpia = String(url || '').split('?')[0];
      // Jamás: admin, auth, datos por usuario, detalle con polling, webhooks
      if (/(^|\/)(todos|admin)(\/|$)/.test(limpia)) return 0;
      if (/^\/api\/comercios\/[^/]+$/.test(limpia)) return 0;
      if (/^\/api\/(pedidos|users|usuarios|notificaciones|auth|pagos|upload|mandados|solicitudes|calificaciones|cupones)/.test(limpia)) return 0;
      for (const r of TTL_POR_RUTA) {
        if (r.test(limpia)) return r.ttl;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  leer(clave) {
    try {
      const item = this.datos.get(clave);
      if (!item) return null;
      if (Date.now() > item.expira) {
        this.datos.delete(clave);
        return null;
      }
      this.hits++;
      return item.data;
    } catch {
      this.fallos++;
      return null; // fallback: como si no hubiera caché
    }
  }

  guardar(clave, data, ttl) {
    try {
      if (this.datos.size >= MAX_ENTRADAS) this.datos.clear();
      // Solo JSON serializable (evita referencias circulares en caché)
      JSON.stringify(data);
      this.datos.set(clave, { data, expira: Date.now() + ttl });
      this.miss++;
    } catch {
      this.fallos++;
    }
  }

  limpiar() {
    try { this.datos.clear(); } catch {}
  }

  stats() {
    return { entradas: this.datos.size, hits: this.hits, miss: this.miss, fallos: this.fallos };
  }
}

const cache = new CacheMemoria();

function clave(req) {
  return `${req.method}:${req.originalUrl}`;
}

function clearApiCache() {
  cache.limpiar();
}

function middlewareCache(req, res, next) {
  let ttl = 0;
  try {
    if (req.method !== 'GET') return next();
    ttl = cache.ttlPara(req.originalUrl);
    if (!ttl) return next();
  } catch {
    return next(); // fallback: seguir a BD
  }

  const k = clave(req);
  const hit = cache.leer(k);
  if (hit !== null && hit !== undefined) {
    try {
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Tipo', 'memoria');
      return res.json(hit);
    } catch {
      return next();
    }
  }

  let originalJson;
  try {
    originalJson = res.json.bind(res);
  } catch {
    return next();
  }
  res.json = (data) => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.guardar(k, data, ttl);
      }
      res.set('X-Cache', 'MISS');
    } catch {
      // fallback: responder sin caché
    }
    return originalJson(data);
  };
  next();
}

module.exports = { middlewareCache, clearApiCache, cache, TTL_POR_RUTA };

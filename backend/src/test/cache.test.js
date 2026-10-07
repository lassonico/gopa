import { describe, it, expect } from 'vitest';

const { middlewareCache, clearApiCache, cache } = await import('../middleware/cache.middleware.js');

function mockReq(url) {
  return { method: 'GET', originalUrl: url };
}

function mockRes(captura) {
  return {
    statusCode: 200,
    headers: {},
    set(k, v) { this.headers[k] = v; },
    json(data) { captura.data = data; return data; },
  };
}

describe('Cache servidor', () => {
  it('MISS luego HIT en catálogo público', async () => {
    clearApiCache();
    let nextLlamado = false;
    const req = mockReq('/api/comercios');
    const cap1 = {};
    const res1 = mockRes(cap1);
    middlewareCache(req, res1, () => { nextLlamado = true; });
    expect(nextLlamado).toBe(true);
    res1.json([{ id: 'c1' }]);
    expect(res1.headers['X-Cache']).toBe('MISS');

    let next2 = false;
    const cap2 = {};
    const res2 = mockRes(cap2);
    middlewareCache(mockReq('/api/comercios'), res2, () => { next2 = true; });
    expect(next2).toBe(false);
    expect(res2.headers['X-Cache']).toBe('HIT');
    expect(cap2.data).toEqual([{ id: 'c1' }]);
  });

  it('NUNCA cachea pedidos, admin, detalle ni auth', () => {
    clearApiCache();
    for (const url of [
      '/api/pedidos', '/api/users/abc', '/api/notificaciones',
      '/api/comercios/todos', '/api/comercios/xyz', '/api/auth/login',
      '/api/dashboard', '/api/cupones/validar',
    ]) {
      let next = false;
      middlewareCache(mockReq(url), mockRes({}), () => { next = true; });
      expect(next, url).toBe(true);
    }
  });

  it('TTL por tipo: referencia > catálogo > listas', () => {
    const { TTL_POR_RUTA } = require('../middleware/cache.middleware.js');
    const ttl = (u) => (TTL_POR_RUTA.find(r => r.test(u)) || {}).ttl;
    expect(ttl('/api/categorias')).toBe(300000);
    expect(ttl('/api/productos')).toBe(120000);
    expect(ttl('/api/comercios')).toBe(60000);
    expect(ttl('/api/promociones')).toBe(60000);
  });

  it('fallback: si el caché falla, sigue a BD (next)', () => {
    clearApiCache();
    cache.datos = null; // simular caché roto
    let next = false;
    let lanzo = false;
    try {
      middlewareCache(mockReq('/api/comercios'), mockRes({}), () => { next = true; });
    } catch {
      lanzo = true;
    }
    expect(lanzo).toBe(false);
    expect(next).toBe(true);
    cache.datos = new Map();
  });
});

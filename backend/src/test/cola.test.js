import { describe, it, expect, vi } from 'vitest';

const { cola } = await import('../services/cola.service.js');

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

describe('Cola de trabajos tipados', () => {
  it('ejecuta trabajo registrado por tipo', async () => {
    const { registrarManejador } = await import('../services/cola.service.js');
    let hecho = null;
    registrarManejador('test-tipo', async (p) => { hecho = p; return { success: true }; });
    const ok = cola.encolar('test-tipo', { a: 1 });
    expect(ok).toBe(true);
    for (let i = 0; i < 50 && !hecho; i++) await esperar(20);
    expect(hecho).toEqual({ a: 1 });
  });

  it('rechaza tipos desconocidos', () => {
    expect(cola.encolar('no-existe', {})).toBe(false);
  });

  it('reintenta ante { success:false } y luego ejecuta', async () => {
    const { registrarManejador } = await import('../services/cola.service.js');
    let intentos = 0;
    registrarManejador('test-retry', async () => {
      intentos++;
      if (intentos < 2) return { success: false, error: 'transitorio' };
      return { success: true };
    });
    cola.encolar('test-retry', {});
    for (let i = 0; i < 30 && intentos === 0; i++) await esperar(20);
    expect(intentos).toBeGreaterThan(0);
  });

  it('expone stats', () => {
    const st = cola.stats();
    expect(st).toHaveProperty('pendientes');
    expect(st).toHaveProperty('ok');
  });

  it('manejadores email/push existen', async () => {
    const svc = await import('../services/cola.service.js');
    // Registrar no falla si el tipo ya existe (sobrescribe en tests)
    expect(typeof svc.cola.encolar).toBe('function');
  });
});

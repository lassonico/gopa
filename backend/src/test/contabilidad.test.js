import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const contabilidadRouter = (await import('../modules/contabilidad/contabilidad.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/contabilidad', contabilidadRouter);
  return app;
}

async function seedPagosCompletados() {
  const repo = (await import('../repositories/index.js')).default;
  const hoy = new Date().toISOString();
  const sufijo = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const comId = `com-cont-${sufijo}`;
  const p1 = `pd-cont-a-${sufijo}`;
  const p2 = `pd-cont-b-${sufijo}`;
  await repo.create('Comercios', {
    id: comId, nombreNegocio: 'Comercio Cont', estado: 'aprobado', comision: '10',
  });
  await repo.create('Pedidos', {
    id: p1, comercioId: comId, clienteId: 'c1', clienteNombre: 'Ana',
    total: '100000', estado: 'entregado',
  });
  await repo.create('Pedidos', {
    id: p2, comercioId: comId, clienteId: 'c1', clienteNombre: 'Ana',
    total: '50000', estado: 'entregado',
  });
  await repo.create('Pagos', {
    id: `pg-cont-a-${sufijo}`, pedidoId: p1, valor: '100000', metodo: 'wompi',
    estado: 'completado', referencia: 'REF-CONT-A', fechaPago: hoy,
  });
  await repo.create('Pagos', {
    id: `pg-cont-b-${sufijo}`, pedidoId: p2, valor: '50000', metodo: 'enlace',
    estado: 'completado', referencia: 'REF-CONT-B', fechaPago: hoy,
  });
  await repo.create('Pagos', {
    id: `pg-cont-c-${sufijo}`, pedidoId: p1, valor: '99999', metodo: 'wompi',
    estado: 'pendiente', referencia: 'REF-CONT-C',
  });
  return comId;
}

describe('Contabilidad', () => {
  it('bloquea sin token (401)', async () => {
    const res = await request(buildApp()).get('/api/contabilidad/resumen');
    expect(res.status).toBe(401);
  });

  it('bloquea con rol cliente (403)', async () => {
    const res = await request(buildApp())
      .get('/api/contabilidad/resumen')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('resumen solo cuenta pagos completados', async () => {
    await seedPagosCompletados();
    const res = await request(buildApp())
      .get('/api/contabilidad/resumen')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);
    const completados = res.body.totalPagos;
    expect([2, 4, 6]).toContain(completados);
    expect(res.body.ticketPromedio).toBeGreaterThan(0);
    expect(res.body.porMetodo.length).toBeGreaterThanOrEqual(1);
  });

  it('resumen por comercio calcula comisión', async () => {
    const comId = await seedPagosCompletados();
    const res = await request(buildApp())
      .get('/api/contabilidad/comercios')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);
    const comercio = res.body.comercios.find(c => c.comercioId === comId);
    expect(comercio).toBeTruthy();
    expect(comercio.ventas).toBe(150000);
    expect(comercio.comision).toBe(15000);
    expect(comercio.neto).toBe(135000);
  });

  it('resumen IVA desglosa base e IVA', async () => {
    await seedPagosCompletados();
    const res = await request(buildApp())
      .get('/api/contabilidad/iva')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.montoConIVA).toBeGreaterThanOrEqual(150000);
    expect(res.body.iva).toBeGreaterThan(0);
  });

  it('exporta CSV con pagos completados', async () => {
    const comId = await seedPagosCompletados();
    const res = await request(buildApp())
      .get('/api/contabilidad/export/csv')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Fecha');
    expect(res.text).toContain('Comercio Cont');
  });

  it('rechaza rango de fechas inválido', async () => {
    const res = await request(buildApp())
      .get('/api/contabilidad/resumen?desde=2025-01-01&hasta=2024-01-01')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(500);
  });
});
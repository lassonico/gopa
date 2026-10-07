import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const calificacionesRouter = (await import('../modules/calificaciones/calificaciones.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/calificaciones', calificacionesRouter);
  return app;
}

describe('Calificaciones - consultas públicas', () => {
  it('GET /comercio/:id solo muestra calificaciones visibles', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Calificaciones', { id: 'cal-1', comercioId: 'com-1', calificacionGeneral: '5', visible: 'true' });
    await repo.create('Calificaciones', { id: 'cal-2', comercioId: 'com-1', calificacionGeneral: '3', visible: 'false' });

    const res = await request(app).get('/api/calificaciones/comercio/com-1');
    expect(res.status).toBe(200);
    const ids = res.body.map(c => c.id);
    expect(ids).toContain('cal-1');
    expect(ids).not.toContain('cal-2');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/calificaciones/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('Calificaciones - creación', () => {
  it('rechaza sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/calificaciones/').send({
      comercioId: 'com-1', pedidoId: 'pd-1', calificacionGeneral: '5',
    });
    expect(res.status).toBe(401);
  });

  it('rechaza 400 si faltan campos requeridos', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/calificaciones/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ comentario: 'solo comentario' });
    expect(res.status).toBe(400);
  });

  it('cliente crea calificación y actualiza el promedio del comercio', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const comId = `com-prom-${Date.now()}`;
    await repo.create('Comercios', {
      id: comId, nombreNegocio: 'Comercio Promedio', activo: 'true', estado: 'aprobado',
      calificacionPromedio: '0', totalCalificaciones: '0',
    });
    await repo.create('Calificaciones', {
      id: 'cal-previa', comercioId: comId, pedidoId: 'pd-0',
      calificacionGeneral: '4', visible: 'true',
    });
    await repo.create('Pedidos', {
      id: 'pd-1', comercioId: comId, clienteId: 'test-user-id', estado: 'entregado',
    });

    const res = await request(app)
      .post('/api/calificaciones/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente', nombre: 'Cliente A' })}`)
      .send({ comercioId: comId, pedidoId: 'pd-1', calificacionGeneral: '5', comentario: 'Excelente' });

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe('test-user-id');
    expect(res.body.clienteNombre).toBe('Cliente A');

    const comercio = await repo.findById('Comercios', comId);
    expect(comercio.calificacionPromedio).toBe('4.5');
    expect(comercio.totalCalificaciones).toBe('2');
  });

  it('rechaza 409 al calificar dos veces el mismo pedido', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const comId = `com-dup-${Date.now()}`;
    await repo.create('Comercios', { id: comId, nombreNegocio: 'Dup', activo: 'true', estado: 'aprobado' });
    await repo.create('Pedidos', { id: 'pd-dup', comercioId: comId, clienteId: 'test-user-id', estado: 'entregado' });
    const token = `Bearer ${global.generateTestToken({ rol: 'cliente' })}`;
    const r1 = await request(app).post('/api/calificaciones/')
      .set('Authorization', token)
      .send({ comercioId: comId, pedidoId: 'pd-dup', calificacionGeneral: '5' });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/calificaciones/')
      .set('Authorization', token)
      .send({ comercioId: comId, pedidoId: 'pd-dup', calificacionGeneral: '4' });
    expect(r2.status).toBe(409);
  });

  it('rechaza 400 si el pedido no está entregado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const comId = `com-noent-${Date.now()}`;
    await repo.create('Comercios', { id: comId, nombreNegocio: 'NoEnt', activo: 'true', estado: 'aprobado' });
    await repo.create('Pedidos', { id: 'pd-noent', comercioId: comId, clienteId: 'test-user-id', estado: 'en preparación' });
    const res = await request(app).post('/api/calificaciones/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ comercioId: comId, pedidoId: 'pd-noent', calificacionGeneral: '5' });
    expect(res.status).toBe(400);
  });

  it('rechaza 403 al calificar pedido ajeno', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const comId = `com-ajeno-${Date.now()}`;
    await repo.create('Comercios', { id: comId, nombreNegocio: 'Ajeno', activo: 'true', estado: 'aprobado' });
    await repo.create('Pedidos', { id: 'pd-ajeno', comercioId: comId, clienteId: 'otro-id', estado: 'entregado' });
    const res = await request(app).post('/api/calificaciones/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ comercioId: comId, pedidoId: 'pd-ajeno', calificacionGeneral: '5' });
    expect(res.status).toBe(403);
  });
});
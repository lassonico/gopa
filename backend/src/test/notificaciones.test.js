import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const notificacionesRouter = (await import('../modules/notificaciones/notificaciones.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notificaciones', notificacionesRouter);
  return app;
}

describe('Notificaciones - consultas', () => {
  it('bloquea listar sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/notificaciones/');
    expect(res.status).toBe(401);
  });

  it('usuario ve solo sus notificaciones y las dirigidas a su rol/todos', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Notificaciones', { id: 'n-1', destinatarioId: 'test-user-id', titulo: 'Mía', leida: 'false' });
    await repo.create('Notificaciones', { id: 'n-2', dirigidoA: 'todos', titulo: 'Todos', leida: 'false' });
    await repo.create('Notificaciones', { id: 'n-3', dirigidoA: 'cliente', titulo: 'Clientes', leida: 'false' });
    await repo.create('Notificaciones', { id: 'n-4', destinatarioId: 'otro-user', titulo: 'Ajena', leida: 'false' });

    const res = await request(app)
      .get('/api/notificaciones/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(200);
    const ids = res.body.map(n => n.id);
    expect(ids).toEqual(expect.arrayContaining(['n-1', 'n-2', 'n-3']));
    expect(ids).not.toContain('n-4');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/notificaciones/no-existe')
      .set('Authorization', `Bearer ${global.generateTestToken()}`);
    expect(res.status).toBe(404);
  });
});

describe('Notificaciones - acciones', () => {
  it('usuario marca como leída una notificación', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Notificaciones', { id: 'n-leer', titulo: 'X', leida: 'false', destinatarioId: 'test-user-id' });

    const res = await request(app)
      .put('/api/notificaciones/n-leer/leida')
      .set('Authorization', `Bearer ${global.generateTestToken()}`);
    expect(res.status).toBe(200);

    const notif = await repo.findById('Notificaciones', 'n-leer');
    expect(notif.leida).toBe('true');
  });

  it('admin crea una notificación', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/notificaciones/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ titulo: 'Anuncio', mensaje: 'Mantenimiento programado', tipo: 'general' });

    expect(res.status).toBe(201);
    expect(res.body.dirigidoA).toBe('todos');
    expect(res.body.leida).toBe('false');
  });

  it('rechaza crear notificación sin título (400)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/notificaciones/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ mensaje: 'sin título' });
    expect(res.status).toBe(400);
  });
});
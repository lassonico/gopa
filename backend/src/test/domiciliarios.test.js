import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const domiciliariosRouter = (await import('../modules/domiciliarios/domiciliarios.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/domiciliarios', domiciliariosRouter);
  return app;
}

describe('Domiciliarios - consultas admin', () => {
  it('bloquea listar sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/domiciliarios/');
    expect(res.status).toBe(401);
  });

  it('bloquea listar con token de cliente (403)', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/domiciliarios/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('admin lista solo usuarios con rol domiciliario', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Usuarios', { id: 'dom-1', nombre: 'Dom Uno', rol: 'domiciliario', activo: 'true' });
    await repo.create('Usuarios', { id: 'cli-1', nombre: 'Cliente', rol: 'cliente', activo: 'true' });

    const res = await request(app)
      .get('/api/domiciliarios/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);
    const ids = res.body.map(u => u.id);
    expect(ids).toContain('dom-1');
    expect(ids).not.toContain('cli-1');
    expect(res.body[0].password).toBeUndefined();
  });

  it('GET /:id devuelve 404 si no es domiciliario', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Usuarios', { id: 'cli-2', nombre: 'C', rol: 'cliente' });

    const res = await request(app)
      .get('/api/domiciliarios/cli-2')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(404);
  });
});

describe('Domiciliarios - administración', () => {
  it('admin crea un domiciliario', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/domiciliarios/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ nombre: 'Carlos', email: 'dom@test.com', telefono: '3002223333', password: 'Clave123!' });

    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('domiciliario');
    expect(res.body.disponible).toBe('true');
    expect(res.body.password).toBeUndefined();
  });

  it('rechaza email duplicado (400)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Usuarios', { id: 'du-1', email: 'repite@test.com', rol: 'cliente' });

    const res = await request(app)
      .post('/api/domiciliarios/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ nombre: 'X', email: 'repite@test.com', password: 'Clave123!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El email ya está registrado');
  });

  it('admin alterna disponibilidad', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Usuarios', { id: 'dom-toggle', rol: 'domiciliario', disponible: 'true' });

    const off = await request(app)
      .put('/api/domiciliarios/dom-toggle/toggle-disponible')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(off.status).toBe(200);
    expect(off.body.disponible).toBe('false');

    const on = await request(app)
      .put('/api/domiciliarios/dom-toggle/toggle-disponible')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(on.body.disponible).toBe('true');
  });

  it('el propio domiciliario puede alternar su disponibilidad', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Usuarios', { id: 'dom-self', rol: 'domiciliario', disponible: 'true' });

    const res = await request(app)
      .put('/api/domiciliarios/dom-self/toggle-disponible')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.disponible).toBe('false');
  });
});
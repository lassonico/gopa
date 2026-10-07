import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const categoriasRouter = (await import('../modules/categorias/categorias.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categorias', categoriasRouter);
  return app;
}

describe('Categorias - consultas públicas', () => {
  it('GET / lista solo categorías activas', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Categorias', { id: 'cat-1', nombre: 'Comidas', activo: 'true' });
    await repo.create('Categorias', { id: 'cat-2', nombre: 'Bebidas', activo: 'false' });

    const res = await request(app).get('/api/categorias');
    expect(res.status).toBe(200);
    const nombres = res.body.map(c => c.nombre);
    expect(nombres).toContain('Comidas');
    expect(nombres).not.toContain('Bebidas');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/categorias/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('Categorias - admin', () => {
  it('bloquea POST / sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/categorias/').send({ nombre: 'X' });
    expect(res.status).toBe(401);
  });

  it('rechaza 400 si falta el nombre', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/categorias/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ icono: '🍔' });
    expect(res.status).toBe(400);
  });

  it('admin crea, actualiza y elimina una categoría', async () => {
    const app = buildApp();
    const tokens = { Authorization: `Bearer ${global.generateAdminToken()}` };

    const crear = await request(app).post('/api/categorias/').set(tokens).send({
      nombre: 'Postres', descripcion: 'Dulces', icono: '🍰',
    });
    expect(crear.status).toBe(201);
    expect(crear.body.activo).toBe('true');

    const actualizar = await request(app)
      .put(`/api/categorias/${crear.body.id}`)
      .set(tokens)
      .send({ descripcion: 'Repostería' });
    expect(actualizar.status).toBe(200);

    const eliminar = await request(app).delete(`/api/categorias/${crear.body.id}`).set(tokens);
    expect(eliminar.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const categoria = await repo.findById('Categorias', crear.body.id);
    expect(categoria).toBeNull();
  });
});
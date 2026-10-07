import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const promocionesRouter = (await import('../modules/promociones/promociones.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/promociones', promocionesRouter);
  return app;
}

function futuro(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function pasado(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

describe('Promociones - consultas públicas', () => {
  it('GET / excluye inactivas y vencidas', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Promociones', { id: 'pr-1', titulo: 'Vigente', tipo: 'descuento', fechaVencimiento: futuro(5) });
    await repo.create('Promociones', { id: 'pr-2', titulo: 'Vencida', tipo: 'descuento', fechaVencimiento: pasado(5) });
    await repo.create('Promociones', { id: 'pr-3', titulo: 'Inactiva', tipo: 'descuento', activo: 'false' });
    await repo.create('Promociones', { id: 'pr-4', titulo: 'Sin vencimiento', tipo: 'descuento' });

    const res = await request(app).get('/api/promociones');
    expect(res.status).toBe(200);
    const titulos = res.body.map(p => p.titulo);
    expect(titulos).toContain('Vigente');
    expect(titulos).toContain('Sin vencimiento');
    expect(titulos).not.toContain('Vencida');
    expect(titulos).not.toContain('Inactiva');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/promociones/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('Promociones - admin', () => {
  it('bloquea crear sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/promociones/').send({ titulo: 'X', tipo: 'descuento' });
    expect(res.status).toBe(401);
  });

  it('rechaza 400 si faltan título o tipo', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/promociones/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ valor: '20%' });
    expect(res.status).toBe(400);
  });

  it('admin crea, actualiza y elimina una promoción', async () => {
    const app = buildApp();
    const tokens = { Authorization: `Bearer ${global.generateAdminToken()}` };

    const crear = await request(app).post('/api/promociones/').set(tokens).send({
      titulo: '2x1 en hamburguesas', tipo: 'descuento', valor: '50%', fechaVencimiento: futuro(10),
    });
    expect(crear.status).toBe(201);
    expect(crear.body.activo).toBe('true');

    const actualizar = await request(app)
      .put(`/api/promociones/${crear.body.id}`)
      .set(tokens)
      .send({ valor: '60%' });
    expect(actualizar.status).toBe(200);

    const eliminar = await request(app).delete(`/api/promociones/${crear.body.id}`).set(tokens);
    expect(eliminar.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const promo = await repo.findById('Promociones', crear.body.id);
    expect(promo).toBeNull();
  });
});
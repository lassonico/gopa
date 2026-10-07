import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const cuponesRouter = (await import('../modules/cupones/cupones.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cupones', cuponesRouter);
  return app;
}

describe('Cupones - consultas públicas', () => {
  it('GET / lista solo cupones activos', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Cupones', { id: 'cu-1', codigo: 'HOLA10', activo: 'true' });
    await repo.create('Cupones', { id: 'cu-2', codigo: 'FUERA', activo: 'false' });

    const res = await request(app).get('/api/cupones');
    expect(res.status).toBe(200);
    const codigos = res.body.map(c => c.codigo);
    expect(codigos).toContain('HOLA10');
    expect(codigos).not.toContain('FUERA');
  });
});

describe('Cupones - validación', () => {
  it('valida un cupón de porcentaje con compra válida', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Cupones', {
      id: 'cu-descuento', codigo: 'DESC10', tipo: 'porcentaje', valor: '10',
      compraMinima: '0', activo: 'true', usosActuales: '0',
    });

    const res = await request(app).post('/api/cupones/validar').send({
      codigo: 'DESC10', totalCarrito: 100000, usuarioId: 'u-1',
    });
    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(res.body.descuento).toBe(10000);
  });

  it('no encuentra un cupón inexistente (404)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/cupones/validar').send({
      codigo: 'NOEXISTE', totalCarrito: 100, usuarioId: 'u-1',
    });
    expect(res.status).toBe(404);
  });

  it('rechaza cupón agotado (400)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Cupones', {
      id: 'cu-agotado', codigo: 'AGOT', tipo: 'valor_fijo', valor: '5000',
      limiteUsos: '3', usosActuales: '3', activo: 'true', compraMinima: '0',
    });

    const res = await request(app).post('/api/cupones/validar').send({
      codigo: 'AGOT', totalCarrito: 100000, usuarioId: 'u-1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cupón agotado');
  });

  it('rechaza cupón exclusivo de otro usuario (400)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Cupones', {
      id: 'cu-excl', codigo: 'EXCL', tipo: 'valor_fijo', valor: '2000',
      exclusivoUsuario: 'usuario-A', activo: 'true', compraMinima: '0',
    });

    const res = await request(app).post('/api/cupones/validar').send({
      codigo: 'EXCL', totalCarrito: 50000, usuarioId: 'usuario-B',
    });
    expect(res.status).toBe(400);
  });
});

describe('Cupones - admin', () => {
  it('bloquea crear sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/cupones/').send({ codigo: 'X', tipo: 'valor_fijo', valor: '1000' });
    expect(res.status).toBe(401);
  });

  it('admin crea cupón con código en mayúsculas', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/cupones/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ codigo: 'bienvenido', tipo: 'valor_fijo', valor: '5000' });

    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe('BIENVENIDO');
    expect(res.body.activo).toBe('true');
  });
});
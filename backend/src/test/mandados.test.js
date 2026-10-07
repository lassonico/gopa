import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const mandadosRouter = (await import('../modules/mandados/mandados.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/mandados', mandadosRouter);
  return app;
}

describe('Mandados - autenticación', () => {
  it('bloquea crear mandado sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/mandados').send({ direccion: 'Centro' });
    expect(res.status).toBe(401);
  });

  it('bloquea listar mandados sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/mandados/');
    expect(res.status).toBe(401);
  });
});

describe('Mandados - creación', () => {
  it('cliente crea un mandado con dirección', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mandados')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente', nombre: 'Cliente Uno' })}`)
      .send({ direccion: 'Barrio Centro, frente al parque' });

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe('test-user-id');
    expect(res.body.clienteNombre).toBe('Cliente Uno');
    expect(res.body.direccion).toBe('Barrio Centro, frente al parque');
    expect(res.body.estado).toBe('solicitado');
  });

  it('cliente crea un mandado con posición actual', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mandados')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ lat: '2.8905', lng: '-75.3036', enlace: 'https://maps.google.com/?q=2.8905,-75.3036' });

    expect(res.status).toBe(201);
    expect(res.body.lat).toBe('2.8905');
    expect(res.body.lng).toBe('-75.3036');
    expect(res.body.enlace).toContain('maps.google.com');
    expect(res.body.direccion).toBe('');
  });

  it('rechaza 400 si no hay dirección ni ubicación', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mandados')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ direccion: '   ' });
    expect(res.status).toBe(400);
  });

  it('rechaza 403 si el usuario no es cliente', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mandados')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`)
      .send({ direccion: 'Centro' });
    expect(res.status).toBe(403);
  });

  it('rechaza 403 si el teléfono del cliente no está verificado', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mandados')
      .set('Authorization', `Bearer ${global.generateTokenSinTelefonoVerificado()}`)
      .send({ direccion: 'Centro' });
    expect(res.status).toBe(403);
    expect(res.body.telefonoVerificado).toBe(false);
  });
});

describe('Mandados - listado por rol', () => {
  it('domiciliario puede listar los mandados', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Mandados', { id: 'md-1', clienteId: 'u1', clienteNombre: 'Ana', direccion: 'Centro', estado: 'solicitado', fecha: '2026-01-01 10:00:00' });

    const res = await request(app)
      .get('/api/mandados/')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.map(m => m.id)).toContain('md-1');
  });

  it('cliente no puede listar mandados (403)', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/mandados/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });
});
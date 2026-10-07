import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

const reportesRouter = (await import('../modules/reportes/reportes.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/reportes', reportesRouter);
  return app;
}

const csrfToken = () => Buffer.from('csrf-secret-token-for-test', 'utf8').toString('base64url');

function withCsrf(req) {
  const token = csrfToken();
  return req.set('Cookie', `csrf_token=${token}`).set('x-csrf-token', token);
}

describe('Reportes de problemas', () => {
  it('bloquea sin token (401)', async () => {
    const res = await request(buildApp()).post('/api/reportes/').send({ nombre: 'A' });
    expect(res.status).toBe(401);
  });

  it('rechaza 400 sin campos', async () => {
    const res = await withCsrf(request(buildApp())
      .post('/api/reportes/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ nombre: 'A' });
    expect(res.status).toBe(400);
  });

  it('rechaza 400 si la descripción es muy corta', async () => {
    const res = await withCsrf(request(buildApp())
      .post('/api/reportes/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ nombre: 'A', email: 'a@test.com', problema: 'corto' });
    expect(res.status).toBe(400);
  });

  it('envía reporte válido (degrade a log sin SMTP)', async () => {
    const res = await withCsrf(request(buildApp())
      .post('/api/reportes/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ nombre: 'Cliente Test', email: 'cliente@test.com', problema: 'El pedido llegó incompleto' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
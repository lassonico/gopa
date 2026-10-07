import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const verifRouter = (await import('../modules/verificacion/verificacion.routes.js')).default;
const authRouter = (await import('../modules/auth/auth.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/verificacion', verifRouter);
  app.use('/api/auth', authRouter);
  return app;
}

describe('Verificación de contacto', () => {
  it('envía y confirma código de email', async () => {
    const app = buildApp();
    const email = `verif-${Date.now()}@test.com`;
    const r1 = await request(app).post('/api/verificacion/email/enviar').send({ email });
    expect(r1.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const regs = await repo.findWhere('Verificaciones', 'destino', email);
    expect(regs.length).toBeGreaterThan(0);

    // Código incorrecto
    const r2 = await request(app).post('/api/verificacion/email/confirmar').send({ email, codigo: '000000' });
    expect(r2.status).toBe(400);
  });

  it('rechaza email inválido', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/verificacion/email/enviar').send({ email: 'no-es-email' });
    expect(res.status).toBe(400);
  });
});

describe('Crear password comercio (invitación)', () => {
  it('rechaza token inválido', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/crear-password-comercio')
      .send({ token: 'invalido', password: 'ClaveSegura123!' });
    expect(res.status).toBe(400);
  });

  it('rechaza contraseña débil', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const crypto = (await import('crypto')).default;
    const token = 'tokendebil12345678901234567890';
    await repo.create('Invitaciones', {
      id: `inv-${Date.now()}`, comercioId: 'com-x', email: 'deb@test.com',
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      expira: new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' '),
      usado: 'false',
    });
    const res = await request(app).post('/api/auth/crear-password-comercio')
      .send({ token, password: 'corta' });
    expect(res.status).toBe(400);
  });

  it('crea la cuenta con token válido y marca usado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const crypto = (await import('crypto')).default;
    const token = 'tokenvalido12345678901234567890';
    const email = `nuevo-${Date.now()}@test.com`;
    const invId = `inv-ok-${Date.now()}`;
    await repo.create('Comercios', { id: 'com-inv', nombreNegocio: 'Inv', activo: 'true', estado: 'aprobado' });
    await repo.create('Invitaciones', {
      id: invId, comercioId: 'com-inv', email,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      expira: new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' '),
      usado: 'false',
    });
    const res = await request(app).post('/api/auth/crear-password-comercio')
      .send({ token, password: 'ClaveSegura123!' });
    expect(res.status).toBe(200);

    const users = await repo.findAll('Usuarios');
    const user = users.find(u => u.email === email);
    expect(user).toBeTruthy();
    expect(user.rol).toBe('comercio');
    const inv = await repo.findById('Invitaciones', invId);
    expect(String(inv.usado)).toBe('true');

    // Reuso rechazado
    const r2 = await request(app).post('/api/auth/crear-password-comercio')
      .send({ token, password: 'ClaveSegura123!' });
    expect(r2.status).toBe(400);
  });
});

import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';

const authRouter = (await import('../modules/auth/auth.routes.js')).default;

global.fetch = vi.fn(async () => {
  throw new Error('red deshabilitada en tests');
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

async function seedUser(repo, overrides = {}) {
  const id = overrides.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hashed = await bcrypt.hash('ClaveSegura123!', 4);
  const user = {
    id,
    nombre: 'Test User',
    email: 'test@example.com',
    telefono: '3001112233',
    password: hashed,
    rol: 'cliente',
    activo: 'true',
    fechaRegistro: new Date().toISOString(),
    ...overrides,
    id,
  };
  await repo.create('Usuarios', user);
  return user;
}

describe('Auth - registro', () => {
  it('registra un nuevo cliente', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Ana María',
      email: 'ana@test.com',
      password: 'ClaveSegura123!',
      telefono: '3005556666',
      mayorEdad: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ana@test.com');
    expect(res.body.user.rol).toBe('cliente');
    expect(res.body.user.password).toBeUndefined();
  });

  it('rechaza 400 sin confirmación de mayoría de edad', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Joven',
      email: 'joven@test.com',
      password: 'ClaveSegura123!',
    });

    expect(res.status).toBe(400);
  });

  it('rechaza 400 si el email ya está registrado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo, { email: 'duplicado@test.com' });

    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Otro',
      email: 'duplicado@test.com',
      password: 'ClaveSegura123!',
      mayorEdad: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El email ya está registrado');
  });
});

describe('Auth - login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'ClaveSegura123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('rechaza contraseña incorrecta (401)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'ContraseñaIncorrecta!',
    });
    expect(res.status).toBe(401);
  });

  it('rechaza email no registrado (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 'inexistente@test.com',
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(401);
  });

  it('rechaza cuenta desactivada (401)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo, { email: 'inactivo@test.com', activo: 'false' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'inactivo@test.com',
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth - bloqueo de intentos', () => {
  it('bloquea la cuenta tras 5 intentos fallidos (429)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo, { email: 'bloqueo@test.com' });

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({
        email: 'bloqueo@test.com',
        password: 'WrongPass!',
      });
    }

    const res = await request(app).post('/api/auth/login').send({
      email: 'bloqueo@test.com',
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(429);
  });
});

describe('Auth - login sanitización de inputs', () => {
  it('rechaza email no-string con 400 (sin error 500)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 12345,
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza password no-string con 400', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: { $ne: '' },
    });
    expect(res.status).toBe(400);
  });

  it('acepta email con espacios y mayúsculas (trim + lowercase)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo);

    const res = await request(app).post('/api/auth/login').send({
      email: '  TEST@example.com  ',
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(200);
  });

  it('rechaza password gigante sin llegar a bcrypt (400/401 genérico)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'x'.repeat(5000),
    });
    expect([400, 401]).toContain(res.status);
    expect(res.body.error).not.toMatch(/bcrypt|hash|stack/i);
  });

  it('ignora caracteres de control en el email', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com\x00',
      password: 'ClaveSegura123!',
    });
    expect(res.status).toBe(200);
  });
});

describe('Auth - recuperación de contraseña', () => {
  it('genera token y responde mensaje para email existente', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const user = await seedUser(repo, { email: 'reset@test.com' });

    const res = await request(app).post('/api/auth/recover-password').send({ email: 'reset@test.com' });
    expect(res.status).toBe(200);

    const updated = await repo.findById('Usuarios', user.id);
    expect(updated.resetToken).toBeTruthy();
  });

  it('responde genérico aunque el email no exista (anti-enumeración)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/recover-password').send({ email: 'nadie@test.com' });
    expect(res.status).toBe(200);
  });

  it('resetea la contraseña con un token válido', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const tokenValido = 't'.repeat(32);
    const user = await seedUser(repo, {
      email: 'reset2@test.com',
      resetToken: tokenValido,
      resetTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'NuevaClaveSegura1!',
    });
    expect(res.status).toBe(200);

    const updated = await repo.findById('Usuarios', user.id);
    expect(updated.resetToken).toBe('');
    const valid = await bcrypt.compare('NuevaClaveSegura1!', updated.password);
    expect(valid).toBe(true);
  });

  it('rechaza token inválido (400)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'i'.repeat(32),
      newPassword: 'NuevaClaveSegura1!',
    });
    expect(res.status).toBe(400);
  });
});

describe('Auth - tokens FCM multi-dispositivo', () => {
  it('acumula varios tokens sin pisar los de otros dispositivos', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedUser(repo, { id: 'test-user-id', email: 'test@example.com' });

    const tokenWeb = 'w'.repeat(120);
    const tokenCelular = 'c'.repeat(120);

    const r1 = await request(app)
      .put('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${global.generateTestToken()}`)
      .send({ fcmToken: tokenWeb });
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .put('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${global.generateTestToken()}`)
      .send({ fcmToken: tokenCelular });
    expect(r2.status).toBe(200);

    const user = await repo.findById('Usuarios', 'test-user-id');
    const tokens = JSON.parse(user.fcmTokens);
    expect(tokens).toContain(tokenWeb);
    expect(tokens).toContain(tokenCelular);
  });
});
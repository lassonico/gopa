import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const comerciosRouter = (await import('../modules/comercios/comercios.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/comercios', comerciosRouter);
  return app;
}

describe('Comercios - consultas públicas', () => {
  it('GET / lista comercios aprobados con estado abierto/cerrado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Comercios', {
      id: 'c-abierto', nombreNegocio: 'Aprobado 1', nombrePropietario: 'P',
      telefono: '300', activo: 'true', estado: 'aprobado',
      horarios: 'Lun-Dom 0 - 24',
    });
    await repo.create('Comercios', {
      id: 'c-inactivo', nombreNegocio: 'Inactivo', nombrePropietario: 'P',
      telefono: '301', activo: 'false', estado: 'aprobado',
    });
    await repo.create('Comercios', {
      id: 'c-pendiente', nombreNegocio: 'Pendiente', nombrePropietario: 'P',
      telefono: '302', activo: 'true', estado: 'pendiente',
    });

    const res = await request(app).get('/api/comercios');
    expect(res.status).toBe(200);
    const nombres = res.body.map(c => c.nombreNegocio);
    expect(nombres).toContain('Aprobado 1');
    expect(nombres).toContain('Inactivo');
    expect(nombres).not.toContain('Pendiente');

    const abierto = res.body.find(c => c.id === 'c-abierto');
    const inactivo = res.body.find(c => c.id === 'c-inactivo');
    expect(abierto.abierto).toBe('true');
    expect(inactivo.abierto).toBe('false');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/comercios/no-existe');
    expect(res.status).toBe(404);
  });

  it('POST / solicita registro y queda en estado pendiente', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/comercios').send({
      nombreNegocio: 'Nuevo Local',
      nombrePropietario: 'Ana',
      telefono: '3101112222',
      direccion: 'Calle 5',
    });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.activo).toBe('true');
  });

  it('POST / rechaza si faltan campos obligatorios', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/comercios').send({ nombreNegocio: 'Solo nombre' });
    expect(res.status).toBe(400);
  });
});

describe('Comercios - admin', () => {
  it('bloquea POST /admin sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/comercios/admin').send({
      nombreNegocio: 'X', nombrePropietario: 'Y', telefono: '300',
    });
    expect(res.status).toBe(401);
  });

  it('bloquea POST /admin con token de cliente (403)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/comercios/admin')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ nombreNegocio: 'X', nombrePropietario: 'Y', telefono: '300' });
    expect(res.status).toBe(403);
  });

  it('admin crea comercio y usuario vinculado', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/comercios/admin')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({
        nombreNegocio: 'Admin Local',
        nombrePropietario: 'Carlos',
        telefono: '3009998888',
        email: 'comercio@test.com',
        password: 'clave123',
        direccion: 'Calle 5',
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('aprobado');

    const repo = (await import('../repositories/index.js')).default;
    const users = await repo.findWhere('Usuarios', 'comercioId', res.body.id);
    const user = users.find(u => u.rol === 'comercio');
    expect(user).toBeTruthy();
    expect(user.email).toBe('comercio@test.com');
  });

  it('admin aprueba y rechaza comercios', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Comercios', {
      id: 'pend-1', nombreNegocio: 'Pend 1', nombrePropietario: 'P',
      telefono: '300', activo: 'true', estado: 'pendiente',
    });

    const aprobar = await request(app)
      .put('/api/comercios/pend-1/aprobar')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(aprobar.status).toBe(200);

    const rechazar = await request(app)
      .put('/api/comercios/pend-1/rechazar')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(rechazar.status).toBe(200);
    expect(rechazar.body.message).toBe('Comercio rechazado');
  });
});

describe('Comercios - toggle activo', () => {
  it('bloquea toggle sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/comercios/c-1/toggle-activo');
    expect(res.status).toBe(401);
  });

  it('permite a admin desactivar y reactivar', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Comercios', {
      id: 'c-toggle', nombreNegocio: 'Toggle', nombrePropietario: 'P',
      telefono: '300', activo: 'true', estado: 'aprobado',
    });

    const off = await request(app)
      .put('/api/comercios/c-toggle/toggle-activo')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(off.status).toBe(200);
    expect(off.body.activo).toBe('false');

    const on = await request(app)
      .put('/api/comercios/c-toggle/toggle-activo')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(on.status).toBe(200);
    expect(on.body.activo).toBe('true');
  });
});
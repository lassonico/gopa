import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const usersRouter = (await import('../modules/users/users.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRouter);
  return app;
}

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

describe('Users - autenticación y roles', () => {
  it('bloquea listar sin token (401)', async () => {
    const res = await request(buildApp()).get('/api/users/');
    expect(res.status).toBe(401);
  });

  it('bloquea listar con cliente (403)', async () => {
    const res = await request(buildApp())
      .get('/api/users/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('admin lista usuarios sin exponer password', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    await repo.create('Usuarios', {
      id: `usr-${su}`, nombre: 'Juan', correo: `juan-${su}@test.com`, password: 'secret',
    });

    const res = await request(buildApp())
      .get('/api/users/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.some(u => u.id === `usr-${su}`)).toBe(true);
    expect(res.body.every(u => u.password === undefined)).toBe(true);
  });
});

describe('Users - CRUD', () => {
  it('admin crea usuario y hashea la contraseña', async () => {
    const su = uniq();
    const res = await request(buildApp())
      .post('/api/users/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ nombre: 'Cliente Nuevo', email: `nuevo-${su}@test.com`, password: 'abc123' });

    expect(res.status).toBe(201);
    expect(res.body.password).toBeUndefined();
    expect(res.body.email).toBe(`nuevo-${su}@test.com`);

    const repo = (await import('../repositories/index.js')).default;
    const guardado = await repo.findById('Usuarios', res.body.id);
    expect(guardado.password).toBeTruthy();
    expect(guardado.password).not.toBe('abc123');
  });

  it('rechaza 400 sin datos obligatorios', async () => {
    const res = await request(buildApp())
      .post('/api/users/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ nombre: 'Solo Nombre' });
    expect(res.status).toBe(400);
  });

  it('cualquier rol autenticado obtiene su propio perfil', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    await repo.create('Usuarios', {
      id: 'perfil-id', nombre: 'Perfil', correo: `perfil-${su}@test.com`, password: 'x',
    });

    const res = await request(buildApp())
      .get('/api/users/perfil-id')
      .set('Authorization', `Bearer ${global.generateTestToken({ id: 'perfil-id', rol: 'cliente' })}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('perfil-id');
  });

  it('cliente NO ve el perfil de otro cliente (403)', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    await repo.create('Usuarios', {
      id: `otro-${su}`, nombre: 'Otro', correo: `otro-${su}@test.com`, password: 'x',
    });

    const getRes = await request(buildApp())
      .get(`/api/users/otro-${su}`)
      .set('Authorization', `Bearer ${global.generateTestToken({ id: 'yo', rol: 'cliente' })}`);
    expect(getRes.status).toBe(403);

    const putRes = await request(buildApp())
      .put(`/api/users/otro-${su}`)
      .set('Authorization', `Bearer ${global.generateTestToken({ id: 'yo', rol: 'cliente' })}`)
      .send({ nombre: 'Hackeado' });
    expect(putRes.status).toBe(403);
  });

  it('devuelve 404 al obtener usuario inexistente', async () => {
    const res = await request(buildApp())
      .get('/api/users/no-existe')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(404);
  });

  it('usuario autenticado actualiza su perfil', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    const id = `upd-${su}`;
    await repo.create('Usuarios', {
      id, nombre: 'Antes', correo: `upd-${su}@test.com`, password: 'x',
    });

    const res = await request(buildApp())
      .put(`/api/users/${id}`)
      .set('Authorization', `Bearer ${global.generateTestToken({ id, rol: 'cliente' })}`)
      .send({ nombre: 'Después', telefono: '300123' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Después');
    expect(res.body.telefono).toBe('300123');
  });

  it('admin elimina usuario', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    const id = `del-${su}`;
    await repo.create('Usuarios', { id, nombre: 'A Eliminar', correo: `del-${su}@test.com`, password: 'x' });

    const res = await request(buildApp())
      .delete(`/api/users/${id}`)
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);

    const after = await repo.findById('Usuarios', id);
    expect(after).toBeNull();
  });

  it('usuario elimina su propia cuenta (anonimiza, Ley 1581)', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const su = uniq();
    const id = `self-${su}`;
    await repo.create('Usuarios', {
      id, nombre: 'Yo', correo: `yo-${su}@test.com`, telefono: '3001', password: 'x',
    });

    const res = await request(buildApp())
      .delete(`/api/users/${id}/eliminar-cuenta`)
      .set('Authorization', `Bearer ${global.generateTestToken({ id, rol: 'cliente' })}`);
    expect(res.status).toBe(200);

    const after = await repo.findById('Usuarios', id);
    expect(after.nombre).toBe('Usuario eliminado');
    expect(after.email).toContain('@eliminado.local');
    expect(after.telefono).toBe('');
    expect(after.activo).toBe('false');
  });

  it('usuario NO elimina la cuenta de otro (403)', async () => {
    const res = await request(buildApp())
      .delete('/api/users/otro-x/eliminar-cuenta')
      .set('Authorization', `Bearer ${global.generateTestToken({ id: 'yo', rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });
});
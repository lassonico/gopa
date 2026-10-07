import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const serviciosRouter = (await import('../modules/servicios/servicios.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/servicios', serviciosRouter);
  return app;
}

describe('Servicios - registro de proveedor (público, aprueba el admin)', () => {
  beforeEach(() => {});

  it('crea servicio desde registro sin sesión (quedando pendiente)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/servicios/registro').send({
      tipoPersona: 'natural', nombre: 'Técnico Juan', servicio: 'Plomería', telefono: '3001234567',
    });
    expect(res.status).toBe(201);
  });

  it('crea servicio desde registro (quedando pendiente)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/servicios/registro').send({
      tipoPersona: 'natural',
      nombre: 'Técnico Juan',
      servicio: 'Plomería',
      descripcion: 'Reparaciones',
      telefono: '3001234567',
    });

    expect(res.status).toBe(201);
    expect(res.body.tipoPersona).toBe('natural');
    expect(res.body.nombre).toBe('Técnico Juan');
    expect(res.body.servicio).toBe('Plomería');
    expect(res.body.telefono).toBe('3001234567');
    expect(res.body.estado).toBe('pendiente');
  });

  it('rechaza 400 si falta tipo de persona', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/servicios/registro').send({
      nombre: 'A', servicio: 'B', telefono: '300',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza 400 si falta el teléfono', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/servicios/registro').send({
      tipoPersona: 'juridica', nombre: 'Empresa', servicio: 'Limpieza',
    });
    expect(res.status).toBe(400);
  });

  it('notifica al admin al registrarse', async () => {
    const app = buildApp();
    await request(app).post('/api/servicios/registro').send({
      tipoPersona: 'natural', nombre: 'Sr. Noti', servicio: 'Electricidad', telefono: '3001231234',
    });

    const repo = (await import('../repositories/index.js')).default;
    const notifs = await repo.findAll('Notificaciones');
    const notif = notifs.find(n => n.mensaje && n.mensaje.includes('Sr. Noti'));
    expect(notif).toBeTruthy();
    expect(notif.titulo).toBe('Nueva solicitud de servicio');
    expect(notif.dirigidoA).toBe('admin');
  });
});

describe('Servicios - consultas', () => {
  it('GET / excluye servicios pendientes', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Servicios', {
      id: 's-aprobado', nombre: 'Visibles', servicio: 'X', activo: 'true',
      estado: 'aprobado',
    });
    await repo.create('Servicios', {
      id: 's-pendiente', nombre: 'Oculto', servicio: 'Y', activo: 'true',
      estado: 'pendiente',
    });

    const res = await request(app).get('/api/servicios');
    expect(res.status).toBe(200);
    const nombres = res.body.map(s => s.nombre);
    expect(nombres).toContain('Visibles');
    expect(nombres).not.toContain('Oculto');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/servicios/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('Servicios - admin', () => {
  it('bloquea POST / sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/servicios/').send({
      tipoPersona: 'natural', nombre: 'A', servicio: 'B', telefono: '300',
    });
    expect(res.status).toBe(401);
  });

  it('admin crea servicio aprobado', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/servicios/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({
        tipoPersona: 'juridica', nombre: 'Mantenimiento SA', servicio: 'Jardinería',
        descripcion: 'Poda', telefono: '3009998888',
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('aprobado');
    expect(res.body.whatsapp).toBe('3009998888');
  });

  it('admin aprueba y rechaza', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Servicios', {
      id: 'svc-1', nombre: 'S1', servicio: 'X', activo: 'true', estado: 'pendiente',
    });
    await repo.create('Servicios', {
      id: 'svc-2', nombre: 'S2', servicio: 'Y', activo: 'true', estado: 'pendiente',
    });

    const aprobar = await request(app)
      .put('/api/servicios/svc-1/aprobar')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(aprobar.status).toBe(200);

    const rechazar = await request(app)
      .put('/api/servicios/svc-2/rechazar')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(rechazar.status).toBe(200);
    expect(rechazar.body.message).toBe('Servicio rechazado');
  });
});
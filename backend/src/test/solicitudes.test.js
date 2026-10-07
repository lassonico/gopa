import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const solicitudesRouter = (await import('../modules/solicitudes/solicitudes.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/solicitudes', solicitudesRouter);
  return app;
}

async function contactoVerificado(repo, email, telefono = '3001234567') {
  const jwt = (await import('jsonwebtoken')).default;
  await repo.create('Verificaciones', {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    canal: 'email', destino: email, verificado: 'true',
    fechaCreacion: new Date().toISOString(),
  });
  return jwt.sign(
    { phone: `+57${telefono}`, canal: 'sms' },
    process.env.JWT_SECRET, { expiresIn: '15m' }
  );
}

describe('Solicitudes - registro-comercio (público)', () => {
  it('crea solicitud de comercio sin token (pública)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    const pruebaSms = await contactoVerificado(repo, 'pan@test.com');
    const res = await request(app)
      .post('/api/solicitudes/registro-comercio')
      .send({
        nombreNegocio: 'Panadería La Esperanza',
        nombrePropietario: 'María Gómez',
        telefono: '3001234567',
        direccion: 'Calle 10 #20-30',
        email: 'pan@test.com',
        pruebaSms,
      });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('registro_comercio');
    expect(res.body.usuarioId).toBe('');
    expect(res.body.usuarioNombre).toBe('María Gómez');
    expect(JSON.parse(res.body.datos).nombreNegocio).toBe('Panadería La Esperanza');
  });

  it('rechaza con 400 si faltan campos obligatorios', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/solicitudes/registro-comercio')
      .send({ nombreNegocio: 'Solo nombre' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Datos inválidos');
  });

  it('rechaza 400 sin contacto verificado', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/solicitudes/registro-comercio')
      .send({
        nombreNegocio: 'Sin Verificar',
        nombrePropietario: 'Nadie',
        telefono: '3000000000',
        direccion: 'Calle 1 #1-1',
        email: 'sinverificar@test.com',
        pruebaSms: 'invalido',
      });
    expect(res.status).toBe(400);
  });

  it('notifica al admin al crear la solicitud', async () => {
    const app = buildApp();
    const nf = await import('../repositories');
    const notifRepo = nf.default;
    const pruebaSms = await contactoVerificado(notifRepo, 'xyz@test.com', '3011112222');

    await request(app)
      .post('/api/solicitudes/registro-comercio')
      .send({
        nombreNegocio: 'Tienda XYZ',
        nombrePropietario: 'Juan',
        telefono: '3011112222',
        direccion: 'Av 1 #2-3',
        email: 'xyz@test.com',
        pruebaSms,
      });

    const notificaciones = await notifRepo.findAll('Notificaciones');
    expect(notificaciones.length).toBeGreaterThanOrEqual(1);
    const notif = notificaciones.find(n => n.tipo === 'solicitud');
    expect(notif.dirigidoA).toBe('admin');
  });
});

describe('Solicitudes - registro-domiciliario (público)', () => {
  it('crea solicitud de domiciliario sin token con todos los campos', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/solicitudes/registro-domiciliario')
      .send({
        nombre: 'Carlos Pérez',
        tipoDocumento: 'Cédula de ciudadanía',
        numeroDocumento: '1098765432',
        telefono: '3005555555',
        email: 'carlos@test.com',
        tipoVehiculo: 'Moto',
      });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('registro_domiciliario');
    const datos = JSON.parse(res.body.datos);
    expect(datos.nombre).toBe('Carlos Pérez');
    expect(datos.tipoDocumento).toBe('Cédula de ciudadanía');
    expect(datos.numeroDocumento).toBe('1098765432');
    expect(datos.tipoVehiculo).toBe('Moto');
  });

  it('rechaza con 400 si falta el tipo de vehículo', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/solicitudes/registro-domiciliario')
      .send({ nombre: 'Ana', tipoDocumento: 'Pasaporte', numeroDocumento: '123', telefono: '300000' });

    expect(res.status).toBe(400);
  });

  it('crea notificación para el admin', async () => {
    const app = buildApp();
    const nf = await import('../repositories');
    const repo = nf.default;

    await request(app)
      .post('/api/solicitudes/registro-domiciliario')
      .send({
        nombre: 'Luis',
        tipoDocumento: 'Cédula de extranjería',
        numeroDocumento: '55512345',
        telefono: '3000000000',
        email: 'luis@test.com',
        tipoVehiculo: 'Bicicleta',
      });

    const notificaciones = await repo.findAll('Notificaciones');
    const notif = notificaciones.find(n => n.mensaje && n.mensaje.includes('Luis'));
    expect(notif.titulo).toBe('Nueva solicitud de domiciliario');
    expect(notif.mensaje).toContain('Luis');
  });
});

describe('Solicitudes - aprobación/rechazo (admin)', () => {
  let nombreUnico;

  beforeEach(() => {
    nombreUnico = `Negocio ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  });

  async function crearSolicitudComercio(app) {
    const repo = (await import('../repositories/index.js')).default;
    const email = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
    const pruebaSms = await contactoVerificado(repo, email, '3100000000');
    const res = await request(app)
      .post('/api/solicitudes/registro-comercio')
      .send({
        nombreNegocio: nombreUnico,
        nombrePropietario: 'Pedro',
        telefono: '3100000000',
        direccion: 'Calle 1 #2-3',
        email,
        pruebaSms,
      });
    return res.body.id;
  }

  it('bloquea aprobar sin token (401)', async () => {
    const app = buildApp();
    const id = await crearSolicitudComercio(app);
    const res = await request(app).put(`/api/solicitudes/${id}/aprobar`);
    expect(res.status).toBe(401);
  });

  it('bloquea aprobar con token de cliente (403)', async () => {
    const app = buildApp();
    const id = await crearSolicitudComercio(app);
    const res = await request(app)
      .put(`/api/solicitudes/${id}/aprobar`)
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('admin aprueba y crea el comercio', async () => {
    const app = buildApp();
    const id = await crearSolicitudComercio(app);
    const res = await request(app)
      .put(`/api/solicitudes/${id}/aprobar`)
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const comercios = await repo.findAll('Comercios');
    const comercio = comercios.find(c => c.nombreNegocio === nombreUnico);
    expect(comercio).toBeTruthy();
    expect(comercio.estado).toBe('aprobado');
    expect(comercio.activo).toBe('true');
  });

  it('admin rechaza y no crea comercio', async () => {
    const app = buildApp();
    const id = await crearSolicitudComercio(app);
    const res = await request(app)
      .put(`/api/solicitudes/${id}/rechazar`)
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const solicitudes = await repo.findAll('Solicitudes');
    const solicitud = solicitudes.find(s => s.id === id);
    expect(solicitud.estado).toBe('rechazado');

    const comercios = await repo.findAll('Comercios');
    expect(comercios.filter(c => c.nombreNegocio === nombreUnico).length).toBe(0);
  });
});
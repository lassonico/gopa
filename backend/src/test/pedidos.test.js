import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const pedidosRouter = (await import('../modules/pedidos/pedidos.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/pedidos', pedidosRouter);
  return app;
}

async function crearPedido(app, token) {
  const repo = (await import('../repositories/index.js')).default;
  if (!(await repo.findById('Comercios', 'com-1'))) {
    await repo.create('Comercios', { id: 'com-1', nombreNegocio: 'Test', activo: 'true', estado: 'aprobado', ciudad: 'palermo' });
  }
  if (!(await repo.findById('Productos', 'prod-1'))) {
    await repo.create('Productos', { id: 'prod-1', comercioId: 'com-1', nombre: 'Empanada', precio: 2500, activo: 'true' });
  }
  return request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${token}`)
    .send({
      comercioId: 'com-1',
      productos: JSON.stringify([{ id: 'prod-1', nombre: 'Empanada', precio: 2500, cantidad: 2 }]),
      total: 5000,
      direccionEntrega: 'Calle 1 #2-3',
      metodoPago: 'enlace',
    });
}

describe('Pedidos - autenticación', () => {
  it('bloquea crear pedido sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/pedidos').send({ comercioId: 'com-1', productos: [], total: 0 });
    expect(res.status).toBe(401);
  });

  it('bloquea listar pedidos sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/pedidos/');
    expect(res.status).toBe(401);
  });

  it('bloquea crear pedido si el teléfono no está verificado (403)', async () => {
    const app = buildApp();
    const res = await crearPedido(app, global.generateTokenSinTelefonoVerificado());
    expect(res.status).toBe(403);
    expect(res.body.telefonoVerificado).toBe(false);
  });
});

describe('Pedidos - creación', () => {
  it('cliente crea un pedido', async () => {
    const app = buildApp();
    const res = await crearPedido(app, global.generateTestToken({ rol: 'cliente', nombre: 'Cliente Uno' }));

    expect(res.status).toBe(201);
    expect(res.body.clienteId).toBe('test-user-id');
    expect(res.body.clienteNombre).toBe('Cliente Uno');
    expect(res.body.comercioId).toBe('com-1');
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.pagoEstado).toBe('pendiente');
    expect(res.body.metodoPago).toBe('efectivo');
    expect(res.body.total).toBe(7600);
  });

  it('ignora el total manipulado del cliente (recalcula en servidor)', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    if (!(await repo.findById('Comercios', 'com-1'))) {
      await repo.create('Comercios', { id: 'com-1', nombreNegocio: 'Test', activo: 'true', estado: 'aprobado', ciudad: 'palermo' });
    }
    if (!(await repo.findById('Productos', 'prod-1'))) {
      await repo.create('Productos', { id: 'prod-1', comercioId: 'com-1', nombre: 'Empanada', precio: 2500, activo: 'true' });
    }
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({
        comercioId: 'com-1',
        productos: [{ id: 'prod-1', cantidad: 2 }],
        total: 1,
        metodoPago: 'efectivo',
      });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(7600);
  });

  it('crea pedido programado a futuro', async () => {
    const app = buildApp();
    const futura = new Date(Date.now() + 2 * 86400000).toISOString();
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({
        comercioId: 'com-1',
        productos: [{ id: 'prod-1', cantidad: 1 }],
        metodoPago: 'efectivo',
        fechaProgramada: futura,
      });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('programado');
    expect(res.body.fechaProgramada).toBeTruthy();
  });

  it('rechaza programar en el pasado o muy lejos', async () => {
    const app = buildApp();
    const pasada = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({
        comercioId: 'com-1',
        productos: [{ id: 'prod-1', cantidad: 1 }],
        fechaProgramada: new Date(Date.now() - 3600000).toISOString(),
      });
    expect(pasada.status).toBe(400);
    const lejos = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({
        comercioId: 'com-1',
        productos: [{ id: 'prod-1', cantidad: 1 }],
        fechaProgramada: new Date(Date.now() + 10 * 86400000).toISOString(),
      });
    expect(lejos.status).toBe(400);
  });

  it('cliente crea un pedido con método de pago efectivo', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente', nombre: 'Cliente Uno' })}`)
      .send({
        comercioId: 'com-1',
        productos: JSON.stringify([{ id: 'prod-1', nombre: 'Empanada', precio: 2500, cantidad: 2 }]),
        total: 5000,
        direccionEntrega: 'Calle 1 #2-3',
        metodoPago: 'efectivo',
      });
    expect(res.status).toBe(201);
    expect(res.body.metodoPago).toBe('efectivo');
  });

  it('rechaza 400 si faltan campos requeridos', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ comercioId: 'com-1' });
    expect(res.status).toBe(400);
  });

  it('rechaza 409 si el comercio está cerrado o fuera de horario', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Comercios', {
      id: 'com-cerrado', nombreNegocio: 'Cerrado', nombrePropietario: 'P',
      telefono: '300', activo: 'true', estado: 'aprobado',
      horarios: 'Lun-Dom 0 - 1',
    });
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({
        comercioId: 'com-cerrado',
        productos: JSON.stringify([{ id: 'prod-1', nombre: 'Empanada', precio: 2500, cantidad: 2 }]),
        total: 5000,
        direccionEntrega: 'Calle 1 #2-3',
        metodoPago: 'efectivo',
      });
    expect(res.status).toBe(409);
  });
});

describe('Pedidos - listado por rol', () => {
  it('cliente solo ve sus propios pedidos', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-mio', clienteId: 'test-user-id', comercioId: 'com-1', total: '5', estado: 'pendiente' });
    await repo.create('Pedidos', { id: 'pd-ajeno', clienteId: 'otro-usuario', comercioId: 'com-1', total: '9', estado: 'pendiente' });

    const res = await request(app)
      .get('/api/pedidos/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain('pd-mio');
    expect(ids).not.toContain('pd-ajeno');
  });

  it('admin puede ver todos los pedidos', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/pedidos/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Pedidos - cambios de estado', () => {
  async function seedPedido() {
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-estado', clienteId: 'test-user-id', comercioId: 'com-1', total: '5', estado: 'pendiente' });
    return repo;
  }

  it('rechaza estado inválido (400)', async () => {
    const app = buildApp();
    await seedPedido();
    const res = await request(app)
      .put('/api/pedidos/pd-estado/estado')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ estado: 'inexistente' });
    expect(res.status).toBe(400);
  });

  it('comercio no puede cambiar a entregado (403)', async () => {
    const app = buildApp();
    await seedPedido();
    const res = await request(app)
      .put('/api/pedidos/pd-estado/estado')
      .set('Authorization', `Bearer ${global.generateComercioToken()}`)
      .send({ estado: 'entregado' });
    expect(res.status).toBe(403);
  });

  it('domiciliario sí puede marcar como entregado', async () => {
    const app = buildApp();
    await seedPedido();
    const res = await request(app)
      .put('/api/pedidos/pd-estado/estado')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`)
      .send({ estado: 'entregado' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('entregado');

    const repo = (await import('../repositories/index.js')).default;
    const pedido = await repo.findById('Pedidos', 'pd-estado');
    expect(pedido.estado).toBe('entregado');
    expect(pedido.fechaEntrega).toBeTruthy();
  });

  it('marcar como entregado con pago en efectivo completa el pago', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-cash', clienteId: 'test-user-id', comercioId: 'com-1', total: '5000', estado: 'pendiente', metodoPago: 'efectivo' });

    const res = await request(app)
      .put('/api/pedidos/pd-cash/estado')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`)
      .send({ estado: 'entregado' });
    expect(res.status).toBe(200);

    const pedido = await repo.findById('Pedidos', 'pd-cash');
    expect(pedido.pagoEstado).toBe('completado');
  });

  it('marcar como entregado con pago PSE no altera pagoEstado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-pse', clienteId: 'test-user-id', comercioId: 'com-1', total: '5000', estado: 'pendiente', metodoPago: 'pse', pagoEstado: 'pendiente' });

    const res = await request(app)
      .put('/api/pedidos/pd-pse/estado')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`)
      .send({ estado: 'entregado' });
    expect(res.status).toBe(200);

    const pedido = await repo.findById('Pedidos', 'pd-pse');
    expect(pedido.pagoEstado).toBe('pendiente');
  });

  it('admin asigna un domiciliario', async () => {
    const app = buildApp();
    await seedPedido();
    const res = await request(app)
      .put('/api/pedidos/pd-estado/asignar-domiciliario')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ domiciliarioId: 'dom-999' });
    expect(res.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const pedido = await repo.findById('Pedidos', 'pd-estado');
    expect(pedido.domiciliarioId).toBe('dom-999');
  });
});

describe('Pedidos - ubicación del domiciliario (seguimiento)', () => {
  async function crearPedidoAsignado(app, domiciliarioId, id = 'pd-ubic') {
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', {
      id, clienteId: 'test-user-id', comercioId: 'com-1', total: '5000',
      estado: 'en camino', domiciliarioId, lat: '2.934', lng: '-75.281',
    });
  }

  it('bloquea actualizar ubicación sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/pedidos/pd-ubic/ubicacion').send({ lat: '2.9', lng: '-75.2' });
    expect(res.status).toBe(401);
  });

  it('bloquea a un cliente actualizar la ubicación (403)', async () => {
    const app = buildApp();
    await crearPedidoAsignado(app, 'dom-888', 'pd-cli');
    const res = await request(app)
      .put('/api/pedidos/pd-cli/ubicacion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .send({ lat: '2.9', lng: '-75.2' });
    expect(res.status).toBe(403);
  });

  it('bloquea actualizar ubicación de un pedido de otro domiciliario (403)', async () => {
    const app = buildApp();
    await crearPedidoAsignado(app, 'dom-otro', 'pd-otro');
    const res = await request(app)
      .put('/api/pedidos/pd-otro/ubicacion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'domiciliario', id: 'dom-888' })}`)
      .send({ lat: '2.9', lng: '-75.2' });
    expect(res.status).toBe(403);
  });

  it('rechaza 400 si faltan lat/lng', async () => {
    const app = buildApp();
    await crearPedidoAsignado(app, 'dom-888', 'pd-falta');
    const res = await request(app)
      .put('/api/pedidos/pd-falta/ubicacion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'domiciliario', id: 'dom-888' })}`)
      .send({ lat: '' });
    expect(res.status).toBe(400);
  });

  it('domiciliario actualiza su ubicación y se guarda en el pedido', async () => {
    const app = buildApp();
    await crearPedidoAsignado(app, 'dom-888', 'pd-ubi1');
    const token = global.generateTestToken({ rol: 'domiciliario', id: 'dom-888' });
    const res = await request(app)
      .put('/api/pedidos/pd-ubi1/ubicacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: '2.934567', lng: '-75.28123' });
    expect(res.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const pedido = await repo.findById('Pedidos', 'pd-ubi1');
    expect(pedido.domiciliarioLat).toBe('2.934567');
    expect(pedido.domiciliarioLng).toBe('-75.28123');
    expect(pedido.ultimaUbicacion).toBeTruthy();
  });

  it('domiciliario puede reportar ubicación y quedar autoasignado en pedido libre', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', {
      id: 'pd-libre', clienteId: 'test-user-id', comercioId: 'com-1', total: '5000',
      estado: 'en camino',
    });
    const token = global.generateTestToken({ rol: 'domiciliario', id: 'dom-888' });
    const res = await request(app)
      .put('/api/pedidos/pd-libre/ubicacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: '2.93', lng: '-75.28' });
    expect(res.status).toBe(200);

    const pedido = await repo.findById('Pedidos', 'pd-libre');
    expect(pedido.domiciliarioId).toBe('dom-888');
  });
});
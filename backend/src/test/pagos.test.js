import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

const pagosRouter = (await import('../modules/pagos/pagos.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/pagos', pagosRouter);
  return app;
}

const csrfToken = () => {
  const token = Buffer.from('csrf-secret-token-for-test', 'utf8').toString('base64url');
  return token;
};

function withCsrf(req) {
  const token = csrfToken();
  return req
    .set('Cookie', `csrf_token=${token}`)
    .set('x-csrf-token', token);
}

describe('Pagos - autenticación', () => {
  it('bloquea listar sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/pagos/');
    expect(res.status).toBe(401);
  });

  it('bloquea listar con token de cliente (403)', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/pagos/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('admin lista pagos', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pagos', { id: 'pago-1', pedidoId: 'pd-1', estado: 'pendiente' });

    const res = await request(app)
      .get('/api/pagos/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Pagos - generar enlace (sin red)', () => {
  it('rechaza 400 sin pedidoId ni valor', async () => {
    const app = buildApp();
    const res = await withCsrf(request(app)
      .post('/api/pagos/generar-enlace')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ nombreCliente: 'X' });
    expect(res.status).toBe(400);
  });

  it('cliente genera enlace de pago', async () => {
    const app = buildApp();
    const repoPagos = (await import('../repositories/index.js')).default;
    if (!(await repoPagos.findById('Pedidos', 'pd-1'))) {
      await repoPagos.create('Pedidos', { id: 'pd-1', clienteId: 'test-user-id', comercioId: 'com-1', total: 25000, estado: 'pendiente' });
    }
    const res = await withCsrf(request(app)
      .post('/api/pagos/generar-enlace')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ pedidoId: 'pd-1', valor: 25000, nombreCliente: 'Cliente' });

    expect(res.status).toBe(200);
    expect(res.body.enlace).toContain('checkout.wompi.co/p/');
    expect(res.body.enlace).toContain('public-key=test_public_key');
    expect(res.body.enlace).toContain('amount-in-cents=2500000');
    expect(res.body.enlace).toContain('signature%3Aintegrity=');
    expect(res.body.enlace).not.toContain('redirect-url=');
    expect(res.body.referencia).toBeTruthy();

    const repo = (await import('../repositories/index.js')).default;
    const pago = await repo.findById('Pagos', res.body.id);
    expect(pago.estado).toBe('pendiente');
    expect(pago.metodo).toBe('enlace');
  });
});

describe('Pagos - crear transacción Wompi', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'wompi-txn-1' } }),
    }));
  });

  it('rechaza 400 sin pedidoId o monto', async () => {
    const app = buildApp();
    const res = await withCsrf(request(app)
      .post('/api/pagos/crear-transaccion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ monto: 100 });
    expect(res.status).toBe(400);
  });

  it('rechaza 404 si el pedido no existe', async () => {
    const app = buildApp();
    const res = await withCsrf(request(app)
      .post('/api/pagos/crear-transaccion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ pedidoId: 'no-existe', monto: 100, token: 'tok-test' });
    expect(res.status).toBe(404);
  });

  it('rechaza 403 si el pedido es de otro cliente', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-ajeno', clienteId: 'otro', total: '100' });

    const res = await withCsrf(request(app)
      .post('/api/pagos/crear-transaccion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ pedidoId: 'pd-ajeno', monto: 100, token: 'tok-test' });
    expect(res.status).toBe(403);
  });

  it('crea transacción y devuelve checkout', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pedidos', { id: 'pd-propio', clienteId: 'test-user-id', total: '100' });

    const res = await withCsrf(request(app)
      .post('/api/pagos/crear-transaccion')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`))
      .send({ pedidoId: 'pd-propio', monto: 100, token: 'tok-test' });

    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toContain('wompi-txn-1');
    expect(res.body.wompiId).toBe('wompi-txn-1');
  });
});

describe('Pagos - webhook', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'wompi-txn-2', status: 'APPROVED' } }),
    }));
  });

  it('rechaza webhook con firma inválida (400)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/pagos/webhook')
      .set('x-event-checksum', 'firma-invalida')
      .send({ data: { transaction: { id: 'x', status: 'APPROVED', reference: 'y' } }, signature: { properties: ['transaction.id'], timestamp: 1 } });
    expect(res.status).toBe(400);
  });

  it('procesa webhook válido y marca el pedido confirmado', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await repo.create('Pagos', {
      id: 'pago-webhook', pedidoId: 'pd-webhook', estado: 'pendiente',
      referencia: 'REF-1', wompiTransactionId: 'wompi-txn-2',
    });
    await repo.create('Pedidos', { id: 'pd-webhook', clienteId: 'test-user-id', estado: 'pendiente', pagoEstado: 'pendiente' });

    const transaction = { id: 'wompi-txn-2', status: 'APPROVED', amount_in_cents: 4490000, reference: 'REF-1' };
    const timestamp = 1530291411;
    const payload = {
      data: { transaction },
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
        timestamp,
      },
    };
    const values = ['wompi-txn-2', 'APPROVED', 4490000].join('') + timestamp;
    const signature = crypto
      .createHash('sha256')
      .update(values + 'test_events_secret')
      .digest('hex');

    const res = await request(app)
      .post('/api/pagos/webhook')
      .set('x-event-checksum', signature)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('completado');

    const pedido = await repo.findById('Pedidos', 'pd-webhook');
    expect(pedido.estado).toBe('confirmado');
    expect(pedido.pagoEstado).toBe('completado');
  });
});

describe('Pagos - consultar transacción', () => {
  it('devuelve 404 si no existe el pago', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/pagos/referencia/NO-EXISTE')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(404);
  });
});
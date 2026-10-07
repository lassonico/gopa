import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const dashboardRouter = (await import('../modules/dashboard/dashboard.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRouter);
  return app;
}

describe('Dashboard', () => {
  it('bloquea sin token (401)', async () => {
    const res = await request(buildApp()).get('/api/dashboard/');
    expect(res.status).toBe(401);
  });

  it('bloquea con rol cliente (403)', async () => {
    const res = await request(buildApp())
      .get('/api/dashboard/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('admin obtiene métricas del dashboard', async () => {
    const repo = (await import('../repositories/index.js')).default;
    const hoy = new Date().toISOString();
    await repo.create('Pedidos', {
      id: 'pd-dash-1', estado: 'entregado', total: '50000', clienteId: 'c1',
      fechaCreacion: hoy, fechaEntrega: hoy,
    });
    await repo.create('Pedidos', {
      id: 'pd-dash-2', estado: 'pendiente', total: '20000', clienteId: 'c1',
      fechaCreacion: hoy,
    });
    await repo.create('Comercios', {
      id: 'com-dash', estado: 'aprobado', calificacionPromedio: '4.8',
      nombreNegocio: 'Restaurante',
    });
    await repo.create('Usuarios', { id: 'usr-dash', nombre: 'U', correo: 'u@test.com' });

    const res = await request(buildApp())
      .get('/api/dashboard/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPedidos).toBeGreaterThanOrEqual(2);
    expect(res.body.pedidosPendientes).toBeGreaterThanOrEqual(1);
    expect(res.body.comerciosAprobados).toBeGreaterThanOrEqual(1);
    expect(res.body.usuariosRegistrados).toBeGreaterThanOrEqual(1);
    expect(res.body.ventasHoy).toBe(50000);
    expect(res.body.comerciosMejorCalificados.length).toBeGreaterThanOrEqual(1);
  });
});
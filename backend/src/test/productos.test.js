import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const productosRouter = (await import('../modules/productos/productos.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/productos', productosRouter);
  return app;
}

function seedComercio(repo, id, nombre) {
  return repo.create('Comercios', {
    id, nombreNegocio: nombre, nombrePropietario: 'P', telefono: '300',
    activo: 'true', estado: 'aprobado',
  });
}

describe('Productos - consultas públicas', () => {
  it('GET / lista productos con el nombre del negocio', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedComercio(repo, 'com-1', 'Comercio Uno');
    await repo.create('Productos', {
      id: 'prod-1', comercioId: 'com-1', nombre: 'Empanadas', precio: '2500', activo: 'true',
    });

    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    const prod = res.body.find(p => p.id === 'prod-1');
    expect(prod.nombreNegocio).toBe('Comercio Uno');
  });

  it('GET /comercio/:id solo muestra productos activos del comercio', async () => {
    const app = buildApp();
    const repo = (await import('../repositories/index.js')).default;
    await seedComercio(repo, 'com-2', 'Comercio Dos');
    await repo.create('Productos', {
      id: 'p-a', comercioId: 'com-2', nombre: 'Activo', precio: '1000', activo: 'true',
    });
    await repo.create('Productos', {
      id: 'p-i', comercioId: 'com-2', nombre: 'Inactivo', precio: '1000', activo: 'false',
    });

    const res = await request(app).get('/api/productos/comercio/com-2');
    expect(res.status).toBe(200);
    const nombres = res.body.map(p => p.nombre);
    expect(nombres).toContain('Activo');
    expect(nombres).not.toContain('Inactivo');
  });

  it('GET /:id devuelve 404 si no existe', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/productos/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('Productos - admin', () => {
  it('bloquea POST / sin token (401)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/productos/').send({
      comercioId: 'com-1', nombre: 'X', precio: '1000',
    });
    expect(res.status).toBe(401);
  });

  it('rechaza 400 si faltan campos requeridos', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/productos/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`)
      .send({ nombre: 'Sin comercio ni precio' });
    expect(res.status).toBe(400);
  });

  it('admin crea, actualiza y elimina un producto', async () => {
    const app = buildApp();
    const tokens = { Authorization: `Bearer ${global.generateAdminToken()}` };

    const crear = await request(app).post('/api/productos/').set(tokens).send({
      comercioId: 'com-1', nombre: 'Hamburguesa', precio: '15000', categoria: 'Comidas',
    });
    expect(crear.status).toBe(201);
    expect(crear.body.activo).toBe('true');
    expect(crear.body.precio).toBe('15000');

    const actualizar = await request(app)
      .put(`/api/productos/${crear.body.id}`)
      .set(tokens)
      .send({ precio: '17000' });
    expect(actualizar.status).toBe(200);

    const eliminar = await request(app).delete(`/api/productos/${crear.body.id}`).set(tokens);
    expect(eliminar.status).toBe(200);

    const repo = (await import('../repositories/index.js')).default;
    const producto = await repo.findById('Productos', crear.body.id);
    expect(producto).toBeNull();
  });
});
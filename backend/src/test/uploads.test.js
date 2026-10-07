import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

const uploadsRouter = (await import('../modules/uploads/uploads.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/uploads', uploadsRouter);
  return app;
}

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);

describe('Uploads - control de acceso y validación', () => {
  it('bloquea sin token (401)', async () => {
    const res = await request(buildApp()).post('/api/uploads/').attach('imagen', PNG_BYTES, 'foto.png');
    expect(res.status).toBe(401);
  });

  it('bloquea con rol cliente (403)', async () => {
    const res = await request(buildApp())
      .post('/api/uploads/')
      .set('Authorization', `Bearer ${global.generateTestToken({ rol: 'cliente' })}`)
      .attach('imagen', PNG_BYTES, 'foto.png');
    expect(res.status).toBe(403);
  });

  it('rechaza 400 sin imagen', async () => {
    const res = await request(buildApp())
      .post('/api/uploads/')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(400);
  });
});
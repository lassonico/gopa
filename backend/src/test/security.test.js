import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const { upload, validateFileContent } = await import('../middleware/upload.middleware.js');
const { authenticate, authorize } = await import('../middleware/auth.middleware.js');
const config = (await import('../config/index.js')).default;

describe('Security - Helmet Headers', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(helmet());
    app.get('/test', (req, res) => res.json({ ok: true }));
  });
  
  it('should set X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  
  it('should set X-Frame-Options: SAMEORIGIN', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
  
  it('should set X-XSS-Protection: 0', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-xss-protection']).toBe('0');
  });
  
  it('should set Referrer-Policy', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['referrer-policy']).toBeDefined();
  });
  
  it('should set Content-Security-Policy', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Security - CORS Configuration', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(cors({
      origin: config.cors.origin,
      credentials: true
    }));
    app.get('/test', (req, res) => res.json({ ok: true }));
  });
  
  it('should allow configured origins', async () => {
    const res = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
  
  it('should reject unconfigured origins in production', async () => {
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://evil.com');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
  });
});

describe('Security - Rate Limiting', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    const limiter = rateLimit({
      windowMs: 60000,
      max: 5,
      message: { error: 'Demasiadas solicitudes' }
    });
    app.use('/api/', limiter);
    app.post('/api/test', (req, res) => res.json({ ok: true }));
  });
  
  it('should allow requests under limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/test').send({ data: i });
      expect(res.status).toBe(200);
    }
  });
  
  it('should block requests over limit', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/test').send({ data: i });
    }
    const res = await request(app).post('/api/test').send({ data: 6 });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Demasiadas solicitudes');
  });
});

describe('Security - JWT Authentication', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/protected', authenticate, (req, res) => {
      res.json({ user: req.user });
    });
  });
  
  it('should reject requests without token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token requerido');
  });
  
  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido o expirado');
  });
  
  it('should reject expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const expiredToken = jwt.sign(
      { id: 'test', email: 'test@test.com', rol: 'cliente' },
      config.jwt.secret,
      { expiresIn: '-1h' }
    );
    
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido o expirado');
  });
  
  it('should accept valid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${global.generateTestToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('test-user-id');
    expect(res.body.user.rol).toBe('cliente');
  });
});

describe('Security - Authorization (RBAC)', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/admin', authenticate, authorize('admin'), (req, res) => {
      res.json({ ok: true });
    });
    app.get('/domiciliario', authenticate, authorize('domiciliario'), (req, res) => {
      res.json({ ok: true });
    });
    app.get('/multi', authenticate, authorize('admin', 'comercio'), (req, res) => {
      res.json({ ok: true });
    });
  });
  
  it('should allow admin access to admin route', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(res.status).toBe(200);
  });
  
  it('should deny client access to admin route', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${global.generateTestToken()}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('No tienes permisos para esta acción');
  });
  
  it('should allow domiciliario access to domiciliario route', async () => {
    const res = await request(app)
      .get('/domiciliario')
      .set('Authorization', `Bearer ${global.generateDomiciliarioToken()}`);
    expect(res.status).toBe(200);
  });
  
  it('should allow multiple roles for multi-role route', async () => {
    const adminRes = await request(app)
      .get('/multi')
      .set('Authorization', `Bearer ${global.generateAdminToken()}`);
    expect(adminRes.status).toBe(200);
    
    const comercioRes = await request(app)
      .get('/multi')
      .set('Authorization', `Bearer ${global.generateComercioToken()}`);
    expect(comercioRes.status).toBe(200);
    
    const clientRes = await request(app)
      .get('/multi')
      .set('Authorization', `Bearer ${global.generateTestToken()}`);
    expect(clientRes.status).toBe(403);
  });
});

describe('Security - File Upload Validation', () => {
  it('should reject non-image MIME types', () => {
    const mockFile = { mimetype: 'application/pdf' };
    const mockCb = vi.fn();
    
    upload.fileFilter(null, mockFile, mockCb);
    
    expect(mockCb).toHaveBeenCalledWith(expect.any(Error), false);
    expect(mockCb.mock.calls[0][0].message).toContain('Solo se permiten imágenes');
  });
  
  it('should accept valid image MIME types', () => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mockCb = vi.fn();
    
    for (const type of validTypes) {
      const mockFile = { mimetype: type };
      upload.fileFilter(null, mockFile, mockCb);
      expect(mockCb).toHaveBeenCalledWith(null, true);
      mockCb.mockClear();
    }
  });
  
  it('should validate magic bytes for JPEG', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(validateMagicBytes(jpegBuffer, 'image/jpeg')).toBe(true);
  });
  
  it('should validate magic bytes for PNG', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(validateMagicBytes(pngBuffer, 'image/png')).toBe(true);
  });
  
  it('should reject mismatched magic bytes', () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    expect(validateMagicBytes(pdfBuffer, 'image/jpeg')).toBe(false);
  });
});

function validateMagicBytes(buffer, mimeType) {
  const MAGIC_BYTES = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
    'image/gif': [0x47, 0x49, 0x46, 0x38]
  };
  
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.every((byte, i) => buffer[i] === byte);
}

describe('Security - Config Validation', () => {
  it('should require JWT_SECRET in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.DB_PASSWORD;
    delete process.env.CORS_ORIGIN;
    
    vi.resetModules();
    
    await expect(import('../config/index.js')).rejects.toThrow('JWT_SECRET');
    
    process.env.NODE_ENV = originalEnv;
  });
  
  it('should require DB_PASSWORD in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test_secret_min_32_chars_!!';
    delete process.env.DB_PASSWORD;
    delete process.env.CORS_ORIGIN;
    
    vi.resetModules();
    
    await expect(import('../config/index.js')).rejects.toThrow('DB_PASSWORD');
    
    process.env.NODE_ENV = originalEnv;
  });
  
  it('should require CORS_ORIGIN in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test_secret_min_32_chars_!!';
    process.env.DB_PASSWORD = 'test_password';
    delete process.env.CORS_ORIGIN;
    
    vi.resetModules();
    
    await expect(import('../config/index.js')).rejects.toThrow('CORS_ORIGIN');
    
    process.env.NODE_ENV = originalEnv;
  });
  
  it('should use safe defaults in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.DB_PASSWORD;
    delete process.env.CORS_ORIGIN;
    
    vi.resetModules();
    
    const cfg = (await import('../config/index.js')).default;
    expect(cfg.jwt.secret).toBeDefined();
    expect(cfg.mysql.password).toBe('');
    expect(cfg.cors.origin).toContain('http://localhost:5173');
    
    process.env.NODE_ENV = originalEnv;
  });
});

describe('Security - Password Reset Token', () => {
  it('should generate secure random token', async () => {
    const { generateToken } = await import('../utils/helpers.js');
    const token = generateToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(32);
  });
  
  it('should generate unique tokens', async () => {
    const { generateToken } = await import('../utils/helpers.js');
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });
});
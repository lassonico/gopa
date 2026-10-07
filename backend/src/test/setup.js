const jwt = require('jsonwebtoken');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test_secret_key_min_32_chars_!!';
process.env.DB_PASSWORD = 'test_password';
process.env.CORS_ORIGIN = 'http://localhost:5173,http://localhost:5175,http://localhost:5176';
process.env.NODE_ENV = 'test';
process.env.DB_ENGINE = 'json';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'domicilios-test-'));
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.WOMPI_ENV = 'sandbox';
process.env.WOMPI_PRIVATE_KEY = 'test_private_key';
process.env.WOMPI_PUBLIC_KEY = 'test_public_key';
process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret';
process.env.WOMPI_EVENTS_SECRET = 'test_events_secret';
process.env.ADMIN_EMAIL = 'admin@test.com';
// Desactivar Turnstile en tests: no debe depender de llaves reales del entorno
process.env.TURNSTILE_SECRET_KEY = '';
process.env.TURNSTILE_SITE_KEY = '';
process.env.TURNSTILE_HOSTNAMES = 'localhost';
process.env.TURNSTILE_EXCLUDED_ORIGINS = '';

global.generateTestToken = (payload = {}) => {
  return jwt.sign(
    { id: 'test-user-id', email: 'test@example.com', rol: 'cliente', nombre: 'Test User', comercioId: '', telefonoVerificado: '1', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

global.generateTokenSinTelefonoVerificado = () => {
  return global.generateTestToken({ telefonoVerificado: '0' });
};

global.generateAdminToken = () => {
  return global.generateTestToken({ rol: 'admin' });
};

global.generateDomiciliarioToken = () => {
  return global.generateTestToken({ rol: 'domiciliario' });
};

global.generateComercioToken = () => {
  return global.generateTestToken({ rol: 'comercio', comercioId: 'comercio-123' });
};
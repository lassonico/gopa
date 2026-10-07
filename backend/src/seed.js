require('dotenv').config();
const bcrypt = require('bcryptjs');
const repository = require('./repositories');
const { generateId } = require('./utils/helpers');

const DEV_ADMIN_EMAIL = 'admin@dp.com';
const DEV_ADMIN_PASSWORD = 'admin123';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ seed.js está deshabilitado en producción. Crea el admin por el panel o con ADMIN_SEED_* en un entorno no productivo.');
    process.exit(1);
  }

  const users = await repository.findAll('Usuarios');
  const existing = users.find(u => u.rol === 'admin');
  if (existing) {
    console.log(`Ya existe un admin: ${existing.email}`);
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL || DEV_ADMIN_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD || DEV_ADMIN_PASSWORD;
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = {
    id: generateId(),
    nombre: 'Admin',
    email,
    telefono: '3000000000',
    direccion: 'Principal',
    password: hashedPassword,
    rol: 'admin',
    activo: 'true',
    fechaRegistro: new Date().toISOString()
  };

  await repository.create('Usuarios', admin);

  const categorias = ['Restaurante', 'Pizza', 'Asados', 'Helados', 'Panadería', 'Saludable', 'Café', 'Mexicano'];
  for (const nombre of categorias) {
    const existingCat = await repository.findWhere('Categorias', 'nombre', nombre);
    if (existingCat.length === 0) {
      await repository.create('Categorias', {
        id: generateId(), nombre, descripcion: '', icono: '', activo: 'true'
      });
    }
  }

  console.log(`✓ Admin creado: ${email}`);
  console.log('✓ Categorías creadas: ' + categorias.join(', '));
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

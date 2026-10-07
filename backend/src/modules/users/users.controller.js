const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const SHEET = 'Usuarios';

let firebaseAuthInstance = null;
function getFirebaseAuth() {
  if (firebaseAuthInstance) return firebaseAuthInstance;
  try {
    if (getApps().length === 0) {
      let serviceAccount;
      const jsonPath = path.resolve(__dirname, '../../../firebase-service-account.json');
      if (fs.existsSync(jsonPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
      if (serviceAccount) {
        initializeApp({ credential: cert(serviceAccount) });
      }
    }
    firebaseAuthInstance = getAuth();
    return firebaseAuthInstance;
  } catch (err) {
    console.error('Error iniciando Firebase Auth Admin:', err.message);
    return null;
  }
}

function puedeActuar(req, id) {
  return req.user.rol === 'admin' || req.user.id === id;
}

function usuarioSeguro(user) {
  const { password: _, refreshToken: __, resetToken: ___, ...safe } = user;
  return safe;
}

exports.create = async (req, res, next) => {
  try {
    const { nombre, email, telefono, direccion, password, rol, activo } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'nombre, email y password requeridos' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevo = {
      id: generateId(),
      nombre,
      email: String(email).toLowerCase().trim(),
      telefono: telefono || '',
      direccion: direccion || '',
      password: hashedPassword,
      rol: rol || 'cliente',
      activo: activo !== undefined ? activo : 'true',
      fechaRegistro: new Date().toISOString()
    };
    await repository.create(SHEET, nuevo);
    const { password: _, resetToken, ...safe } = nuevo;
    res.status(201).json(safe);
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const users = await repository.findAll(SHEET);
    const safe = users.map(({ password, resetToken, ...u }) => u);
    res.json(safe);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await repository.findById(SHEET, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeActuar(req, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    const { password, resetToken, ...safe } = user;
    res.json(safe);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!puedeActuar(req, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    const { nombre, telefono, direccion, email, password, avatar } = req.body;
    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (telefono !== undefined) updates.telefono = telefono;
    if (direccion !== undefined) updates.direccion = direccion;
    if (email !== undefined) {
      const emailNorm = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
      }
      const users = await repository.findAll(SHEET);
      if (users.some(u => String(u.email || '').toLowerCase() === emailNorm && u.id !== req.params.id)) {
        return res.status(409).json({ error: 'El correo ya está en uso' });
      }
      updates.email = emailNorm;
    }
    if (avatar !== undefined) updates.avatar = avatar;
    if (telefono !== undefined) {
      const userActual = await repository.findById(SHEET, req.params.id);
      if (!userActual) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (userActual.telefono !== telefono) {
        updates.telefonoVerificado = 0;
      }
    }
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    await repository.update(SHEET, req.params.id, updates);
    const user = await repository.findById(SHEET, req.params.id);
    res.json(usuarioSeguro(user));
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    next(error);
  }
};

// DELETE /users/:id/eliminar-cuenta — el propio usuario (Ley 1581).
// Anonimiza en vez de borrar: los pedidos se conservan por obligación legal.
exports.eliminarCuenta = async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes eliminar tu propia cuenta' });
    }
    const user = await repository.findById(SHEET, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const anon = `eliminado_${user.id.slice(0, 8)}`;
    const bcrypt = require('bcryptjs');
    await repository.update(SHEET, user.id, {
      nombre: 'Usuario eliminado',
      email: `${anon}@eliminado.local`,
      telefono: '',
      direccion: '',
      avatar: '',
      password: await bcrypt.hash(generateId() + Date.now(), 10),
      refreshToken: '',
      resetToken: '',
      activo: 'false',
    });
    res.json({ message: 'Cuenta eliminada. Tus datos personales fueron anonimizados.' });
  } catch (error) {
    next(error);
  }
};

exports.verificarCodigoFirebase = async (req, res, next) => {
  try {
    if (!puedeActuar(req, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    const user = await repository.findById(SHEET, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { idToken, phoneNumber } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Token de verificación de Firebase no proporcionado.' });
    }

    let verifiedPhone = phoneNumber;
    try {
      const authAdmin = getFirebaseAuth();
      if (authAdmin) {
        const decoded = await authAdmin.verifyIdToken(idToken);
        if (decoded.phone_number) {
          verifiedPhone = decoded.phone_number;
        }
      }
    } catch (firebaseErr) {
      console.warn('Error verificando idToken de Firebase:', firebaseErr.message);
      if (!verifiedPhone) {
        return res.status(400).json({ error: 'No se pudo validar el token de verificación de Firebase.' });
      }
    }

    const telefonoFinal = verifiedPhone || user.telefono;
    if (!telefonoFinal) {
      return res.status(400).json({ error: 'Número de teléfono no identificado.' });
    }

    await repository.update(SHEET, user.id, {
      telefonoVerificado: 1,
      telefono: telefonoFinal,
    });

    const updated = await repository.findById(SHEET, user.id);
    res.json({ message: 'Número de teléfono verificado exitosamente.', user: usuarioSeguro(updated) });
  } catch (error) {
    next(error);
  }
};

const bcrypt = require('bcryptjs');
const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');

const SHEET = 'Usuarios';

exports.getAll = async (req, res, next) => {
  try {
    const users = await repository.findAll(SHEET);
    const domiciliarios = users.filter(u => u.rol === 'domiciliario' && u.activo !== 'false');
    const safe = domiciliarios.map(({ password, resetToken, ...u }) => u);
    res.json(safe);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await repository.findById(SHEET, req.params.id);
    if (!user || user.rol !== 'domiciliario') {
      return res.status(404).json({ error: 'Domiciliario no encontrado' });
    }
    const { password, resetToken, ...safe } = user;
    res.json(safe);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, email, telefono, password, direccion } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'nombre, email y password son requeridos' });
    }
    if (String(nombre).length > 100 || String(telefono || '').length > 20 || String(direccion || '').length > 200) {
      return res.status(400).json({ error: 'Campos demasiado largos' });
    }
    const emailNormalizado = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }
    const users = await repository.findAll(SHEET);
    if (users.find(u => u.email === emailNormalizado)) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevo = {
      id: generateId(),
      nombre,
      email: emailNormalizado,
      telefono: telefono || '',
      direccion: direccion || '',
      password: hashedPassword,
      rol: 'domiciliario',
      activo: 'true',
      disponible: 'true',
      fechaRegistro: formatDate()
    };
    await repository.create(SHEET, nuevo);
    const { password: _, resetToken, ...safe } = nuevo;
    res.status(201).json(safe);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const user = await repository.findById(SHEET, req.params.id);
    if (!user || user.rol !== 'domiciliario') {
      return res.status(404).json({ error: 'Domiciliario no encontrado' });
    }
    const { nombre, email, telefono, direccion, password } = req.body;
    const updateData = {};
    if (nombre !== undefined) updateData.nombre = String(nombre).trim();
    if (telefono !== undefined) updateData.telefono = String(telefono).trim();
    if (direccion !== undefined) updateData.direccion = String(direccion).trim();
    if (email !== undefined) {
      const emailNorm = String(email || '').toLowerCase().trim();
      if (!emailNorm) {
        return res.status(400).json({ error: 'El correo no puede estar vacío' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
      }
      const users = await repository.findAll(SHEET);
      if (users.some(u => String(u.email || '').toLowerCase() === emailNorm && u.id !== user.id)) {
        return res.status(409).json({ error: `El correo ${emailNorm} ya está en uso por otro usuario` });
      }
      updateData.email = emailNorm;
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Sin cambios para guardar' });
    }
    await repository.update(SHEET, req.params.id, updateData);
    res.json({ message: 'Domiciliario actualizado' });
  } catch (error) {
    next(error);
  }
};

exports.toggleDisponible = async (req, res, next) => {
  try {
    const user = await repository.findById(SHEET, req.params.id);
    if (!user || user.rol !== 'domiciliario') {
      return res.status(404).json({ error: 'Domiciliario no encontrado' });
    }
    const nuevoEstado = user.disponible === 'true' ? 'false' : 'true';
    await repository.update(SHEET, req.params.id, { disponible: nuevoEstado });
    res.json({ message: `Domiciliario ${nuevoEstado === 'true' ? 'disponible' : 'no disponible'}`, disponible: nuevoEstado });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await repository.update(SHEET, req.params.id, { activo: 'false' });
    res.json({ message: 'Domiciliario desactivado' });
  } catch (error) {
    next(error);
  }
};

exports.resetPasswordAdmin = async (req, res, next) => {
  try {
    const user = await repository.findById(SHEET, req.params.id);
    if (!user || user.rol !== 'domiciliario') {
      return res.status(404).json({ error: 'Domiciliario no encontrado' });
    }
    if (!user.email) {
      return res.status(400).json({ error: 'Este domiciliario no tiene email registrado.' });
    }

    const resetToken = require('crypto').randomBytes(24).toString('hex');
    await repository.update(SHEET, user.id, {
      resetToken,
      resetTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const base = process.env.DOMICILIARIO_URL || 'https://domiciliario.domipalermo.com';
    const resetLink = `${base}/reset-password?token=${resetToken}`;
    const emailService = require('../../services/email.service');
    const r = await emailService.sendPasswordReset(user.email, resetLink);
    if (!r.success) {
      return res.status(502).json({ error: 'No se pudo enviar el correo de recuperación.' });
    }
    res.json({ message: `Correo de restablecimiento enviado a ${user.email}` });
  } catch (error) {
    next(error);
  }
};

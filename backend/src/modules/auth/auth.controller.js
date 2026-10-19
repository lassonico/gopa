const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../../config');
const repository = require('../../repositories');
const { generateId, generateToken } = require('../../utils/helpers');
const { cola } = require('../../services/cola.service');
const emailService = require('../../services/email.service');
const { validatePasswordStrength, checkPasswordBreach, validatePasswordChange } = require('../../utils/passwordPolicy');
const { addToken, serializeTokens } = require('../../utils/fcmTokens');

const googleClient = new OAuth2Client(config.google.oauthClientId);

const SHEET_USERS = 'Usuarios';

// Versión vigente de Términos + Política (prueba de autorización Ley 1581)
const VERSION_TERMINOS = '2026-09';

const LOGIN_ATTEMPTS = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MAX_TRACKED_EMAILS = 5000;

// Limpieza periódica de registros vencidos (evita crecimiento infinito en memoria)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of LOGIN_ATTEMPTS) {
    if (!record.lockedUntil && (now - (record.lastSeen || 0)) > LOCKOUT_DURATION) {
      LOGIN_ATTEMPTS.delete(key);
    } else if (record.lockedUntil && now > record.lockedUntil) {
      LOGIN_ATTEMPTS.delete(key);
    }
  }
  // Tope de seguridad: evictar los más antiguos si sigue enorme
  while (LOGIN_ATTEMPTS.size > MAX_TRACKED_EMAILS) {
    LOGIN_ATTEMPTS.delete(LOGIN_ATTEMPTS.keys().next().value);
  }
}, 5 * 60 * 1000).unref?.();

function getGoogleName(payload) {
  return payload.name || payload.given_name || payload.email?.split('@')[0] || 'Usuario';
}

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre, comercioId: user.comercioId || '', telefonoVerificado: user.telefonoVerificado },
    config.jwt.secret,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn || '7d' }
  );
  return { accessToken, refreshToken };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProd = config.nodeEnv === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  };
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const clearAuthCookies = (res) => {
  const isProd = config.nodeEnv === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  };
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

const getFailedAttempts = (email) => {
  const record = LOGIN_ATTEMPTS.get(email.toLowerCase());
  if (!record) return { count: 0, lockedUntil: null };
  if (record.lockedUntil && Date.now() > record.lockedUntil) {
    LOGIN_ATTEMPTS.delete(email.toLowerCase());
    return { count: 0, lockedUntil: null };
  }
  return record;
};

const recordFailedAttempt = (email) => {
  const key = email.toLowerCase();
  const record = LOGIN_ATTEMPTS.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;
  record.lastSeen = Date.now();
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  LOGIN_ATTEMPTS.set(key, record);
  return record;
};

const clearFailedAttempts = (email) => {
  LOGIN_ATTEMPTS.delete(email.toLowerCase());
};

const isAccountLocked = (email) => {
  const { lockedUntil } = getFailedAttempts(email);
  return lockedUntil && Date.now() < lockedUntil;
};

const getLockoutTimeRemaining = (email) => {
  const { lockedUntil } = getFailedAttempts(email);
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000 / 60));
};

exports.register = async (req, res, next) => {
  try {
    const { nombre, email: rawEmail, telefono, password, direccion } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ 
        error: 'Contraseña no cumple con los requisitos de seguridad', 
        details: passwordCheck.errors,
        warnings: passwordCheck.warnings,
      });
    }
    
    const breach = await checkPasswordBreach(password);
    if (breach.breached) {
      return res.status(400).json({ 
        error: 'Esta contraseña ha aparecido en filtraciones de datos', 
        message: 'Elige una contraseña diferente y más segura'
      });
    }
    
    const existing = await repository.findOne(SHEET_USERS, 'email', email);
    if (existing) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: generateId(),
      nombre,
      email,
      telefono: telefono || '',
      direccion: direccion || '',
      password: hashedPassword,
      rol: 'cliente',
      activo: 'true',
      terminosVersion: VERSION_TERMINOS,
      terminosFecha: new Date().toISOString(),
      fechaRegistro: new Date().toISOString()
    };
    await repository.create(SHEET_USERS, newUser);
    cola.encolar('bienvenida', { email, nombre });
    const { accessToken, refreshToken } = generateTokens(newUser);
    await repository.update(SHEET_USERS, newUser.id, { refreshToken });
    setAuthCookies(res, accessToken, refreshToken);
    const { password: _, refreshToken: __, resetToken: ___, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    // Usar el body ya validado por el schema cuando exista
    const raw = req.validatedBody || req.body || {};
    const { email: rawEmail, password: rawPassword } = raw;
    // Validación y limpieza estricta de inputs
    if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    // Quitar espacios y caracteres de control; normalizar a minúsculas
    const normalizedEmail = rawEmail.replace(/[\x00-\x1F\x7F]/g, '').trim().toLowerCase();
    const password = rawPassword.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    if (normalizedEmail.length < 3 || normalizedEmail.length > 255) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    
    if (isAccountLocked(normalizedEmail)) {
      const minutes = getLockoutTimeRemaining(normalizedEmail);
      return res.status(429).json({ 
        error: 'Cuenta bloqueada temporalmente', 
        message: `Demasiados intentos fallidos. Intente nuevamente en ${minutes} minutos.`
      });
    }
    
    const identificador = normalizedEmail;
    // Búsqueda indexada por email; respaldo por nombre de usuario
    let user = await repository.findOne(SHEET_USERS, 'email', identificador);
    if (!user) {
      const porUsuario = await repository.findWhere(SHEET_USERS, 'usuario', identificador);
      user = porUsuario[0] || null;
    }
    if (!user) {
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (user.activo === 'false') {
      return res.status(401).json({ error: 'Cuenta desactivada' });
    }
    if (!user.password) {
      // Cuentas creadas solo con Google: sin hash que comparar
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    clearFailedAttempts(normalizedEmail);
    // Backfill de prueba de autorización para cuentas antiguas
    if (!user.terminosVersion) {
      await repository.update(SHEET_USERS, user.id, {
        terminosVersion: VERSION_TERMINOS,
        terminosFecha: user.fechaRegistro || new Date().toISOString(),
      }).catch(() => {});
    }
    const { accessToken, refreshToken } = generateTokens(user);
    await repository.update(SHEET_USERS, user.id, { refreshToken });
    setAuthCookies(res, accessToken, refreshToken);
    const { password: _, refreshToken: __, resetToken: ___, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    next(error);
  }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { credential, access_token } = req.body;
    let payload;
    if (access_token) {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        return res.status(401).json({ error: 'Credencial de Google inválida' });
      }
      payload = await r.json();
    } else if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.oauthClientId,
      });
      payload = ticket.getPayload();
    } else {
      return res.status(400).json({ error: 'Credencial de Google requerida' });
    }
    const { sub: googleId, email, picture } = payload;
    const nombre = getGoogleName(payload);

    let user = await repository.findOne('Usuarios', 'email', String(email || '').toLowerCase());
    if (!user) {
      const todos = await repository.findAll('Usuarios');
      user = todos.find(u => u.email === email) || null;
    }

    if (!user) {
      user = {
        id: generateId(),
        nombre,
        email,
        telefono: '',
        direccion: '',
        password: '',
        googleId,
        avatar: picture || '',
        rol: 'cliente',
        activo: 'true',
        terminosVersion: VERSION_TERMINOS,
        terminosFecha: new Date().toISOString(),
        fechaRegistro: new Date().toISOString()
      };
      await repository.create('Usuarios', user);
    } else if (!user.googleId) {
      await repository.update('Usuarios', user.id, { googleId, avatar: picture || '' });
      user.googleId = googleId;
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await repository.update('Usuarios', user.id, { refreshToken });
    setAuthCookies(res, accessToken, refreshToken);
    const { password: _, refreshToken: __, resetToken: ___, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    if (error.message?.includes('Invalid token') || error.message?.includes('audience')) {
      return res.status(401).json({ error: 'Credencial de Google inválida' });
    }
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido' });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.secret);
    } catch (err) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
    if (decoded.type !== 'refresh') {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Token inválido' });
    }
    const user = await repository.findById(SHEET_USERS, decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Token revocado' });
    }
    if (user.activo === 'false') {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Cuenta desactivada' });
    }
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await repository.update(SHEET_USERS, user.id, { refreshToken: newRefreshToken });
    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const users = await repository.findAll(SHEET_USERS);
      const user = users.find(u => u.refreshToken === refreshToken);
      if (user) {
        await repository.update(SHEET_USERS, user.id, { refreshToken: '' });
      }
    }
    clearAuthCookies(res);
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    next(error);
  }
};

exports.recoverPassword = async (req, res, next) => {
  try {
    const raw = req.validatedBody || req.body || {};
    const email = typeof raw.email === 'string' ? raw.email.replace(/[\x00-\x1F\x7F]/g, '').trim().toLowerCase() : '';
    const user = email ? await repository.findOne(SHEET_USERS, 'email', email) : null;
    if (user) {
      const resetToken = generateToken();
      const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await repository.update(SHEET_USERS, user.id, { resetToken, resetTokenExpiresAt });
      const resetLink = `${req.headers.origin || config.clientUrl}/reset-password?token=${resetToken}`;
      cola.encolar('reset-password', { email, resetLink });
    }
    res.json({ message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const users = await repository.findAll(SHEET_USERS);
    const user = users.find(u => u.resetToken === token);
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() <= Date.now()) {
      if (user) {
        await repository.update(SHEET_USERS, user.id, { resetToken: '', resetTokenExpiresAt: '' });
      }
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ 
        error: 'Contraseña no cumple con los requisitos de seguridad', 
        details: passwordCheck.errors,
        warnings: passwordCheck.warnings,
      });
    }
    
    const breach = await checkPasswordBreach(newPassword);
    if (breach.breached) {
      return res.status(400).json({ 
        error: 'Esta contraseña ha aparecido en filtraciones de datos', 
        message: 'Elige una contraseña diferente y más segura'
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await repository.update(SHEET_USERS, user.id, { password: hashedPassword, resetToken: '', resetTokenExpiresAt: '' });
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/crear-password-comercio { token, password } — público con límite.
// El comercio crea su contraseña desde el botón del correo de aprobación.
exports.crearPasswordComercio = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña requeridos' });
    }
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const invs = await repository.findAll('Invitaciones').catch(() => []);
    const inv = (invs || []).find(i => i.tokenHash === hash);
    const yaUsada = inv && (inv.usado === true || inv.usado === 1 || inv.usado === 'true');
    if (!inv || yaUsada) {
      return res.status(400).json({ error: 'Invitación inválida o ya utilizada' });
    }
    if (inv.expira && new Date(inv.expira).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invitación vencida. Pide una nueva al administrador.' });
    }
    const pwError = validatePasswordStrength(password);
    if (pwError && !pwError.valid) {
      return res.status(400).json({ error: 'Contraseña no cumple los requisitos', details: pwError.errors });
    }
    const breach = await checkPasswordBreach(password).catch(() => ({ breached: false }));
    if (breach.breached) {
      return res.status(400).json({ error: 'Esta contraseña apareció en filtraciones. Elige otra.' });
    }
    const users = await repository.findAll(SHEET_USERS);
    const emailNorm = String(inv.email || '').toLowerCase();
    let user = users.find(u => String(u.email || '').toLowerCase() === emailNorm);
    const hashed = await bcrypt.hash(password, 12);
    if (user && !user.comercioId) {
      await repository.update(SHEET_USERS, user.id, { password: hashed, rol: 'comercio', comercioId: inv.comercioId, activo: 'true' });
    } else if (!user) {
      const comercio = await repository.findById('Comercios', inv.comercioId).catch(() => null);
      user = {
        id: generateId(),
        nombre: comercio?.nombrePropietario || comercio?.nombreNegocio || 'Comercio',
        email: emailNorm,
        telefono: comercio?.telefono || '',
        direccion: '',
        password: hashed,
        rol: 'comercio',
        comercioId: inv.comercioId,
        activo: 'true',
        terminosVersion: VERSION_TERMINOS,
        terminosFecha: new Date().toISOString(),
        fechaRegistro: new Date().toISOString()
      };
      await repository.create(SHEET_USERS, user);
    } else {
      return res.status(409).json({ error: 'Este correo ya tiene una cuenta vinculada' });
    }
    await repository.update('Invitaciones', inv.id, { usado: 'true' }).catch(() => {});
    const { cola: colaSvc } = require('../../services/cola.service');
    colaSvc.encolar('bienvenida-comercio', { email: emailNorm, nombre: user.nombre || 'Comercio' });
    res.json({ message: 'Contraseña creada. Ya puedes iniciar sesión.' });
  } catch (error) {
    next(error);
  }
};

exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken requerido' });
    }
    // Multi-dispositivo: se agrega el token a la lista del usuario (no pisa
    // el de otros dispositivos de la misma cuenta). `fcmToken` queda como el
    // último registrado, por compatibilidad con lectores antiguos.
    const user = await repository.findById(SHEET_USERS, req.user.id);
    const tokens = addToken(user, fcmToken);
    await repository.update(SHEET_USERS, req.user.id, {
      fcmTokens: serializeTokens(tokens),
      fcmToken: tokens[tokens.length - 1] || ''
    });
    res.json({ message: 'Token FCM actualizado' });
  } catch (error) {
    next(error);
  }
};

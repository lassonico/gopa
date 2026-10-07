const jwt = require('jsonwebtoken');
const config = require('../config');

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const extractToken = (req) => {
  return req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
};

const authenticate = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};

const telefonoEstaVerificado = (v) =>
  v === 1 || v === '1' || v === true || v === 'true';

const requireTelefonoVerificado = async (req, res, next) => {
  if (telefonoEstaVerificado(req.user?.telefonoVerificado)) return next();
  try {
    const repository = require('../repositories');
    const user = await repository.findById('Usuarios', req.user.id);
    if (user && telefonoEstaVerificado(user.telefonoVerificado)) return next();
  } catch (err) {}
  return res.status(403).json({
    error: 'Para continuar debes verificar tu número de teléfono.',
    telefonoVerificado: false,
  });
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { ...cookieOptions, path: '/' });
  res.clearCookie('refreshToken', { ...cookieOptions, path: '/' });
};

module.exports = { authenticate, authorize, requireTelefonoVerificado, setAuthCookies, clearAuthCookies, cookieOptions };

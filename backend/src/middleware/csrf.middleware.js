const { randomBytes, timingSafeEqual } = require('crypto');

const CSRF_TOKEN_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf_token';

const generateCsrfToken = () => randomBytes(32).toString('base64url');

const setCsrfCookie = (req, res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
};

const validateCsrfToken = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] || req.body?.[CSRF_TOKEN_NAME];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token requerido' });
  }

  try {
    const cookieBuf = Buffer.from(cookieToken, 'base64url');
    const headerBuf = Buffer.from(headerToken, 'base64url');

    if (cookieBuf.length !== headerBuf.length || !timingSafeEqual(cookieBuf, headerBuf)) {
      return res.status(403).json({ error: 'CSRF token inválido' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'CSRF token malformado' });
  }
};

const csrfProtection = (req, res, next) => {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    setCsrfCookie(req, res, token);
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies[CSRF_COOKIE_NAME];
  }
  res.locals.csrfToken = req.csrfToken;
  next();
};

const doubleSubmitCsrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  return validateCsrfToken(req, res, next);
};

const getCsrfToken = (req, res) => {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    setCsrfCookie(req, res, token);
    return token;
  }
  return req.cookies[CSRF_COOKIE_NAME];
};

module.exports = {
  csrfProtection,
  validateCsrfToken,
  doubleSubmitCsrf,
  getCsrfToken,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
};
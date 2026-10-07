const config = require('../config');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

module.exports = function verifyTurnstile(action) {
  return async function verifyTurnstileHandler(req, res, next) {
    if (!config.turnstile.secretKey) return next();

    const origin = (req.headers.origin || '').toLowerCase();
    const esDesarrolloLocal = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    if (esDesarrolloLocal) return next();

    const token = req.body && (req.body.turnstileToken || req.body.cfTurnstileToken);
    const expectedHostnames = config.turnstile.allowedHostnames;

    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > 2048 ||
      expectedHostnames.size === 0
    ) {
      console.warn('[Turnstile] Token inválido o faltante:', { hasToken: !!token, tokenLength: token?.length, allowedHostnames: Array.from(expectedHostnames) });
      return res.status(403).json({ error: 'Verificación de seguridad requerida' });
    }

    try {
      const params = new URLSearchParams({
        secret: config.turnstile.secretKey,
        response: token
      });
      if (req.ip) params.append('remoteip', req.ip);

      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10000),
        body: params
      });
      if (!response.ok) throw new Error(`siteverify ${response.status}`);

      const data = await response.json();
      console.log('[Turnstile] Verificación:', { success: data.success, action: data.action, hostname: data.hostname, expectedAction: action, allowedHostnames: Array.from(expectedHostnames) });

      if (
        !data.success ||
        (action && data.action !== action) ||
        !expectedHostnames.has(data.hostname)
      ) {
        console.warn('[Turnstile] Fallo:', { success: data.success, actionMatch: data.action === action, hostnameAllowed: expectedHostnames.has(data.hostname), receivedHostname: data.hostname });
        return res.status(403).json({ error: 'Verificación de robot fallida' });
      }
      next();
    } catch (err) {
      console.error('[Turnstile] Error:', err.message);
      return res.status(403).json({ error: 'Verificación de seguridad requerida' });
    }
  };
};

// Multi-dispositivo: cada usuario puede tener varios tokens FCM (un celular
// por cuenta, o la misma cuenta en web + celular). Se guarda la lista completa
// en `fcmTokens` (JSON) y se mantiene `fcmToken` = último token como compat.
const MAX_TOKENS = 10;

function parseTokens(user) {
  if (!user) return [];
  const tokens = [];
  if (user.fcmTokens) {
    try {
      const parsed = typeof user.fcmTokens === 'string'
        ? JSON.parse(user.fcmTokens)
        : user.fcmTokens;
      if (Array.isArray(parsed)) tokens.push(...parsed);
      else if (typeof parsed === 'string' && parsed.trim()) tokens.push(parsed);
    } catch {
      if (typeof user.fcmTokens === 'string' && user.fcmTokens.trim()) {
        tokens.push(user.fcmTokens);
      }
    }
  }
  if (typeof user.fcmToken === 'string' && user.fcmToken.trim()) {
    tokens.push(user.fcmToken);
  }
  return [...new Set(tokens.map(t => String(t).trim()).filter(Boolean))];
}

function serializeTokens(tokens) {
  return JSON.stringify([...new Set((tokens || []).map(t => String(t).trim()).filter(Boolean))]);
}

function addToken(user, token) {
  const t = String(token || '').trim();
  const base = parseTokens(user);
  if (!t) return base;
  return [...new Set([...base, t])].slice(-MAX_TOKENS);
}

function removeToken(user, token) {
  const t = String(token || '').trim();
  return parseTokens(user).filter(x => x !== t);
}

module.exports = { parseTokens, serializeTokens, addToken, removeToken, MAX_TOKENS };

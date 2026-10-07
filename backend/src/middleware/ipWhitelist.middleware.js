const config = require('../config');

// Función para normalizar IP (soporta IPv4, IPv6, y rangos CIDR)
function normalizeIp(ip) {
  if (!ip) return null;
  
  // Si viene de proxy (X-Forwarded-For), tomar la primera
  const forwarded = ip.split(',')[0].trim();
  
  // Mapear IPv6 localhost a IPv4
  if (forwarded === '::1' || forwarded === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  
  // Remover prefijo IPv6 mapped IPv4
  if (forwarded.startsWith('::ffff:')) {
    return forwarded.substring(7);
  }
  
  return forwarded;
}

// Verificar si una IP coincide con un patrón (IP exacta, CIDR, o rango)
function ipMatches(ip, pattern) {
  if (!ip || !pattern) return false;
  
  const normalizedIp = normalizeIp(ip);
  const normalizedPattern = pattern.trim();
  
  // IP exacta
  if (normalizedIp === normalizedPattern) return true;
  
  // CIDR (ej: 192.168.1.0/24)
  if (normalizedPattern.includes('/')) {
    return cidrMatch(normalizedIp, normalizedPattern);
  }
  
  // Rango con comodín (ej: 192.168.1.*)
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp('^' + normalizedPattern.replace(/\*/g, '.*') + '$');
    return regex.test(normalizedIp);
  }
  
  return false;
}

// Verificar coincidencia CIDR
function cidrMatch(ip, cidr) {
  const [rangeIp, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);
  
  if (isNaN(mask) || mask < 0 || mask > 32) return false;
  
  const ipParts = ip.split('.').map(Number);
  const rangeParts = rangeIp.split('.').map(Number);
  
  if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
  
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
  
  const maskNum = ~((1 << (32 - mask)) - 1);
  
  return (ipNum & maskNum) === (rangeNum & maskNum);
}

// Middleware para verificar IP whitelist
const ipWhitelist = (req, res, next) => {
  // Obtener IPs permitidas del usuario/comercio
  const allowedIps = req.user?.allowedIps || req.comercio?.allowedIps || [];
  
  // Si no hay IPs configuradas, permitir acceso (modo abierto)
  if (!allowedIps || allowedIps.length === 0) {
    return next();
  }
  
  // Obtener IP del cliente
  const clientIp = req.ip || 
    req.headers['x-forwarded-for'] || 
    req.headers['x-real-ip'] || 
    req.connection?.remoteAddress || 
    req.socket?.remoteAddress;
  
  if (!clientIp) {
    console.warn('No se pudo determinar IP del cliente');
    return next(); // Permitir si no se puede determinar
  }
  
  // Verificar si la IP coincide con alguna permitida
  const isAllowed = allowedIps.some(pattern => ipMatches(clientIp, pattern));
  
  if (!isAllowed) {
    console.warn(`Acceso denegado por IP: ${clientIp} (usuario: ${req.user?.id})`);
    return res.status(403).json({ 
      error: 'Acceso denegado', 
      message: 'Tu dirección IP no está autorizada para acceder a este panel',
      ip: clientIp
    });
  }
  
  next();
};

// Helper para obtener IP del cliente
function getClientIp(req) {
  return req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
    req.headers['x-real-ip'] || 
    req.connection?.remoteAddress || 
    req.socket?.remoteAddress || 
    'unknown';
}

// Validar formato de IP/CIDR
function validateIpPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return false;
  
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  
  // CIDR
  if (trimmed.includes('/')) {
    const [ip, bits] = trimmed.split('/');
    const ipParts = ip.split('.');
    const bitsNum = parseInt(bits, 10);
    
    if (ipParts.length !== 4 || isNaN(bitsNum) || bitsNum < 0 || bitsNum > 32) return false;
    if (!ipParts.every(p => !isNaN(p) && p >= 0 && p <= 255)) return false;
    return true;
  }
  
  // IP con comodín
  if (trimmed.includes('*')) {
    const parts = trimmed.split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => p === '*' || (!isNaN(p) && p >= 0 && p <= 255));
  }
  
  // IP exacta
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => !isNaN(p) && p >= 0 && p <= 255);
}

module.exports = {
  ipWhitelist,
  getClientIp,
  validateIpPattern,
  ipMatches,
  cidrMatch,
  normalizeIp,
};
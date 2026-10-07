const crypto = require('crypto');

const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master',
  'hello', 'login', 'passw0rd', 'qwerty123', '123123', '111111',
  'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'batman', 'trustno1', '654321', '123321', 'qazwsx', 'michael',
  'jordan', 'jennifer', 'hunter', 'buster', 'soccer', 'harley',
  'thomas', 'tigger', 'robert', 'george', 'charlie', 'andrew',
  'michelle', 'love', 'amanda', 'ashley', 'nicole', 'jessica',
  'chicago', 'daniel', 'matthew', 'anthony', 'donald', 'steven',
  'paul', 'mark', 'david', 'james', 'john', 'richard',
]);

const KEYBOARD_PATTERNS = [
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  '1234567890', '0987654321',
  'qazwsxedc', 'rfvtgbyhn', 'ujmnhygt',
];

const REPEATED_CHARS = /(.)\1{2,}/;

function validatePasswordStrength(password) {
  const errors = [];
  const warnings = [];
  let score = 0;

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['La contraseña es requerida'], score: 0 };
  }

  if (password.length < 12) {
    errors.push('La contraseña debe tener al menos 12 caracteres');
  } else if (password.length >= 16) {
    score += 10;
  } else {
    score += 5;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  } else {
    score += 5;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al least una letra minúscula');
  } else {
    score += 5;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número');
  } else {
    score += 5;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial (!@#$%^&*...)');
  } else {
    score += 10;
  }

  const lowerPassword = password.toLowerCase();
  
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push('Esta contraseña es demasiado común y fácil de adivinar');
  }

  if (REPEATED_CHARS.test(password)) {
    warnings.push('Evita repetir el mismo carácter más de 2 veces seguidas');
    score -= 5;
  }

  for (const pattern of KEYBOARD_PATTERNS) {
    if (lowerPassword.includes(pattern) || lowerPassword.includes(pattern.split('').reverse().join(''))) {
      warnings.push('Evita patrones de teclado secuenciales');
      score -= 10;
      break;
    }
  }

  const sequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789|890)/i;
  if (sequential.test(password)) {
    warnings.push('Evita secuencias alfabéticas o numéricas');
    score -= 5;
  }

  const entropy = calculateEntropy(password);
  if (entropy < 60) {
    warnings.push('La entropía de la contraseña es baja, considera hacerla más larga o compleja');
  } else if (entropy >= 80) {
    score += 10;
  }

  const uniqueChars = new Set(password).size;
  if (uniqueChars < password.length * 0.6) {
    warnings.push('Poca variedad de caracteres');
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score,
    entropy,
    strength: getStrengthLabel(score),
  };
}

function calculateEntropy(password) {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) poolSize += 32;
  
  return password.length * Math.log2(poolSize);
}

function getStrengthLabel(score) {
  if (score >= 80) return 'Muy fuerte';
  if (score >= 60) return 'Fuerte';
  if (score >= 40) return 'Media';
  if (score >= 20) return 'Débil';
  return 'Muy débil';
}

async function checkPasswordBreach(password) {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);
    
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'DomiciliosPalermo-SecurityCheck' },
    });
    
    if (!response.ok) {
      return { breached: false, count: 0, error: null };
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        return { breached: true, count: parseInt(count, 10), error: null };
      }
    }
    
    return { breached: false, count: 0, error: null };
  } catch (error) {
    console.warn('Error checking password breach:', error.message);
    return { breached: false, count: 0, error: error.message };
  }
}

async function validatePasswordChange(currentPassword, newPassword, userEmail) {
  const strength = validatePasswordStrength(newPassword);
  
  if (!strength.valid) {
    return { valid: false, errors: strength.errors, warnings: strength.warnings };
  }

  if (currentPassword === newPassword) {
    return { valid: false, errors: ['La nueva contraseña debe ser diferente a la actual'] };
  }

  const breach = await checkPasswordBreach(newPassword);
  if (breach.breached) {
    return { 
      valid: false, 
      errors: [`Esta contraseña ha aparecido en ${breach.count} filtraciones de datos. Elige otra.`] 
    };
  }

  return { 
    valid: true, 
    warnings: strength.warnings,
    strength: strength.strength,
    score: strength.score,
  };
}

function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  
  const strength = validatePasswordStrength(password);
  if (!strength.valid || strength.score < 60) {
    return generateSecurePassword(length);
  }
  
  return password;
}

module.exports = {
  validatePasswordStrength,
  checkPasswordBreach,
  validatePasswordChange,
  generateSecurePassword,
  COMMON_PASSWORDS,
};
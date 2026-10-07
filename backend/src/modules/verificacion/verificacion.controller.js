const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');
const config = require('../../config');
const emailService = require('../../services/email.service');

const SHEET = 'Verificaciones';
const esVerificado = (x) => x === true || x === 1 || x === 'true';
const noVerificado = (x) => !esVerificado(x);
const CODIGO_TTL_MS = 10 * 60 * 1000;
const MAX_INTENTOS_CODIGO = 5;

function codigoAleatorio() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/verificacion/email/enviar { email } — público con límite
exports.enviarCodigoEmail = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }
    const codigo = codigoAleatorio();
    const expira = new Date(Date.now() + CODIGO_TTL_MS).toISOString().slice(0, 19).replace('T', ' ');
    // Invalidar códigos previos de ese email
    const previos = await repository.findWhere(SHEET, 'destino', email).catch(() => []);
    for (const p of (previos || []).filter(x => x.canal === 'email' && noVerificado(x.verificado))) {
      try { await repository.delete(SHEET, p.id); } catch {}
    }
    await repository.create(SHEET, {
      id: generateId(),
      canal: 'email',
      destino: email,
      codigoHash: await bcrypt.hash(codigo, 10),
      verificado: 0,
      intentos: 0,
      expira,
    });
    emailService.sendMail({
      to: email,
      subject: 'Tu código de verificación - GoPalermo',
      html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #5E244E;">Tu código es: ${codigo}</h2>
        <p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>
        <p style="color: #bbb; font-size: 12px;">GoPalermo &copy; ${new Date().getFullYear()}</p>
      </div>`,
    }).catch(err => console.warn('[Email código]', err.message));
    res.json({ message: 'Código enviado al correo' });
  } catch (error) {
    next(error);
  }
};

// POST /api/verificacion/email/confirmar { email, codigo }
exports.confirmarCodigoEmail = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const codigo = String(req.body?.codigo || '').trim();
    if (!email || !codigo) return res.status(400).json({ error: 'Correo y código requeridos' });
    const regs = await repository.findWhere(SHEET, 'destino', email).catch(() => []);
    const reg = (regs || []).filter(x => x.canal === 'email' && noVerificado(x.verificado)).sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0))[0];
    if (!reg) return res.status(400).json({ error: 'No hay código pendiente para este correo' });
    if (reg.expira && new Date(reg.expira).getTime() <= Date.now()) {
      try { await repository.delete(SHEET, reg.id); } catch {}
      return res.status(400).json({ error: 'Código vencido. Solicita uno nuevo.' });
    }
    if (parseInt(reg.intentos || 0) >= MAX_INTENTOS_CODIGO) {
      try { await repository.delete(SHEET, reg.id); } catch {}
      return res.status(429).json({ error: 'Demasiados intentos. Solicita un código nuevo.' });
    }
    const ok = await bcrypt.compare(codigo, reg.codigoHash || '');
    if (!ok) {
      await repository.update(SHEET, reg.id, { intentos: parseInt(reg.intentos || 0) + 1 }).catch(() => {});
      return res.status(400).json({ error: 'Código incorrecto' });
    }
    await repository.update(SHEET, reg.id, { verificado: 1, codigoHash: '' }).catch(() => {});
    res.json({ message: 'Correo verificado' });
  } catch (error) {
    next(error);
  }
};

// POST /api/verificacion/sms/confirmar { idToken } — público con límite.
// Verifica con Firebase Admin y devuelve prueba firmada (15 min).
exports.confirmarSms = async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Token de verificación requerido' });
    }
    let phone = '';
    try {
      const { initializeApp, cert, getApps } = require('firebase-admin/app');
      const { getAuth } = require('firebase-admin/auth');
      if (getApps().length === 0) {
        const configAdm = require('../../config');
        const saPath = require('path').join(__dirname, '../../../', configAdm.firebase?.serviceAccountPath || 'firebase-service-account.json');
        const fs = require('fs');
        if (!fs.existsSync(saPath)) throw new Error('Firebase no configurado');
        initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
      }
      const decoded = await getAuth().verifyIdToken(idToken);
      phone = decoded.phone_number || '';
    } catch (e) {
      console.warn('[Verificación SMS] Firebase rechazó el token:', e.code || e.message);
      return res.status(400).json({ error: 'No se pudo verificar el SMS' });
    }
    if (!phone) return res.status(400).json({ error: 'El token no contiene un teléfono verificado' });
    // Prueba de verificación: 2h para alcanzar a diligenciar el formulario
    const prueba = jwt.sign(
      { phone, canal: 'sms', exp: Math.floor(Date.now() / 1000) + 2 * 3600 },
      config.jwt.secret
    );
    res.json({ message: 'Teléfono verificado', phone, prueba });
  } catch (error) {
    next(error);
  }
};

// Utilidades internas
async function emailVerificado(email) {
  if (!email) return false;
  const regs = await repository.findWhere(SHEET, 'destino', String(email).toLowerCase()).catch(() => []);
  const ok = (regs || []).find(x => x.canal === 'email' && esVerificado(x.verificado));
  if (!ok) return false;
  // Vigencia de la verificación: 24h
  const f = new Date(ok.fechaCreacion || ok.fecha || 0).getTime();
  return f && (Date.now() - f) < 24 * 3600000;
}

function verificarPruebaSms(prueba, telefono) {
  try {
    if (!prueba) return false;
    const d = jwt.verify(prueba, config.jwt.secret);
    if (d.canal !== 'sms' || !d.phone) return false;
    const norm = (v) => String(v || '').replace(/\D/g, '').replace(/^57/, '');
    return norm(d.phone) === norm(telefono) && norm(telefono) !== '';
  } catch {
    return false;
  }
}

module.exports = {
  enviarCodigoEmail: exports.enviarCodigoEmail,
  confirmarCodigoEmail: exports.confirmarCodigoEmail,
  confirmarSms: exports.confirmarSms,
  emailVerificado,
  verificarPruebaSms,
};

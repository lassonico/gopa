const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const wompi = require('../../services/wompi.service');
const config = require('../../config');
const emailService = require('../../services/email.service');
const { cola } = require('../../services/cola.service');

const SHEET = 'Anuncios';

// Tarifa plana del anuncio: $20.000 COP por 5 días calendario.
// Se cobra el valor exacto, sin recargos por medio de pago.
const VALOR_ANUNCIO = 20000;
const DIAS_VIGENCIA = 5;

function contarPalabras(titulo) {
  return String(titulo || '').trim().split(/\s+/).filter(Boolean).length;
}

function esHttpsReal(url) {
  return /^https:\/\//.test(url || '') && !String(url).includes('localhost');
}

async function marcarPagadoYNotificar(anuncio, transactionId, wompiStatus) {
  if (anuncio.estado === 'pagado') return anuncio;
  await repository.update(SHEET, anuncio.id, {
    estado: 'pagado',
    wompiTransactionId: transactionId || anuncio.wompiTransactionId || '',
    wompiStatus: wompiStatus || '',
    fechaPago: new Date().toISOString()
  });
  const actualizado = await repository.findById(SHEET, anuncio.id);

  // Datos para que el admin cree el banner manualmente
  const comercios = await repository.findAll('Comercios').catch(() => []);
  const comercio = comercios.find(c => c.id === actualizado.comercioId) || {};
  const usuarios = await repository.findAll('Usuarios').catch(() => []);
  const cuenta = usuarios.find(u => u.rol === 'comercio' && u.comercioId === actualizado.comercioId) || {};
  const vencimiento = new Date(Date.now() + DIAS_VIGENCIA * 86400000).toLocaleDateString('es-CO');

  cola.encolar('email-admin', {
    subject: `Nuevo anuncio pagado 📢 — ${actualizado.titulo}`,
    texto: `Un comercio pagó su anuncio.<br><br>` +
    `<b>Comercio:</b> ${comercio.nombreNegocio || actualizado.comercioId}<br>` +
    `<b>Email contacto:</b> ${cuenta.email || '—'}<br>` +
    `<b>Título:</b> ${actualizado.titulo}<br>` +
    `<b>Imagen:</b> <a href="${actualizado.imagen}">${actualizado.imagen}</a><br>` +
    `<b>Valor pagado:</b> $${Number(actualizado.valor || 0).toLocaleString('es-CO')}<br>` +
    `<b>Vigencia:</b> ${DIAS_VIGENCIA} días calendario (hasta ${vencimiento})<br>` +
    `<b>Referencia Wompi:</b> ${actualizado.referencia}<br>` +
    `<b>Transacción:</b> ${transactionId || '—'}<br><br>` +
    `Crea el banner desde el admin (Promociones/Banners, tipo "banner") con estos datos.`
  });

  return actualizado;
}

// POST /api/anuncios — crear anuncio + enlace de pago Wompi
exports.crear = async (req, res, next) => {
  try {
    const { titulo, imagen } = req.body;
    const tituloLimpio = String(titulo || '').trim();
    if (!tituloLimpio) {
      return res.status(400).json({ error: 'El título del anuncio es requerido' });
    }
    if (contarPalabras(tituloLimpio) > 3) {
      return res.status(400).json({ error: 'El título debe tener máximo 3 palabras' });
    }
    if (!imagen || typeof imagen !== 'string') {
      return res.status(400).json({ error: 'La imagen del anuncio es requerida' });
    }

    const referencia = generateId().slice(0, 8).toUpperCase();
    const amountInCents = VALOR_ANUNCIO * 100;
    const comercioUrl = config.comercioUrl || '';
    const redirectUrl = esHttpsReal(comercioUrl)
      ? `${comercioUrl}/anuncios/retorno?ref=${referencia}`
      : undefined;
    const enlace = wompi.generateCheckoutLink({
      reference: referencia,
      amountInCents,
      currency: 'COP',
      redirectUrl,
    });

    const anuncio = {
      id: generateId(),
      comercioId: req.user.comercioId,
      titulo: tituloLimpio,
      imagen,
      valor: VALOR_ANUNCIO,
      dias: DIAS_VIGENCIA,
      estado: 'pendiente',
      referencia,
      wompiTransactionId: '',
      fechaCreacion: formatDate(),
      fechaPago: ''
    };
    await repository.create(SHEET, anuncio);

    res.status(201).json({ enlace, referencia, id: anuncio.id, valor: VALOR_ANUNCIO, dias: DIAS_VIGENCIA });
  } catch (error) {
    next(error);
  }
};

// GET /api/anuncios/mios — historial del comercio
exports.mios = async (req, res, next) => {
  try {
    const todos = await repository.findWhere(SHEET, 'comercioId', req.user.comercioId);
    todos.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));
    res.json(todos);
  } catch (error) {
    next(error);
  }
};

// GET /api/anuncios/consultar/:referencia — verificar pago en Wompi
exports.consultar = async (req, res, next) => {
  try {
    const anuncios = await repository.findAll(SHEET);
    const anuncio = anuncios.find(a => a.referencia === req.params.referencia);
    if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });
    if (req.user.rol === 'comercio' && anuncio.comercioId !== req.user.comercioId) {
      return res.status(403).json({ error: 'No tienes permiso sobre este anuncio' });
    }
    if (anuncio.estado === 'pagado') {
      return res.json({ estado: 'pagado', anuncio });
    }
    let tx = null;
    try {
      tx = await wompi.getTransactionByReference(anuncio.referencia);
    } catch (e) {
      console.warn('[Anuncios] No se pudo consultar Wompi:', e.message);
    }
    const data = tx?.data ?? tx;
    const single = Array.isArray(data) ? data[0] : data;
    const status = single?.status || '';
    if (status === 'APPROVED') {
      const actualizado = await marcarPagadoYNotificar(anuncio, single?.id || '', status);
      return res.json({ estado: 'pagado', anuncio: actualizado });
    }
    const mapa = { DECLINED: 'fallido', VOIDED: 'anulado', ERROR: 'fallido' };
    if (mapa[status]) {
      await repository.update(SHEET, anuncio.id, { estado: mapa[status], wompiStatus: status });
      return res.json({ estado: mapa[status], anuncio: await repository.findById(SHEET, anuncio.id) });
    }
    res.json({ estado: 'pendiente', anuncio });
  } catch (error) {
    next(error);
  }
};

// POST /api/anuncios/webhook — eventos Wompi (público, con firma)
exports.webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-event-checksum'] || req.body?.signature?.checksum;
    if (!wompi.verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({ error: 'Firma inválida' });
    }
    const { data } = req.body;
    const transaction = data?.transaction || data || {};
    const { id: transactionId, status, reference } = transaction;

    const anuncios = await repository.findAll(SHEET);
    const anuncio = anuncios.find(a => a.referencia === reference || a.wompiTransactionId === transactionId);
    if (!anuncio) {
      return res.json({ message: 'Anuncio no encontrado localmente' });
    }
    if (status === 'APPROVED') {
      await marcarPagadoYNotificar(anuncio, transactionId, status);
      return res.json({ message: 'Anuncio marcado como pagado' });
    }
    const mapa = { DECLINED: 'fallido', VOIDED: 'anulado', ERROR: 'fallido', PENDING: 'pendiente' };
    await repository.update(SHEET, anuncio.id, {
      estado: mapa[status] || 'pendiente',
      wompiStatus: status || '',
      wompiTransactionId: transactionId || anuncio.wompiTransactionId
    });
    res.json({ message: 'Webhook procesado' });
  } catch (error) {
    next(error);
  }
};

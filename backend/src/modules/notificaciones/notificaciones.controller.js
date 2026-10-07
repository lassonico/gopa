const repository = require('../../repositories');
const { generateId, formatDate } = require('../../utils/helpers');
const notificationService = require('../../services/notification.service');
const emailService = require('../../services/email.service');
const { cola } = require('../../services/cola.service');

const SHEET = 'Notificaciones';

exports.getByUser = async (req, res, next) => {
  try {
    const notifs = await repository.findAll(SHEET);
    const isAdmin = req.user.rol === 'admin';
    const todas = isAdmin && req.query.todas === 'true';
    const userNotifs = todas
      ? notifs
      : notifs.filter(n =>
          n.destinatarioId === req.user.id || n.dirigidoA === 'todos' || n.dirigidoA === req.user.rol
        );
    userNotifs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    res.json(userNotifs);
  } catch (error) {
    next(error);
  }
};

function esVisiblePara(notif, user) {
  if (!notif || !user) return false;
  if (user.rol === 'admin') return true;
  return notif.destinatarioId === user.id || notif.dirigidoA === 'todos' || notif.dirigidoA === user.rol;
}

exports.getById = async (req, res, next) => {
  try {
    const notif = await repository.findById(SHEET, req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    if (!esVisiblePara(notif, req.user)) {
      return res.status(403).json({ error: 'No tienes permisos para ver esta notificación' });
    }
    res.json(notif);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const notif = await repository.findById(SHEET, req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    await repository.delete(SHEET, req.params.id);
    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { titulo, mensaje, tipo, dirigidoA, destinatarioId } = req.body;
    if (!titulo || !mensaje) {
      return res.status(400).json({ error: 'Título y mensaje requeridos' });
    }
    const nueva = {
      id: generateId(),
      titulo,
      mensaje,
      tipo: tipo || 'general',
      dirigidoA: dirigidoA || 'todos',
      destinatarioId: destinatarioId || '',
      leida: 'false',
      fecha: formatDate()
    };
    await repository.create(SHEET, nueva);

    const nt = titulo, nm = mensaje, nd = nueva.destinatarioId, ng = nueva.dirigidoA;
    if (nd) {
      cola.encolar('push-usuario', { userId: nd, title: nt, body: nm });
    } else if (ng && ng !== 'todos') {
      cola.encolar('push-rol', { role: ng, title: nt, body: nm });
    } else {
      cola.encolar('push-todos', { title: nt, body: nm });
    }

    if (tipo === 'promocion' || tipo === 'cupon') {
      const users = await repository.findAll('Usuarios');
      const targets = nd
        ? users.filter(u => u.id === nd)
        : ng && ng !== 'todos'
          ? users.filter(u => u.rol === ng)
          : users;
      const mails = targets.filter(u => u.email).map(u => u.email);
      const fv = req.body.fechaVencimiento;
      const lk = req.body.link;
      if (mails.length) {
        cola.encolar('promo-lote', { mails, titulo: nt, descripcion: nm, vencimiento: fv, link: lk });
      }
    }

    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

exports.marcarLeida = async (req, res, next) => {
  try {
    const notif = await repository.findById(SHEET, req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    if (!esVisiblePara(notif, req.user)) {
      return res.status(403).json({ error: 'No tienes permisos sobre esta notificación' });
    }
    await repository.update(SHEET, req.params.id, { leida: 'true' });
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    next(error);
  }
};
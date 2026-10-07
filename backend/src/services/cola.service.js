// Cola de trabajos tipados con reintentos + DLQ persistente.
//
// - La UI responde de inmediato: todo email/push se encola, nunca se espera.
// - Trabajos serializables {tipo, payload}: se pueden guardar, reintentar
//   desde el admin y migrar a Redis/BullMQ sin cambiar llamadas.
// - Reintentos con backoff 5s → 30s → 2min; al agotarse va a la tabla
//   TrabajosFallidos (DLQ) en vez de perderse en un log.
// - Fallback: si la BD de DLQ falla, se registra en consola (nunca rompe).

const ESPERAS = [5000, 30000, 120000];
const CONCURRENCIA = 2;

const handlers = {};

function registrarManejador(tipo, fn) {
  handlers[tipo] = fn;
}

class Cola {
  constructor() {
    this.pendientes = [];
    this.activos = 0;
    this.ok = 0;
    this.fallidos = 0;
  }

  encolar(tipo, payload = {}) {
    if (!handlers[tipo]) {
      console.error(`[Cola] Tipo desconocido: ${tipo}`);
      return false;
    }
    this.pendientes.push({ tipo, payload, intento: 0 });
    this.bombeo();
    return true;
  }

  bombeo() {
    while (this.activos < CONCURRENCIA && this.pendientes.length > 0) {
      const trabajo = this.pendientes.shift();
      this.activos++;
      this.ejecutar(trabajo).finally(() => {
        this.activos--;
        this.bombeo();
      });
    }
  }

  async ejecutar(trabajo) {
    try {
      const r = await handlers[trabajo.tipo](trabajo.payload);
      if (r && r.success === false && trabajo.intento < ESPERAS.length) {
        throw new Error(r.error || 'fallo del servicio');
      }
      this.ok++;
    } catch (e) {
      if (trabajo.intento < ESPERAS.length) {
        const espera = ESPERAS[trabajo.intento];
        trabajo.intento++;
        console.warn(`[Cola] ${trabajo.tipo} falló (intento ${trabajo.intento}), reintento en ${espera / 1000}s: ${e.message || e}`);
        const t = setTimeout(() => {
          this.pendientes.push(trabajo);
          this.bombeo();
        }, espera);
        if (t.unref) t.unref();
      } else {
        this.fallidos++;
        await this.aDLQ(trabajo, e);
      }
    }
  }

  async aDLQ(trabajo, e) {
    try {
      const repository = require('../repositories');
      await repository.create('TrabajosFallidos', {
        id: require('../utils/helpers').generateId(),
        tipo: trabajo.tipo,
        payload: JSON.stringify(trabajo.payload || {}).slice(0, 5000),
        error: String((e && e.message) || e || 'desconocido').slice(0, 500),
        intentos: trabajo.intento + 1,
        fecha: new Date().toISOString(),
      });
      console.error(`[Cola] ${trabajo.tipo} a DLQ tras ${trabajo.intento + 1} intentos`);
    } catch (err) {
      console.error('[Cola] No se pudo guardar en DLQ:', err.message);
    }
  }

  stats() {
    return { pendientes: this.pendientes.length, activos: this.activos, ok: this.ok, fallidos: this.fallidos };
  }
}

const cola = new Cola();

// ---- Manejadores (único lugar con efectos laterales) ----
registrarManejador('email', async ({ to, subject, html }) => {
  const emailService = require('./email.service');
  return emailService.sendMail({ to, subject, html });
});

registrarManejador('email-admin', async ({ subject, texto }) => {
  const emailService = require('./email.service');
  return emailService.sendAdminNotification(subject, texto);
});

registrarManejador('bienvenida', async ({ email, nombre }) => {
  const emailService = require('./email.service');
  return emailService.sendWelcome(email, nombre);
});

registrarManejador('bienvenida-comercio', async ({ email, nombre }) => {
  const emailService = require('./email.service');
  return emailService.sendWelcomeComercio(email, nombre);
});

registrarManejador('bienvenida-domiciliario', async ({ email, nombre, usuario }) => {
  const emailService = require('./email.service');
  return emailService.sendWelcomeDomiciliario(email, nombre, usuario);
});

registrarManejador('reset-password', async ({ email, resetLink }) => {
  const emailService = require('./email.service');
  return emailService.sendPasswordReset(email, resetLink);
});

registrarManejador('promo-lote', async ({ mails, titulo, descripcion, vencimiento, link }) => {
  const emailService = require('./email.service');
  let enviados = 0;
  for (const mail of mails || []) {
    const r = await emailService.sendPromotion(mail, { titulo, descripcion, vencimiento, link });
    if (r && r.success !== false) enviados++;
  }
  return enviados > 0 ? { success: true, enviados } : { success: false, error: 'ningún envío exitoso' };
});

registrarManejador('push-usuario', async ({ userId, title, body, data }) => {
  const notificationService = require('./notification.service');
  return notificationService.sendToUser(userId, title, body, data || {});
});

registrarManejador('push-rol', async ({ role, title, body, data }) => {
  const notificationService = require('./notification.service');
  return notificationService.sendToRole(role, title, body, data || {});
});

registrarManejador('push-todos', async ({ title, body, data }) => {
  const notificationService = require('./notification.service');
  return notificationService.sendToAll(title, body, data || {});
});

module.exports = { cola, registrarManejador };

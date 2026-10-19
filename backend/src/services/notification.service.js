const config = require('../config');
const fs = require('fs');
const path = require('path');
const { parseTokens, serializeTokens, removeToken } = require('../utils/fcmTokens');

class NotificationService {
  constructor() {
    this.admin = null;
    this.initialized = false;
  }

  _esTokenInvalido(error) {
    const code = String((error && error.code) || '').toLowerCase();
    const msg = String((error && error.message) || error || '').toLowerCase();
    return code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      msg.includes('unregistered') || msg.includes('notregistered') ||
      msg.includes('registration-token-not-registered') || msg.includes('invalid-registration-token');
  }

  // Quita SOLO el token fallido de la lista, conservando los demás
  // dispositivos de la misma cuenta.
  async _limpiarToken(userId, token) {
    try {
      const repository = require('../repositories');
      const user = await repository.findById('Usuarios', userId);
      if (!user) return;
      const tokens = removeToken(user, token);
      await repository.update('Usuarios', userId, {
        fcmTokens: serializeTokens(tokens),
        fcmToken: tokens[tokens.length - 1] || ''
      });
      console.log(`Token FCM inválido borrado del usuario ${userId}`);
    } catch (e) {
      console.warn(`No se pudo limpiar token de ${userId}: ${e.message}`);
    }
  }

  // Envío multicast que limpia los tokens inválidos de cada usuario fallido.
  async _enviarMulticast(pares, data) {
    const tokens = pares.map(p => p.token);
    const response = await this._messaging().sendEachForMulticast({ data, tokens });
    for (let i = 0; i < response.responses.length; i++) {
      const r = response.responses[i];
      if (!r.success && this._esTokenInvalido(r.error)) {
        await this._limpiarToken(pares[i].userId, pares[i].token);
      }
    }
    return response;
  }

  _init() {
    if (this.initialized) return;

    try {
      let serviceAccount;

      if (config.firebase?.serviceAccountPath) {
        const filePath = path.resolve(__dirname, '../../', config.firebase.serviceAccountPath);
        if (fs.existsSync(filePath)) {
          serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log('Firebase: usando archivo JSON');
        }
      }

      if (!serviceAccount) {
        if (config.firebase?.projectId && config.firebase?.clientEmail && config.firebase?.privateKey) {
          serviceAccount = {
            projectId: config.firebase.projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey
          };
          console.log('Firebase: usando variables de entorno');
        }
      }

      if (!serviceAccount) {
        console.log('Notificaciones Firebase: no configurado (modo log)');
        return;
      }

      this.admin = require('firebase-admin');
      const getApps = this.admin.getApps ? this.admin.getApps : () => this.admin.apps || [];
      const cert = (this.admin.credential?.cert || this.admin.cert).bind(this.admin);
      if (getApps().length === 0) {
        this.admin.initializeApp({
          credential: cert(serviceAccount),
          databaseURL: config.firebase?.databaseURL
        });
      }
      this.initialized = true;
      console.log('Notificaciones Firebase: inicializado');
    } catch (error) {
      console.error('Error inicializando Firebase Admin:', error.message);
    }
  }

  async sendToUser(userId, title, body, data = {}) {
    if (!this.initialized) {
      this._init();
    }
    if (!this.admin) {
      console.log(`[Notificación Log] To: ${userId} | ${title}: ${body}`);
      return { success: true, mode: 'log' };
    }
    try {
      const repository = require('../repositories');
      const user = await repository.findById('Usuarios', userId);
      const tokens = parseTokens(user);
      if (tokens.length === 0) {
        console.log(`Usuario ${userId} sin token FCM`);
        return { success: false, error: 'Sin token FCM' };
      }
      const pares = tokens.map(token => ({ userId, token }));
      const response = await this._enviarMulticast(pares, { title, body, ...data });
      if (response.successCount > 0) {
        return { success: true, successCount: response.successCount, failureCount: response.failureCount };
      }
      return { success: false, error: 'Ningún token válido', failureCount: response.failureCount };
    } catch (error) {
      console.error('Error enviando notificación Firebase:', error.message);
      return { success: false, error: error.message };
    }
  }

  _messaging() {
    if (this.admin.messaging) return this.admin.messaging();
    try {
      const { getMessaging } = require('firebase-admin/messaging');
      const app = this.admin.getApps?.()[0];
      return getMessaging(app);
    } catch (e) {
      throw new Error('Messaging no disponible en esta versión de firebase-admin');
    }
  }

  async sendToRole(role, title, body, data = {}) {
    if (!this.initialized) {
      this._init();
    }
    if (!this.admin) {
      console.log(`[Notificación Log] Role: ${role} | ${title}: ${body}`);
      return { success: true, mode: 'log' };
    }
    try {
      const repository = require('../repositories');
      const users = await repository.findAll('Usuarios');
      const pares = [];
      for (const u of users) {
        if (u.rol !== role) continue;
        for (const token of parseTokens(u)) pares.push({ userId: u.id, token });
      }
      if (pares.length === 0) return { success: false, error: 'Sin tokens' };
      const response = await this._enviarMulticast(pares, { title, body, ...data });
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      console.error('Error enviando notificación Firebase:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendToAll(title, body, data = {}) {
    if (!this.initialized) {
      this._init();
    }
    if (!this.admin) {
      console.log(`[Notificación Log] All | ${title}: ${body}`);
      return { success: true, mode: 'log' };
    }
    try {
      const repository = require('../repositories');
      const users = await repository.findAll('Usuarios');
      const pares = [];
      for (const u of users) {
        for (const token of parseTokens(u)) pares.push({ userId: u.id, token });
      }
      if (pares.length === 0) return { success: false, error: 'Sin tokens' };
      const response = await this._enviarMulticast(pares, { title, body, ...data });
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      console.error('Error enviando notificación Firebase:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();

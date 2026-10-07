const config = require('../config');
const fs = require('fs');
const path = require('path');

class NotificationService {
  constructor() {
    this.admin = null;
    this.initialized = false;
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
      const users = await repository.findAll('Usuarios');
      const user = users.find(u => u.id === userId);
      if (!user?.fcmToken) {
        console.log(`Usuario ${userId} sin token FCM`);
        return { success: false, error: 'Sin token FCM' };
      }
      const message = {
        data: { title, body, ...data },
        token: user.fcmToken
      };
      const response = await this._messaging().send(message);
      return { success: true, messageId: response };
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
      const tokens = users
        .filter(u => u.rol === role && u.fcmToken)
        .map(u => u.fcmToken);
      if (tokens.length === 0) return { success: false, error: 'Sin tokens' };
      const message = {
        data: { title, body, ...data },
        tokens
      };
      const response = await this._messaging().sendEachForMulticast(message);
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
      const tokens = users.filter(u => u.fcmToken).map(u => u.fcmToken);
      if (tokens.length === 0) return { success: false, error: 'Sin tokens' };
      const message = {
        data: { title, body, ...data },
        tokens
      };
      const response = await this._messaging().sendEachForMulticast(message);
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      console.error('Error enviando notificación Firebase:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();

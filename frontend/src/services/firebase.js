import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app = null;
let auth = null;
let messaging = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.languageCode = 'es';
    try {
      messaging = getMessaging(app);
    } catch (mErr) {
      console.warn('FCM Messaging no soportado en este entorno');
    }
  }
} catch (e) {
  console.warn('Firebase no configurado:', e.message);
}

export { auth, messaging };

export async function requestFcmToken() {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso de notificaciones denegado');
      return null;
    }
    // Fuerza una suscripción NUEVA: si la actual está vencida, getToken()
    // devuelve el mismo token muerto (FCM responde "unregistered"). Al
    // desuscribirnos y volver a pedir, FCM registra una suscripción/token
    // nuevos y válidos. Solo se hace al iniciar sesión (poco frecuente).
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });
    if (currentToken) {
      return currentToken;
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo token FCM:', error.message);
    return null;
  }
}

// Renueva el token sin pedir permiso: solo si ya fue concedido.
export async function refreshFcmToken() {
  if (!messaging) return null;
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return null;
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });
    return currentToken || null;
  } catch (error) {
    console.warn('Error renovando token FCM:', error.message);
    return null;
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return null;
  return onMessage(messaging, callback);
}

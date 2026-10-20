importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCC7cerx2iKfJOeEL5rs9oKYWMnHcfLBh4',
  authDomain: 'domicilioscv-com.firebaseapp.com',
  projectId: 'domicilioscv-com',
  storageBucket: 'domicilioscv-com.firebasestorage.app',
  messagingSenderId: '382348164096',
  appId: '1:382348164096:web:b2f7171cbbd119fb24ece5',
});

const messaging = firebase.messaging();

self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(self.clients.claim()); });

const ICON = '/icon-192.png';

messaging.onBackgroundMessage(function(payload) {
  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: data.body || payload.notification?.body || '',
    icon: ICON,
    badge: ICON,
    data: data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/notificaciones';
  if (data.tipo === 'pedido' && data.pedidoId) {
    url = '/pedidos/' + data.pedidoId;
  } else if (data.url) {
    url = data.url;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

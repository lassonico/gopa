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

messaging.onBackgroundMessage(function(payload) {
  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: data.body || payload.notification?.body || '',
    icon: '/favicon.ico',
    data: data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

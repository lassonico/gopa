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

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    sound: '/notification.wav',
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

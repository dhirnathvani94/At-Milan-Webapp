// ─────────────────────────────────────────────────────────────────────────────
// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the web app is not in focus
// ─────────────────────────────────────────────────────────────────────────────

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config is injected dynamically from the app when it registers the SW
// The app sets firebaseConfig in a broadcast channel or via postMessage
let firebaseConfig = null;
let messaging = null;

// Listen for config from the main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      messaging = firebase.messaging();

      // Handle background messages
      messaging.onBackgroundMessage((payload) => {
        console.log('[SW] Background message received:', payload);
        const { title, body, icon, image } = payload.notification || {};
        const data = payload.data || {};

        const notificationTitle = title || '🔔 Notification';
        const notificationOptions = {
          body: body || '',
          icon: icon || '/vite.svg',
          image: image,
          badge: '/vite.svg',
          tag: data.notif_id || 'atmilan-notif',
          data: {
            url: data.action_url || '/',
            notif_id: data.notif_id,
          },
          requireInteraction: false,
          silent: false,
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: '👆 View' },
            { action: 'dismiss', title: '✕ Dismiss' },
          ],
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
      });

      console.log('[SW] Firebase Messaging initialized');
    } catch (e) {
      console.warn('[SW] Firebase init error:', e);
    }
  }
});

// Handle notification click — open the app at the action_url
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  if (action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  const fullUrl = url.startsWith('http') ? url : self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open in a tab, focus it
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Activate immediately without waiting for old SW to stop
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

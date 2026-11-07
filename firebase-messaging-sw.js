/* Фоновый обработчик уведомлений. Должен лежать в корне сайта рядом с index.html. */
self.window = self;
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
  'firebase-config.js'
);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Сервер присылает только data: { title, body, url, tag }
messaging.onBackgroundMessage(p => {
  const d = (p && p.data) || {};
  return self.registration.showNotification(d.title || 'Во что сыграем?', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './' }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) {
      if (w.url.startsWith(self.registration.scope) && 'focus' in w) {
        return w.focus().then(c => (c && c.navigate && c.url !== url) ? c.navigate(url) : c).catch(() => self.clients.openWindow(url));
      }
    }
    return self.clients.openWindow(url);
  }));
});

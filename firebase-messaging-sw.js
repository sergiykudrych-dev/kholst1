/* Фоновый обработчик уведомлений. Должен лежать в корне сайта рядом с index.html.
   Без Firebase SDK: показываем уведомление на КАЖДЫЙ push — иначе iPhone считает push «тихим»
   и после нескольких таких может отключить уведомления для сайта. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (_) { try { j = { data: { body: e.data.text() } }; } catch (__) {} }
  const d = Object.assign({}, j.notification || {}, j.data || {}, (j.data && j.data.data) || {});
  e.waitUntil(self.registration.showNotification(d.title || 'Во что сыграем?', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './' }
  }));
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

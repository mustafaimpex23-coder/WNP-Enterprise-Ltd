// WNP Admin – service worker (push notifications + app install)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'WNP Admin', body: event.data && event.data.text() }; }
  const title = data.title || 'New website query';
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || 'Open the admin panel to see it.',
        icon: '/admin/icon-192.png',
        badge: '/admin/icon-192.png',
        tag: data.tag || 'wnp-query',
        renotify: true,
        requireInteraction: true,
        data: { url: data.url || '/admin/' },
      });
      if (self.navigator && 'setAppBadge' in self.navigator) {
        try { await self.navigator.setAppBadge(); } catch {}
      }
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      wins.forEach((w) => w.postMessage({ type: 'push', data }));
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/admin/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.includes('/admin')) { await w.focus(); w.navigate ? w.navigate(url) : w.postMessage({ type: 'open', url }); return; }
      }
      await self.clients.openWindow(url);
    })()
  );
});

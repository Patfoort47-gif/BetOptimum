const CACHE = 'betoptimum-shell-bet387-v1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const response = await fetch(new URL('offline-assets.json', self.registration.scope), {
        cache: 'no-store'
      });
      if (!response.ok) throw Error('Liste hors ligne indisponible');
      const assets = await response.json(),
        cache = await caches.open(CACHE);
      await cache.addAll(assets.map((path) => new URL(path, self.registration.scope).href));
      await self.skipWaiting();
    })()
  )
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('betoptimum-shell-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  )
);
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(new URL(self.registration.scope).pathname) ||
    url.pathname.includes('/data/') ||
    !(/\.(js|css|png|svg|webmanifest|woff2)$/.test(url.pathname) || request.mode === 'navigate')
  )
    return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match(new URL('index.html', self.registration.scope));
          if (shell) return shell;
        }
        throw error;
      }
    })()
  );
});
function notificationTarget(value) {
  const scope = new URL(self.registration.scope);
  try {
    const url = new URL(value ?? scope.href, scope);
    if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) return url;
  } catch {
    // Un ancien message peut contenir une destination devenue invalide.
  }
  return null;
}
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (!payload?.title || (payload.expiresAt && Date.parse(payload.expiresAt) <= Date.now())) return;
  const url = notificationTarget(payload.url);
  if (!url) return;
  event.waitUntil(
    self.registration.showNotification(String(payload.title).slice(0, 120), {
      body: String(payload.body ?? '').slice(0, 1000),
      tag: String(payload.tag ?? 'betoptimum'),
      icon: new URL('icons/icon-192x192.png?v=bet387', self.registration.scope).href,
      data: { url: url.href }
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url =
        notificationTarget(event.notification.data?.url) ?? new URL(self.registration.scope);
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client =
        windows.find((item) => item.url === url.href) ??
        windows.find((item) => notificationTarget(item.url));
      if (client) {
        try {
          const target = client.url === url.href ? client : await client.navigate(url.href);
          if (target) {
            await target.focus();
            return;
          }
        } catch {
          // Si la fenêtre a été fermée entre-temps, ouvrir la destination.
        }
      }
      await self.clients.openWindow(url.href);
    })()
  );
});

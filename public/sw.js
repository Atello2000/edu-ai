const CACHE = 'jangalai-a9b4a59-1780254796058';

// IMPORTANT: never cache HTML entry points (/ or index.html) —
// their hashed asset references change on every deploy and a stale
// cached HTML causes a blank page (old JS hash → 404 → React never mounts).
const ASSETS = [
  '/manifest.json', '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting(); // activate immediately so the new SW takes over right away
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => {
        const stale = keys.filter(k => k !== CACHE);
        return Promise.all(stale.map(k => caches.delete(k)))
          .then(() => stale.length > 0); // true = this is an update, not first install
      })
      .then(async isUpdate => {
        await self.clients.claim();
        // Only force-reload open windows when replacing a previous version.
        // On first install there is no stale content — skipping the forced
        // navigate prevents a reload that could land on an old CDN edge node.
        if (!isUpdate) return;
        const openClients = await self.clients.matchAll({ type: 'window' });
        for (const client of openClients) {
          client.navigate(client.url);
        }
      })
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Jangalai', {
      body:  data.body  || 'Vous avez des flashcards à réviser.',
      icon:  data.icon  || '/icon.svg',
      badge: '/icon.svg',
      data:  { url: data.url || '/app' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/app'));
});

const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  const url = new URL(e.request.url);
  const isExternal = EXTERNAL.some(h => url.hostname.includes(h));

  if (isExternal) {
    // Cache-first pour les ressources CDN/fonts
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
  } else {
    // Network-first pour les assets locaux (/assets/… du build Vite)
    // IMPORTANT: never cache HTML responses — they are SPA entry points whose
    // hashed asset references change on every deploy. Caching them causes a
    // blank page when the old HTML references asset filenames that no longer exist.
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('text/html')) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});

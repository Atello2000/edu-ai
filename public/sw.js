const CACHE = 'jangalai-__CACHE_VERSION__';

// IMPORTANT: never cache HTML entry points (/ or index.html) —
// their hashed asset references change on every deploy and a stale
// cached HTML causes a blank page (old JS hash → 404 → React never mounts).
const ASSETS = [
  '/app.js', '/style.css', '/manifest.json', '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(async () => {
        await self.clients.claim();
        // Force-reload all open windows so they pick up the new index.html.
        // This recovers users who are stuck on a blank page due to a stale
        // cached index.html pointing to old (now 404) hashed asset filenames.
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
      data:  { url: data.url || '/app.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/app.html'));
});

const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

// URLs whose content changes on every deploy — always fetch fresh, never cache
const NO_CACHE_PATTERNS = ['/', '/index.html', '/app.html'];

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  const url = new URL(e.request.url);
  const isExternal = EXTERNAL.some(h => url.hostname.includes(h));

  // HTML entry points: always network, never fall back to cache
  if (!isExternal && NO_CACHE_PATTERNS.includes(url.pathname)) {
    e.respondWith(fetch(e.request));
    return;
  }

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
    // Network-first pour les assets locaux (app.js, style.css…)
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});

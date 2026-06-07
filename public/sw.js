const CACHE = 'jangalai-ffad3a1-1780765430713';

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

function networkErrorResponse(request) {
  if (request.mode === 'navigate') {
    return new Response(
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jangalai hors ligne</title></head><body><main style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1rem;line-height:1.5"><h1>Connexion indisponible</h1><p>Jangalai ne peut pas charger cette page pour le moment. Verifiez votre connexion puis rechargez la page.</p></main></body></html>',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return new Response('', {
    status: 504,
    statusText: 'Gateway Timeout',
  });
}

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
      }).catch(() => networkErrorResponse(e.request)))
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
      }).catch(err => {
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          return networkErrorResponse(e.request);
        });
      })
    );
  }
});

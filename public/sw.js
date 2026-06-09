const CACHE = 'jangalai-ef5cfaa-1780995641457';

// IMPORTANT: never cache HTML entry points (/ or index.html).
// Their hashed asset references change on every deploy and stale HTML can
// point to missing JS/CSS files.
const ASSETS = [
  '/manifest.json',
  '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap',
];

const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const stale = keys.filter(key => key !== CACHE);
        return Promise.all(stale.map(key => caches.delete(key)))
          .then(() => stale.length > 0);
      })
      .then(async isUpdate => {
        await self.clients.claim();

        if (!isUpdate) return;
        const openClients = await self.clients.matchAll({ type: 'window' });
        for (const client of openClients) {
          client.navigate(client.url);
        }
      })
  );
});

self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Jangalai', {
      body: data.body || 'Vous avez des flashcards a reviser.',
      icon: data.icon || '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/app' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/app'));
});

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

function cacheResponse(request, response) {
  const clone = response.clone();
  caches.open(CACHE)
    .then(cache => cache.put(request, clone))
    .catch(() => {});
}

async function handleFetch(request) {
  const url = new URL(request.url);
  const isExternal = EXTERNAL.some(host => url.hostname.includes(host));

  try {
    if (isExternal) {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cacheResponse(request, response);
      return response;
    }

    const response = await fetch(request);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) cacheResponse(request, response);
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request).catch(() => null);
    return cached || networkErrorResponse(request);
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(handleFetch(event.request));
});

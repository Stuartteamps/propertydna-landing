// PropertyDNA service worker — minimal for PWA install eligibility
// Strategy: network-first, with stale-while-revalidate for shell assets.
// We deliberately avoid aggressive caching so app updates ship immediately.

const VERSION = 'pdna-v1-20260611';
const SHELL = [
  '/',
  '/launch',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Always go to network for API + Netlify functions. Don't cache.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first with cache fallback for navigation and static assets
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy).catch(() => null));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});

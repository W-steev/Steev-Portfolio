// Steev Admin – service worker
// Keeps the app screen available offline. Visitor numbers always come
// fresh from the internet (they are never saved on the phone).
const CACHE = 'steev-admin-v1';
const SHELL = [
  '/admin/',
  '/admin/manifest.webmanifest',
  '/admin/icons/icon-192.png',
  '/Images/logo-steev.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never touch the stats API or anything from other websites
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Try the internet first (so updates show straight away), fall back to the saved copy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && SHELL.includes(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/admin/')))
  );
});

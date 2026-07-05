const CACHE_NAME = 'ems-stock-v16';
const BASE = '/EMS-Stock-Manager';
const STATIC_ASSETS = [
  `${BASE}/index.html`,
  `${BASE}/css/base.css`,
  `${BASE}/css/components.css`,
  `${BASE}/css/layout.css`,
  `${BASE}/css/animations.css`,
  `${BASE}/js/app.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/db.js`,
  `${BASE}/js/sync.js`,
  `${BASE}/js/scanner.js`,
  `${BASE}/js/qrgen.js`,
  `${BASE}/js/notifications.js`,
  `${BASE}/pages/dashboard.html`,
  `${BASE}/pages/inventory.html`,
  `${BASE}/pages/receive.html`,
  `${BASE}/pages/issue.html`,
  `${BASE}/pages/transactions.html`,
  `${BASE}/pages/reports.html`,
  `${BASE}/pages/users.html`,
  `${BASE}/pages/settings.html`,
  `${BASE}/assets/logo.svg`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || network;
    })
  );
});

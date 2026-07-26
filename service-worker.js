// SANDRO RADIO TV - Service Worker
const CACHE_NAME = 'sandro-radio-tv-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-167.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// URL assoluti risolti per matching robusto su qualsiasi path (incluso GitHub Pages sottocartella)
const STATIC_URLS = STATIC_ASSETS.map(a => new URL(a, self.location.href).href);

// Installazione: cache assets statici
self.addEventListener('install', (event) => {
  console.log('[SW] Installazione...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Attivazione: pulizia cache vecchie
self.addEventListener('activate', (event) => {
  console.log('[SW] Attivazione...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: strategia Network-First per API/stream, Cache-First per statici
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Stream HLS / video: pass-through (non cache)
  if (url.pathname.match(/\.(m3u8|ts|mp4|mp3|aac)$/i) || 
      request.headers.get('accept')?.includes('video') ||
      request.headers.get('accept')?.includes('audio')) {
    return;
  }

  // Assets statici: Cache-First
  if (STATIC_URLS.includes(request.url) || url.pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|json)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Tutto il resto: Network-First con fallback cache
  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        return caches.match(new URL('./index.html', self.location.href));
      });
    })
  );
});

// Gestione notifiche push (opzionale)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SANDRO RADIO TV', {
      body: data.body || 'Nuovo aggiornamento disponibile',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: data.tag || 'default',
      requireInteraction: false
    })
  );
});

// Click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

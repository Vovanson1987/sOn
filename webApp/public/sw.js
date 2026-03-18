/**
 * Service Worker для sOn Messenger.
 * Стратегия кэширования: Cache First для статики, Network First для API.
 */

const CACHE_NAME = 'son-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

/* Установка: кэширование статических ресурсов */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* Активация: очистка старого кэша */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Стратегия fetch */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API запросы: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Статика: Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

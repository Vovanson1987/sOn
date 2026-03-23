const CACHE_NAME = 'son-v2';
const STATIC_ASSETS = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/favicon.svg'];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-only for API/WS, stale-while-revalidate for assets, cache-first for shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network only for API and WebSocket
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  // For navigation requests: network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets (JS, CSS, images): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'sOn', {
      body: data.body || 'Новое сообщение',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { chatId: data.chat_id },
      tag: 'son-' + (data.chat_id || 'general'),
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (chatId) client.navigate('/chat/' + chatId);
          return;
        }
      }
      return clients.openWindow(chatId ? '/chat/' + chatId : '/');
    })
  );
});

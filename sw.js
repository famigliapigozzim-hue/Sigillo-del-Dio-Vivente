const CACHE_NAME = 'nel-sigillo-app-cache-v20260910-01';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico,
    '/canti.json',
    '/messaggi.json',
    '/preghiere.json'
];

// 1. Installazione: salva la pagina principale in cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Attivazione: pulisci le vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 2. Attivazione: pulisci le vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Gestione richieste: restituisci prima la cache locale, poi tenta la rete
self.addEventListener('fetch', (event) => {
  // Ignora le chiamate a Google Apps Script (sono già gestite da localStorage in index.html)
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Ritorna subito il file cached (index.html, ecc.)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// Gestione messaggi di aggiornamento
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

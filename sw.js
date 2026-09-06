const CACHE_NAME = 'nel-sigillo-app-cache-v20260906-01';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/canti.json',
    '/messaggi.json',
    '/preghiere.json'
];

// Installazione iniziale
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting()) // Forza l'attivazione immediata
    );
});

// Pulizia delle vecchie cache all'attivazione
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Ascolta il comando di skip waiting proveniente dal browser
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Strategia Cache-First con aggiornamento in background (Network Fallback)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Aggiorna la cache in background se c'è rete
                fetch(e.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
                    }
                }).catch(() => /* Ignora errore in background offline */ {});
                
                return cachedResponse;
            }
            
            // Se il file non è in cache, usa la rete
            return fetch(e.request).then((networkResponse) => {
                if (networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                // Fallback estremo per la navigazione
                if (e.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

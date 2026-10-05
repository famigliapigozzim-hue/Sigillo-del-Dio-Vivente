const CACHE_NAME = 'nel-sigillo-app-cache-v20260912-cl2-01';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './canti.json',
  './messaggi.json',
  './preghiere.json'
];

// Installazione: prepara la cache dell'app.
// Se un singolo asset non è disponibile, l'installazione non deve fallire
// completamente: gli asset verranno comunque recuperati dalla rete quando richiesti.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'no-cache' });

            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch (error) {
            // Asset non disponibile: verrà richiesto dalla rete al bisogno.
          }
        })
      );
    })
  );
});

// Attivazione: elimina le vecchie cache e prende immediatamente il controllo.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Richiesta aggiornamento immediato dal client.
// index_CL_2.0 usa SKIP_WAITING.
self.addEventListener('message', (event) => {
  if (
    event.data &&
    (
      event.data.type === 'SKIP_WAITING' ||
      event.data.action === 'skipWaiting'
    )
  ) {
    self.skipWaiting();
  }
});

// Strategia:
// - Google Apps Script: sempre rete, perché il contenuto viene gestito da
//   localStorage/index.html.
// - Asset statici e JSON locali: cache-first con aggiornamento in background.
// - Risorse non in cache: rete; se la rete fallisce, prova la cache.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Gestiamo solo richieste GET.
  if (request.method !== 'GET') return;

  // Le API Google Apps Script non devono essere intercettate dal SW.
  if (request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
          }

          return networkResponse;
        });

      // Se abbiamo la risorsa in cache, restituiamola subito e aggiorniamo
      // la cache in background.
      if (cachedResponse) {
        networkFetch.catch(() => {});
        return cachedResponse;
      }

      // Nessuna cache: attendiamo la rete.
      return networkFetch.catch(() => caches.match(request));
    })
  );
});

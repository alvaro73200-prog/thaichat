const CACHE_NAME = 'thaichat-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/prompts.js',
  '/js/storage.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap'
];

// Instalación: Guardar recursos iniciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ThaiChat SW] Precaching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activación: Limpiar cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[ThaiChat SW] Limpiando caché antiguo', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network first para la API, Cache first (con fallback a network) para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a la API de Gemini
  if (url.hostname === 'generativelanguage.googleapis.com') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso de la caché si existe
        if (response) {
          return response;
        }

        // Si no está en caché, ir a la red
        return fetch(event.request).then(networkResponse => {
          // No cacheamos respuestas de terceros que no controlamos, excepto las fuentes
          if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('fonts.googleapis.com')) {
            return networkResponse;
          }

          // Clonar la respuesta para guardarla en la caché (se consume al leerse)
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        });
      })
  );
});

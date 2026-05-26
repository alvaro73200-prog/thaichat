const CACHE_NAME = 'thaichat-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/prompts.js',
  './js/storage.js',
  './js/pwa.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
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

// Fetch: Network-first para JS/CSS/HTML, Cache-first para imágenes/fuentes
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a la API de Gemini
  if (url.hostname === 'generativelanguage.googleapis.com') {
    return;
  }

  // Imágenes y fuentes → Cache-first (cambian poco)
  const isStaticAsset = url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?)$/)
    || url.hostname.includes('fonts.g');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // JS / CSS / HTML → Network-first (siempre carga lo más nuevo)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Sin internet → fallback al caché
        return caches.match(event.request);
      })
  );
});


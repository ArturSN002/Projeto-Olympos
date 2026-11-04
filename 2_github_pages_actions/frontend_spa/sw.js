/**
 * Service Worker Oficial — Hub Olympos V2.2
 * Estratégia: Cache de Shell Estático Offline com proteção absoluta de chamadas dinâmicas.
 */

const CACHE_NAME = 'olympos-shell-v2.2.0';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './css/style.css',
  './favicon.ico',
  './assets/favicon.svg',
  './manifest.json',
  './js/app.js',
  './js/api.js',
  './js/icons.js',
  './js/router.js',
  './js/supabase_client.js',
  './js/setup_modal.js',
  './js/memorias_catalogo.js',
  './js/olympos_password_guard.js',
  './js/views/visaoGeral.js',
  './js/views/oficios.js',
  './js/views/portarias.js',
  './js/views/licencas.js',
  './js/views/certificados.js',
  './js/views/diarioOficial.js',
  './js/views/papiroCadmo.js',
  './js/views/personas.js',
  './js/views/busca.js',
  './js/views/configuracoes.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;

  // 1. REQUISITO CRÍTICO: Zero interferência em requisições que não sejam GET (POST, PUT, DELETE)
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // 2. REQUISITO CRÍTICO: Bypass irrestrito para APIs dinâmicas e serviços de terceiros
  const isSupabase = url.hostname.includes('supabase.co');
  const isGoogleAppsScript = url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com');
  const isGoogleApis = url.hostname.includes('drive.google.com') || url.hostname.includes('docs.google.com') || url.hostname.includes('googleapis.com');

  if (isSupabase || isGoogleAppsScript || isGoogleApis) {
    return;
  }

  // 3. Navegação (HTML): Network-First com fallback para cache de ./index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // 4. Recursos do Shell Estático (CSS, JS, Imagens, Fontes, Manifest): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then(function(cachedResponse) {
      const fetchPromise = fetch(req).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

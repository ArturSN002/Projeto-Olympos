/**
 * Service Worker Oficial — Hub Olympos V4.0 (App Shell Mínimo)
 * Estratégia:
 * - Pre-cache estritamente mínimo no install (< 150 KB) sem tempestade de rede em 4G.
 * - Cache-First para chunks versionados pelo Vite (/assets/*-[hash].*).
 * - Stale-While-Revalidate sob demanda para demais recursos estáticos.
 * - Bypass absoluto para APIs dinâmicas (Supabase, GAS, Google APIs, HIBP).
 */

const CACHE_NAME = 'olympos-shell-v4.0.0';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './assets/favicon.svg'
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

  // 1. Zero interferência em requisições que não sejam GET (POST, PUT, DELETE)
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // 2. Bypass irrestrito para APIs dinâmicas e serviços externos
  const isSupabase = url.hostname.includes('supabase.co');
  const isGoogleAppsScript = url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com');
  const isGoogleApis = url.hostname.includes('drive.google.com') || url.hostname.includes('docs.google.com') || url.hostname.includes('googleapis.com');
  const isPwnedPasswords = url.hostname.includes('pwnedpasswords.com');

  if (isSupabase || isGoogleAppsScript || isGoogleApis || isPwnedPasswords) {
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

  // 4. Assets versionados pelo Vite (/assets/name-hash.js|css): Cache-First
  if (url.origin === self.location.origin && /\/assets\/[^/]+-[a-zA-Z0-9_-]{6,}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function(cached) {
        if (cached) return cached;
        return fetch(req).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(req, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Demais recursos estáticos sob demanda: Stale-While-Revalidate
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

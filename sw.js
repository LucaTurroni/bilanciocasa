// ═══════════════════════════════════════
// Bilancio Casa — Service Worker
// ═══════════════════════════════════════
// Aggiorna CACHE_VERSION ad ogni release per forzare
// il rinnovo della cache su tutti i dispositivi.

var CACHE_VERSION = '1.2.0';
var CACHE_NAME    = 'bilancio-casa-' + CACHE_VERSION;

// File da mettere in cache al primo avvio
var PRECACHE_URLS = [
  './',
  './index.html',
  './sw.js'
];

// ── INSTALL: precache delle risorse principali ──
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[SW] Precache parziale:', err);
      });
    })
  );
  // Attiva subito senza aspettare che le vecchie tab vengano chiuse
  self.skipWaiting();
});

// ── ACTIVATE: rimuove le vecchie cache ──
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) {
            console.log('[SW] Elimino cache vecchia:', k);
            return caches.delete(k);
          })
      );
    }).then(function() {
      // Prende il controllo di tutte le tab aperte
      return self.clients.claim();
    }).then(function() {
      // Notifica tutte le tab che c'è una nuova versione
      return self.clients.matchAll({ type: 'window' });
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'NEW_VERSION', version: CACHE_VERSION });
      });
    })
  );
});

// ── FETCH: network first, cache come fallback ──
self.addEventListener('fetch', function(e) {
  // Gestisci solo richieste GET sullo stesso dominio
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        // Metti in cache la risposta fresca
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, responseClone);
        });
        return response;
      })
      .catch(function() {
        // Offline: usa la cache
        return caches.match(e.request).then(function(cached) {
          return cached || new Response(
            '<h2 style="font-family:sans-serif;padding:40px">Offline — riconnettiti per usare l\'app.</h2>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});

// ── MESSAGE: comandi dalla pagina ──
self.addEventListener('message', function(e) {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data === 'GET_VERSION') {
    e.source.postMessage({ type: 'NEW_VERSION', version: CACHE_VERSION });
  }
});

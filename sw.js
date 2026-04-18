const CACHE_NAME = 'forward-cache-v27';

// Version suffix on JS/CSS URLs forces stale-cache misses in older SW
// generations. When updating any asset below, bump ?v= in BOTH index.html
// and here.
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './js/firebase-config.js?v=3',
    './js/config/constants.js?v=3',
    './js/data.js?v=3',
    './js/ai/state.js?v=3',
    './js/ai/client.js?v=3',
    './js/ai/key.js?v=3',
    './js/ai/prompts.js?v=3',
    './js/ai/tasks.js?v=3',
    './js/actions.js?v=3',
    './js/render.js?v=3',
    './js/app.js?v=3',
    './js/launch.js?v=3',
    './css/main.css?v=3',
    './css/layout.css?v=3',
    './css/modals.css?v=3',
    './css/launch.css?v=3'
];

// Queue for failed Firestore/Gemini writes while offline — replayed on reconnect.
const OUTBOX_CACHE = 'forward-outbox-v1';
async function enqueueOutbox(request) {
  try {
    const cache = await caches.open(OUTBOX_CACHE);
    const body = await request.clone().text();
    const entry = new Response(JSON.stringify({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body,
      queuedAt: Date.now()
    }), { headers: { 'Content-Type': 'application/json' } });
    await cache.put(new Request(`queued-${Date.now()}-${Math.random().toString(36).slice(2)}`), entry);
  } catch (e) { /* best-effort */ }
}
self.addEventListener('install', event => {
    // Resilient precache: fetch each URL individually so one missing/404
    // file doesn't abort the whole install (which would pin users on the
    // previous SW generation with stale assets). cache.addAll() is atomic;
    // this replaces it with a best-effort loop that logs failures but
    // always lets the new SW activate.
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.all(urlsToCache.map(url =>
                cache.add(url).catch(err => {
                    console.warn('[SW] precache skipped:', url, err && err.message);
                })
            ))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('fetch', event => {
    // Bypass caching for external/API calls.
    // For POST writes to Firestore/Gemini while offline, enqueue them into the
    // outbox so we can replay when connectivity returns.
    if (
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('securetoken.googleapis.com') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('gstatic.com') ||
        event.request.url.includes('googleapis.com')
    ) {
        if (event.request.method === 'POST' && !self.navigator.onLine) {
            event.respondWith(
                fetch(event.request.clone()).catch(async () => {
                    await enqueueOutbox(event.request);
                    return new Response(JSON.stringify({ queued: true }), {
                        status: 202,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
            );
            return;
        }
        return;
    }

    const url = new URL(event.request.url);

    // Network First strategy for HTML to ensure latest app wrapper
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Stale-While-Revalidate for CSS and JS
    if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
                    }
                    return networkResponse;
                }).catch(() => { }); // Ignore network errors in SWR

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // Cache First for Images & Static Assets
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(networkResponse => {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    // Focus or open the app when notification is clicked
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // If so, just focus it
                if (client.url.includes('forward') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, then open the target URL in a new window/tab
            if (clients.openWindow) {
                return clients.openWindow('./index.html');
            }
        })
    );
});

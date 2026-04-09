const CACHE_NAME = 'forward-cache-v23';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './js/firebase-config.js',
    './js/data.js',
    './js/ai.js',
    './js/actions.js',
    './js/render.js',
    './js/app.js',
    './css/main.css',
    './css/layout.css',
    './css/components.css',
    './css/modals.css',
    './css/launch.css'
];
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('fetch', event => {
    // Bypass caching for external/API calls
    if (
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('securetoken.googleapis.com') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('gstatic.com') ||
        event.request.url.includes('googleapis.com')
    ) {
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
                .catch(() => caches.match(event.request).then(function(cached) {
                    return cached || caches.match('./404.html');
                }))
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

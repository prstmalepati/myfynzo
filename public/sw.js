/// <reference lib="webworker" />
// Service Worker for myFynzo PWA
// B6 Enhancement: Proper caching, offline support, background sync

const CACHE_NAME = 'myfynzo-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-transparent.png',
  '/favicon.svg',
  '/site.webmanifest',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;

  // Firebase/API calls: let Firebase SDK handle
  if (url.hostname.includes('firestore') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('firebaseapp')) {
    return;
  }

  // CDN resources (fonts, scripts): cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline: serve cached version or fallback to index.html for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return cached || new Response('Offline', { status: 503 });
        });

        // Return cached immediately, update in background
        return cached || fetchPromise;
      })
    );
  }
});

export {};

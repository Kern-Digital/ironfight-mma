/**
 * Tidal Athletics — Service Worker
 * Cache-First für App-Shell, Network-First für API/Firebase
 */

const CACHE_NAME = "tidal-v1";
const STATIC_ASSETS = [
  "/",
  "/training",
  "/timer",
  "/manifest.json",
];

// Install: App-Shell cachen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: alte Caches löschen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Cache-First für statische Assets, Network-First für alles andere
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase, externe APIs → immer Network
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    request.method !== "GET"
  ) {
    return;
  }

  // Next.js HMR / _next/webpack → ignorieren
  if (url.pathname.startsWith("/_next/webpack")) return;

  // Cache-First für statische Next.js-Assets
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Stale-While-Revalidate für HTML-Seiten
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});

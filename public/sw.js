const CACHE_NAME = "app-cache-v1";
const CORE_ASSETS = [
  "/index.html",
  "/"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) ||
      ["tile.openstreetmap.org"].includes(url.hostname) ||
      ["cdn.jsdelivr.net", "cdn.tailwindcss.com", "unpkg.com"].includes(url.hostname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match("/"))
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return caches.match("/offline.html");
  }
}

const CACHE_NAME = "app-cache-v1";
const MAX_CACHE_SIZE = 50 * 1024 * 1024;

const FONT_DOMAINS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

const CORE_STUFF = [
  "/",
  "/index.html"
];

const TILE_DOMAINS = [
  "tile.openstreetmap.org"
];

const ASSET_DOMAINS = [
  "cdn.jsdelivr.net",
  "cdn.tailwindcss.com",
  "unpkg.com"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_STUFF);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match("/index.html");
        });
      })
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
      await enforceCacheLimit(cache);
    }

    return response;
  } catch (err) {
    console.warn("Fetch failed:", request.url);
    throw err;
  }
}

async function enforceCacheLimit(cache) {
  const requests = await cache.keys();
  let totalSize = 0;

  const entries = [];

  for (const request of requests) {
    const response = await cache.match(request);
    const blob = await response.blob();
    const size = blob.size;

    totalSize += size;

    entries.push({ request, size });
  }

  if (totalSize <= MAX_CACHE_SIZE) return;

  console.log("Cache exceeds 50MB. Cleaning…");

  for (const entry of entries) {
    await cache.delete(entry.request);
    totalSize -= entry.size;

    if (totalSize <= MAX_CACHE_SIZE) break;
  }
}

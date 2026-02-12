const CACHE_NAME = "app-cache-v1";
const MAX_CACHE_SIZE = 50 * 1024 * 1024;

const FONT_DOMAINS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

const TILE_DOMAINS = [
  "tile.openstreetmap.org"
];

const ASSET_DOMAINS = [
  "cdn.jsdelivr.net",
  "unpkg.com"
];

self.addEventListener("install", event => {
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
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  if (
    FONT_DOMAINS.includes(url.hostname) ||
    TILE_DOMAINS.includes(url.hostname) ||
    ASSET_DOMAINS.includes(url.hostname)
  ) {
    event.respondWith(cacheFirst(event.request));
  }
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

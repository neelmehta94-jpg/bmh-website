// BMH Order Hub service worker.
// Strategy: network-first with cache fallback. Only same-origin GET requests
// are handled/cached, so the app works when dropped into any subfolder of a
// static host (e.g. /app/ on GitHub Pages).

const CACHE_NAME = "bmh-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Only handle http(s) requests to our own origin.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Offline navigation fallback: serve the cached app shell.
        if (request.mode === "navigate") {
          const shell =
            (await caches.match(new URL("./index.html", self.location.href).href)) ||
            (await caches.match(new URL("./", self.location.href).href));
          if (shell) return shell;
        }
        return new Response("You appear to be offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});

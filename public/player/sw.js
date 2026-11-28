// Keeps the sound-desk player's own files on the device so it opens with no
// internet. The music itself is stored separately (IndexedDB) by app.mjs.
// Change VERSION whenever any player file changes, so devices pick up the update.
const VERSION = "player-v5";
const FILES = [
  "/player/index.html",
  "/player/app.mjs",
  "/player/core.mjs",
  "/player/style.css",
  "/player/manifest.json",
  "/player/icon-180.png",
  "/player/icon-192.png",
  "/player/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Always answer from the saved copy straight away (venue Wi-Fi can be slow or
// patchy), and quietly fetch a fresh copy for next time when online.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  const key = url.pathname === "/player/" || url.pathname === "/player" ? "/player/index.html" : url.pathname;
  if (!FILES.includes(key)) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const saved = await cache.match(key);
      const fresh = fetch(key, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (saved) {
        event.waitUntil(fresh);
        return saved;
      }
      return (await fresh) ?? Response.error();
    }),
  );
});

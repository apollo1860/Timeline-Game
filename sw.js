// Service Worker: speichert das Spiel samt aller Bilder, damit es offline läuft.
const CACHE = "zeitstrahl-v1";
const CORE = [
  "./", "index.html", "style.css", "events.js", "common.js", "game.js",
  "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png",
];

// Lädt alles, was noch nicht im Cache liegt – auch Bilder neu hinzugekommener Ereignisse.
async function precacheAll() {
  const cache = await caches.open(CACHE);
  const res = await fetch("events.js", { cache: "no-cache" });
  const text = await res.clone().text();
  const images = [...text.matchAll(/"(img\/[\w-]+\.svg)"/g)].map((m) => m[1]);
  const missing = [];
  for (const url of [...CORE, ...images]) if (!(await cache.match(url))) missing.push(url);
  await cache.addAll(missing);
  await cache.put("events.js", res);
}

self.addEventListener("install", (e) => {
  e.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "precache") e.waitUntil(precacheAll().catch(() => {}));
});

// Erst aus dem Cache antworten (schnell & offline), im Hintergrund aktualisieren.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

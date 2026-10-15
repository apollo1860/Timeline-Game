// Service Worker: speichert das Spiel samt aller Bilder, damit es offline läuft.
const CACHE = "zeitstrahl-v2";
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

// Spieldateien (HTML, JS, CSS): online immer frisch laden, offline aus dem Cache.
// Bilder: aus dem Cache (schnell & offline), fehlende werden nachgeladen.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isImage = url.pathname.includes("/img/") || /\.(png|svg)$/.test(url.pathname);
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(isImage ? e.request : new Request(url.href, { cache: "no-cache" }))
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; });
      if (isImage) return cached || fresh;
      return fresh.catch(() => cached);
    })
  );
});

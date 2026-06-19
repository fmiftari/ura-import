// CACHE-Version manuell erhöhen (ura-vN), wenn sich Inhalte grundlegend ändern und alte Caches
// invalidiert werden sollen. Der JS-Bundle-Hash wird NICHT mehr hier hartkodiert, da der CI-Build
// (.github/workflows/deploy.yml) bei jedem Push einen neuen Hash erzeugt — Precaching übernimmt
// stattdessen der Fetch-Handler unten zur Laufzeit (Cache-as-you-go).
const CACHE = "ura-v8";
const ASSETS = [
  "/ura-import/",
  "/ura-import/manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

// Service Worker für den Viertel-Finder (/app): App-Shell und Städtedaten offline.
// Build ersetzt BUILD und SHELL (scripts/build-web.mjs). Ungebaut (dev) ist die Liste leer und alles läuft übers Netz.
// Fremddienste (Geocoding, Ortsabfrage, Kartenkacheln, Vermieter-Seiten) werden NIE angefasst: nur gleiche Herkunft, nur GET.
const BUILD = /*BUILD*/'dev';
const SHELL = /*SHELL*/[];
const SHELL_CACHE = 'sm-shell-' + BUILD;
const DATA_CACHE = 'sm-data-1'; // Datei-URLs tragen ?v=Hash, daher bleibt der Cache über Builds gültig
const INDEX = '/data/index.json';

self.addEventListener('install', (e) => {
  // Shell ist klein; ein Fehler bricht die Installation ab, die alte Version bleibt dann aktiv
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sm-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Die ~11 MB Städtedaten lädt die Seite nach dem Start im Hintergrund an (Nachricht 'warm'), nicht beim Installieren
async function warmData() {
  const cache = await caches.open(DATA_CACHE);
  let idx;
  try { const r = await fetch(INDEX, { cache: 'no-cache' }); if (!r.ok) return; await cache.put(INDEX, r.clone()); idx = await r.json(); } catch { return; }
  const files = [...new Set(Object.values(idx).filter((v) => typeof v === 'string'))].map((f) => '/data/' + f);
  for (const k of await cache.keys()) { const u = new URL(k.url); if (u.pathname !== INDEX && !files.includes(u.pathname + u.search)) await cache.delete(k); }
  for (const f of files) {
    if (await cache.match(f)) continue;
    try { const r = await fetch(f); if (r.ok) await cache.put(f, r); } catch { return; } // offline: beim nächsten Start weiter
  }
}
self.addEventListener('message', (e) => { if (e.data === 'warm') e.waitUntil(warmData()); });

const networkFirst = async (req, cacheName, key) => {
  const cache = await caches.open(cacheName);
  try { const r = await fetch(req); if (r.ok) cache.put(key || req, r.clone()); return r; }
  catch (err) { const hit = await cache.match(key || req, { ignoreSearch: !key }); if (hit) return hit; throw err; }
};
const cacheFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r;
};

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (req.mode === 'navigate' && (p === '/app' || p === '/app.html')) { e.respondWith(networkFirst(req, SHELL_CACHE, '/app').catch(() => caches.match('/app'))); return; }
  if (p === INDEX) { e.respondWith(networkFirst(req, DATA_CACHE, INDEX)); return; }
  if (p.startsWith('/data/') && p.endsWith('.json')) { e.respondWith(cacheFirst(req, DATA_CACHE)); return; }
  if (/\.(js|css|woff2|svg|png|webmanifest)$/.test(p) && p !== '/sw.js') e.respondWith(cacheFirst(req, SHELL_CACHE));
});

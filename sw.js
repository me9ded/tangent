/* Tangent service worker: keeps the app itself available offline and remembers company logos.
   Prices are never cached here; the app keeps the last prices it saw on its own.
   A deployed version serves the app from its cache, so it opens instantly even on a bad connection;
   new code arrives as a new version of this file, which the app offers with "Reload". The
   unstamped development version asks the network first, so edits show up on a plain reload. */
// Deploys replace this with "tangent-<commit>" (tests/build-site.js), so every deploy is a new version.
const VERSION = "tangent-dev";
const DEV = VERSION === "tangent-dev";
const LOGOS = "tangent-logos";
// Chart history from Twelve Data (kept across versions, like logos).
const HISTORY = "tangent-history";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/theme.js",
  "./js/util.js",
  "./js/time.js",
  "./js/state.js",
  "./js/quote.js",
  "./js/finnhub.js",
  "./js/market.js",
  "./js/history.js",
  "./js/search.js",
  "./js/logos.js",
  "./js/chart.js",
  "./js/live.js",
  "./js/refresh.js",
  "./js/main.js",
  "./js/ui/toast.js",
  "./js/ui/bits.js",
  "./js/ui/layers.js",
  "./js/ui/nav.js",
  "./js/ui/status.js",
  "./js/ui/hero.js",
  "./js/ui/list.js",
  "./js/ui/ptr.js",
  "./js/ui/stock.js",
  "./js/ui/watch.js",
  "./js/ui/searchtab.js",
  "./js/ui/settings.js",
  "./js/ui/key.js",
  "./js/ui/home.js",
  "./js/ui/install.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./fonts/inter-latin.woff2",
  "./fonts/inter-latin-ext.woff2"
];

self.addEventListener("install", (e) => {
  // No skipWaiting here: a new version waits until the app asks (the "Reload" toast), so a page
  // never runs old code against a new cache. The very first install activates right away anyway.
  // "reload" skips the browser's HTTP cache, so a new version never precaches an old file.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "skip-waiting") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== LOGOS && k !== HISTORY).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function shellFirstNetwork(req) {
  const cache = await caches.open(VERSION);
  let res = null;
  try {
    res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
  } catch (e) {}
  // Offline, slow, or a server error: the cached copy is better than an error page.
  const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("./index.html") : null);
  if (hit) return hit;
  if (res) return res;
  throw new Error("offline and not cached");
}

async function shellFromCache(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("./index.html") : null);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function cacheFirst(name, req, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    await cache.put(req, res.clone());
    if (max) trim(cache, max);
  }
  return res;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (/\/(fonts|icons)\//.test(url.pathname)) e.respondWith(cacheFirst(VERSION, req));
    else e.respondWith(DEV ? shellFirstNetwork(req) : shellFromCache(req));
    return;
  }
  if (url.hostname === "static2.finnhub.io" || url.hostname === "static.finnhub.io") {
    e.respondWith(cacheFirst(LOGOS, req, 80));
  }
});

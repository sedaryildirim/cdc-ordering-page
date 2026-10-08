// Offline support: the whole site is static, so cache it and the app opens with no connection.
// Strategy: stale-while-revalidate for same-origin files (instant load, refreshed in the background).
//
// The cache name includes a fingerprint of config/config.js and config/data.js, so editing items,
// prices, pars or emails starts a fresh cache by itself (the browser re-checks those imported files
// whenever it checks sw.js). Only bump CODE_VERSION when you change the site's own code or styles.
importScripts("config/config.js", "config/data.js");
const CODE_VERSION = 31;
function fingerprint(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const VERSION = "mojos-v" + CODE_VERSION + "-" + fingerprint(JSON.stringify(DATA) + JSON.stringify(CONFIG));
const SHELL = [
  "./",
  "index.html",
  "css/fonts.css",
  "css/shared/tokens.css",
  "css/shared/base.css",
  "css/pickers.css",
  "css/order-screen.css",
  "css/bottom-bar.css",
  "css/review.css",
  "css/confirm.css",
  "css/notices.css",
  "css/history.css",
  "css/shared-data.css",
"css/side-nav.css",
"css/order-history.css",
  "fonts/calistoga.woff2",
  "fonts/inter.woff2",
  "fonts/jetbrains-mono.woff2",
  "config/config.js",
  "config/data.js",
  "js/vendor/xlsx.full.min.js",
  "js/vendor/jspdf.umd.min.js",
  "js/ordering/01-state-storage.js",
  "js/ordering/dormant.js",
  "js/ordering/shared-data.js",
  "js/ordering/02-totals.js",
  "js/ordering/03-order-screens.js",
  "js/ordering/04-review-export.js",
  "js/ordering/05-history.js",
"js/ordering/05b-order-history.js",
  "js/ordering/06-actions-init.js",
  "js/shell/a11y.js",
  "js/shell/scroll-search.js",
  "js/shell/offline.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === "navigate" ? cache.match("index.html") : Response.error()));
      return cached || network;
    })
  );
});

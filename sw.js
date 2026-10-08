// The ordering site used to be this site's home page and registered an offline service worker at this address.
// That worker now lives with the ordering site (order/sw.js). This file replaces the old one on phones that still
// have it: it removes itself and its caches, so the menu always loads fresh. Nothing registers it any more.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll(); })
      .then(function (clients) { clients.forEach(function (c) { c.navigate(c.url); }); })
  );
});

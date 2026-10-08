// Registers the offline cache. Service workers need https or localhost, so this does nothing on file://.
(function () {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) === -1) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
  });
})();

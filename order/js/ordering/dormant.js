// "Not ordered in 6 weeks": decides which items on a store's list have gone quiet. Pure, so it can be tested
// without a browser. An item's clock is the last time an order containing it was sent, or, if it has never
// been ordered, the day it first appeared on this store's list (so a new item is not flagged at once).
(function (root) {
  var SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;

  function clockStart(record) {
    if (!record) return NaN;
    var t = Date.parse(record.lastOrdered || record.firstSeen || "");
    return t;
  }

  // record is { firstSeen, lastOrdered } as the server sends it (ISO text, lastOrdered may be null)
  function isDormant(record, now) {
    var start = clockStart(record);
    if (isNaN(start)) return false;
    return (now == null ? Date.now() : now) - start > SIX_WEEKS_MS;
  }

  function weeksSince(record, now) {
    var start = clockStart(record);
    if (isNaN(start)) return 0;
    return Math.floor(((now == null ? Date.now() : now) - start) / (7 * 24 * 60 * 60 * 1000));
  }

  var api = { SIX_WEEKS_MS: SIX_WEEKS_MS, isDormant: isDormant, weeksSince: weeksSince };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Dormant = api;
})(typeof window !== "undefined" ? window : globalThis);

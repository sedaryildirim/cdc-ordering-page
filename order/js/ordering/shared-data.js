// Shared ordering data: what each store has ordered, kept on the server so every phone sees the same thing.
// The sheets work without it. If the server is not set up, not reachable or the access code is missing, every
// function here quietly does nothing (or uses the last copy kept on this phone) and ordering carries on.
const SharedData = (function () {
  var CODE_KEY = "mojos_access_code_v1";
  var CACHE_KEY = "mojos_shared_cache_v1";
  var OUTBOX_KEY = "mojos_outbox_v1";
  var offUntil = 0; // a 503 (the platform is busy or restarting) pauses the shared extras for a minute, not until the page is reloaded
var off = false; // the server said it is not set up: stop asking until the page is reloaded

  // The functions sit at /api/ordering/ on the site (and answer 404 on a host that has none, which switches this off).
  function endpoint(name) { return "/api/ordering/" + name; }
  function readJson(key, fallback) {
    try { return JSON.parse(storageGet(key) || "") || fallback; } catch (e) { return fallback; }
  }

  function post(name, body, timeoutMs) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl && timeoutMs ? setTimeout(function () { ctl.abort(); }, timeoutMs) : null;
    return fetch(endpoint(name), {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": storageGet(CODE_KEY) || "" },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j }; });
    }).catch(function () { return null; }) // no signal, or too slow
      .then(function (out) { if (timer) clearTimeout(timer); return out; });
  }

  // Asks for the staff access code once; it is remembered on this phone.
  function askForCode() {
    var dlg = document.getElementById("accessDialog");
    if (!dlg || typeof dlg.showModal !== "function") return Promise.resolve(null);
    return new Promise(function (resolve) {
      var input = document.getElementById("accessInput");
      input.value = "";
      function done(value) { dlg.removeEventListener("close", onClose); resolve(value); }
      function onClose() { done(dlg.returnValue === "ok" && input.value.trim() ? input.value.trim() : null); }
      dlg.addEventListener("close", onClose);
      dlg.returnValue = "";
      dlg.showModal();
    });
  }

  // Sends a request; on 401 asks for the code once and tries again. Returns the response, or null if unavailable.
  function call(name, body, timeoutMs, canAsk) {
    if (off || Date.now() < offUntil) return Promise.resolve(null);
    return post(name, body, timeoutMs).then(function (res) {
      if (!res) return null;
      if (res.status === 404 || res.status === 405) { off = true; return null; }
      if (res.status === 503) { offUntil = Date.now() + 60000; return null; }
      if (res.status === 401 && canAsk) {
        return askForCode().then(function (code) {
          if (!code) return null;
          storageSet(CODE_KEY, code);
          return post(name, body, timeoutMs).then(function (again) { return again && again.status === 401 ? (storageSet(CODE_KEY, ""), null) : again; });
        });
      }
      return res.status === 401 ? null : res;
    });
  }

  function cacheKey(branchId, supplierId) { return branchId + "|" + supplierId; }
  function cached(branchId, supplierId) { return readJson(CACHE_KEY, {})[cacheKey(branchId, supplierId)] || null; }
  function remember(branchId, supplierId, info) {
    var all = readJson(CACHE_KEY, {});
    all[cacheKey(branchId, supplierId)] = info;
    storageSet(CACHE_KEY, JSON.stringify(all));
  }

  // { items: { itemId: { firstSeen, lastOrdered } }, hidden: [itemId] } from the server, else the copy on this phone, else null.
  // canAsk (default true): whether a wrong or missing access code may pop up the code dialog. Pass false to never ask.
  function loadState(branchId, supplierId, itemIds, canAsk) {
    return call("state", { storeId: branchId, supplierId: supplierId, items: itemIds }, 2500, canAsk !== false).then(function (res) {
      if (res && res.status === 200 && res.json && res.json.items) {
        remember(branchId, supplierId, { items: res.json.items, hidden: res.json.hidden || [] });
        return cached(branchId, supplierId);
      }
      return cached(branchId, supplierId);
    });
  }

  function setHidden(branchId, supplierId, itemId, hidden) {
    return call("hide", { storeId: branchId, supplierId: supplierId, itemId: itemId, hidden: hidden }, 6000, true).then(function (res) {
      if (!res || res.status !== 200) return false;
      var info = cached(branchId, supplierId) || { items: {}, hidden: [] };
      info.hidden = info.hidden.filter(function (id) { return id !== itemId; });
      if (hidden) info.hidden.push(itemId);
      remember(branchId, supplierId, info);
      return true;
    });
  }

  // The orders every phone has sent (newest first), or null when the server cannot be reached.
  function loadHistory(filters) {
    return call("history", filters || {}, 8000, true).then(function (res) {
      return res && res.status === 200 && res.json && Array.isArray(res.json.orders) ? res.json.orders : null;
    });
  }

  // ---- sent orders: kept in an outbox until the server confirms them, so nothing is lost without signal
  function uuid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function flush() {
    var box = readJson(OUTBOX_KEY, []);
    if (box.length === 0 || off || Date.now() < offUntil) return Promise.resolve();
    var entry = box[0];
    return call("sent", entry, 8000, false).then(function (res) {
      // 200 stored, 400 can never succeed: both leave the outbox. Anything else tries again later.
      if (res && (res.status === 200 || res.status === 400)) {
        storageSet(OUTBOX_KEY, JSON.stringify(readJson(OUTBOX_KEY, []).filter(function (e) { return e.clientId !== entry.clientId; })));
        return flush();
      }
    });
  }
  function reportSent(branchId, supplierId, via, total, lines, at) {
    var box = readJson(OUTBOX_KEY, []);
    box.push({
      clientId: uuid(), storeId: branchId, supplierId: supplierId, via: via || "", total: total, sentAt: at,
      lines: lines.map(function (l) { return { id: l.id, name: l.name, unit: l.unit, qty: l.qty, price: l.price }; })
    });
    storageSet(OUTBOX_KEY, JSON.stringify(box.slice(-50)));
    return flush();
  }
  window.addEventListener("online", function () { flush(); });
  setTimeout(flush, 3000); // anything left from an earlier visit

  return { loadHistory: loadHistory, loadState: loadState, cached: cached, setHidden: setHidden, reportSent: reportSent, flush: flush };
})();

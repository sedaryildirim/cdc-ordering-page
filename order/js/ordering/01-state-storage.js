const state = {
  branch: null,
  supplier: null,
  data: null,
  stock: {},     // "catIdx-itemIdx" -> current stock count
  toOrder: {},   // "catIdx-itemIdx" -> qty to order
  completed: {}, // catIdx -> true
  skipped: {},   // "catIdx-itemIdx" -> true (deliberately not ordering this item)
  shared: null   // { items, hidden } from the server (or this phone's copy of it) for the open store and supplier
};

// Drafts live in localStorage, keyed by branch and supplier. Items are stored under a stable id
// (category name + item id), not their position, so editing config/data.js never shifts a saved
// order onto the wrong items. Inside the app, state still uses position keys ("catIdx-itemIdx");
// toStable / fromStable convert at the storage boundary.
const STORAGE_KEY = "mojos_order_drafts_v4";
const LEGACY_STORAGE_KEY = "mojos_order_drafts_v3"; // position-based, migrated once
const LAST_SENT_KEY = "mojos_last_sent_v1";       // copy of the last order sent, so it can be restored

function $(sel, el = document) { return el.querySelector(sel); }
function $all(sel, el = document) { return [...el.querySelectorAll(sel)]; }

const THEME_KEY = "mojos_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  storageSet(THEME_KEY, theme);
  const switchTo = theme === "light" ? "dark" : "light";
  $all(".js-theme").forEach(btn => {
    btn.textContent = theme === "light" ? "☽" : "☀";
    btn.title = `Switch to ${switchTo} mode`;
    btn.setAttribute("aria-label", `Switch to ${switchTo} mode`);
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(current === "light" ? "dark" : "light");
}

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
  if (typeof updateSideNav === "function") updateSideNav();
}

function emptySlice() { return { stock: {}, toOrder: {}, completed: {}, skipped: {} }; }

// ---- storage helpers: a full or blocked store must never break the form ----
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    setStorageNotice(false);
    return true;
  } catch (e) {
    setStorageNotice(true);
    return false;
  }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* nothing to remove */ }
}
function setStorageNotice(show) {
  const el = document.getElementById("storageNotice");
  if (el) el.classList.toggle("hidden", !show);
}

// The one message toast. tone "danger" is used for the two-tap Clear warning.
let toastTimer = null;
function showGlobalToast(message, ms = 4500, tone = "") {
  const el = document.getElementById("globalToast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-danger", tone === "danger");
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

function hideGlobalToast() {
  clearTimeout(toastTimer);
  const el = document.getElementById("globalToast");
  if (el) el.classList.add("hidden");
}

// ---- stable item ids ----
function itemId(cat, item) { return cat.name + "|" + (item.id || item.name); }

function toStable(slice, data) {
  const out = emptySlice();
  for (const field of ["stock", "toOrder", "skipped"]) {
    for (const key of Object.keys(slice[field] || {})) {
      const [ci, ii] = key.split("-").map(Number);
      const cat = data.categories[ci];
      const item = cat && cat.items[ii];
      if (item) out[field][itemId(cat, item)] = slice[field][key];
    }
  }
  for (const ci of Object.keys(slice.completed || {})) {
    const cat = data.categories[ci];
    if (cat && slice.completed[ci]) out.completed[cat.name] = true;
  }
  return out;
}

function fromStable(slice, data) {
  const byId = {};
  const byCategory = {};
  data.categories.forEach((cat, ci) => {
    byCategory[cat.name] = ci;
    cat.items.forEach((item, ii) => { byId[itemId(cat, item)] = itemKey(ci, ii); });
  });
  const out = emptySlice();
  for (const field of ["stock", "toOrder", "skipped"]) {
    for (const id of Object.keys(slice[field] || {})) {
      if (byId[id] !== undefined) out[field][byId[id]] = slice[field][id]; // items removed from the data are dropped
    }
  }
  for (const name of Object.keys(slice.completed || {})) {
    if (byCategory[name] !== undefined && slice.completed[name]) out.completed[byCategory[name]] = true;
  }
  return out;
}

// ---- drafts: always read fresh and write only the slice that changed, so two tabs never overwrite each other ----
function readAllDrafts() {
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  return migrateLegacyDrafts();
}

function migrateLegacyDrafts() {
  const raw = storageGet(LEGACY_STORAGE_KEY);
  if (!raw) return {};
  let old;
  try { old = JSON.parse(raw) || {}; } catch (e) { return {}; }
  const out = {};
  for (const b of Object.keys(old)) {
    for (const s of Object.keys(old[b] || {})) {
      if (!DATA[s]) continue;
      out[b] = out[b] || {};
      out[b][s] = toStable({ ...emptySlice(), ...old[b][s] }, DATA[s]);
    }
  }
  storageSet(STORAGE_KEY, JSON.stringify(out));
  return out;
}

function writeSlice(branchId, supplierId, stableSlice) {
  const all = readAllDrafts();
  if (stableSlice) {
    all[branchId] = all[branchId] || {};
    all[branchId][supplierId] = stableSlice;
  } else if (all[branchId]) {
    delete all[branchId][supplierId];
  }
  return storageSet(STORAGE_KEY, JSON.stringify(all));
}

function getSlice(branchId, supplierId) {
  const data = DATA[supplierId] || { categories: [] };
  const all = readAllDrafts();
  const stable = (all[branchId] && all[branchId][supplierId]) || emptySlice();
  return fromStable({ ...emptySlice(), ...stable }, data);
}

function saveDraft() {
  if (!state.branch || !state.supplier) return;
  const slice = { stock: state.stock, toOrder: state.toOrder, completed: state.completed, skipped: state.skipped };
  writeSlice(state.branch.id, state.supplier.id, toStable(slice, state.data));
}


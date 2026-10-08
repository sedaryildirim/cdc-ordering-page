// ---- order history: the last few orders for each store + supplier, kept on this device ----
// Each entry snapshots its own lines (name, unit, price), so it still reads correctly after
// config/data.js changes, and "Use these quantities" matches lines back up by stable item id.
const HISTORY_KEY = "mojos_order_history_v1";
const HISTORY_MAX = 10;
const VIA_LABEL = { email: "Email", copy: "Copy", excel: "Excel", pdf: "PDF" };

function readHistory() {
  const raw = storageGet(HISTORY_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

function historyFor(branchId, supplierId) {
  const all = readHistory();
  return (all[branchId] && all[branchId][supplierId]) || [];
}

function recordHistory(via) {
  if (totalItemsSelected() === 0) return;
  const lines = [];
  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const qty = state.toOrder[itemKey(ci, ii)] || 0;
      if (qty > 0) lines.push({ id: itemId(cat, item), cat: cat.name, name: item.name, unit: item.unit, price: item.price || 0, qty });
    });
  });
  const entry = { at: Date.now(), via: via || "", total: Math.round(totalWithVat()), lines };

  const all = readHistory();
  const b = state.branch.id, s = state.supplier.id;
  all[b] = all[b] || {};
  const list = all[b][s] || [];
  // "Send again" re-sends the same order: update that entry instead of adding a duplicate
  const sameLines = a => a.lines.length === lines.length && a.lines.every((l, i) => l.id === lines[i].id && l.qty === lines[i].qty);
  if (list[0] && sameLines(list[0])) list[0] = entry;
  else list.unshift(entry);
  all[b][s] = list.slice(0, HISTORY_MAX);
  storageSet(HISTORY_KEY, JSON.stringify(all));
  // Tell the server too (kept in an outbox until it confirms), so every phone knows what was ordered and when.
  SharedData.reportSent(b, s, via || "", entry.total, lines, entry.at);
}

function formatHistoryDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Puts a past order's quantities into the current order. Stock counts stay as entered; items still
// need to be reviewed, so every category finishes as usual before the order can be sent.
function useHistoryEntry(entry) {
  const byId = {};
  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => { byId[itemId(cat, item)] = itemKey(ci, ii); });
  });
  state.toOrder = {};
  let used = 0;
  entry.lines.forEach(l => {
    const key = byId[l.id];
    if (key === undefined) return;
    state.toOrder[key] = l.qty;
    delete state.skipped[key];
    used++;
  });
  saveDraft();
  renderOrderScreen();
  window.scrollTo(0, 0);
  const missing = entry.lines.length - used;
  showGlobalToast(
    `Loaded ${used} item${used === 1 ? "" : "s"} from ${formatHistoryDate(entry.at)}.` +
    (missing > 0 ? ` ${missing} no longer on this list.` : "") + " Check your stock, then review."
  );
}

function renderHistory() {
  const entries = historyFor(state.branch.id, state.supplier.id);
  if (entries.length === 0) return null;

  const box = document.createElement("details");
  box.className = "history";
  box.innerHTML = `<summary>Past orders <span class="meta">(${entries.length})</span></summary>`;
  const list = document.createElement("div");
  list.className = "history-list";

  entries.forEach(entry => {
    const item = document.createElement("div");
    item.className = "history-entry";
    const n = entry.lines.length;
    const via = Object.hasOwn(VIA_LABEL, entry.via) ? ` &middot; ${VIA_LABEL[entry.via]}` : "";
    item.innerHTML = `
      <div class="history-head">
        <span class="history-date">${formatHistoryDate(entry.at)}</span>
        <span class="history-sum">${n} item${n === 1 ? "" : "s"} &middot; ${formatMoney(entry.total)}${via}</span>
      </div>
      <div class="history-actions">
        <button type="button" class="btn-link history-view" aria-expanded="false">Show items</button>
        <button type="button" class="btn secondary history-use">Use these quantities</button>
      </div>
      <ul class="history-lines hidden">${entry.lines.map(l => `<li><span>${l.name}</span><span>x${l.qty} ${l.unit}</span></li>`).join("")}</ul>
    `;
    const viewBtn = $(".history-view", item);
    const linesEl = $(".history-lines", item);
    viewBtn.addEventListener("click", () => {
      const open = linesEl.classList.toggle("hidden") === false;
      viewBtn.textContent = open ? "Hide items" : "Show items";
      viewBtn.setAttribute("aria-expanded", String(open));
    });
    const useBtn = $(".history-use", item);
    let armTimer = null;
    useBtn.addEventListener("click", () => {
      if (totalItemsSelected() > 0 && !useBtn.classList.contains("armed")) {
        // replaces quantities already entered: tap twice
        useBtn.classList.add("armed");
        useBtn.textContent = "Tap again to replace current quantities";
        armTimer = setTimeout(() => { useBtn.classList.remove("armed"); useBtn.textContent = "Use these quantities"; }, 4000);
        return;
      }
      clearTimeout(armTimer);
      useHistoryEntry(entry);
    });
    list.appendChild(item);
  });
  box.appendChild(list);
  return box;
}

let lastOrderText = "";

function clearSentDraft(via) {
  // Clear this branch+supplier's draft now that it's been submitted, but keep one copy of it:
  // opening the mail app does not prove the email was sent, so the confirm screen can restore it.
  const all = readAllDrafts();
  const slice = all[state.branch.id] && all[state.branch.id][state.supplier.id];
  if (slice) {
    storageSet(LAST_SENT_KEY, JSON.stringify({ branch: state.branch.id, supplier: state.supplier.id, slice, at: Date.now() }));
  }
  recordHistory(via);
  writeSlice(state.branch.id, state.supplier.id, null);
}

function restoreLastSent() {
  const raw = storageGet(LAST_SENT_KEY);
  if (!raw) return;
  let sent;
  try { sent = JSON.parse(raw); } catch (e) { return; }
  const branch = CONFIG.branches.find(x => x.id === sent.branch);
  const supplier = CONFIG.suppliers.find(x => x.id === sent.supplier);
  if (!branch || !supplier || !sent.slice) return;
  writeSlice(branch.id, supplier.id, sent.slice);
  storageRemove(LAST_SENT_KEY);
  state.branch = branch;
  selectSupplier(supplier);
  showGlobalToast("Order restored. Check it, then send again.");
}


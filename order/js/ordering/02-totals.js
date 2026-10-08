function itemKey(catIdx, itemIdx) { return catIdx + "-" + itemIdx; }

function setCategoryOpen(catEl, open) {
  catEl.classList.toggle("open", open);
  const header = $(".category-header", catEl);
  if (header) header.setAttribute("aria-expanded", String(open));
}

// The top bar is pinned, so a plain scrollIntoView puts the target underneath it.
// Scroll so it lands just below the bar.
function scrollBelowStickyBars(el) {
  const topbar = $("#orderScreen .topbar");
  const stuck = topbar ? topbar.offsetHeight : 0; // the search bar slides away while scrolling down
  const y = el.getBoundingClientRect().top + window.scrollY - stuck - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function setCategoryCompleted(ci, catEl, completed) {
  state.completed[ci] = completed;
  catEl.classList.toggle("completed", completed);
  const doneBtn = $(".cat-complete-btn", catEl);
  if (doneBtn) {
    doneBtn.textContent = completed ? "Category complete \u2713 Tap to reopen" : "Mark category complete";
    doneBtn.classList.toggle("is-done", completed);
  }
  saveDraft();
  updateIncompleteWarning();
  if (completed) {
    setCategoryOpen(catEl, false);
    const next = catEl.nextElementSibling;
    if (next && next.classList.contains("category")) {
      setCategoryOpen(next, true);
      scrollBelowStickyBars(next);
    }
  }
}

function totalItemsSelected() {
  return Object.values(state.toOrder).filter(v => v > 0).length;
}

// Counts items with real entered data (stock, an order qty, or an explicit
// skip) - this reports what was actually typed in.
function totalItemsTouched() {
  const keys = new Set([
    ...Object.keys(state.stock),
    ...Object.keys(state.toOrder).filter(k => state.toOrder[k] > 0),
    ...Object.keys(state.skipped)
  ]);
  return keys.size;
}

function totalUnitsSelected() {
  return Object.values(state.toOrder).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

function incompleteCategories() {
  const total = state.data.categories.length;
  const incomplete = state.data.categories.filter((_, ci) => !state.completed[ci]);
  return { total, incomplete };
}

// Minimum order for this store + supplier (0 = none). Set per store in config/config.js.
function currentMoq() {
  const set = state.branch && state.branch.minimumOrders;
  return (set && set[state.supplier.id]) || state.data.moq || 0;
}

function moqShortfall() {
  const moq = currentMoq();
  if (!moq) return 0;
  return Math.max(0, moq - totalUnitsSelected());
}

function comboMismatches() {
  const messages = [];
  state.data.categories.forEach((cat, ci) => {
    if (!cat.combo || !cat.combo.requireTogether) return;
    const minEach = cat.combo.minEach || 1;
    const qtys = cat.combo.itemIndices.map(idx => state.toOrder[itemKey(ci, idx)] || 0);
    const anyTouched = qtys.some(q => q > 0);
    const allMet = qtys.every(q => q >= minEach);
    if (anyTouched && !allMet) {
      const names = cat.combo.itemIndices.map(idx => cat.items[idx].name).join(" and ");
      messages.push(`${names} must be ordered together (minimum ${minEach} kg each).`);
    }
  });
  return messages;
}

function totalEstimatedCost() {
  let total = 0;
  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const qty = state.toOrder[key] || 0;
      total += qty * (item.price || 0);
    });
  });
  return total;
}

const VAT_RATE = 0.07;

function totalWithVat() {
  return totalEstimatedCost() * (1 + VAT_RATE);
}

function formatMoney(n) {
  return "฿" + Math.round(n).toLocaleString();
}


function showConfirmScreen(heading, body) {
  $("#confirmHeading").textContent = heading;
  $("#confirmBody").textContent = body;
  $("#restoreOrderBtn").classList.toggle("hidden", !storageGet(LAST_SENT_KEY));
  showScreen("confirmScreen");
}

function emailOrder() {
  const subject = `${supplierShortName()} ${state.branch.name.toUpperCase()} ORDER ${formatDateDDMMYYYY(new Date())}`;
  const body = buildOrderText();
  lastOrderText = body;
  let mailto = `mailto:${encodeURIComponent(state.branch.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CONFIG.ccEmail) mailto += `&cc=${encodeURIComponent(CONFIG.ccEmail)}`;
  // Many mail apps cut a mailto: link off around 2,000 characters.
  const tooLong = mailto.length > 1900;
  window.location.href = mailto;

  clearSentDraft("email");
  setTimeout(() => showConfirmScreen(
    tooLong ? "Check your email" : "Email ready to send",
    tooLong
      ? "This order is long, so your mail app may have cut it off. Check the email before sending, or share the Excel file or copy the order instead."
      : "Your mail app should have opened with the order. Tap Send there. If nothing opened, or you did not send it, use Send again below or restore your order."
  ), 400);
}

const COPY_FAILED = "Couldn't copy. Use Share Excel or Email instead.";

function copyOrderFromReview() {
  const body = buildOrderText();
  lastOrderText = body;
  copyTextToClipboard(body, () => {
    clearSentDraft("copy");
    showConfirmScreen(
      "Order copied",
      "The order has been copied to your clipboard. Paste it into WhatsApp, Line, email, or wherever you send orders."
    );
  }, () => showGlobalToast(COPY_FAILED));
}

// onDone runs only when the text really reached the clipboard; onFail runs otherwise.
function copyTextToClipboard(text, onDone, onFail) {
  const fail = onFail || (() => {});
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone).catch(() => fallbackCopy(text, onDone, fail));
  } else {
    fallbackCopy(text, onDone, fail);
  }
}

function copyOrderText() {
  const btn = $("#copyOrderBtn");
  const done = () => {
    const original = "\u{1F4CB} Copy order";
    btn.textContent = "✓ Copied to clipboard";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 2000);
  };
  // Build the text now: lastOrderText is empty (or another supplier's) after an Excel/PDF send.
  const body = buildOrderText();
  lastOrderText = body;
  copyTextToClipboard(body, done, () => showGlobalToast(COPY_FAILED));
}

function fallbackCopy(text, onDone, onFail) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { /* ok stays false */ }
  document.body.removeChild(textarea);
  if (ok) onDone(); else onFail();
}

function resetOrder() {
  state.branch = null;
  state.supplier = null;
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  state.skipped = {};
  showScreen("branchScreen");
}

function clearAllNow() {
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  state.skipped = {};
  saveDraft();
  renderOrderScreen();
}

function nextSupplier() {
  renderSupplierScreen();
  showScreen("supplierScreen");
}

// Two-tap guard, used only for Clear (the one action that really deletes work).
const armedTimers = new WeakMap();

function armConfirm(btn, message, onConfirm) {
  if (btn.classList.contains("armed")) {
    disarmConfirm(btn);
    onConfirm();
    return;
  }
  btn.classList.add("armed");
  showGlobalToast(message, 3000, "danger");
  armedTimers.set(btn, setTimeout(() => disarmConfirm(btn), 3000));
}

function disarmConfirm(btn) {
  btn.classList.remove("armed");
  clearTimeout(armedTimers.get(btn));
  armedTimers.delete(btn);
  hideGlobalToast();
}

// The par/stock/to-order legend is shown until it has been read once on this device.
const HOWTO_KEY = "mojos_howto_seen";

// The sidebar: highlights the screen you are on, and only offers Suppliers / Current order once a store / supplier is chosen.
function updateSideNav() {
  const active = document.querySelector(".screen.active");
  const onOrder = active && ["orderScreen", "reviewScreen", "confirmScreen"].includes(active.id);
  $all("[data-side]").forEach(b => {
    const id = b.dataset.side;
    const here = active && (active.id === id || (id === "orderScreen" && onOrder));
    if (here) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    // aria-disabled (not disabled) keeps the item in the tab order and lets the hint be read out
    const off = (id === "supplierScreen" && !state.branch) || (id === "orderScreen" && !(state.branch && state.supplier));
    if (off) { b.setAttribute("aria-disabled", "true"); b.title = id === "supplierScreen" ? "Choose a store first" : "Choose a store and a supplier first"; }
    else { b.removeAttribute("aria-disabled"); b.removeAttribute("title"); }
  });
  const where = $("#sideWhere");
  where.hidden = !state.branch;
  where.textContent = state.branch ? state.branch.name + (state.supplier && onOrder ? " · " + state.supplier.name : "") : "";
}

function init() {
  renderBranchScreen();
  applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  $all(".js-theme").forEach(b => b.addEventListener("click", toggleTheme));
  // The link back to the menu of tools (the launcher is its own site; its address is in config/config.js)
  if (CONFIG.homeUrl) { for (const id of ["#backToLauncher", "#sideHome"]) { const home = $(id); home.href = CONFIG.homeUrl; home.hidden = false; } }
  $all("[data-side]").forEach(b => b.addEventListener("click", () => {
    if (b.getAttribute("aria-disabled") === "true") return;
    const target = b.dataset.side;
    // focus stays on the sidebar, so a keyboard user can carry on down the list (js/shell/a11y.js reads this flag)
    document.body.dataset.keepFocus = "1";
    setTimeout(() => { delete document.body.dataset.keepFocus; }, 50);
    if (target === "supplierScreen") renderSupplierScreen();
    if (target === "historyScreen") { openOrderHistory(); return; } // it shows the screen itself
    showScreen(target);
  }));

  $("#backToBranch").addEventListener("click", () => showScreen("branchScreen"));
  $("#backToOrder").addEventListener("click", () => showScreen("orderScreen"));
  $("#reviewBtn").addEventListener("click", () => {
    renderReviewScreen();
    showScreen("reviewScreen");
  });
  $("#emailOrderBtn").addEventListener("click", emailOrder);
  $("#copyReviewBtn").addEventListener("click", copyOrderFromReview);
  $("#excelReviewBtn").addEventListener("click", () => sendFile("excel"));
  $("#pdfReviewBtn").addEventListener("click", () => sendFile("pdf"));
  // Progress is saved as you type, so leaving the order needs no confirmation.
  // Back to the store picker. Progress is saved as you type, so nothing is lost (the same as the Supplier button).
  $("#switchStore").addEventListener("click", () => showScreen("branchScreen"));
  $("#switchBranch").addEventListener("click", () => {
    renderSupplierScreen();
    showScreen("supplierScreen");
  });
  $("#newOrderBtn").addEventListener("click", () => {
    resetOrder();
    showScreen("branchScreen");
  });
  $("#nextSupplierBtn").addEventListener("click", nextSupplier);
  $("#restoreOrderBtn").addEventListener("click", restoreLastSent);
  $("#clearSearchBtn").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#onlyTouchedToggle").checked = false;
    applyFilters();
  });
  $("#emailConfirmBtn").addEventListener("click", emailOrder);
  $("#copyOrderBtn").addEventListener("click", copyOrderText);
  $("#excelConfirmBtn").addEventListener("click", () => sendFile("excel"));
  $("#pdfConfirmBtn").addEventListener("click", () => sendFile("pdf"));
  const howTo = $("#howTo");
  if (storageGet(HOWTO_KEY)) howTo.classList.add("hidden");
  $("#howToDismiss").addEventListener("click", () => {
    storageSet(HOWTO_KEY, "1");
    howTo.classList.add("hidden");
  });
  $("#clearAllBtn").addEventListener("click", () => {
    const n = totalItemsSelected();
    const msg = n > 0
      ? `Tap Clear again to clear all stock counts and quantities for ${state.supplier.name}. This can't be undone.`
      : `Tap Clear again to clear your category progress for ${state.supplier.name}. This can't be undone.`;
    armConfirm($("#clearAllBtn"), msg, clearAllNow);
  });
  $("#warnToggle").addEventListener("click", () => {
    $("#incompleteWarning").classList.toggle("expanded");
    syncWarnToggle(warnLineCount);
  });
  $("#searchInput").addEventListener("input", applyFilters);
  $("#onlyTouchedToggle").addEventListener("change", applyFilters);

  // Always start at the store picker. A half-finished order is kept (saved as you type) and offered again when you
  // open the same store and supplier, but the page never jumps straight back into it.
  showScreen("branchScreen");
}

init();

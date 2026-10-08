// ---- Order history screen: every order that was sent (from the shared database, or this device's own copy when there
// is no signal), filterable, with PDF and Excel downloads that carry the prices as they were when the order was sent.
let ohOrders = [];     // what the list on screen shows
let ohFromServer = false;
let ohRequest = 0;     // counts requests, so a slow old answer never replaces the answer to the latest filter

function ohStoreName(id) { const b = CONFIG.branches.find(x => x.id === id); return b ? b.name : id; }
function ohSupplierName(id) { const s = CONFIG.suppliers.find(x => x.id === id); return s ? s.name.replace(/^Order\s+/i, "") : id; }
function ohEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function ohSums(order) {
  const subtotal = order.lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const vat = subtotal * VAT_RATE;
  return { subtotal, vat, total: subtotal + vat };
}
function ohAllowedStores() {
  const site = new URLSearchParams(location.search).get("site");
  return CONFIG.branches.filter(b => !site || b.site === site);
}

// The copy kept on this device: the last few orders of each store and supplier.
function ohLocalOrders() {
  const out = [];
  const all = readHistory();
  Object.keys(all).forEach(storeId => Object.keys(all[storeId] || {}).forEach(supplierId => {
    (all[storeId][supplierId] || []).forEach((e, i) => out.push({ id: `local-${storeId}-${supplierId}-${e.at}-${i}`, storeId, supplierId, sentAt: e.at, via: e.via || "", total: e.total, lines: e.lines }));
  }));
  return out.sort((a, b) => b.sentAt - a.sentAt);
}

function openOrderHistory() {
  const stores = ohAllowedStores();
  const storeSel = $("#ohStore"), supSel = $("#ohSupplier");
  const keepStore = storeSel.value, keepSup = supSel.value;
  storeSel.innerHTML = (stores.length > 1 ? '<option value="">All stores</option>' : "") + stores.map(b => `<option value="${ohEsc(b.id)}">${ohEsc(b.name)}</option>`).join("");
  const supplierIds = [...new Set(stores.flatMap(b => b.suppliers || CONFIG.suppliers.map(s => s.id)))];
  supSel.innerHTML = '<option value="">All suppliers</option>' + supplierIds.map(id => `<option value="${ohEsc(id)}">${ohEsc(ohSupplierName(id))}</option>`).join("");
  if (keepStore && [...storeSel.options].some(o => o.value === keepStore)) storeSel.value = keepStore;
  if (keepSup && [...supSel.options].some(o => o.value === keepSup)) supSel.value = keepSup;
  showScreen("historyScreen");
  loadOrderHistory();
}

async function loadOrderHistory() {
  const mine = ++ohRequest;
  const note = $("#ohNote"), list = $("#ohList");
  note.textContent = "Loading…";
  list.innerHTML = "";
  const days = Number($("#ohPeriod").value);
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : undefined;
  const storeId = $("#ohStore").value, supplierId = $("#ohSupplier").value;
  const allowed = new Set(ohAllowedStores().map(b => b.id));
  const server = await SharedData.loadHistory({ storeId: storeId || undefined, storeIds: storeId ? undefined : [...allowed], supplierId: supplierId || undefined, since, limit: 300 });
  if (mine !== ohRequest) return; // a newer filter was chosen while this one was loading
  ohFromServer = server !== null;
  let orders = server !== null ? server : ohLocalOrders().filter(o => (!storeId || o.storeId === storeId) && (!supplierId || o.supplierId === supplierId) && (!since || o.sentAt >= Date.parse(since)));
  orders = orders.filter(o => allowed.has(o.storeId));
  ohOrders = orders;
  note.textContent = ohFromServer ? "" : "Showing the orders sent from this device only (the shared history could not be reached).";
  renderOrderHistory();
}

function renderOrderHistory() {
  const list = $("#ohList");
  const has = ohOrders.length > 0;
  $("#ohAllExcel").disabled = !has;
  $("#ohAllPdf").disabled = !has;
  if (!has) { list.innerHTML = '<p class="oh-empty">No orders sent in this period yet.</p>'; return; }
  const grand = ohOrders.reduce((t, o) => t + ohSums(o).total, 0);
  list.innerHTML = `<p class="oh-sum">${ohOrders.length} order${ohOrders.length === 1 ? "" : "s"} &middot; ${formatMoney(grand)} incl. VAT</p>` +
    ohOrders.map((o, i) => {
      const s = ohSums(o), n = o.lines.length;
      const via = Object.hasOwn(VIA_LABEL, o.via) ? ` &middot; ${VIA_LABEL[o.via]}` : "";
      return `<article class="oh-order" data-i="${i}">
        <div class="oh-head"><strong>${ohEsc(ohSupplierName(o.supplierId))}</strong><span>${ohEsc(ohStoreName(o.storeId))}</span></div>
        <div class="oh-meta">${formatHistoryDate(o.sentAt)} &middot; ${n} item${n === 1 ? "" : "s"}${via}</div>
        <div class="oh-total">${formatMoney(s.subtotal)} + VAT ${formatMoney(s.vat)} = <strong>${formatMoney(s.total)}</strong></div>
        <div class="oh-buttons">
          <button type="button" class="btn-link" data-act="items" aria-expanded="false" aria-controls="oh-lines-${i}">Show items</button>
          <button type="button" class="btn secondary" data-act="excel">Excel</button>
          <button type="button" class="btn secondary" data-act="pdf">PDF</button>
        </div>
        <table class="oh-lines hidden" id="oh-lines-${i}"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${
          o.lines.map(l => `<tr><td>${ohEsc(l.name)}</td><td>${ohEsc(l.qty)} ${ohEsc(l.unit || "")}</td><td>${l.price ? formatMoney(l.price) : "n/a"}</td><td>${l.price ? formatMoney(l.qty * l.price) : "n/a"}</td></tr>`).join("")
        }</tbody></table>
      </article>`;
    }).join("");
}

// ---- files: Excel (one sheet of every line with prices, one summary sheet) and PDF (each order with its lines and totals)
function ohFileName(orders, ext) {
  const stamp = formatDateDDMMYYYY(new Date()).replace(/\//g, "-");
  if (orders.length === 1) {
    const o = orders[0], d = new Date(o.sentAt);
    return `${ohSupplierName(o.supplierId).replace(/\W+/g, "_")}_${ohStoreName(o.storeId).replace(/\W+/g, "_")}_${formatDateDDMMYYYY(d).replace(/\//g, "-")}.${ext}`;
  }
  return `Order_history_${stamp}.${ext}`;
}
function ohDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ohWhen(ms) { const d = new Date(ms); return formatDateDDMMYYYY(d) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

function ohExcel(orders) {
  const lines = [["Date", "Store", "Supplier", "Article No.", "Description", "Unit", "Unit price (THB)", "Qty", "Line total (THB)"]];
  const summary = [["Date", "Store", "Supplier", "Items", "Subtotal (THB)", "VAT 7% (THB)", "Total incl. VAT (THB)", "Sent via"]];
  let sub = 0, vat = 0;
  orders.forEach(o => {
    const s = ohSums(o);
    sub += s.subtotal; vat += s.vat;
    summary.push([ohWhen(o.sentAt), ohStoreName(o.storeId), ohSupplierName(o.supplierId), o.lines.length, Math.round(s.subtotal * 100) / 100, Math.round(s.vat * 100) / 100, Math.round(s.total * 100) / 100, (Object.hasOwn(VIA_LABEL, o.via) ? VIA_LABEL[o.via] : "")]);
    o.lines.forEach(l => lines.push([ohWhen(o.sentAt), ohStoreName(o.storeId), ohSupplierName(o.supplierId), l.id || "", l.name, l.unit || "", Number(l.price) || 0, Number(l.qty) || 0, Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100) / 100]));
  });
  if (orders.length > 1) summary.push([], ["Total", "", "", "", Math.round(sub * 100) / 100, Math.round(vat * 100) / 100, Math.round((sub + vat) * 100) / 100, ""]);
  const wsL = XLSX.utils.aoa_to_sheet(lines);
  wsL["!cols"] = [{ wch: 17 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 16 }];
  const wsS = XLSX.utils.aoa_to_sheet(summary);
  wsS["!cols"] = [{ wch: 17 }, { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsS, "Orders");
  XLSX.utils.book_append_sheet(wb, wsL, "Lines with prices");
  return new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function ohPdf(orders) {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 15, bottom = pageH - 18;
  const col = { name: margin, unit: margin + 92, qty: margin + 128, price: margin + 154, total: pageW - margin };
  const num = n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unitNum = n => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  let y = margin;
  const ensure = space => { if (y + space > bottom) { doc.addPage(); y = margin; } };

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
  doc.text(orders.length === 1 ? "Order" : "Order history", margin, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  doc.text(`Prices as at the time each order was sent. Created ${formatDateDDMMYYYY(new Date())}`, pageW - margin, y + 5, { align: "right" });
  y += 14;
  let sub = 0, vat = 0;
  orders.forEach(o => {
    const s = ohSums(o);
    sub += s.subtotal; vat += s.vat;
    ensure(30);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
    doc.text(ohSupplierName(o.supplierId), margin, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
    doc.text(`${ohStoreName(o.storeId)}  |  ${ohWhen(o.sentAt)}${Object.hasOwn(VIA_LABEL, o.via) ? "  |  " + VIA_LABEL[o.via] : ""}`, pageW - margin, y, { align: "right" });
    y += 3;
    doc.setDrawColor(200).line(margin, y, pageW - margin, y);
    y += 4.5;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
    doc.text("ITEM", col.name, y); doc.text("UNIT", col.unit, y);
    doc.text("QTY", col.qty, y, { align: "right" }); doc.text("PRICE (THB)", col.price, y, { align: "right" }); doc.text("TOTAL (THB)", col.total, y, { align: "right" });
    y += 4.5;
    o.lines.forEach(l => {
      const nameLines = doc.setFont("helvetica", "normal").setFontSize(9.5).splitTextToSize(String(l.name), 88);
      const h = nameLines.length * 4.4;
      ensure(h + 2);
      const price = Number(l.price) || 0, qty = Number(l.qty) || 0;
      doc.setTextColor(20).setFontSize(9.5).text(nameLines, col.name, y);
      doc.setFontSize(8.5).text(String(l.unit || ""), col.unit, y);
      doc.setFontSize(9.5).setFont("helvetica", "bold").text(String(qty), col.qty, y, { align: "right" });
      doc.setFont("helvetica", "normal").text(price ? unitNum(price) : "n/a", col.price, y, { align: "right" });
      doc.setFont("helvetica", "bold").text(price ? num(qty * price) : "n/a", col.total, y, { align: "right" });
      y += h + 1.4;
    });
    ensure(20);
    doc.setDrawColor(225).line(col.qty - 12, y - 0.5, pageW - margin, y - 0.5);
    y += 4;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70);
    doc.text("Subtotal", col.price, y, { align: "right" }); doc.text(num(s.subtotal), col.total, y, { align: "right" }); y += 4.6;
    doc.text("VAT (7%)", col.price, y, { align: "right" }); doc.text(num(s.vat), col.total, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20);
    doc.text("Total incl. VAT", col.price, y, { align: "right" }); doc.text(num(s.total), col.total, y, { align: "right" });
    y += 11;
  });
  if (orders.length > 1) {
    ensure(24);
    doc.setDrawColor(150).line(col.qty - 30, y - 3, pageW - margin, y - 3);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    doc.text(`All ${orders.length} orders: subtotal`, col.price, y + 2, { align: "right" }); doc.text(num(sub), col.total, y + 2, { align: "right" });
    doc.text("VAT (7%)", col.price, y + 7.5, { align: "right" }); doc.text(num(vat), col.total, y + 7.5, { align: "right" });
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
    doc.text("Total incl. VAT", col.price, y + 14, { align: "right" }); doc.text(num(sub + vat), col.total, y + 14, { align: "right" });
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) doc.setPage(p).setFont("helvetica", "normal").setFontSize(8).setTextColor(130).text(`Page ${p} of ${pages}`, pageW - margin, pageH - 10, { align: "right" });
  return doc.output("blob");
}

function ohSave(kind, orders) {
  const lib = kind === "pdf" ? window.jspdf : window.XLSX;
  if (!lib) { showGlobalToast(`${kind === "pdf" ? "PDF" : "Excel"} isn't available right now.`); return; }
  try {
    ohDownload(kind === "pdf" ? ohPdf(orders) : ohExcel(orders), ohFileName(orders, kind === "pdf" ? "pdf" : "xlsx"));
  } catch (e) {
    showGlobalToast(`Couldn't create the ${kind === "pdf" ? "PDF" : "Excel"} file.`);
  }
}

$("#openHistory").addEventListener("click", openOrderHistory);
$("#backFromHistory").addEventListener("click", () => showScreen("branchScreen"));
["#ohStore", "#ohSupplier", "#ohPeriod"].forEach(sel => $(sel).addEventListener("change", loadOrderHistory));
$("#ohAllExcel").addEventListener("click", () => ohSave("excel", ohOrders));
$("#ohAllPdf").addEventListener("click", () => ohSave("pdf", ohOrders));
$("#ohList").addEventListener("click", ev => {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const card = btn.closest(".oh-order"), order = ohOrders[Number(card.dataset.i)];
  if (btn.dataset.act === "items") {
    const open = $(".oh-lines", card).classList.toggle("hidden") === false;
    btn.textContent = open ? "Hide items" : "Show items";
    btn.setAttribute("aria-expanded", String(open));
  } else ohSave(btn.dataset.act, [order]);
});

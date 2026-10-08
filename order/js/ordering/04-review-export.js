function renderReviewScreen() {
  const list = $("#reviewList");
  list.innerHTML = "";
  const n = totalItemsSelected();

  if (n === 0) {
    list.innerHTML = `<div class="review-empty">No items selected yet.</div>`;
    setSubmitButtonsDisabled(true);
    return;
  }

  state.data.categories.forEach((cat, ci) => {
    const rows = cat.items
      .map((item, ii) => ({ item, key: itemKey(ci, ii) }))
      .filter(({ key }) => state.toOrder[key] > 0);
    if (rows.length === 0) return;

    const catBlock = document.createElement("div");
    catBlock.className = "review-cat";
    catBlock.innerHTML = `<h3>${cat.name}</h3>`;
    rows.forEach(({ item, key }) => {
      const qty = state.toOrder[key];
      const lineTotal = qty * (item.price || 0);
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerHTML = `<span>${item.name}</span><span class="qty">x${qty} ${item.unit}${item.price ? `<span class="price">${formatMoney(lineTotal)}</span>` : ""}</span>`;
      catBlock.appendChild(row);
    });
    list.appendChild(catBlock);
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;

  const subtotalRow = document.createElement("div");
  subtotalRow.className = "review-subtotal";
  subtotalRow.innerHTML = `<span>Subtotal</span><span>${formatMoney(subtotal)}</span>`;
  list.appendChild(subtotalRow);

  const vatRow = document.createElement("div");
  vatRow.className = "review-subtotal";
  vatRow.innerHTML = `<span>VAT (7%)</span><span>${formatMoney(vat)}</span>`;
  list.appendChild(vatRow);

  const totalRow = document.createElement("div");
  totalRow.className = "review-total";
  totalRow.innerHTML = `<span>Estimated Total</span><span>${formatMoney(subtotal + vat)}</span>`;
  list.appendChild(totalRow);

  const gateLines = [];
  const { total, incomplete } = incompleteCategories();
  if (total > 0 && incomplete.length > 0) {
    const names = incomplete.map(c => c.name).join(", ");
    gateLines.push(`${incomplete.length} categor${incomplete.length === 1 ? "y" : "ies"} still to complete: ${names}.`);
  }
  const shortfall = moqShortfall();
  if (shortfall > 0) {
    gateLines.push(`Minimum order is ${currentMoq()} ${state.data.moqLabel || "units"}. Add ${shortfall} more.`);
  }
  gateLines.push(...comboMismatches());

  if (gateLines.length > 0) {
    const gate = document.createElement("div");
    gate.className = "review-gate-warning";
    gate.innerHTML = `&#9888; ${gateLines.join("<br>")} Go back and fix this before sending.`;
    list.appendChild(gate);
    setSubmitButtonsDisabled(true);
  } else {
    setSubmitButtonsDisabled(false);
  }
}

function setSubmitButtonsDisabled(disabled) {
  $("#emailOrderBtn").disabled = disabled;
  $("#copyReviewBtn").disabled = disabled;
  $("#excelReviewBtn").disabled = disabled;
  $("#pdfReviewBtn").disabled = disabled;
}

function buildOrderText() {
  const lines = [];
  const now = new Date();
  lines.push(`Mojo's Order - ${state.supplier.name} - ${state.branch.name} branch`);
  lines.push(`Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  lines.push("");

  state.data.categories.forEach((cat, ci) => {
    const rows = cat.items
      .map((item, ii) => ({ item, key: itemKey(ci, ii) }))
      .filter(({ key }) => state.toOrder[key] > 0);
    if (rows.length === 0) return;
    lines.push(`${cat.name.toUpperCase()}${state.completed[ci] ? " (COMPLETE)" : ""}`);
    rows.forEach(({ item, key }) => {
      const stock = state.stock[key] ?? "-";
      const par = (item.par === null || item.par === undefined) ? "-" : item.par;
      lines.push(`  - ${item.name} : Par ${par} | Stock ${stock} | Order ${state.toOrder[key]} ${item.unit}`);
    });
    lines.push("");
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  lines.push(`Total line items: ${totalItemsSelected()}`);
  lines.push(`Subtotal: ${formatMoney(subtotal)}`);
  lines.push(`VAT (7%): ${formatMoney(vat)}`);
  lines.push(`Estimated total cost (incl. VAT): ${formatMoney(subtotal + vat)}`);
  return lines.join("\n");
}

function orderFileName(ext) {
  const supplier = supplierShortName().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const branch = state.branch.name.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const date = formatDateDDMMYYYY(new Date()).replace(/\//g, "-");
  return `${supplier}_${branch}_${date}.${ext}`;
}

function buildOrderWorkbook() {
  const priceRows = [];
  priceRows.push([`${state.supplier.name} - ${state.branch.name} branch`]);
  priceRows.push([`Order date: ${formatDateDDMMYYYY(new Date())}`]);
  priceRows.push([]);
  priceRows.push(["Category", "Article No.", "Description", "Unit", "Unit Price (THB)", "Qty", "Line Total (THB)"]);

  const plainRows = [];
  plainRows.push([`${state.supplier.name} - ${state.branch.name} branch`]);
  plainRows.push([`Order date: ${formatDateDDMMYYYY(new Date())}`]);
  plainRows.push([]);
  plainRows.push(["Category", "Article No.", "Description", "Unit", "Qty"]);

  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const qty = state.toOrder[key] || 0;
      if (qty <= 0) return;
      priceRows.push([cat.name, item.id || "", item.name, item.unit, item.price || 0, qty, qty * (item.price || 0)]);
      plainRows.push([cat.name, item.id || "", item.name, item.unit, qty]);
    });
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  priceRows.push([]);
  priceRows.push(["", "", "", "", "", "Subtotal", Math.round(subtotal)]);
  priceRows.push(["", "", "", "", "", "VAT (7%)", Math.round(vat)]);
  priceRows.push(["", "", "", "", "", "Total (incl. VAT)", Math.round(subtotal + vat)]);

  const wsPrice = XLSX.utils.aoa_to_sheet(priceRows);
  wsPrice["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 16 }];

  const wsPlain = XLSX.utils.aoa_to_sheet(plainRows);
  wsPlain["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPrice, "Order");
  XLSX.utils.book_append_sheet(wb, wsPlain, "Order (No Prices)");
  return wb;
}

let fileBusy = false;

// Excel and PDF go through the same path: build a file, hand it to the share sheet,
// or fall back to a plain download.
async function sendFile(kind) {
  if (fileBusy) return;
  const lib = kind === "pdf" ? window.jspdf : window.XLSX;
  const label = kind === "pdf" ? "PDF" : "Excel";
  if (!lib) {
    showGlobalToast(`${label} isn't available right now. Use Email or Copy instead.`);
    return;
  }
  // The guard covers only building the file. The share sheet can stay open (or never answer) on
  // some phones and in-app browsers, and must not leave the buttons dead until a reload.
  fileBusy = true;
  let file;
  try {
    file = kind === "pdf" ? buildOrderPdf() : buildOrderExcel();
  } catch (e) {
    showGlobalToast(`Couldn't create the ${label} file. Use Email or Copy instead.`);
    return;
  } finally {
    fileBusy = false;
  }
  try {
    await shareOrDownload(file.blob, file.filename, label, kind);
  } catch (e) {
    showGlobalToast(`Couldn't send the ${label} file. Use Email or Copy instead.`);
  }
}

function buildOrderExcel() {
  const wb = buildOrderWorkbook();
  const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return {
    blob: new Blob([wbArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: orderFileName("xlsx")
  };
}

async function shareOrDownload(blob, filename, label, via) {
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${state.supplier.name} order`,
          text: `${state.supplier.name} order for ${state.branch.name} branch`
        });
        clearSentDraft(via);
        showConfirmScreen("Order shared", `The ${label} file has been shared.`);
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet, do nothing
      if (e && e.name === "InvalidStateError") return; // a share sheet is already open
      // any other failure: fall through to the plain download below
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  clearSentDraft(via);
  showConfirmScreen("Order downloaded", `The ${label} file should now be in your downloads. If you can't find it, use Send again below to email or copy the order instead.`);
}

// The PDF goes straight to the supplier, so it lists what to deliver and nothing about money:
// no prices, line totals, subtotal, VAT or total.
function buildOrderPdf() {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 15, bottom = pageH - 18;
  // Article no., item, unit, then quantity, unit price and line total lined up on their right edges.
  const col = { art: margin, name: margin + 29, unit: margin + 85, qty: margin + 127, price: margin + 153, total: pageW - margin };
  let y = margin;
  let unpriced = 0;

  // The built-in PDF fonts have no baht sign, so amounts are plain numbers and the headings say THB.
  const num = n => Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // A unit price keeps up to 3 decimals (a returnable bottle is 8.125), so price x qty reads right.
  const unitNum = n => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  const thb = n => "THB " + Math.round(n).toLocaleString("en-US");

  function ensure(space) {
    if (y + space <= bottom) return;
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(state.supplier.name, margin, y + 5);
  y += 11;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`${state.branch.name} branch`, margin, y);
  doc.text(`Order date: ${formatDateDDMMYYYY(new Date())}`, pageW - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(200).line(margin, y, pageW - margin, y);
  y += 7;

  state.data.categories.forEach((cat, ci) => {
    const rows = cat.items
      .map((item, ii) => ({ item, qty: state.toOrder[itemKey(ci, ii)] || 0 }))
      .filter(r => r.qty > 0);
    if (rows.length === 0) return;

    ensure(24);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
    doc.text(cat.name, margin, y);
    y += 2.5;
    doc.setFontSize(8).setTextColor(110);
    doc.text("ARTICLE NO.", col.art, y + 3);
    doc.text("ITEM", col.name, y + 3);
    doc.text("UNIT", col.unit, y + 3);
    doc.text("QTY", col.qty, y + 3, { align: "right" });
    doc.text("PRICE (THB)", col.price, y + 3, { align: "right" });
    doc.text("TOTAL (THB)", col.total, y + 3, { align: "right" });
    y += 5;
    doc.setDrawColor(210).line(margin, y, pageW - margin, y);
    y += 5;

    let catTotal = 0;
    let catPriced = 0;
    rows.forEach(({ item, qty }) => {
      const nameLines = doc.setFont("helvetica", "normal").setFontSize(10).splitTextToSize(item.name, 54);
      const idLines = doc.setFontSize(8).splitTextToSize(String(item.id || ""), 27);
      const height = Math.max(nameLines.length * 4.6, idLines.length * 3.8);
      ensure(height + 2);
      const price = item.price || 0;
      const line = qty * price;
      catTotal += line;
      if (price) catPriced++;
      else unpriced++;
      doc.setTextColor(110).setFontSize(8);
      doc.text(idLines, col.art, y);
      doc.setTextColor(20).setFontSize(10);
      doc.text(nameLines, col.name, y);
      doc.setFontSize(9).text(String(item.unit), col.unit, y).setFontSize(10);
      doc.setFont("helvetica", "bold").text(String(qty), col.qty, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.text(price ? unitNum(price) : "n/a", col.price, y, { align: "right" });
      doc.setFont("helvetica", "bold").text(price ? num(line) : "n/a", col.total, y, { align: "right" });
      y += height + 1.6;
    });

    if (catPriced > 0) {
      ensure(8);
      doc.setDrawColor(225).line(col.qty - 12, y - 1, pageW - margin, y - 1);
      y += 3;
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
      doc.text(`${cat.name} total`, col.price, y, { align: "right" });
      doc.setFont("helvetica", "bold").setTextColor(20).text(num(catTotal), col.total, y, { align: "right" });
      y += 9;
    } else {
      y += 4;
    }
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  ensure(unpriced ? 40 : 32);
  doc.setDrawColor(150).line(col.qty - 30, y - 2, pageW - margin, y - 2);
  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
  doc.text("Subtotal", col.price, y, { align: "right" });
  doc.text(thb(subtotal), col.total, y, { align: "right" });
  y += 5.5;
  doc.text("VAT (7%)", col.price, y, { align: "right" });
  doc.text(thb(vat), col.total, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
  doc.text("Estimated total (incl. VAT)", col.price, y, { align: "right" });
  doc.text(thb(subtotal + vat), col.total, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text("Estimated from list prices. The supplier's invoice may differ.", pageW - margin, y, { align: "right" });
  if (unpriced) {
    y += 4;
    doc.text(`${unpriced} item${unpriced === 1 ? " has" : "s have"} no list price (n/a) and ${unpriced === 1 ? "is" : "are"} not in the total.`, pageW - margin, y, { align: "right" });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 10, { align: "right" });
  }
  return { blob: doc.output("blob"), filename: orderFileName("pdf") };
}

function formatDateDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function supplierShortName() {
  return state.supplier.name.replace(/^Order\s+/i, "").toUpperCase();
}


const STORAGE_KEY = "thalia-grocery-store-v1";
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const dayKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const today = dayKey();
const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dayKey(date);
};

function makeStarterData() {
  const products = [
    { id: "p1", name: "Jasmine Rice", sku: "GRN-001", category: "Grains", price: 58, stock: 34, unit: "kg" },
    { id: "p2", name: "Fresh Eggs", sku: "DAI-004", category: "Dairy & eggs", price: 12, stock: 48, unit: "pc" },
    { id: "p3", name: "Whole Milk", sku: "DAI-012", category: "Dairy & eggs", price: 92, stock: 7, unit: "bottle" },
    { id: "p4", name: "Lucky Me Pancit Canton", sku: "INS-021", category: "Instant food", price: 16, stock: 27, unit: "pack" },
    { id: "p5", name: "Cooking Oil", sku: "PAN-009", category: "Pantry", price: 48, stock: 12, unit: "bottle" },
    { id: "p6", name: "White Sugar", sku: "PAN-014", category: "Pantry", price: 42, stock: 19, unit: "kg" },
    { id: "p7", name: "Canned Sardines", sku: "TIN-003", category: "Canned goods", price: 27, stock: 5, unit: "can" },
    { id: "p8", name: "Mineral Water", sku: "DRK-008", category: "Drinks", price: 20, stock: 31, unit: "bottle" }
  ];
  const sales = [];
  const demoAmounts = [950, 1240, 870, 1560, 1310, 1890, 0];
  for (let offset = -6; offset <= 0; offset += 1) {
    const amount = demoAmounts[offset + 6];
    if (amount) sales.push({ id: `demo-${offset}`, productName: "Store sales", qty: 1, total: amount, date: `${dateOffset(offset)}T12:00:00`, type: "sale" });
  }
  return {
    products,
    sales,
    debts: [
      { id: "d1", customer: "Maria Santos", amount: 640, paid: 200, note: "Rice, eggs, and cooking oil", updated: `${today}T09:30:00` },
      { id: "d2", customer: "Jun Reyes", amount: 380, paid: 0, note: "Weekly groceries", updated: `${today}T10:15:00` },
      { id: "d3", customer: "Aling Nena", amount: 520, paid: 220, note: "Milk and pantry items", updated: `${dateOffset(-1)}T16:00:00` }
    ]
  };
}

function readLegacyState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.products) && Array.isArray(parsed.sales) && Array.isArray(parsed.debts)) return parsed;
    }
  } catch (error) {
    console.warn("Could not load saved store data.", error);
  }
  return null;
}

let state = makeStarterData();
let databaseReady = false;
let saveQueue = Promise.resolve();
let salesLineChart;
let salesBarChart;
let toastTimeout;
let activeView = "dashboard";
let searchTerm = "";
let posSearchTerm = "";
let posCart = [];
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function saveState() {
  if (!databaseReady) return;
  const snapshot = {
    ...state,
    sales: state.sales.map((sale) => ({ ...sale, date: new Date(sale.date).toISOString() })),
    debts: state.debts.map((debt) => ({ ...debt, updated: new Date(debt.updated).toISOString() }))
  };
  saveQueue = saveQueue.then(async () => {
    const result = await apiRequest("PUT", "", snapshot);
    if (result.saved) setDatabaseStatus("Saved to MySQL database");
  }).catch((error) => {
    console.error("Could not save store data.", error);
    setDatabaseStatus("MySQL save failed. Check config.php.");
    toast("Could not save to MySQL. Check that MySQL is running.");
  });
}

async function apiRequest(method = "GET", action = "", payload = null) {
  const url = action ? `api.php?action=${encodeURIComponent(action)}` : "api.php";
  const response = await fetch(url, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function setDatabaseStatus(message) {
  const status = byId("database-status");
  if (status) status.textContent = message;
}

async function initializeStore() {
  try {
    const result = await apiRequest();
    if (result.initialized) {
      state = result.state;
    } else {
      const firstState = readLegacyState() || makeStarterData();
      const migrated = await apiRequest("POST", "bootstrap", {
        ...firstState,
        sales: firstState.sales.map((sale) => ({ ...sale, date: new Date(sale.date).toISOString() })),
        debts: firstState.debts.map((debt) => ({ ...debt, updated: new Date(debt.updated).toISOString() }))
      });
      state = migrated.state;
    }
    databaseReady = true;
    localStorage.removeItem(STORAGE_KEY);
    setDatabaseStatus("Saved to MySQL database");
  } catch (error) {
    console.error("Could not connect to the store database.", error);
    state = readLegacyState() || makeStarterData();
    setDatabaseStatus("MySQL is offline. Changes will not be saved.");
  }
  render();
}

function formatMoney(value) {
  return money.format(Number(value) || 0);
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-PH", options).format(new Date(value));
}

function formatMatch(value) {
  const safe = escapeHtml(value);
  if (!searchTerm.trim()) return safe;
  const expression = new RegExp(`(${escapeRegex(searchTerm.trim())})`, "ig");
  return safe.replace(expression, '<mark class="highlight">$1</mark>');
}

function stockStatus(product) {
  if (Number(product.stock) <= 0) return { label: "Out of stock", className: "status-out" };
  if (Number(product.stock) <= 8) return { label: "Low stock", className: "status-low" };
  return { label: "In stock", className: "status-ok" };
}

function itemCell(product) {
  return `<div class="item-cell"><span class="item-thumb"><i data-lucide="${product.category.toLowerCase().includes("drink") ? "cup-soda" : product.category.toLowerCase().includes("dairy") ? "milk" : "package"}"></i></span><span><span class="item-name">${formatMatch(product.name)}</span><span class="item-sub">${escapeHtml(product.unit || "item")}</span></span></div>`;
}

function renderProductRows(products, compact = false) {
  if (!products.length) return "";
  return products.map((product) => {
    const status = stockStatus(product);
    if (compact) return `<tr><td>${itemCell(product)}</td><td class="price-cell">${formatMoney(product.price)}</td><td><span class="stock-number">${Number(product.stock)} ${escapeHtml(product.unit || "")}</span></td><td><span class="status-pill ${status.className}">${status.label}</span></td><td><div class="row-actions"><button class="row-action" data-action="edit-product" data-id="${product.id}" aria-label="Edit ${escapeHtml(product.name)}" title="Edit"><i data-lucide="pencil"></i></button></div></td></tr>`;
    return `<tr><td>${itemCell(product)}</td><td class="table-code">${formatMatch(product.sku || "—")}</td><td class="category-tag">${formatMatch(product.category)}</td><td class="price-cell">${formatMoney(product.price)}</td><td><span class="stock-number">${Number(product.stock)} ${escapeHtml(product.unit || "")}</span></td><td><span class="status-pill ${status.className}">${status.label}</span></td><td><div class="row-actions"><button class="row-action" data-action="edit-product" data-id="${product.id}" aria-label="Edit ${escapeHtml(product.name)}" title="Edit item"><i data-lucide="pencil"></i></button><button class="row-action delete" data-action="delete-product" data-id="${product.id}" aria-label="Delete ${escapeHtml(product.name)}" title="Delete item"><i data-lucide="trash-2"></i></button></div></td></tr>`;
  }).join("");
}

function salesForDate(date) {
  return state.sales.filter((sale) => sale.type === "sale" && dayKey(new Date(sale.date)) === date);
}

function outstanding(debt) {
  return Math.max(0, Number(debt.amount) - Number(debt.paid));
}

function renderActivity() {
  const grouped = new Map();
  state.sales.forEach((sale) => {
    const payment = sale.type === "payment";
    const key = payment ? `payment:${sale.id}` : `sale:${sale.saleId || sale.id}`;
    const transaction = grouped.get(key) || { ...sale, total: 0, qty: 0, items: [] };
    transaction.total += Number(sale.total) || 0;
    transaction.qty += Number(sale.qty) || 1;
    if (!payment && !transaction.items.includes(sale.productName || "Store sale")) transaction.items.push(sale.productName || "Store sale");
    grouped.set(key, transaction);
  });
  const transactions = [...grouped.values()].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (!transactions.length) return '<div class="empty-state"><strong>No transactions yet</strong><p>Record a sale or payment to see activity here.</p></div>';
  return transactions.map((sale) => {
    const payment = sale.type === "payment";
    const label = payment ? `Utang payment · ${escapeHtml(sale.customer || "Customer")}` : escapeHtml(sale.items.length > 1 ? `${sale.items[0]} +${sale.items.length - 1} more` : sale.items[0] || "Store sale");
    return `<div class="activity-row"><span class="activity-mark ${payment ? "payment" : ""}"><i data-lucide="${payment ? "hand-coins" : "shopping-bag"}"></i></span><span class="activity-copy"><strong>${label}</strong><small>${payment ? "Payment collected" : `${sale.qty} item${sale.qty === 1 ? "" : "s"}`} · ${formatDate(sale.date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></span><span class="activity-amount">+${formatMoney(sale.total)}</span></div>`;
  }).join("");
}

function chartSeries() {
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(index - 6));
  return { days, labels: days.map((date) => formatDate(`${date}T12:00:00`, { weekday: "short" })), totals: days.map((date) => salesForDate(date).reduce((sum, sale) => sum + Number(sale.total), 0)) };
}

function renderCharts() {
  const series = chartSeries();
  const weekTotal = series.totals.reduce((sum, amount) => sum + amount, 0);
  byId("week-sales").textContent = formatMoney(weekTotal);
  const bestIndex = series.totals.indexOf(Math.max(...series.totals));
  byId("best-day").textContent = weekTotal ? `${series.labels[bestIndex]} · ${formatMoney(series.totals[bestIndex])}` : "No sales yet";
  if (!window.Chart) {
    byId("sales-chart").replaceWith(Object.assign(document.createElement("p"), { className: "chart-fallback", textContent: "Charts need an internet connection to load." }));
    byId("daily-chart").replaceWith(Object.assign(document.createElement("p"), { className: "chart-fallback", textContent: "Charts need an internet connection to load." }));
    return;
  }
  if (salesLineChart) salesLineChart.destroy();
  if (salesBarChart) salesBarChart.destroy();
  const chartBase = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#173b33", padding: 9, titleFont: { family: "DM Sans", size: 10 }, bodyFont: { family: "DM Sans", size: 10 }, callbacks: { label: (context) => ` ${formatMoney(context.parsed.y)}` } } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: "#929e98", font: { family: "DM Sans", size: 9 } } }, y: { beginAtZero: true, border: { display: false, dash: [3, 4] }, grid: { color: "#edf1ed", drawTicks: false }, ticks: { color: "#a0aaa5", font: { family: "DM Sans", size: 8 }, maxTicksLimit: 4, callback: (value) => value === 0 ? "₱0" : `₱${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}` } } } };
  salesLineChart = new Chart(byId("sales-chart"), { type: "line", data: { labels: series.labels, datasets: [{ data: series.totals, borderColor: "#368567", backgroundColor: (context) => { const chart = context.chart; const { ctx, chartArea } = chart; if (!chartArea) return "rgba(54,133,103,.08)"; const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); gradient.addColorStop(0, "rgba(54,133,103,.20)"); gradient.addColorStop(1, "rgba(54,133,103,0)"); return gradient; }, fill: true, tension: .36, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: "#fff", pointBorderColor: "#368567", pointBorderWidth: 2 }] }, options: { ...chartBase, interaction: { intersect: false, mode: "index" } } });
  salesBarChart = new Chart(byId("daily-chart"), { type: "bar", data: { labels: series.labels, datasets: [{ data: series.totals, backgroundColor: series.totals.map((_, index) => index === bestIndex && weekTotal ? "#e98768" : "#c8dfcf"), hoverBackgroundColor: "#548f6e", borderRadius: 4, maxBarThickness: 23 }] }, options: { ...chartBase, scales: { ...chartBase.scales, y: { ...chartBase.scales.y, ticks: { ...chartBase.scales.y.ticks, maxTicksLimit: 3 } } } } });
}

function renderDebts() {
  const query = byId("debt-search").value.trim().toLowerCase();
  const activeDebts = state.debts.filter((debt) => outstanding(debt) > 0);
  const filtered = activeDebts.filter((debt) => `${debt.customer} ${debt.note || ""}`.toLowerCase().includes(query));
  byId("debt-count").textContent = String(activeDebts.length);
  byId("ledger-outstanding").textContent = formatMoney(activeDebts.reduce((sum, debt) => sum + outstanding(debt), 0));
  byId("ledger-customers").textContent = String(activeDebts.length);
  byId("ledger-collected").textContent = formatMoney(state.sales.filter((sale) => sale.type === "payment" && dayKey(new Date(sale.date)) === today).reduce((sum, sale) => sum + Number(sale.total), 0));
  byId("ledger-added").textContent = formatMoney(state.debts.filter((debt) => debt.lastChargeDate === today).reduce((sum, debt) => sum + Number(debt.lastChargeAmount || 0), 0));
  byId("debt-rows").innerHTML = filtered.map((debt) => `<tr><td><div class="debt-customer"><span class="customer-avatar">${escapeHtml(debt.customer.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase())}</span><strong>${formatMatch(debt.customer)}</strong></div></td><td><span class="debt-note" title="${escapeHtml(debt.note || "No details")}">${formatMatch(debt.note || "No details")}</span></td><td>${formatDate(debt.updated, { month: "short", day: "numeric" })}</td><td>${formatMoney(debt.amount)}</td><td class="paid-amount">${formatMoney(debt.paid)}</td><td class="balance-amount">${formatMoney(outstanding(debt))}</td><td><div class="row-actions"><button class="button button-secondary" data-action="add-debt" data-id="${debt.id}" title="Add another charge"><i data-lucide="circle-plus"></i><span>Charge</span></button><button class="button button-primary" data-action="pay-debt" data-id="${debt.id}"><i data-lucide="wallet-cards"></i><span>Pay</span></button></div></td></tr>`).join("");
  byId("empty-debts").hidden = filtered.length > 0;
}

function render() {
  const todaySales = salesForDate(today);
  const todayTransactions = state.sales.filter((sale) => dayKey(new Date(sale.date)) === today);
  byId("today-sales").textContent = formatMoney(todaySales.reduce((sum, sale) => sum + Number(sale.total), 0));
  byId("transaction-count").textContent = String(new Set(todayTransactions.map((sale) => sale.saleId || sale.id)).size);
  byId("stock-count").textContent = String(state.products.reduce((sum, product) => sum + Number(product.stock), 0));
  byId("low-stock-count").textContent = `${state.products.filter((product) => Number(product.stock) <= 8).length} LOW`;
  const openDebts = state.debts.filter((debt) => outstanding(debt) > 0);
  byId("utang-total").textContent = formatMoney(openDebts.reduce((sum, debt) => sum + outstanding(debt), 0));
  byId("utang-people-count").textContent = `${openDebts.length} PEOPLE`;
  byId("inventory-count").textContent = String(state.products.length);
  byId("dashboard-products").innerHTML = renderProductRows([...state.products].sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 5), true);
  const inventoryQuery = byId("inventory-search").value.trim().toLowerCase();
  const inventoryProducts = state.products.filter((product) => `${product.name} ${product.category} ${product.sku}`.toLowerCase().includes(inventoryQuery));
  byId("product-count").textContent = String(inventoryQuery ? inventoryProducts.length : state.products.length);
  byId("inventory-products").innerHTML = renderProductRows(inventoryProducts);
  byId("empty-inventory").hidden = inventoryProducts.length > 0;
  byId("recent-activity").innerHTML = renderActivity();
  renderDebts();
  renderPosProducts();
  renderPosCart();
  renderCharts();
  if (window.lucide) window.lucide.createIcons();
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `view-${view}`));
  document.querySelectorAll("[data-view-link]").forEach((element) => element.classList.toggle("active", view === element.dataset.viewLink && element.classList.contains("nav-item")));
  const names = { dashboard: "Dashboard", pos: "Point of sale", inventory: "Inventory", utang: "Utang ledger" };
  byId("breadcrumb-current").textContent = names[view];
  if (view === "inventory") byId("inventory-search").focus({ preventScroll: true });
  if (view === "pos") { renderPosProducts(); renderPosCart(); byId("pos-search").focus({ preventScroll: true }); }
}

function toast(message) {
  const element = byId("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove("show"), 2500);
}

function field(name, label, options = {}) {
  const full = options.full ? " full" : "";
  const required = options.required === false ? "" : " required";
  if (options.select) return `<div class="field${full}"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}"${required}>${options.select.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></div>`;
  const type = options.type || "text";
  const value = options.value !== undefined ? ` value="${escapeHtml(options.value)}"` : "";
  const min = options.min !== undefined ? ` min="${options.min}"` : "";
  const max = options.max !== undefined ? ` max="${options.max}"` : "";
  const step = options.step !== undefined ? ` step="${options.step}"` : "";
  const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";
  return `<div class="field${full}"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}"${value}${min}${max}${step}${placeholder}${required}></div>`;
}

function openDialog({ title, description = "", eyebrow = "STORE DESK", submit = "Save", fields = [], onSubmit, icon = "plus" }) {
  const dialog = byId("app-dialog");
  const formElement = byId("dialog-form");
  dialog.classList.toggle("pos-dialog", icon === "shopping-cart");
  byId("dialog-title").textContent = title;
  byId("dialog-description").textContent = description;
  byId("dialog-eyebrow").textContent = eyebrow;
  byId("dialog-submit").textContent = submit;
  byId("dialog-fields").innerHTML = fields.join("");
  dialog.querySelector(".dialog-icon").innerHTML = `<i data-lucide="${icon}"></i>`;
  if (window.lucide) window.lucide.createIcons();
  formElement.onsubmit = (event) => {
    event.preventDefault();
    if (!formElement.reportValidity()) return;
    const values = Object.fromEntries(new FormData(formElement).entries());
    if (onSubmit(values) === false) return;
    dialog.close();
  };
  dialog.showModal();
  dialog.querySelector("input, select")?.focus();
}

function addProduct(product) {
  state.products.unshift({ ...product, id: crypto.randomUUID(), price: Number(product.price), stock: Number(product.stock), unit: product.unit || "item" });
  saveState(); render(); toast("Item added to inventory.");
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  openDialog({ title: "Update item", description: "Change the price, stock, or product details.", submit: "Save changes", icon: "pencil", fields: [field("name", "Item name", { value: product.name, full: true }), field("sku", "Item code", { value: product.sku, required: false }), field("category", "Category", { value: product.category }), field("price", "Price (₱)", { type: "number", value: product.price, min: "0.01", step: "0.01" }), field("stock", "Stock quantity", { type: "number", value: product.stock, min: "0", step: "1" }), field("unit", "Unit", { value: product.unit, required: false })], onSubmit: (values) => { Object.assign(product, { ...values, price: Number(values.price), stock: Number(values.stock) }); saveState(); render(); toast("Item details updated."); } });
}

function showProductDialog() {
  openDialog({ title: "Add an item", description: "Add a product to your shelves and inventory.", submit: "Add item", icon: "package-plus", fields: [field("name", "Item name", { placeholder: "e.g. Brown rice", full: true }), field("sku", "Item code", { placeholder: "e.g. GRN-015", required: false }), field("category", "Category", { placeholder: "e.g. Grains" }), field("price", "Price (₱)", { type: "number", min: "0.01", step: "0.01", placeholder: "0.00" }), field("stock", "Starting stock", { type: "number", min: "0", step: "1", value: "0" }), field("unit", "Unit", { placeholder: "kg, bottle, pack", value: "pc", required: false })], onSubmit: addProduct });
}

function renderPosProducts() {
  const categorySelect = byId("pos-category");
  if (!categorySelect) return;
  const selectedCategory = categorySelect.value || "All";
  const categories = ["All", ...new Set(state.products.map((product) => product.category).filter(Boolean).sort((a, b) => a.localeCompare(b)))];
  categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${category === "All" ? "All categories" : escapeHtml(category)}</option>`).join("");
  categorySelect.value = categories.includes(selectedCategory) ? selectedCategory : "All";
  const query = posSearchTerm.trim().toLowerCase();
  const products = state.products.filter((product) => {
    const matchesQuery = `${product.name} ${product.category} ${product.sku || ""}`.toLowerCase().includes(query);
    return matchesQuery && (categorySelect.value === "All" || product.category === categorySelect.value);
  });
  byId("pos-visible-count").textContent = String(products.length);
  byId("pos-no-products").hidden = products.length > 0;
  byId("pos-products").innerHTML = products.map((product) => {
    const outOfStock = Number(product.stock) <= 0;
    const icon = product.category.toLowerCase().includes("drink") ? "cup-soda" : product.category.toLowerCase().includes("dairy") ? "milk" : "package";
    const query = posSearchTerm.trim();
    const safeName = escapeHtml(product.name);
    const name = query ? safeName.replace(new RegExp(`(${escapeRegex(query)})`, "ig"), '<mark class="highlight">$1</mark>') : safeName;
    return `<button class="pos-product-card" type="button" data-pos-add="${escapeHtml(product.id)}" ${outOfStock ? "disabled" : ""}><span class="pos-product-icon"><i data-lucide="${icon}"></i></span><span class="pos-product-stock ${outOfStock ? "out" : Number(product.stock) <= 8 ? "low" : ""}">${outOfStock ? "Out of stock" : `${Number(product.stock)} ${escapeHtml(product.unit || "in stock")}`}</span><strong>${name}</strong><small>${escapeHtml(product.category)}</small><span class="pos-product-price">${formatMoney(product.price)}</span></button>`;
  }).join("");
  if (window.lucide) window.lucide.createIcons();
}

function posTotal() {
  return posCart.reduce((total, line) => total + line.unitPrice * line.qty, 0);
}

function renderPosCart() {
  const rows = byId("pos-cart-rows");
  if (!rows) return;
  rows.innerHTML = posCart.length ? posCart.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const productName = escapeHtml(product?.name || "Item removed");
    return `<article class="pos-cart-line"><div class="pos-cart-line-main"><span class="pos-cart-line-name">${productName}</span><span class="pos-cart-line-price">${formatMoney(line.unitPrice)} each · ${formatMoney(line.unitPrice * line.qty)}</span></div><div class="pos-cart-line-controls"><div class="pos-qty-control"><button type="button" data-pos-qty="-1" data-id="${escapeHtml(line.productId)}" aria-label="Decrease quantity of ${productName}"><i data-lucide="minus"></i></button><span>${line.qty}</span><button type="button" data-pos-qty="1" data-id="${escapeHtml(line.productId)}" aria-label="Increase quantity of ${productName}" ${line.qty >= Number(product?.stock || 0) ? "disabled" : ""}><i data-lucide="plus"></i></button></div><button class="row-action delete" type="button" data-pos-remove="${escapeHtml(line.productId)}" aria-label="Remove ${productName} from cart"><i data-lucide="trash-2"></i></button></div></article>`;
  }).join("") : '<div class="pos-cart-empty"><i data-lucide="shopping-basket"></i><strong>Your cart is empty</strong><span>Select a product to start an order.</span></div>';
  byId("pos-cart-count").textContent = String(posCart.reduce((count, line) => count + line.qty, 0));
  byId("pos-subtotal").textContent = formatMoney(posTotal());
  byId("pos-clear-cart").disabled = posCart.length === 0;
  renderPosPayment();
  if (window.lucide) window.lucide.createIcons();
}

function renderPosPayment() {
  const isUtang = document.querySelector('input[name="pos-payment"]:checked')?.value === "utang";
  const total = posTotal();
  const tendered = Number(byId("pos-tendered").value) || 0;
  const change = Math.max(0, tendered - total);
  byId("pos-customer-field").hidden = !isUtang;
  byId("pos-cash-fields").hidden = isUtang;
  byId("pos-utang-hint").hidden = !isUtang;
  byId("pos-change").textContent = formatMoney(change);
  byId("pos-payment-hint").textContent = tendered < total ? `Short by ${formatMoney(total - tendered)}.` : total > 0 ? "Change is ready to give the customer." : "Enter the amount received from the customer.";
  byId("pos-complete-sale").disabled = posCart.length === 0 || (isUtang ? !byId("pos-customer").value.trim() : tendered < total);
  byId("pos-complete-sale").innerHTML = `<i data-lucide="${isUtang ? "book-open-check" : "check"}"></i><span>${isUtang ? "Charge to utang" : "Complete cash sale"}</span>`;
  if (window.lucide) window.lucide.createIcons();
}

function renderPosReceipt(receipt) {
  const container = byId("pos-receipt");
  const lineItems = receipt.items.map((line) => `<li><span>${line.qty} × ${escapeHtml(line.name)}</span><strong>${formatMoney(line.total)}</strong></li>`).join("");
  container.innerHTML = `<div class="receipt-heading"><span class="receipt-check"><i data-lucide="check"></i></span><div><p class="eyebrow">SALE COMPLETE</p><h2>${receipt.paymentMethod === "utang" ? "Charged to utang" : "Payment received"}</h2></div><button class="button button-secondary" type="button" data-action="print-receipt"><i data-lucide="printer"></i><span>Print receipt</span></button></div><div class="receipt-meta"><span>Receipt <strong>${escapeHtml(receipt.id.slice(0, 8).toUpperCase())}</strong></span><span>${formatDate(receipt.date, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>${receipt.customer ? `<span>Customer <strong>${escapeHtml(receipt.customer)}</strong></span>` : ""}</div><ul class="receipt-lines">${lineItems}</ul><div class="receipt-totals"><span>Total <strong>${formatMoney(receipt.total)}</strong></span>${receipt.paymentMethod === "cash" ? `<span>Cash received <strong>${formatMoney(receipt.tendered)}</strong></span><span class="receipt-change">Change due <strong>${formatMoney(receipt.change)}</strong></span>` : ""}</div>`;
  container.hidden = false;
  if (window.lucide) window.lucide.createIcons();
}

function completePosSale() {
  if (!posCart.length) return;
  const paymentMethod = document.querySelector('input[name="pos-payment"]:checked')?.value || "cash";
  const customer = byId("pos-customer").value.trim();
  const total = posTotal();
  const tendered = Number(byId("pos-tendered").value) || 0;
  if (paymentMethod === "cash" && tendered < total) { toast("Cash received is less than the order total."); return; }
  if (paymentMethod === "utang" && !customer) { toast("Enter the customer's name for an utang sale."); return; }
  for (const line of posCart) {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product || line.qty > Number(product.stock)) { toast(`${product?.name || "An item"} does not have enough stock.`); return; }
  }
  const id = crypto.randomUUID();
  const date = new Date().toISOString();
  const items = posCart.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    product.stock = Number(product.stock) - line.qty;
    return { name: product.name, qty: line.qty, total: line.unitPrice * line.qty };
  });
  posCart.forEach((line, index) => {
    const product = state.products.find((item) => item.id === line.productId);
    state.sales.push({ id: crypto.randomUUID(), saleId: id, productId: product.id, productName: product.name, customer: customer || null, qty: line.qty, total: line.unitPrice * line.qty, date, type: "sale", paymentMethod, amountReceived: index === 0 && paymentMethod === "cash" ? tendered : 0, changeDue: index === 0 && paymentMethod === "cash" ? tendered - total : 0 });
  });
  if (paymentMethod === "utang") {
    const note = `POS ${id.slice(0, 8).toUpperCase()}: ${items.map((item) => `${item.qty} × ${item.name}`).join(", ")}`;
    const matchingDebt = state.debts.find((debt) => debt.customer.trim().toLowerCase() === customer.toLowerCase() && outstanding(debt) > 0);
    if (matchingDebt) {
      matchingDebt.amount = Number(matchingDebt.amount) + total;
      matchingDebt.paid = Number(matchingDebt.paid);
      matchingDebt.note = note;
      matchingDebt.updated = date;
      matchingDebt.lastChargeAmount = total;
      matchingDebt.lastChargeDate = dayKey(new Date(date));
    } else {
      state.debts.unshift({ id: crypto.randomUUID(), customer, amount: total, paid: 0, note, updated: date, lastChargeAmount: total, lastChargeDate: dayKey(new Date(date)) });
    }
  }
  posCart = [];
  byId("pos-tendered").value = "";
  byId("pos-customer").value = "";
  document.querySelector('input[name="pos-payment"][value="cash"]').checked = true;
  saveState();
  render();
  renderPosReceipt({ id, date, items, total, tendered, change: Math.max(0, tendered - total), paymentMethod, customer });
  toast(paymentMethod === "utang" ? "Sale charged to the utang ledger." : `Sale complete. Give ${formatMoney(tendered - total)} change.`);
  byId("pos-receipt").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function recordSale() {
  switchView("pos");
}

function addDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  const fields = id ? [field("customer", "Customer name", { value: debt.customer, full: true }), field("amount", "Additional utang (₱)", { type: "number", min: "0.01", step: "0.01" }), field("note", "Details", { value: debt.note, placeholder: "Items or reason", required: false })] : [field("customer", "Customer name", { placeholder: "Full name", full: true }), field("amount", "Utang amount (₱)", { type: "number", min: "0.01", step: "0.01", placeholder: "0.00" }), field("note", "Details", { placeholder: "Items or reason", required: false })];
  openDialog({ title: id ? "Add to utang" : "Add customer utang", description: id ? `Add another charge to ${debt.customer}'s balance.` : "Record a new customer balance to collect later.", eyebrow: "CUSTOMER CREDIT", submit: id ? "Add charge" : "Save utang", icon: "notebook-pen", fields, onSubmit: (values) => {
    const amount = Number(values.amount);
    const matching = id ? debt : state.debts.find((item) => item.customer.trim().toLowerCase() === values.customer.trim().toLowerCase() && outstanding(item) > 0);
    const chargeDate = new Date().toISOString();
    if (matching) { matching.amount = Number(matching.amount) + amount; matching.note = values.note || matching.note; matching.updated = chargeDate; matching.lastChargeAmount = amount; matching.lastChargeDate = dayKey(new Date(chargeDate)); }
    else state.debts.unshift({ id: crypto.randomUUID(), customer: values.customer.trim(), amount, paid: 0, note: values.note || "", updated: chargeDate, lastChargeAmount: amount, lastChargeDate: dayKey(new Date(chargeDate)) });
    saveState(); render(); toast("Utang charge saved.");
  } });
}

function payDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  const remaining = outstanding(debt);
  openDialog({ title: "Record a payment", description: `${debt.customer} has ${formatMoney(remaining)} remaining. Enter a full or partial payment.`, eyebrow: "UTANG PAYMENT", submit: "Save payment", icon: "wallet-cards", fields: [field("amount", "Payment received (₱)", { type: "number", min: "0.01", max: remaining, step: "0.01", placeholder: `Up to ${remaining.toFixed(2)}` }), field("customer", "Customer", { value: debt.customer, required: false })], onSubmit: (values) => {
    const amount = Number(values.amount);
    if (amount > outstanding(debt)) { toast("Payment cannot be more than the remaining balance."); return; }
    debt.paid = Number(debt.paid) + amount;
    debt.updated = new Date().toISOString();
    state.sales.push({ id: crypto.randomUUID(), productName: "Utang payment", customer: debt.customer, qty: 1, total: amount, date: new Date().toISOString(), type: "payment" });
    saveState(); render(); toast(outstanding(debt) ? "Partial payment recorded." : "Utang fully paid. Salamat!");
  } });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const viewLink = event.target.closest("[data-view-link]");
    if (viewLink) { event.preventDefault(); switchView(viewLink.dataset.viewLink); return; }
    const posAdd = event.target.closest("[data-pos-add]");
    if (posAdd) {
      const product = state.products.find((item) => item.id === posAdd.dataset.posAdd);
      const line = posCart.find((item) => item.productId === posAdd.dataset.posAdd);
      if (product && (!line || line.qty < Number(product.stock))) {
        if (line) line.qty += 1;
        else posCart.push({ productId: product.id, qty: 1, unitPrice: Number(product.price) });
        byId("pos-receipt").hidden = true;
        renderPosCart();
      } else if (product) toast(`Only ${product.stock} ${product.unit || "item(s)"} available.`);
      return;
    }
    const quantityButton = event.target.closest("[data-pos-qty]");
    if (quantityButton) {
      const line = posCart.find((item) => item.productId === quantityButton.dataset.id);
      if (line) {
        line.qty += Number(quantityButton.dataset.posQty);
        if (line.qty <= 0) posCart = posCart.filter((item) => item !== line);
        byId("pos-receipt").hidden = true;
        renderPosCart();
      }
      return;
    }
    const removeLine = event.target.closest("[data-pos-remove]");
    if (removeLine) {
      posCart = posCart.filter((item) => item.productId !== removeLine.dataset.posRemove);
      byId("pos-receipt").hidden = true;
      renderPosCart();
      return;
    }
    const tenderButton = event.target.closest("[data-pos-tender]");
    if (tenderButton) {
      byId("pos-tendered").value = tenderButton.dataset.posTender === "exact" ? posTotal().toFixed(2) : tenderButton.dataset.posTender;
      renderPosPayment();
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) {
      const id = action.dataset.id;
      if (action.dataset.action === "add-product") showProductDialog();
      if (action.dataset.action === "edit-product") editProduct(id);
      if (action.dataset.action === "record-sale") recordSale();
      if (action.dataset.action === "add-debt") addDebt(id);
      if (action.dataset.action === "pay-debt") payDebt(id);
      if (action.dataset.action === "print-receipt") window.print();
      if (action.dataset.action === "delete-product") {
        const product = state.products.find((item) => item.id === id);
        if (product && window.confirm(`Remove ${product.name} from inventory? This cannot be undone.`)) { state.products = state.products.filter((item) => item.id !== id); saveState(); render(); toast("Item removed from inventory."); }
      }
    }
    if (event.target.closest("[data-close-dialog]")) byId("app-dialog").close();
  });
  byId("pos-search").addEventListener("input", (event) => { posSearchTerm = event.target.value; renderPosProducts(); });
  byId("pos-category").addEventListener("change", renderPosProducts);
  byId("pos-clear-cart").addEventListener("click", () => {
    if (posCart.length && window.confirm("Clear all items from this order?")) { posCart = []; byId("pos-receipt").hidden = true; renderPosCart(); }
  });
  byId("pos-tendered").addEventListener("input", renderPosPayment);
  byId("pos-customer").addEventListener("input", renderPosPayment);
  document.querySelectorAll('input[name="pos-payment"]').forEach((input) => input.addEventListener("change", renderPosPayment));
  byId("pos-complete-sale").addEventListener("click", completePosSale);
  byId("global-search").addEventListener("input", (event) => {
    searchTerm = event.target.value;
    byId("inventory-search").value = searchTerm;
    byId("clear-search").hidden = !searchTerm;
    if (searchTerm && activeView !== "inventory") switchView("inventory");
    render();
  });
  byId("inventory-search").addEventListener("input", (event) => {
    searchTerm = event.target.value;
    byId("global-search").value = searchTerm;
    byId("clear-search").hidden = !searchTerm;
    render();
  });
  byId("clear-search").addEventListener("click", () => { byId("inventory-search").value = ""; byId("global-search").value = ""; searchTerm = ""; byId("clear-search").hidden = true; render(); byId("inventory-search").focus(); });
  byId("debt-search").addEventListener("input", renderDebts);
  byId("global-search").addEventListener("keydown", (event) => { if (event.key === "Escape") { event.target.value = ""; byId("inventory-search").value = ""; searchTerm = ""; render(); } });
  document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); byId("global-search").focus(); } });
  byId("today-label").querySelector("span").textContent = formatDate(new Date(), { month: "short", day: "numeric" });
  byId("dashboard-date").textContent = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
}

bindEvents();
initializeStore();
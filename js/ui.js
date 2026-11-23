// ui.js: everything that touches the DOM.

// Escape text from outside before putting it in innerHTML (prevents XSS)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const clean = (sym) => sym.replace(/\.(NS|BO)$/, "").replace("^", "");
const inr = (n) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const signed = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
const trend = (n) => (n >= 0 ? "gain" : "loss");

// Indian style: lakh (L) and crore (Cr)
const volume = (n) =>
  n == null ? "—" : n >= 1e7 ? (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? (n / 1e5).toFixed(2) + " L" : n.toLocaleString("en-IN");

export function renderSummary(el, s) {
  if (!s) { el.innerHTML = `<h2>No stock selected</h2><p>Pick one from the list.</p>`; return; }
  el.innerHTML = `
    <h2>${esc(s.name)} <span class="ticker">${esc(clean(s.symbol))}</span></h2>
    <p class="price">${inr(s.price)}</p>
    <p class="change ${trend(s.change)}">${signed(s.change)} (${signed(s.changePct)}%)</p>
    <dl class="stats">
      <div><dt>Open</dt><dd>${inr(s.open)}</dd></div>
      <div><dt>Prev close</dt><dd>${inr(s.prevClose)}</dd></div>
      <div><dt>High</dt><dd>${inr(s.high)}</dd></div>
      <div><dt>Low</dt><dd>${inr(s.low)}</dd></div>
      <div><dt>Volume</dt><dd>${volume(s.volume)}</dd></div>
    </dl>`;
}

export function renderList(el, stocks, selected, { loading, hasData }) {
  if (loading && !hasData) { el.innerHTML = `<li class="empty">Loading live prices…</li>`; return; }
  if (stocks.length === 0) { el.innerHTML = `<li class="empty">No match in your list. Press Search to look it up on NSE.</li>`; return; }
  el.innerHTML = stocks.map((s) => `
    <li>
      <button type="button" class="stock-row ${s.symbol === selected ? "selected" : ""}" data-symbol="${esc(s.symbol)}">
        <span>${esc(clean(s.symbol))}</span>
        <span>${inr(s.price)}</span>
        <span class="${trend(s.changePct)}">${signed(s.changePct)}%</span>
      </button>
    </li>`).join("");
}

export function renderIndices(el, indices, labels) {
  el.innerHTML = indices.map((i) => `
    <div class="index-card">
      <span class="index-name">${esc(labels[i.symbol] || clean(i.symbol))}</span>
      <strong>${i.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
      <span class="${trend(i.change)}">${signed(i.changePct)}%</span>
    </div>`).join("");
}

export function renderStatus(el, { open, updatedAt, error, loading }) {
  const time = updatedAt ? updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  el.innerHTML = `
    <span class="badge ${open ? "open" : "closed"}">${open ? "Market open" : "Market closed"}</span>
    <span>${loading ? "Updating…" : "Updated " + time + " IST"}</span>
    ${error ? `<span class="error">${esc(error)}</span>` : ""}`;
}

export function markActiveSort(bar, key) {
  bar.querySelectorAll(".sort-btn").forEach((b) => b.classList.toggle("active", b.dataset.sort === key));
}

export function markActiveRange(bar, range) {
  bar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.range === range));
}
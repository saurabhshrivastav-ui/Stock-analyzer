// ui.js: everything that touches the DOM lives here.

const money = (n) => `$${n.toFixed(2)}`;
const signed = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
const trend = (n) => (n >= 0 ? "gain" : "loss");

// Turns 52300000 into "52.3M"
const shortNumber = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);

export function renderSummary(container, stock) {
  if (!stock) {
    container.innerHTML = `<h2>No stock selected</h2><p>Pick one from the list.</p>`;
    return;
  }
  container.innerHTML = `
    <h2>${stock.name} <span class="ticker">${stock.symbol}</span></h2>
    <p class="price">${money(stock.price)}</p>
    <p class="change ${trend(stock.change)}">
      ${signed(stock.change)} (${signed(stock.changePct)}%)
    </p>
    <p class="description">${stock.description}</p>
    <dl class="stats">
      <div><dt>Open</dt><dd>${money(stock.open)}</dd></div>
      <div><dt>High</dt><dd>${money(stock.high)}</dd></div>
      <div><dt>Low</dt><dd>${money(stock.low)}</dd></div>
      <div><dt>Volume</dt><dd>${shortNumber(stock.volume)}</dd></div>
    </dl>
  `;
}

export function renderList(container, stocks, selectedSymbol) {
  // Empty state: always tell the user what happened
  if (stocks.length === 0) {
    container.innerHTML = `<li class="empty">No stocks match your search.</li>`;
    return;
  }

  container.innerHTML = stocks
    .map(
      (s) => `
      <li>
        <button type="button" class="stock-row ${s.symbol === selectedSymbol ? "selected" : ""}"
                data-symbol="${s.symbol}">
          <span>${s.symbol}</span>
          <span>${money(s.price)}</span>
          <span class="${trend(s.changePct)}">${signed(s.changePct)}%</span>
        </button>
      </li>`
    )
    .join("");
}

export function markActiveSort(sortBar, sortKey) {
  sortBar.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === sortKey);
  });
}
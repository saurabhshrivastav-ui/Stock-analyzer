// app.js: holds the state and wires events to rendering.
import { stocks } from "./data.js";
import { renderSummary, renderList, markActiveSort } from "./ui.js";

// 1. Grab elements once
const form = document.querySelector("#search-form");
const input = document.querySelector("#symbol");
const sortBar = document.querySelector("#sort-bar");
const listEl = document.querySelector("#stock-list");
const summaryEl = document.querySelector("#summary");

// 2. State: the single source of truth. The screen is just a picture of this.
const state = {
  query: "",
  sortKey: "symbol",
  selected: stocks[0].symbol,
};

// 3. Pure helper: takes data in, returns new data out, changes nothing
function getVisibleStocks() {
  const q = state.query.trim().toLowerCase();

  return stocks
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .sort((a, b) =>
      state.sortKey === "symbol"
        ? a.symbol.localeCompare(b.symbol)
        : b[state.sortKey] - a[state.sortKey] // high to low for numbers
    );
}

// 4. Render: redraw the page from state
function render() {
  const visible = getVisibleStocks();
  const selectedStock = stocks.find((s) => s.symbol === state.selected);

  renderList(listEl, visible, state.selected);
  renderSummary(summaryEl, selectedStock);
  markActiveSort(sortBar, state.sortKey);
}

// 5. Events: change state, then render
input.addEventListener("input", () => {
  state.query = input.value;
  render();
});

form.addEventListener("submit", (e) => {
  e.preventDefault(); // stop the page from reloading
  const match = getVisibleStocks()[0];
  if (match) state.selected = match.symbol;
  render();
});

sortBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".sort-btn");
  if (!btn) return;
  state.sortKey = btn.dataset.sort;
  render();
});

// Event delegation: one listener on the list instead of one per row
listEl.addEventListener("click", (e) => {
  const row = e.target.closest(".stock-row");
  if (!row) return;
  state.selected = row.dataset.symbol;
  render();
});

render(); // first paint
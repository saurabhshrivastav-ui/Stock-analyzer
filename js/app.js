import { INDICES, WATCHLIST, REFRESH_MS } from "./data.js";
import { fetchQuotes, fetchHistory } from "./api.js";
import { renderSummary, renderList, renderIndices, renderStatus, markActiveSort, markActiveRange } from "./ui.js";
import { drawChart, clearChart } from "./chart.js";

const form = document.querySelector("#search-form");
const input = document.querySelector("#symbol");
const sortBar = document.querySelector("#sort-bar");
const listEl = document.querySelector("#stock-list");
const summaryEl = document.querySelector("#summary");
const indicesEl = document.querySelector("#indices");
const statusEl = document.querySelector("#status");
const timeframesEl = document.querySelector("#timeframes");
const canvas = document.querySelector("#price-chart");
const chartMsg = document.querySelector("#chart-msg");

const labels = Object.fromEntries(INDICES.map((i) => [i.symbol, i.label]));

const state = {
  quotes: [], indices: [], extras: [],
  query: "", sortKey: "symbol", selected: null, range: "1mo",
  loading: false, error: "", updatedAt: null,
};

// NSE hours: Mon-Fri 9:15-15:30 IST (public holidays not handled)
function isMarketOpen() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "numeric", hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  const mins = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return !["Sat", "Sun"].includes(p.weekday) && mins >= 555 && mins <= 930;
}

function visibleStocks() {
  const q = state.query.trim().toLowerCase();
  return state.quotes
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .sort((a, b) => state.sortKey === "symbol" ? a.symbol.localeCompare(b.symbol) : b[state.sortKey] - a[state.sortKey]);
}

// render() draws text/lists. The chart is NOT redrawn here (it'd flicker every refresh).
function render() {
  renderStatus(statusEl, { open: isMarketOpen(), ...state });
  renderIndices(indicesEl, state.indices, labels);
  renderList(listEl, visibleStocks(), state.selected, { loading: state.loading, hasData: state.quotes.length > 0 });
  renderSummary(summaryEl, state.quotes.find((s) => s.symbol === state.selected));
  markActiveSort(sortBar, state.sortKey);
  markActiveRange(timeframesEl, state.range);
}

// ----- chart loading -----
const historyCache = new Map(); // "TCS.NS|1mo" -> points (avoids refetching)
let historyRequestId = 0;       // guards against out-of-order responses

async function loadHistory() {
  const symbol = state.selected;
  if (!symbol) return;
  const key = `${symbol}|${state.range}`;
  const myId = ++historyRequestId;

  chartMsg.textContent = "Loading chart…";
  try {
    let points = historyCache.get(key);
    if (!points) {
      points = (await fetchHistory(symbol, state.range)).points;
      historyCache.set(key, points);
    }
    if (myId !== historyRequestId) return; // user clicked something newer; ignore this result

    if (points.length < 2) { clearChart(); chartMsg.textContent = "Not enough data to draw a chart."; return; }
    chartMsg.textContent = "";
    drawChart(canvas, points, symbol);
  } catch (err) {
    if (myId !== historyRequestId) return;
    clearChart();
    chartMsg.textContent = `Chart unavailable: ${err.message}`;
  }
}

function selectStock(symbol) {
  state.selected = symbol;
  render();
  loadHistory();
}

// ----- quote loading -----
async function load() {
  state.loading = true; state.error = ""; render();
  let firstSelection = false;
  try {
    const [stocks, idx] = await Promise.all([
      fetchQuotes([...WATCHLIST, ...state.extras]),
      fetchQuotes(INDICES.map((i) => i.symbol)),
    ]);
    state.quotes = stocks.quotes;
    state.indices = idx.quotes;
    state.updatedAt = new Date();
    if (!state.selected && state.quotes.length) { state.selected = state.quotes[0].symbol; firstSelection = true; }
    if (stocks.errors.length) state.error = `Could not load: ${stocks.errors.map((e) => e.symbol).join(", ")}`;
  } catch (err) {
    state.error = err.message;
    console.error(err);
  } finally {
    state.loading = false; render();
  }
  if (firstSelection) loadHistory();
}

// ----- events -----
input.addEventListener("input", () => { state.query = input.value; render(); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim().toUpperCase();
  if (!q) return;
  const match = visibleStocks()[0];
  if (match) return selectStock(match.symbol);

  const symbol = q.includes(".") ? q : `${q}.NS`;
  state.extras.push(symbol);
  state.query = ""; input.value = "";
  state.selected = symbol;
  await load();
  if (state.quotes.some((s) => s.symbol === symbol)) {
    loadHistory();
  } else {
    state.extras = state.extras.filter((s) => s !== symbol);
    state.selected = state.quotes[0]?.symbol ?? null;
    state.error = `Symbol "${q}" not found on NSE.`; render();
    loadHistory();
  }
});

sortBar.addEventListener("click", (e) => {
  const b = e.target.closest(".sort-btn");
  if (!b) return;
  state.sortKey = b.dataset.sort; render();
});

listEl.addEventListener("click", (e) => {
  const row = e.target.closest(".stock-row");
  if (row) selectStock(row.dataset.symbol);
});

timeframesEl.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.range = b.dataset.range;
  render();
  loadHistory();
});

// ----- start -----
load();
setInterval(() => { if (isMarketOpen() && !document.hidden) load(); }, REFRESH_MS);
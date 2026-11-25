import { INDICES, WATCHLIST, REFRESH_MS } from "./data.js";
import { fetchQuotes, fetchHistory, searchSymbols } from "./api.js";
import { load as loadPref, save as savePref, pruneCache } from "./storage.js";
import { debounce } from "./utils.js";
import {
  renderSummary,
  renderList,
  renderIndices,
  renderStatus,
  renderSuggestions,
  markActiveSort,
  markActiveRange,
  renderAnalysis,
} from "./ui.js";
import { drawChart, clearChart } from "./chart.js";
import {
  sma,
  dailyChanges,
  periodStats,
  rsi,
  trendSignal,
} from "./analysis.js";

const $ = (sel) => document.querySelector(sel);
const form = $("#search-form"),
  input = $("#symbol"),
  suggEl = $("#suggestions");
const sortBar = $("#sort-bar"),
  listEl = $("#stock-list"),
  summaryEl = $("#summary");
const indicesEl = $("#indices"),
  statusEl = $("#status"),
  timeframesEl = $("#timeframes");
const canvas = $("#price-chart"),
  chartMsg = $("#chart-msg"),
  analysisEl = $("#analysis");
const themeBtn = $("#theme-toggle"),
  resetBtn = $("#reset-watchlist");

const MAX_WATCHLIST = 20;
const SYMBOL_RE = /^[\w.&^-]{1,20}$/;
const RANGE_NAMES = {
  "5d": "1 week",
  "1mo": "1 month",
  "6mo": "6 months",
  "1y": "1 year",
};
const labels = Object.fromEntries(INDICES.map((i) => [i.symbol, i.label]));

// Never trust stored data: someone (or a bug) may have changed it
function sanitizeWatchlist(v) {
  const ok =
    Array.isArray(v) &&
    v.length <= MAX_WATCHLIST &&
    v.every((s) => typeof s === "string" && SYMBOL_RE.test(s));
  return ok ? v : [...WATCHLIST];
}
const savedRange = loadPref("range", "1mo");

const state = {
  watchlist: sanitizeWatchlist(loadPref("watchlist", WATCHLIST)),
  quotes: [],
  indices: [],
  suggestions: [],
  query: "",
  sortKey: "symbol",
  selected: null,
  range: RANGE_NAMES[savedRange] ? savedRange : "1mo",
  theme: document.documentElement.dataset.theme || "light",
  loading: false,
  error: "",
  updatedAt: null,
};

// ----- theme -----
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  themeBtn.setAttribute("aria-pressed", String(state.theme === "dark"));
}

// NSE hours: Mon-Fri 9:15-15:30 IST (public holidays not handled)
function isMarketOpen() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const mins = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return !["Sat", "Sun"].includes(p.weekday) && mins >= 555 && mins <= 930;
}

function visibleStocks() {
  const q = state.query.trim().toLowerCase();
  return state.quotes
    .filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    )
    .sort((a, b) =>
      state.sortKey === "symbol"
        ? a.symbol.localeCompare(b.symbol)
        : b[state.sortKey] - a[state.sortKey],
    );
}

function render() {
  renderStatus(statusEl, { open: isMarketOpen(), ...state });
  renderIndices(indicesEl, state.indices, labels);
  renderList(listEl, visibleStocks(), state.selected, {
    loading: state.loading,
    hasData: state.quotes.length > 0,
    emptyWatchlist: state.watchlist.length === 0,
  });
  renderSummary(
    summaryEl,
    state.quotes.find((s) => s.symbol === state.selected),
  );
  markActiveSort(sortBar, state.sortKey);
  markActiveRange(timeframesEl, state.range);
  applyTheme();
}

// ----- chart + analysis -----
let historyRequestId = 0; // guards against out-of-order responses

function clearChartArea(message = "") {
  clearChart();
  analysisEl.innerHTML = "";
  chartMsg.textContent = message;
}

async function loadHistory() {
  const symbol = state.selected;
  if (!symbol) return clearChartArea("Add a stock to see its chart.");
  const myId = ++historyRequestId;

  chartMsg.textContent = "Loading chart…";
  try {
    const { points } = await fetchHistory(symbol, state.range); // cached in api.js
    if (myId !== historyRequestId) return;

    if (points.length < 2)
      return clearChartArea("Not enough data to draw a chart.");
    chartMsg.textContent = "";

    const closes = points.map((p) => p.close);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    drawChart(canvas, points, symbol, [
      { label: "SMA 20", data: sma20, color: "#f59e0b" },
      { label: "SMA 50", data: sma50, color: "#6b8cff" },
    ]);

    // Screen-reader description of the chart
    canvas.setAttribute(
      "aria-label",
      `${symbol.replace(/\.(NS|BO)$/, "")} closing price over ${RANGE_NAMES[state.range]}: from ₹${closes[0].toFixed(2)} to ₹${closes[closes.length - 1].toFixed(2)}`,
    );

    const changes = dailyChanges(closes);
    renderAnalysis(analysisEl, {
      stats: periodStats(points),
      rsi: rsi(closes, 14),
      signal: trendSignal(closes[closes.length - 1], sma50[sma50.length - 1]),
      bestDay: changes.length ? Math.max(...changes) : null,
      worstDay: changes.length ? Math.min(...changes) : null,
      hasSma: sma50.some((v) => v != null),
    });
  } catch (err) {
    if (myId !== historyRequestId) return;
    clearChartArea(`Chart unavailable: ${err.message}`);
  }
}

function selectStock(symbol) {
  state.selected = symbol;
  render();
  loadHistory();
}

// ----- quotes -----
async function load() {
  state.loading = true;
  state.error = "";
  render();
  let firstSelection = false;
  try {
    const [stocks, idx] = await Promise.all([
      state.watchlist.length
        ? fetchQuotes(state.watchlist)
        : Promise.resolve({ quotes: [], errors: [] }),
      fetchQuotes(INDICES.map((i) => i.symbol)),
    ]);
    state.quotes = stocks.quotes;
    state.indices = idx.quotes;
    state.updatedAt = new Date();
    if (!state.selected && state.quotes.length) {
      state.selected = state.quotes[0].symbol;
      firstSelection = true;
    }
    if (stocks.errors.length)
      state.error = `Could not load: ${stocks.errors.map((e) => e.symbol).join(", ")}`;
  } catch (err) {
    state.error = err.message;
    console.error(err);
  } finally {
    state.loading = false;
    render();
  }
  if (firstSelection) loadHistory();
}

// ----- watchlist actions -----
async function addToWatchlist(symbol) {
  symbol = symbol.toUpperCase();
  closeSuggestions();
  state.query = "";
  input.value = "";

  if (!SYMBOL_RE.test(symbol)) {
    state.error = "That doesn't look like a valid symbol.";
    return render();
  }
  if (state.watchlist.includes(symbol)) return selectStock(symbol);
  if (state.watchlist.length >= MAX_WATCHLIST) {
    state.error = `Watchlist is full (max ${MAX_WATCHLIST}). Remove one first.`;
    return render();
  }

  state.watchlist.push(symbol);
  await load();
  if (state.quotes.some((s) => s.symbol === symbol)) {
    savePref("watchlist", state.watchlist);
    selectStock(symbol);
  } else {
    state.watchlist = state.watchlist.filter((s) => s !== symbol); // undo: it didn't work
    state.error = `Symbol "${symbol}" not found.`;
    render();
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((s) => s !== symbol);
  state.quotes = state.quotes.filter((s) => s.symbol !== symbol);
  savePref("watchlist", state.watchlist);

  if (state.selected === symbol) {
    state.selected = visibleStocks()[0]?.symbol ?? null;
    render();
    loadHistory();
  } else {
    render();
  }
  listEl.querySelector(".stock-row")?.focus(); // keep keyboard users oriented
}

// ----- search suggestions (debounced) -----
let searchId = 0;
function closeSuggestions() {
  state.suggestions = [];
  renderSuggestions(suggEl, []);
}

const runSearch = debounce(async (q) => {
  if (q.length < 2) return closeSuggestions();
  const myId = ++searchId;
  try {
    const { results } = await searchSymbols(q);
    if (myId !== searchId) return; // a newer search is already running
    state.suggestions = results.filter(
      (r) => !state.watchlist.includes(r.symbol),
    );
  } catch {
    state.suggestions = [];
  }
  renderSuggestions(suggEl, state.suggestions);
}, 350);

// ----- events -----
input.addEventListener("input", () => {
  state.query = input.value;
  render(); // local filter: instant
  runSearch(input.value.trim()); // network lookup: waits until typing pauses
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    input.value = "";
    state.query = "";
    closeSuggestions();
    render();
  }
});

document.addEventListener("click", (e) => {
  if (!form.contains(e.target)) closeSuggestions();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  const match = visibleStocks()[0];
  if (match) {
    closeSuggestions();
    return selectStock(match.symbol);
  }
  if (state.suggestions[0]) return addToWatchlist(state.suggestions[0].symbol);
  const up = q.toUpperCase();
  addToWatchlist(up.includes(".") ? up : `${up}.NS`);
});

suggEl.addEventListener("click", (e) => {
  const b = e.target.closest(".suggestion");
  if (b) addToWatchlist(b.dataset.symbol);
});

sortBar.addEventListener("click", (e) => {
  const b = e.target.closest(".sort-btn");
  if (!b) return;
  state.sortKey = b.dataset.sort;
  render();
});

listEl.addEventListener("click", (e) => {
  const rm = e.target.closest(".remove-btn");
  if (rm) return removeFromWatchlist(rm.dataset.remove);
  const row = e.target.closest(".stock-row");
  if (row) selectStock(row.dataset.symbol);
});

timeframesEl.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.range = b.dataset.range;
  savePref("range", state.range);
  render();
  loadHistory();
});

themeBtn.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  savePref("theme", state.theme);
  applyTheme();
  loadHistory(); // redraw chart with the new theme colors (data comes from cache)
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset the watchlist to the default stocks?")) return;
  state.watchlist = [...WATCHLIST];
  savePref("watchlist", state.watchlist);
  state.selected = null;
  state.quotes = [];
  load();
});

// ----- start -----
pruneCache();
applyTheme();
load();
setInterval(() => {
  if (isMarketOpen() && !document.hidden) load();
}, REFRESH_MS);

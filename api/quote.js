// Runs on Vercel's server, not in the browser.
// Browser calls: /api/quote?symbols=RELIANCE.NS,TCS.NS,^NSEI
// Environment variable with a safe default. Set CACHE_SECONDS in Vercel to change it.
const CACHE_SECONDS = Number(process.env.CACHE_SECONDS) || 60;
const YF = "https://query1.finance.yahoo.com/v8/finance/chart/";

async function getQuote(symbol) {
  const url = `${YF}${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("Symbol not found");

  const m = result.meta;
  const q = result.indicators?.quote?.[0] ?? {};
  const price = m.regularMarketPrice;
  const prevClose = m.chartPreviousClose ?? m.previousClose;

  return {
    symbol,
    name: m.shortName || m.longName || symbol,
    price,
    prevClose,
    change: price - prevClose,
    changePct: ((price - prevClose) / prevClose) * 100,
    open: q.open?.[0] ?? null,
    high: m.regularMarketDayHigh ?? null,
    low: m.regularMarketDayLow ?? null,
    volume: m.regularMarketVolume ?? null,
    currency: m.currency,
    time: m.regularMarketTime, // unix seconds
  };
}

module.exports = async (req, res) => {
  const symbols = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 25);

  // Validate input: never trust what the browser sends
  if (symbols.length === 0 || !symbols.every((s) => /^[\w.&^-]{1,20}$/.test(s))) {
    return res.status(400).json({ error: "Provide valid ?symbols=A.NS,B.NS" });
  }

  const settled = await Promise.allSettled(symbols.map(getQuote));
  const quotes = [];
  const errors = [];
  settled.forEach((r, i) =>
    r.status === "fulfilled"
      ? quotes.push(r.value)
      : errors.push({ symbol: symbols[i], message: r.reason.message })
  );

  // Cache at Vercel's edge for 60s so we don't hammer Yahoo
  res.setHeader("Cache-Control", `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`);
  res.status(200).json({ quotes, errors });
};
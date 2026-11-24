// Browser calls: /api/history?symbol=TCS.NS&range=1mo
const ALLOWED_RANGES = ["5d", "1mo", "6mo", "1y"]; // whitelist: never pass raw input along

module.exports = async (req, res) => {
  const symbol = String(req.query.symbol || "").trim();
  const range = String(req.query.range || "1mo");

  if (!/^[\w.&^-]{1,20}$/.test(symbol) || !ALLOWED_RANGES.includes(range)) {
    return res.status(400).json({ error: "Invalid symbol or range" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`Data provider error (${r.status})`);

    const result = (await r.json()).chart?.result?.[0];
    if (!result?.timestamp) throw new Error("No history found for this symbol");

    const q = result.indicators.quote[0];
    // Yahoo uses null for days with missing data, so drop those
    const points = result.timestamp
      .map((t, i) => ({ t: t * 1000, close: q.close[i], volume: q.volume[i] }))
      .filter((p) => p.close != null);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.status(200).json({ symbol, range, points });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

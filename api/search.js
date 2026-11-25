// Browser calls: /api/search?q=zomato  -> NSE/BSE stock suggestions
module.exports = async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 40);
  if (q.length < 2 || !/^[\w .&'-]+$/.test(q)) {
    return res.status(400).json({ error: "Invalid query" });
  }
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`Data provider error (${r.status})`);
    const json = await r.json();

    const results = (json.quotes || [])
      .filter((x) => x.quoteType === "EQUITY" && /\.(NS|BO)$/.test(x.symbol || ""))
      .slice(0, 6)
      .map((x) => ({
        symbol: x.symbol,
        name: x.shortname || x.longname || x.symbol,
        exchange: x.symbol.endsWith(".NS") ? "NSE" : "BSE",
      }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
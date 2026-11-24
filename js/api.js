// api.js: the only file that talks to the network.
export async function fetchQuotes(symbols) {
  const url = `/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json(); // { quotes: [...], errors: [...] }
}

export async function fetchHistory(symbol, range) {
  const url = `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data; // { symbol, range, points: [{ t, close, volume }] }
}

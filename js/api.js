// api.js: the only file that talks to the network. Responses are cached with a timestamp.
import { cacheGet, cacheSet } from "./storage.js";

const QUOTE_TTL = 30 * 1000; // live prices: reuse for 30 seconds
const HISTORY_TTL = 5 * 60 * 1000; // daily history: reuse for 5 minutes

export async function fetchQuotes(symbols) {
  const key = "quotes:" + symbols.join(",");
  const cached = cacheGet(key, QUOTE_TTL);
  if (cached) return cached;

  const res = await fetch(
    `/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  const data = await res.json();
  if (data.quotes.length > 0) cacheSet(key, data); // never cache an empty/failed result
  return data;
}

export async function fetchHistory(symbol, range) {
  const key = `history:${symbol}:${range}`;
  const cached = cacheGet(key, HISTORY_TTL);
  if (cached) return cached;

  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  cacheSet(key, data);
  return data; // { symbol, range, points: [...] }
}

export async function searchSymbols(query) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data; // { results: [{ symbol, name, exchange }] }
}

// api.js: the only file that talks to the network.
export async function fetchQuotes(symbols) {
  const url = `/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json(); // { quotes: [...], errors: [...] }
}
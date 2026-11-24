// Config only. NO API KEYS HERE: this file is public once deployed.
// .NS = NSE, .BO = BSE. Add or remove symbols freely.
export const INDICES = [
  { symbol: "^NSEI", label: "Nifty 50" },
  { symbol: "^BSESN", label: "Sensex" },
  { symbol: "^NSEBANK", label: "Bank Nifty" },
];

export const WATCHLIST = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "ITC.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "LT.NS",
  "WIPRO.NS",
  "HINDUNILVR.NS",
  "ADANIENT.NS",
  "ASIANPAINT.NS",
  "MARUTI.NS",
  "KOTAKBANK.NS",
  "HCLTECH.NS",
];

export const REFRESH_MS = 60_000; // refresh every minute while market is open

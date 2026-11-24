// analysis.js: pure functions only. Data in, result out, no DOM, no fetch.
// Complete reference solution with explanations. Study it, then try rewriting it from memory.

/**
 * Simple Moving Average.
 * For each day, average the last `period` values.
 * sma([1,2,3,4,5], 3) -> [null, null, 2, 3, 4]
 */
export function sma(values, period) {
  return values.map((_, i) => {
    // Before we have `period` values, there is nothing to average yet
    if (i < period - 1) return null;

    // slice(start, end) copies values from start up to (not including) end.
    // Here: the `period` values ending at day i.
    const windowValues = values.slice(i - period + 1, i + 1);

    // reduce adds them all up, starting the running total at 0
    const total = windowValues.reduce((sum, v) => sum + v, 0);
    return total / period;
  });
}

/**
 * Day-over-day percentage changes (one fewer item than the input).
 * dailyChanges([100, 110, 99]) -> [10, -10]
 */
export function dailyChanges(closes) {
  const changes = [];
  // Start at 1 because day 0 has no "yesterday" to compare with
  for (let i = 1; i < closes.length; i++) {
    const yesterday = closes[i - 1];
    const today = closes[i];
    changes.push(((today - yesterday) / yesterday) * 100);
  }
  return changes;
}

/**
 * Summary of a period. points look like { t, close, volume }.
 * Returns { changePct, high, low, avgVolume }.
 */
export function periodStats(points) {
  // Guard: empty input must not crash (Math.max of nothing is -Infinity)
  if (points.length === 0) {
    return { changePct: null, high: null, low: null, avgVolume: null };
  }

  const closes = points.map((p) => p.close);
  const first = closes[0];
  const last = closes[closes.length - 1];

  // Some days have null volume; skip those so they don't ruin the average
  const volumes = points.map((p) => p.volume).filter((v) => v != null);
  const avgVolume =
    volumes.length > 0
      ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length
      : null;

  return {
    changePct: ((last - first) / first) * 100,
    high: Math.max(...closes), // "..." spreads the array into separate arguments
    low: Math.min(...closes),
    avgVolume,
  };
}

/**
 * RSI (simple version), latest value only. Returns 0-100, or null if not enough data.
 * Above 70 is often called "overbought", below 30 "oversold".
 */
export function rsi(closes, period = 14) {
  // To get `period` price changes we need period + 1 closes
  if (closes.length < period + 1) return null;

  const recent = closes.slice(-(period + 1)); // the last period+1 closes

  let gains = 0;
  let losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff; // diff is negative, so this ADDS a positive number
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100; // no losses (or no movement at all)

  const rs = avgGain / avgLoss; // "relative strength"
  return 100 - 100 / (1 + rs);
}

/**
 * Very simple trend label. Informational only, NOT advice.
 */
export function trendSignal(price, smaValue) {
  if (smaValue == null) return "Insufficient data";
  if (price > smaValue) return "Bullish";
  if (price < smaValue) return "Bearish";
  return "Neutral";
}

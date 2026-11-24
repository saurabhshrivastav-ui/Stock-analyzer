// analysis.js: pure functions only. Data in, result out, no DOM, no fetch.
// YOUR JOB: replace each stub body with a real implementation.
// Open tests.html in the browser. Red = not done yet, green = done.

/**
 * Simple Moving Average.
 * Returns an array THE SAME LENGTH as `values`.
 * The first (period - 1) entries are null (not enough data yet).
 * sma([1,2,3,4,5], 3) -> [null, null, 2, 3, 4]
 *
 * Hint: for each index i >= period-1, average values[i-period+1 .. i].
 * Start with a loop + slice + reduce. (Stretch: do it with a running sum.)
 */
export function sma(values, period) {
  return values.map(() => null); // TODO
}

/**
 * Day-over-day percentage changes.
 * Returns an array one shorter than `closes`.
 * dailyChanges([100, 110, 99]) -> [10, -10]
 *
 * Hint: change = (today - yesterday) / yesterday * 100
 */
export function dailyChanges(closes) {
  return []; // TODO
}

/**
 * Summary of a period. `points` look like { t, close, volume }.
 * Returns { changePct, high, low, avgVolume }
 *   changePct = % change from the FIRST close to the LAST close
 *   high / low = highest / lowest close
 *   avgVolume = average volume (ignore points where volume is null)
 *
 * Hint: Math.max(...array) and Math.min(...array). Use reduce for the average.
 * Return all-null values if points is empty.
 */
export function periodStats(points) {
  return { changePct: null, high: null, low: null, avgVolume: null }; // TODO
}

/**
 * RSI (Relative Strength Index), latest value only. Default period 14.
 * Returns a number 0-100, or null if there are fewer than period + 1 closes.
 *
 * Hint (simple version):
 *   1. Take the last `period` daily changes (price differences are fine).
 *   2. avgGain = average of the positive ones (negatives count as 0 gain)
 *      avgLoss = average of the negative ones, as positive numbers
 *   3. If avgLoss is 0 -> return 100
 *   4. RS = avgGain / avgLoss ;  RSI = 100 - 100 / (1 + RS)
 * Stretch: Wilder's smoothing, which is what trading platforms use.
 */
export function rsi(closes, period = 14) {
  return null; // TODO
}

/**
 * Very simple trend label. Informational only, NOT advice.
 * Returns "Bullish" if price > smaValue, "Bearish" if price < smaValue,
 * "Neutral" if equal, and "Insufficient data" if smaValue is null.
 */
export function trendSignal(price, smaValue) {
  return "Insufficient data"; // TODO
}

// storage.js: safe wrappers around localStorage + a tiny timestamped cache.
// localStorage can be blocked (private mode) or full, so every call is in try/catch.
const PREFIX = "sa:";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw); // stored as text, so parse it back
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value)); // only text can be stored
  } catch {
    /* storage full or blocked: the app still works, it just won't remember */
  }
}

// ----- cache: { t: timestamp, v: value } -----
export function cacheGet(key, maxAgeMs) {
  const entry = load("cache:" + key, null);
  if (!entry || typeof entry.t !== "number") return null;
  return Date.now() - entry.t <= maxAgeMs ? entry.v : null; // too old = treat as missing
}

export function cacheSet(key, value) {
  save("cache:" + key, { t: Date.now(), v: value });
}

// Remove old cache entries so storage doesn't fill up over time
export function pruneCache(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX + "cache:")) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(k));
        if (!entry || Date.now() - entry.t > maxAgeMs) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k); // corrupt entry
      }
    }
  } catch { /* ignore */ }
}
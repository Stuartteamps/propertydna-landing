/**
 * _cache.js — Public data cache wrapper for Netlify functions
 *
 * Wraps any async fetch function with a Supabase `public_data_cache` look-up
 * so that slow, rate-limited, or frequently re-fetched public API responses
 * (FRED, BLS, NOAA, FBI, AirNow, HUD FMR) are served from the DB on repeat
 * requests within the TTL window.
 *
 * TABLE: public_data_cache  (migration 035 — may not yet be applied)
 *   cache_key  TEXT PRIMARY KEY
 *   source     TEXT NOT NULL
 *   data       JSONB NOT NULL
 *   fetched_at TIMESTAMPTZ DEFAULT now()
 *   expires_at TIMESTAMPTZ NOT NULL
 *
 * GRACEFUL DEGRADATION: if the table does not exist, any Supabase call returns
 * a 4xx/5xx error which is caught here. The function simply falls through to
 * the live fetch and returns the live result. Cache writes are fire-and-forget
 * and never block the return value.
 *
 * Usage example in enrich-property.js:
 *   const { cachedFetch } = require("./_cache");
 *
 *   const fredResult = await cachedFetch(
 *     "fred_macro_weekly",   // cache key
 *     "fred",                // source label
 *     7,                     // TTL in days
 *     () => fetchFRED()      // live-fetch function, must return { status, data }
 *   );
 *
 * The live fetch function must return an object with at minimum a `status`
 * field equal to `"success"` when data is available. Any other status causes
 * the result to be returned as-is without caching.
 */

"use strict";

const db = require("./_supabase");

/**
 * Fetch `key` from the cache, or call `fetchFn()` if the cache entry is absent
 * or expired, then store the fresh result for future calls.
 *
 * @param {string}   key      Unique cache key, e.g. "bls_unemp_CA_2026-06"
 * @param {string}   source   Human-readable source label stored in the DB row
 * @param {number}   ttlDays  How many days the cached value should be kept
 * @param {Function} fetchFn  Async function that fetches the live value.
 *                            Must return { status: "success", data: <any> }
 *                            on success; any other value is not cached.
 * @returns {*} The result object from either the cache or the live fetch.
 */
async function cachedFetch(key, source, ttlDays, fetchFn) {
  // 1. Check cache (table may not exist → caught below)
  try {
    const rows = await db
      .from("public_data_cache")
      .select("data")
      .eq("cache_key", key)
      .gte("expires_at", new Date().toISOString())  // .gt() not in _supabase.js; .gte() is equivalent here
      .limit(1)
      .get();

    const row = Array.isArray(rows) ? rows[0] : null;
    if (row && row.data !== undefined) {
      return { status: "success", data: row.data, cached: true };
    }
  } catch {
    // Table absent (migration 035 not applied) or network error — fall through to live fetch.
    // Never throw: graceful degradation is the contract.
  }

  // 2. Fetch live data
  let result;
  try {
    result = await fetchFn();
  } catch (e) {
    return { status: "error", error: String(e?.message || e) };
  }

  // 3. Store result if successful (fire-and-forget — never blocks return value)
  if (result && result.status === "success") {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    db.upsert(
      "public_data_cache",
      {
        cache_key:  key,
        source,
        data:       result.data,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      "cache_key"
    ).catch(() => {
      // Table absent or upsert error — silently ignore.
      // The live result is already being returned to the caller.
    });
  }

  return result;
}

module.exports = { cachedFetch };

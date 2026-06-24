/**
 * pull-solds.js — back-test ground-truth ingestion.
 *
 * Pulls recently SOLD listings from RentCast for a given market
 * (city/state, or zip), and writes them to:
 *   - `properties`            (one row per address; back-test's ground-truth
 *                              source — last_sale_price + last_sale_date)
 *   - `property_history`      (one row per sale event; APN-keyed when we can
 *                              resolve APN via property_master lookup)
 *
 * Why this exists: as of 2026-06-23, property_history has 0 sale events and
 * the `properties` ground-truth table has 12 hand-curated rows. The
 * backtest-accuracy function can't return real numbers until we populate
 * either of those tables. See memory/valuation_phase1_baseline.md.
 *
 * Idempotent:
 *   - properties: upsert on (address, city, state, zip)
 *   - property_history: skip if (apn, event_type='sale', event_date) already
 *     exists for the same price
 *
 * Auth: POST + x-internal-key (same pattern as state indexers).
 * Body:
 *   {
 *     "city":     "Palm Springs",       // OR
 *     "zip":      "92262",              // (one of these is required)
 *     "state":    "CA",                 // required for city searches
 *     "limit":    500,                  // RentCast page size, default 500, max 500
 *     "offset":   0,                    // pagination cursor
 *     "daysBack": 365,                  // only ingest sales within this window
 *     "dryRun":   false,                // if true, fetch + count but no writes
 *     "saleTypes": ["Sold"],            // RentCast status filter; default ["Sold"]
 *     "minPrice": 50000,                // suppress junk transfers
 *   }
 *
 * Returns: { fetched, written_properties, written_history, skipped,
 *            errors, nextOffset, done, city|zip, marketStats }
 *
 * Cron: can be scheduled per market. See netlify.toml.
 */
const https = require("https");
const db = require("./_supabase");

const RC_BASE = "api.rentcast.io";
const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;
const RC_KEY   = process.env.RENTCAST_API_KEY;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const reply = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function rentcastGet(path, timeoutMs = 18000) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: RC_BASE, path, method: "GET",
      headers: {
        "X-Api-Key": RC_KEY,
        "Accept": "application/json",
        "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)",
      },
    }, (res) => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ statusCode: res.statusCode, data: null, raw }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("rentcast timeout")); });
    req.on("error", reject);
    req.end();
  });
}

function supaReq(path, init = {}) {
  return fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== "") p.append(k, String(v));
  }
  return "?" + p.toString();
}

// ── Listing → row mapping ────────────────────────────────────────────────────
// RentCast /v1/listings/sale returns fields like:
//   id, formattedAddress, addressLine1, addressLine2, city, state, zipCode,
//   propertyType, bedrooms, bathrooms, squareFootage, lotSize, yearBuilt,
//   latitude, longitude, hoa.fee, price, status ("Active"|"Sold"|...),
//   listedDate, removedDate, lastSeenDate, daysOnMarket, mlsName, mlsNumber,
//   listingType, listingAgent, listingOffice, history (object keyed by date)
//
// For Sold listings the `removedDate` is typically the sale-close date and
// `price` is the closing/list price. RentCast does not always distinguish
// closing price from list price — we treat `price` as the best-available
// sale price and tag the data so we can filter later if needed.

function buildPropertyRow(L) {
  const addr1 = L.addressLine1 || L.formattedAddress || null;
  if (!addr1) return null;
  return {
    address:               addr1,
    unit:                  L.addressLine2 || null,
    city:                  L.city || null,
    state:                 L.state || null,
    zip:                   L.zipCode ? String(L.zipCode).slice(0, 5) : null,
    apn:                   null, // resolved separately if found in property_master
    property_type_raw:     L.propertyType || null,
    property_type_normalized: L.propertyType || null,
    beds:                  L.bedrooms != null ? Math.round(L.bedrooms) : null,
    baths:                 L.bathrooms != null ? Math.round(L.bathrooms) : null,
    sqft:                  L.squareFootage || null,
    lot_sqft:              L.lotSize || null,
    year_built:            L.yearBuilt || null,
    hoa_monthly:           L.hoa?.fee || null,
    latitude:              L.latitude || null,
    longitude:             L.longitude || null,
    last_sale_date:        L.removedDate || L.lastSeenDate || L.listedDate || null,
    last_sale_price:       L.price ? Math.round(L.price) : null,
    current_estimated_value: null, // RentCast listings don't carry an estimate
    confidence_score:      null,
    mls_number:            L.mlsNumber || null,
    listing_source:        L.mlsName || L.listingType || "rentcast_listings",
    mls_raw_data:          { listingId: L.id, status: L.status, daysOnMarket: L.daysOnMarket },
    mls_enrichment_status: "from_listings_feed",
    updated_at:            new Date().toISOString(),
  };
}

// Lookup APN in property_master by address+city+state+zip. Best-effort —
// returns null if no exact match (very common at 10M parcels with messy
// address spelling). The property_history row simply won't be written when
// APN is null; the `properties` row is still written.
async function resolveApn(row) {
  if (!row?.address || !row?.city || !row?.state) return null;
  const url = `/rest/v1/property_master?select=apn`
    + `&address=ilike.${encodeURIComponent(row.address)}`
    + `&city=ilike.${encodeURIComponent(row.city)}`
    + `&state=eq.${encodeURIComponent(row.state)}`
    + (row.zip ? `&zip=eq.${encodeURIComponent(row.zip)}` : "")
    + `&limit=1`;
  try {
    const r = await supaReq(url);
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.apn || null;
  } catch { return null; }
}

// Check whether (apn, sale, event_date) already exists with same/similar price
// to keep this idempotent on re-runs.
async function saleEventExists(apn, eventDate, price) {
  if (!apn || !eventDate) return false;
  const url = `/rest/v1/property_history?select=id,data`
    + `&apn=eq.${encodeURIComponent(apn)}`
    + `&event_type=eq.sale`
    + `&event_date=eq.${encodeURIComponent(eventDate)}`
    + `&limit=1`;
  try {
    const r = await supaReq(url);
    if (!r.ok) return false;
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return false;
    // If exists at all on that date, treat as duplicate (price drift small
    // doesn't matter — we don't want to bloat property_history).
    return true;
  } catch { return false; }
}

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return reply(405, { error: "POST only" });

  // Auth — same x-internal-key gate as the state indexers
  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return reply(401, { error: "unauthorized" });
  }
  if (!RC_KEY)   return reply(500, { error: "RENTCAST_API_KEY not configured" });
  if (!SUPA_KEY) return reply(500, { error: "SUPABASE_SERVICE_KEY not configured" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const city      = body.city ? String(body.city).trim() : null;
  const stateAbbr = body.state ? String(body.state).trim().toUpperCase() : null;
  const zip       = body.zip ? String(body.zip).trim() : null;
  const limit     = Math.min(Math.max(parseInt(body.limit || 500, 10), 1), 500);
  const offset    = Math.max(parseInt(body.offset || 0, 10), 0);
  const daysBack  = Math.min(Math.max(parseInt(body.daysBack || 365, 10), 1), 1825);
  const minPrice  = Math.max(parseInt(body.minPrice || 50000, 10), 0);
  const dryRun    = body.dryRun === true;
  const saleTypes = Array.isArray(body.saleTypes) && body.saleTypes.length
    ? body.saleTypes
    : ["Sold"];

  if (!zip && !(city && stateAbbr)) {
    return reply(400, { error: "city+state OR zip required" });
  }

  const cutoffMs = Date.now() - (daysBack * 86400 * 1000);

  // 1. Fetch one page of sold listings from RentCast.
  const rcParams = { limit, offset, status: saleTypes.join(",") };
  if (zip)       rcParams.zipCode = zip;
  if (city)      rcParams.city = city;
  if (stateAbbr) rcParams.state = stateAbbr;

  let listings = [];
  let rcError = null;
  try {
    const res = await rentcastGet(`/v1/listings/sale${qs(rcParams)}`);
    if (res.statusCode !== 200) {
      rcError = `RentCast ${res.statusCode}: ${(res.raw || JSON.stringify(res.data || {})).slice(0, 180)}`;
    } else if (Array.isArray(res.data)) {
      listings = res.data;
    }
  } catch (e) {
    rcError = `RentCast error: ${String(e?.message || e).slice(0, 180)}`;
  }
  if (rcError) return reply(502, { error: rcError, market: { city, state: stateAbbr, zip } });

  // 2. Walk results — filter by recency + minPrice, then upsert.
  const stats = {
    fetched: listings.length,
    in_window: 0,
    rejected_minprice: 0,
    rejected_window: 0,
    rejected_missing_fields: 0,
    written_properties: 0,
    written_history: 0,
    history_skipped_dupe: 0,
    history_skipped_no_apn: 0,
    errors: [],
  };

  for (const L of listings) {
    if (!L) continue;
    const eventDate = L.removedDate || L.lastSeenDate || L.listedDate || null;
    const price     = L.price ? Number(L.price) : null;
    if (!eventDate || !price) { stats.rejected_missing_fields++; continue; }
    const eventMs = Date.parse(eventDate);
    if (isNaN(eventMs) || eventMs < cutoffMs) { stats.rejected_window++; continue; }
    if (price < minPrice) { stats.rejected_minprice++; continue; }
    stats.in_window++;

    if (dryRun) continue;

    // 2a. Upsert into `properties` (back-test ground-truth source)
    const row = buildPropertyRow(L);
    if (!row) { stats.rejected_missing_fields++; continue; }

    try {
      // Manual upsert on (address, city, state, zip) — postgrest on_conflict
      // requires a unique constraint we may not have, so do select-or-insert.
      const existsResp = await supaReq(
        `/rest/v1/properties?select=id&address=eq.${encodeURIComponent(row.address)}`
        + `&city=eq.${encodeURIComponent(row.city)}`
        + `&state=eq.${encodeURIComponent(row.state)}`
        + (row.zip ? `&zip=eq.${row.zip}` : "")
        + `&limit=1`
      );
      const existing = existsResp.ok ? await existsResp.json() : [];

      if (Array.isArray(existing) && existing.length > 0) {
        // Update — only overwrite last_sale_* (preserve other fields)
        const id = existing[0].id;
        await supaReq(`/rest/v1/properties?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            last_sale_date:  row.last_sale_date,
            last_sale_price: row.last_sale_price,
            beds:            row.beds || undefined,
            baths:           row.baths || undefined,
            sqft:            row.sqft || undefined,
            year_built:      row.year_built || undefined,
            property_type_raw: row.property_type_raw || undefined,
            mls_number:      row.mls_number || undefined,
            listing_source:  row.listing_source || undefined,
            mls_raw_data:    row.mls_raw_data,
            updated_at:      row.updated_at,
          }),
        });
      } else {
        // Insert
        await supaReq(`/rest/v1/properties`, {
          method: "POST",
          body: JSON.stringify(row),
        });
      }
      stats.written_properties++;
    } catch (e) {
      stats.errors.push(`properties write: ${String(e?.message || e).slice(0, 120)}`);
    }

    // 2b. Try APN lookup → write property_history (best-effort)
    const apn = await resolveApn(row);
    if (!apn) { stats.history_skipped_no_apn++; continue; }

    const eventDateStr = (eventDate || "").slice(0, 10);
    const dup = await saleEventExists(apn, eventDateStr, price);
    if (dup) { stats.history_skipped_dupe++; continue; }

    try {
      await supaReq(`/rest/v1/property_history`, {
        method: "POST",
        body: JSON.stringify({
          apn,
          event_type: "sale",
          event_date: eventDateStr,
          data: {
            price,
            address: row.address,
            city: row.city,
            state: row.state,
            zip: row.zip,
            source: "rentcast_listings_feed",
            mlsNumber: L.mlsNumber || null,
            status: L.status || null,
            daysOnMarket: L.daysOnMarket || null,
          },
        }),
      });
      stats.written_history++;
    } catch (e) {
      stats.errors.push(`history write apn=${apn}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }

  // 3. KPI breadcrumb so we can see runs in kpi_events
  db.kpi("solds_pull", `solds:${city || ""}|${stateAbbr || ""}|${zip || ""}`, {
    city, state: stateAbbr, zip, ...stats, offset, limit, daysBack, dryRun,
  });

  const nextOffset = offset + listings.length;
  const done = listings.length < limit;

  return reply(200, {
    ok: true,
    market: { city, state: stateAbbr, zip },
    saleTypes,
    daysBack,
    offset, limit, nextOffset, done,
    ...stats,
    errors: stats.errors.slice(0, 5), // first 5 only
  });
};

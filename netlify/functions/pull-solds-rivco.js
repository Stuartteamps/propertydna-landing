/**
 * pull-solds-rivco.js — Free replacement for RentCast pull-solds.js (Riverside County)
 *
 * Pulls recently sold properties from the Riverside County Assessor CREST public
 * ArcGIS service (no API key, no cost) and writes to:
 *   - `properties`        (upsert on APN — back-test ground truth)
 *   - `property_history`  (one row per sale event, event_type='sale')
 *
 * CREST endpoint (Layer 50 — Assessor summary with last-sale fields):
 *   https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query
 *
 * DEPENDENCY: `properties` upsert relies on a UNIQUE constraint on the `apn`
 * column. PostgREST returns 400 on on_conflict if the constraint is absent;
 * errors are caught per-record (never fatal). property_history dedup relies on
 * a UNIQUE constraint on (apn, event_type, event_date); inserts silently skip
 * on conflict.
 *
 * POST /.netlify/functions/pull-solds-rivco
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body:
 *   {
 *     "city":    "Palm Springs",   // SITUS_CITY to filter (case-insensitive)
 *     "daysBack": 365,             // only ingest sales within this window
 *     "offset":   0,               // ArcGIS resultOffset for pagination
 *     "limit":    1000,            // records per page (max 2000)
 *     "dryRun":   false            // if true, fetch + count but no writes
 *   }
 *
 * Returns: { ok, fetched, written_properties, written_history, skipped,
 *            errors, nextOffset, done, city, daysBack, cutoff, dryRun, source }
 */

"use strict";

const https = require("https");
const db    = require("./_supabase");

const CREST_HOST = "gis.countyofriverside.us";
const CREST_PATH = "/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const reply = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * GET a page of features from CREST ArcGIS Layer 50.
 * All parameters are passed as query-string to the ArcGIS REST endpoint.
 */
function crestGet(params, timeoutMs = 25000) {
  const qs = new URLSearchParams({
    f: "json",
    outFields: "*",
    returnGeometry: "false",
    ...params,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: CREST_HOST,
        path: `${CREST_PATH}?${qs}`,
        method: "GET",
        headers: { "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)" },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ statusCode: res.statusCode, data: null, raw });
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("CREST timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Return a YYYY-MM-DD cutoff string for the ArcGIS WHERE clause.
 */
function cutoffDateStr(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse an ArcGIS date attribute into a YYYY-MM-DD string.
 *
 * ArcGIS date fields are returned as epoch milliseconds (number). Some older
 * or manually-typed string fields may return 'YYYY-MM-DD' strings. Both cases
 * are handled so that writing garbage like "1719532800" to event_date is
 * impossible.
 */
function parseArcGISDate(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    // Epoch milliseconds → ISO date
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // If it already looks like YYYY-MM-DD or YYYY/MM/DD, normalise it.
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  // Fallback: try Date.parse on whatever string we got
  const ts = Date.parse(s);
  return isNaN(ts) ? null : new Date(ts).toISOString().slice(0, 10);
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return reply(405, { error: "POST only" });

  // Auth — same x-internal-key gate as the state indexers
  const internalKey =
    event.headers["x-internal-key"] || event.headers["X-Internal-Key"] || "";
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return reply(401, { error: "unauthorized" });
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {
    return reply(400, { error: "invalid JSON body" });
  }

  const city    = (body.city ? String(body.city).trim() : "PALM SPRINGS").toUpperCase();
  const daysBack = Math.min(Math.max(parseInt(body.daysBack || 365, 10), 1), 1825);
  const offset   = Math.max(parseInt(body.offset  || 0,    10), 0);
  const limit    = Math.min(Math.max(parseInt(body.limit   || 1000, 10), 1), 2000);
  const dryRun   = body.dryRun === true;

  const cutoff = cutoffDateStr(daysBack);

  // ArcGIS WHERE clause.
  // DATE literal syntax works for both Date-type fields (epoch-ms storage) and
  // text fields; bare string comparison like >= '2025-06-28' only works safely
  // for text fields. We use DATE literal to cover both cases.
  const escapedCity = city.replace(/'/g, "''");
  const where = `SITUS_CITY = '${escapedCity}' AND LAST_SALE_DATE >= DATE '${cutoff}' AND LAST_SALE_AMOUNT > 50000`;

  let crestResult;
  try {
    crestResult = await crestGet({
      where,
      resultOffset: String(offset),
      resultRecordCount: String(limit),
    });
  } catch (e) {
    return reply(502, { error: `CREST fetch failed: ${String(e.message).slice(0, 200)}` });
  }

  if (!crestResult.data?.features) {
    return reply(502, {
      error: "CREST returned no features array",
      crestStatus: crestResult.statusCode,
      crestError: crestResult.data?.error || null,
    });
  }

  const features = crestResult.data.features;
  const stats = {
    fetched:           features.length,
    written_properties: 0,
    written_history:   0,
    skipped:           0,
    errors:            [],
  };

  for (const feat of features) {
    const attr = feat?.attributes;
    if (!attr) { stats.skipped++; continue; }

    const apn       = attr.APN ? String(attr.APN).trim() : null;
    const saleDate  = parseArcGISDate(attr.LAST_SALE_DATE);
    const salePrice = attr.LAST_SALE_AMOUNT != null ? Number(attr.LAST_SALE_AMOUNT) : null;
    const address   = attr.SITUS_ADDR ? String(attr.SITUS_ADDR).trim() : null;

    if (!apn || !saleDate || !salePrice || salePrice < 50000) {
      stats.skipped++;
      continue;
    }

    if (dryRun) continue;

    // ── Write to `properties` ──────────────────────────────────────────────
    // Requires a UNIQUE constraint on `apn` for on_conflict upsert to work.
    // If the constraint is absent, PostgREST returns 400 which is caught here.
    await db
      .upsert(
        "properties",
        {
          apn,
          address:            address || null,
          city:               attr.SITUS_CITY  ? String(attr.SITUS_CITY).trim()  : city,
          state:              "CA",
          zip:                attr.SITUS_ZIP   ? String(attr.SITUS_ZIP).slice(0, 5) : null,
          beds:               attr.BEDROOMS    != null ? Number(attr.BEDROOMS)   : null,
          baths:              attr.BATHROOMS   != null ? Number(attr.BATHROOMS)  : null,
          sqft:               attr.SQ_FT       != null ? Number(attr.SQ_FT)      : null,
          year_built:         attr.YEAR_BUILT  != null ? Number(attr.YEAR_BUILT) : null,
          land_value:         attr.LAND_VALUE  != null ? Number(attr.LAND_VALUE) : null,
          improvement_value:  attr.IMPROVEMENT_VALUE != null
                                ? Number(attr.IMPROVEMENT_VALUE) : null,
          assessed_value:     attr.TOTAL_VALUE != null ? Number(attr.TOTAL_VALUE): null,
          last_sale_price:    salePrice,
          last_sale_date:     saleDate,
          source:             "rivco_assessor_crest",
          updated_at:         new Date().toISOString(),
        },
        "apn"
      )
      .then(() => { stats.written_properties++; })
      .catch((e) => {
        console.warn("[pull-solds-rivco:properties upsert]", apn, e.message);
        stats.errors.push(`properties apn=${apn}: ${String(e.message).slice(0, 120)}`);
      });

    // ── Write to `property_history` ────────────────────────────────────────
    // Dedup relies on a UNIQUE constraint on (apn, event_type, event_date).
    // A constraint-violation error is caught silently and counted as skipped.
    await db
      .insert("property_history", {
        apn,
        event_type: "sale",
        event_date: saleDate,
        data: {
          price:   salePrice,
          source:  "rivco_crest",
          address: address || null,
        },
        source: "rivco_assessor_crest",
      })
      .then(() => { stats.written_history++; })
      .catch(() => { stats.skipped++; });
  }

  // KPI breadcrumb (fire-and-forget, matches pull-solds.js pattern)
  db.kpi("solds_pull_rivco", `solds_rivco:${city}`, {
    city, daysBack, offset, limit, dryRun, ...stats,
  });

  const nextOffset = features.length === limit ? offset + limit : null;

  return reply(200, {
    ok:                true,
    source:            "rivco_assessor_crest_free",
    city,
    daysBack,
    cutoff,
    dryRun,
    offset,
    limit,
    fetched:           stats.fetched,
    written_properties: stats.written_properties,
    written_history:   stats.written_history,
    skipped:           stats.skipped,
    errors:            stats.errors.slice(0, 5),
    nextOffset,
    done:              nextOffset === null,
  });
};

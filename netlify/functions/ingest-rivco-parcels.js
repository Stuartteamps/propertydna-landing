/**
 * ingest-rivco-parcels.js — Geocoded, RentCast-free parcel ingester (Riverside County)
 *
 * Populates the `properties` table (the map's primary internal source) with
 * GEOCODED residential parcels for every Coachella Valley city, so
 * get-heatmap-parcels.js shows real homes — not just Palm Springs.
 *
 * SOURCE: Riverside County Assessor CREST public ArcGIS service, Layer 50
 *   (PARCELS_CREST). No API key, no cost.
 *   https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query
 *
 * WHY THE OLD pull-solds-rivco.js WAS BROKEN
 *   1. It queried fields that DO NOT EXIST on Layer 50 (LAST_SALE_DATE,
 *      LAST_SALE_AMOUNT, SITUS_ADDR, BEDROOMS, TOTAL_VALUE, …) → ArcGIS 400
 *      "Failed to execute query".
 *   2. It used returnGeometry=false → wrote NO coordinates (null lat/lng), so
 *      rows were unmappable.
 *   3. It upserted columns that DON'T EXIST on `properties` (land_value,
 *      improvement_value, assessed_value, source) and relied on a UNIQUE
 *      constraint on `apn` that DOESN'T EXIST → silent PostgREST 400s.
 *
 * HOW THIS FIXES IT
 *   - Real Layer-50 fields: APN, SITUS_STREET, ZIP_CODE, CLASS_CODE, LAND,
 *     STRUCTURES (+ polygon SHAPE).
 *   - returnGeometry=true & outSR=4326 → polygon rings in WGS84 lon/lat;
 *     centroid = average of the outer ring's vertices.
 *   - The SITUS_CITY / CITY text fields are unusable (mailing junk, misspelled),
 *     so a parcel's city is decided SPATIALLY: each request queries the city's
 *     bounding-box envelope and stamps that city name.
 *   - value = LAND + STRUCTURES (total assessed). STRUCTURES > 0 guarantees a
 *     built home (not vacant land), so the map's price>0 filter passes.
 *   - Writes ONLY real `properties` columns. Dedup is done at page level
 *     (one apn=in.() select + one bulk insert) because `apn` has no unique
 *     constraint — so native on_conflict upsert is unavailable.
 *
 * POST /.netlify/functions/ingest-rivco-parcels
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body:
 *   {
 *     "city":   "Palm Desert",   // required — must be a known CV city (below)
 *     "offset": 0,               // ArcGIS resultOffset for pagination
 *     "limit":  500,             // records per page (max 2000)
 *     "minValue": 1,             // skip parcels with assessed value below this
 *     "dryRun": false            // fetch + count, no writes
 *   }
 *
 * Returns: { ok, city, fetched, written, existing, skipped, errors,
 *            offset, limit, nextOffset, done, sample, dryRun, source }
 */

"use strict";

const https = require("https");
const db    = require("./_supabase");

const CREST_HOST = "gis.countyofriverside.us";
const CREST_PATH = "/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query";

// City → WGS84 bounding box [lonMin, latMin, lonMax, latMax].
// Boxes are kept reasonably tight to minimise cross-city bleed; the value
// written to `properties.city` is the canonical title-case key below, which is
// what get-heatmap-parcels matches via ilike(city).
const CITY_BOXES = {
  "Palm Springs":       [-116.580, 33.770, -116.450, 33.875],
  "Cathedral City":     [-116.500, 33.740, -116.430, 33.825],
  "Rancho Mirage":      [-116.460, 33.705, -116.380, 33.785],
  "Thousand Palms":     [-116.430, 33.790, -116.335, 33.865],
  "Palm Desert":        [-116.430, 33.670, -116.300, 33.785],
  "Indian Wells":       [-116.360, 33.675, -116.290, 33.730],
  "Bermuda Dunes":      [-116.300, 33.715, -116.255, 33.760],
  "La Quinta":          [-116.330, 33.580, -116.210, 33.720],
  "Indio":              [-116.285, 33.665, -116.170, 33.785],
  "Coachella":          [-116.215, 33.620, -116.095, 33.720],
  "Desert Hot Springs": [-116.560, 33.925, -116.430, 34.005],
};

// Residential CLASS_CODE filter — captures SFD, condos, small multis and their
// MA-/CT- variants while excluding land, ag, commercial and industrial.
const RESIDENTIAL_WHERE =
  "STRUCTURES > 0 AND (" +
  "CLASS_CODE LIKE '%Dwelling%' OR " +
  "CLASS_CODE LIKE '%Condo%' OR " +
  "CLASS_CODE LIKE '%SFD%' OR " +
  "CLASS_CODE LIKE '%SFR%' OR " +
  "CLASS_CODE LIKE '%Cooperative%' OR " +
  "CLASS_CODE LIKE 'Residential%' OR " +
  "CLASS_CODE IN ('Duplex','Triplex','Fourplex','Factory Built SFD')" +
  ")";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const reply = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });

// ── HTTP helper ────────────────────────────────────────────────────────────
function crestGet(params, timeoutMs = 25000) {
  const qs = new URLSearchParams({ f: "json", ...params }).toString();
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
          try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw) }); }
          catch { resolve({ statusCode: res.statusCode, data: null, raw }); }
        });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("CREST timeout")); });
    req.on("error", reject);
    req.end();
  });
}

// ── Geometry → centroid ─────────────────────────────────────────────────────
/**
 * Average the vertices of a polygon's outer ring (ring[0]) to get a centroid
 * lon/lat. Falls back to the geometry envelope center if rings are absent.
 * Returns { lat, lon } in WGS84, or null when nothing usable is present.
 */
function centroidOf(geometry) {
  if (!geometry) return null;
  const ring = Array.isArray(geometry.rings) ? geometry.rings[0] : null;
  if (Array.isArray(ring) && ring.length) {
    // ArcGIS rings repeat the first vertex as the last — drop the duplicate so
    // it isn't double-weighted.
    const pts = ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1) : ring;
    let sx = 0, sy = 0, n = 0;
    for (const p of pts) {
      if (Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])) { sx += p[0]; sy += p[1]; n++; }
    }
    if (n) return { lat: sy / n, lon: sx / n };
  }
  if (isFinite(geometry.x) && isFinite(geometry.y)) return { lat: geometry.y, lon: geometry.x };
  return null;
}

function normPropType(classCode) {
  const c = String(classCode || "").toLowerCase();
  if (c.includes("condo") || c.includes("pud") || c.includes("cooperative")) return "Condo";
  if (c.includes("duplex") || c.includes("triplex") || c.includes("fourplex") || c.includes("apartment"))
    return "Multi-Family";
  return "Single Family";
}

// Title-case a SITUS_STREET like "44435 VIA DEL SOL" → "44435 Via Del Sol".
function titleCaseStreet(s) {
  if (!s) return null;
  return String(s).trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

// ── Handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return reply(405, { error: "POST only" });

  const internalKey =
    event.headers["x-internal-key"] || event.headers["X-Internal-Key"] || "";
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return reply(401, { error: "unauthorized" });
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); }
  catch { return reply(400, { error: "invalid JSON body" }); }

  // Resolve city to its canonical key (case-insensitive).
  const rawCity = body.city ? String(body.city).trim() : "";
  const city = Object.keys(CITY_BOXES).find((k) => k.toLowerCase() === rawCity.toLowerCase());
  if (!city) {
    return reply(400, { error: `unknown city '${rawCity}'`, validCities: Object.keys(CITY_BOXES) });
  }

  const offset   = Math.max(parseInt(body.offset || 0, 10), 0);
  const limit    = Math.min(Math.max(parseInt(body.limit || 500, 10), 1), 2000);
  const minValue = Math.max(parseInt(body.minValue || 1, 10), 0);
  const dryRun   = body.dryRun === true;
  const box      = CITY_BOXES[city];

  // ── Fetch one page from CREST (spatial envelope + residential filter) ──
  let res;
  try {
    res = await crestGet({
      where:             RESIDENTIAL_WHERE,
      geometry:          box.join(","),
      geometryType:      "esriGeometryEnvelope",
      inSR:              "4326",
      spatialRel:        "esriSpatialRelIntersects",
      outFields:         "APN,SITUS_STREET,ZIP_CODE,CLASS_CODE,LAND,STRUCTURES",
      returnGeometry:    "true",
      outSR:             "4326",
      orderByFields:     "APN",
      resultOffset:      String(offset),
      resultRecordCount: String(limit),
    });
  } catch (e) {
    return reply(502, { error: `CREST fetch failed: ${String(e.message).slice(0, 200)}` });
  }

  if (res.data?.error) {
    return reply(502, { error: "CREST query error", crestError: res.data.error, crestStatus: res.statusCode });
  }
  if (!Array.isArray(res.data?.features)) {
    return reply(502, { error: "CREST returned no features array", crestStatus: res.statusCode, raw: res.raw?.slice(0, 200) });
  }

  const features = res.data.features;
  const stats = { fetched: features.length, written: 0, existing: 0, skipped: 0, errors: [] };
  const candidates = [];

  for (const feat of features) {
    const a = feat?.attributes;
    const apn = a?.APN ? String(a.APN).trim() : null;
    if (!apn) { stats.skipped++; continue; }

    const c = centroidOf(feat.geometry);
    if (!c || !isFinite(c.lat) || !isFinite(c.lon)) { stats.skipped++; continue; }

    const value = (Number(a.LAND) || 0) + (Number(a.STRUCTURES) || 0);
    if (value < minValue) { stats.skipped++; continue; }

    const street = titleCaseStreet(a.SITUS_STREET);
    const zip = a.ZIP_CODE ? String(a.ZIP_CODE).trim().slice(0, 5) : null;

    candidates.push({
      apn,
      address: street ? `${street}, ${city}, CA${zip ? " " + zip : ""}` : `${city}, CA`,
      city,
      state: "CA",
      zip,
      latitude:  Number(c.lat.toFixed(6)),
      longitude: Number(c.lon.toFixed(6)),
      current_estimated_value: Math.round(value),
      property_type_normalized: normPropType(a.CLASS_CODE),
      property_type_raw: a.CLASS_CODE || null,
      updated_at: new Date().toISOString(),
    });
  }

  const nextOffset = features.length === limit ? offset + limit : null;

  if (dryRun || !candidates.length) {
    return reply(200, {
      ok: true, source: "rivco_assessor_crest_geocoded", city, dryRun,
      offset, limit, nextOffset, done: nextOffset === null,
      ...stats, written: 0,
      sample: candidates.slice(0, 2),
    });
  }

  // ── Page-level dedup: which APNs already exist? (no unique constraint on apn) ──
  let existingApns = new Set();
  try {
    const rows = await db.from("properties")
      .select("apn")
      .in("apn", candidates.map((r) => r.apn))
      .limit(candidates.length)
      .get();
    if (Array.isArray(rows)) existingApns = new Set(rows.map((r) => r.apn));
  } catch (e) {
    stats.errors.push(`dedup select: ${String(e.message).slice(0, 120)}`);
  }

  const toInsert = candidates.filter((r) => !existingApns.has(r.apn));
  stats.existing = candidates.length - toInsert.length;

  if (toInsert.length) {
    try {
      const inserted = await db.insert("properties", toInsert);
      stats.written = Array.isArray(inserted) ? inserted.length : toInsert.length;
    } catch (e) {
      stats.errors.push(`bulk insert: ${String(e.message).slice(0, 160)}`);
    }
  }

  db.kpi("ingest_rivco_parcels", `rivco_parcels:${city}`, { city, offset, limit, ...stats });

  return reply(200, {
    ok: true,
    source: "rivco_assessor_crest_geocoded",
    city, dryRun, offset, limit, nextOffset, done: nextOffset === null,
    fetched: stats.fetched,
    written: stats.written,
    existing: stats.existing,
    skipped: stats.skipped,
    errors: stats.errors.slice(0, 5),
    sample: toInsert.slice(0, 2).map((r) => ({ apn: r.apn, address: r.address, latitude: r.latitude, longitude: r.longitude, value: r.current_estimated_value })),
  });
};

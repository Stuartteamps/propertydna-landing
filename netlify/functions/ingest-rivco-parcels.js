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
 *   City boundaries come from the same host's Administrative_Boundaries service
 *   (Layer 1 = Cities, Layer 3 = Census Designated Places).
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
 *   - The SITUS_CITY / CITY / ZIP_CODE text fields are unusable (mailing junk,
 *     misspelled, mis-zipped), so a parcel's city is decided GEOGRAPHICALLY:
 *     parcels are fetched from the city's bounding-box envelope, then each
 *     centroid is tested point-in-polygon against the city's REAL boundary.
 *     This stops adjacent-city / unincorporated-pocket bleed.
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
 *     "offset": 0,               // ArcGIS resultOffset to resume scanning from
 *     "limit":  1000,            // records per ArcGIS page (max 2000)
 *     "maxPages": 8,             // ArcGIS pages to scan per invocation
 *     "target":  2000,           // stop scanning once this many in-city parcels found
 *     "minValue": 1,             // skip parcels with assessed value below this
 *     "dryRun": false            // fetch + count, no writes
 *   }
 *
 * Because parcels are APN-ordered, a rectangular fetch front-loads out-of-city
 * parcels for some cities; each invocation therefore scans up to maxPages pages
 * (advancing `offset`) until it has collected `target` in-city parcels, so every
 * call is productive. Loop the caller on `nextOffset` until `done`.
 *
 * Returns: { ok, city, scanned, fetchedPages, written, existing, outsideCity,
 *            skipped, errors, offset, nextOffset, done, sample, dryRun, source }
 */

"use strict";

const https = require("https");
const db    = require("./_supabase");

const GIS_HOST   = "gis.countyofriverside.us";
const PARCEL_PATH = "/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query";
const ADMIN_BASE  = "/arcgis_mapping/rest/services/OpenData/Administrative_Boundaries/MapServer";

// City → WGS84 bounding box [lonMin, latMin, lonMax, latMax] (the FETCH window;
// kept generous since the real boundary polygon does the precise clipping) plus
// the boundary descriptor used to fetch that polygon.
//   layer 1 = incorporated Cities (CITYNAME, uppercase)
//   layer 3 = Census Designated Places (NAMELSAD, e.g. "Bermuda Dunes CDP")
// Boxes are each city/CDP boundary's exact extent (+~200m pad) so APN-ordered
// pagination front-loads in-city parcels instead of adjacent unincorporated land.
const CITIES = {
  "Palm Springs":       { box: [-116.687, 33.610, -116.441, 33.934], layer: 1, field: "CITYNAME", value: "PALM SPRINGS" },
  "Cathedral City":     { box: [-116.506, 33.754, -116.403, 33.894], layer: 1, field: "CITYNAME", value: "CATHEDRAL CITY" },
  "Rancho Mirage":      { box: [-116.480, 33.712, -116.386, 33.829], layer: 1, field: "CITYNAME", value: "RANCHO MIRAGE" },
  "Palm Desert":        { box: [-116.428, 33.669, -116.300, 33.812], layer: 1, field: "CITYNAME", value: "PALM DESERT" },
  "Indian Wells":       { box: [-116.376, 33.669, -116.293, 33.746], layer: 1, field: "CITYNAME", value: "INDIAN WELLS" },
  "La Quinta":          { box: [-116.324, 33.582, -116.223, 33.740], layer: 1, field: "CITYNAME", value: "LA QUINTA" },
  "Indio":              { box: [-116.303, 33.669, -116.162, 33.819], layer: 1, field: "CITYNAME", value: "INDIO" },
  "Coachella":          { box: [-116.218, 33.640, -116.076, 33.732], layer: 1, field: "CITYNAME", value: "COACHELLA" },
  "Desert Hot Springs": { box: [-116.635, 33.876, -116.455, 33.997], layer: 1, field: "CITYNAME", value: "DESERT HOT SPRINGS" },
  "Bermuda Dunes":      { box: [-116.306, 33.727, -116.263, 33.762], layer: 3, field: "NAMELSAD", value: "Bermuda Dunes CDP" },
  "Thousand Palms":     { box: [-116.408, 33.757, -116.299, 33.862], layer: 3, field: "NAMELSAD", value: "Thousand Palms CDP" },
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
function arcgisGet(path, params, timeoutMs = 25000) {
  const qs = new URLSearchParams({ f: "json", ...params }).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GIS_HOST,
        path: `${path}?${qs}`,
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
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("ArcGIS timeout")); });
    req.on("error", reject);
    req.end();
  });
}

// ── City boundary (point-in-polygon clip) ───────────────────────────────────
/**
 * Fetch a city's boundary as an array of WGS84 rings (a city may be multipart
 * and have holes — both are handled by the even-odd ray-cast below).
 * Generalized to ~5m (maxAllowableOffset) to stay lightweight; null on failure
 * so the caller can fall back to bbox-only.
 */
async function fetchCityRings(cfg) {
  const res = await arcgisGet(`${ADMIN_BASE}/${cfg.layer}/query`, {
    where:             `${cfg.field}='${cfg.value.replace(/'/g, "''")}'`,
    outFields:         cfg.field,
    returnGeometry:    "true",
    outSR:             "4326",
    maxAllowableOffset:"0.00005",
  });
  const feats = res.data?.features;
  if (!Array.isArray(feats) || !feats.length) return null;
  const rings = [];
  for (const f of feats) for (const r of (f.geometry?.rings || [])) if (r.length) rings.push(r);
  return rings.length ? rings : null;
}

/** Even-odd ray-cast point-in-polygon over a set of rings (holes supported). */
function pointInRings(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
  }
  return inside;
}

// ── Geometry → centroid ─────────────────────────────────────────────────────
/**
 * Average the vertices of a polygon's outer ring (ring[0]) to get a centroid
 * lon/lat. Falls back to the envelope center if rings are absent. WGS84.
 */
function centroidOf(geometry) {
  if (!geometry) return null;
  const ring = Array.isArray(geometry.rings) ? geometry.rings[0] : null;
  if (Array.isArray(ring) && ring.length) {
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

  const rawCity = body.city ? String(body.city).trim() : "";
  const city = Object.keys(CITIES).find((k) => k.toLowerCase() === rawCity.toLowerCase());
  if (!city) {
    return reply(400, { error: `unknown city '${rawCity}'`, validCities: Object.keys(CITIES) });
  }

  const startOffset = Math.max(parseInt(body.offset || 0, 10), 0);
  const limit    = Math.min(Math.max(parseInt(body.limit || 1000, 10), 1), 2000);
  const maxPages = Math.min(Math.max(parseInt(body.maxPages || 8, 10), 1), 20);
  const target   = Math.min(Math.max(parseInt(body.target || 2000, 10), 1), 5000);
  const minValue = Math.max(parseInt(body.minValue || 1, 10), 0);
  const dryRun   = body.dryRun === true;
  const cfg      = CITIES[city];

  // ── Fetch the city boundary once (for precise point-in-polygon clipping) ──
  let rings = null;
  try { rings = await fetchCityRings(cfg); }
  catch (e) { /* fall back to bbox-only */ console.warn("[ingest-rivco-parcels:boundary]", e.message); }

  const stats = { scanned: 0, fetchedPages: 0, written: 0, existing: 0, outsideCity: 0, skipped: 0, errors: [] };
  const candidates = [];
  let offset = startOffset;
  let nextOffset = null;

  // Scan up to maxPages APN-ordered pages, advancing offset, until we have
  // `target` in-city parcels or the source is exhausted.
  for (let page = 0; page < maxPages; page++) {
    let res;
    try {
      res = await arcgisGet(PARCEL_PATH, {
        where:             RESIDENTIAL_WHERE,
        geometry:          cfg.box.join(","),
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
      if (page === 0) return reply(502, { error: `CREST fetch failed: ${String(e.message).slice(0, 200)}` });
      stats.errors.push(`page@${offset}: ${String(e.message).slice(0, 80)}`);
      nextOffset = offset; // resume here next invocation
      break;
    }

    if (res.data?.error) {
      if (page === 0) return reply(502, { error: "CREST query error", crestError: res.data.error, crestStatus: res.statusCode });
      nextOffset = offset; break;
    }
    const features = Array.isArray(res.data?.features) ? res.data.features : [];
    if (page === 0 && !Array.isArray(res.data?.features)) {
      return reply(502, { error: "CREST returned no features array", crestStatus: res.statusCode, raw: res.raw?.slice(0, 200) });
    }

    stats.fetchedPages++;
    stats.scanned += features.length;

    for (const feat of features) {
      const a = feat?.attributes;
      const apn = a?.APN ? String(a.APN).trim() : null;
      if (!apn) { stats.skipped++; continue; }

      const c = centroidOf(feat.geometry);
      if (!c || !isFinite(c.lat) || !isFinite(c.lon)) { stats.skipped++; continue; }

      // Precise city clip: keep only parcels whose centroid is inside the real
      // boundary. If the boundary couldn't be fetched, keep all bbox parcels.
      if (rings && !pointInRings(c.lon, c.lat, rings)) { stats.outsideCity++; continue; }

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

    offset += limit;

    // Source exhausted (short page) → all done for this city.
    if (features.length < limit) { nextOffset = null; break; }
    // Collected enough for this invocation → resume from here next time.
    if (candidates.length >= target) { nextOffset = offset; break; }
    // Hit the page budget → resume from here next time.
    if (page === maxPages - 1) { nextOffset = offset; }
  }

  if (dryRun || !candidates.length) {
    return reply(200, {
      ok: true, source: "rivco_assessor_crest_geocoded", city, dryRun,
      boundaryClip: !!rings, offset: startOffset, nextOffset, done: nextOffset === null,
      ...stats, written: 0,
      sample: candidates.slice(0, 2),
    });
  }

  // ── Page-level dedup: which APNs already exist? (no unique constraint on apn) ──
  // Chunk the apn=in.() selects to keep request URLs short.
  const existingApns = new Set();
  for (let i = 0; i < candidates.length; i += 500) {
    const apns = candidates.slice(i, i + 500).map((r) => r.apn);
    try {
      const rows = await db.from("properties").select("apn").in("apn", apns).limit(apns.length).get();
      if (Array.isArray(rows)) for (const r of rows) existingApns.add(r.apn);
    } catch (e) {
      stats.errors.push(`dedup select: ${String(e.message).slice(0, 120)}`);
    }
  }

  // Drop in-batch duplicate APNs too (a parcel can't be inserted twice).
  const seen = new Set();
  const toInsert = candidates.filter((r) => {
    if (existingApns.has(r.apn) || seen.has(r.apn)) return false;
    seen.add(r.apn); return true;
  });
  stats.existing = candidates.length - toInsert.length;

  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    try {
      const inserted = await db.insert("properties", batch);
      stats.written += Array.isArray(inserted) ? inserted.length : batch.length;
    } catch (e) {
      stats.errors.push(`bulk insert: ${String(e.message).slice(0, 160)}`);
    }
  }

  db.kpi("ingest_rivco_parcels", `rivco_parcels:${city}`, { city, startOffset, ...stats });

  return reply(200, {
    ok: true,
    source: "rivco_assessor_crest_geocoded",
    city, dryRun, boundaryClip: !!rings, offset: startOffset, nextOffset, done: nextOffset === null,
    scanned: stats.scanned,
    fetchedPages: stats.fetchedPages,
    written: stats.written,
    existing: stats.existing,
    outsideCity: stats.outsideCity,
    skipped: stats.skipped,
    errors: stats.errors.slice(0, 5),
    sample: toInsert.slice(0, 2).map((r) => ({ apn: r.apn, address: r.address, latitude: r.latitude, longitude: r.longitude, value: r.current_estimated_value })),
  });
};

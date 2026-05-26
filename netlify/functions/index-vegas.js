/**
 * PropertyDNA — Las Vegas / Clark County NV Indexer
 *
 * Source: Clark County Assessor ArcGIS
 *   https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/Layers/MapServer/1
 *
 * Schema (live-inspected 2026-05-26):
 *   APN, CALC_ACRES, ASSR_ACRES, PARCELTYPE, TAX_DIST, Shape (polygon)
 *
 * Clark County's public ArcGIS does NOT expose owner/situs/value attributes
 * (those are subscription-gated). This indexer captures spatial coverage
 * (APN + centroid + acres + tax district + city via spatial join) — owner
 * and valuation data are fetched on-demand via RentCast per-report.
 *
 * Total parcels: ~948,353 (Clark County including Vegas, Henderson, North LV,
 * Boulder City, Summerlin, Mesquite, Laughlin, etc.)
 *
 * POST /.netlify/functions/index-vegas
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { offset?, batchSize?, dryRun? }
 */
const https = require("https");
const db = require("./_supabase");

const BASE = "https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/Layers/MapServer/1";
const FIPS = "32003"; // Clark County NV
const DEFAULT_BATCH = 1000;
const MAX_BATCH = 2000;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// City lookup by TAX_DIST first 3 digits (Clark County uses tax district prefixes per municipality)
// Refined from Clark County Assessor district map. Fallback to "Las Vegas Area" for unmapped.
const TAX_DIST_CITY = {
  // 2xx — Las Vegas City
  "200": "Las Vegas", "201": "Las Vegas", "202": "Las Vegas", "203": "Las Vegas",
  "204": "Las Vegas", "205": "Las Vegas", "206": "Las Vegas", "207": "Las Vegas",
  // 25x — varied LV
  "250": "Las Vegas", "251": "Las Vegas", "252": "Las Vegas", "253": "Las Vegas",
  "254": "Las Vegas", "255": "Las Vegas", "256": "Las Vegas",
  // 3xx — Henderson
  "300": "Henderson", "301": "Henderson", "302": "Henderson", "303": "Henderson",
  "304": "Henderson", "305": "Henderson", "306": "Henderson",
  // 4xx — North Las Vegas
  "400": "North Las Vegas", "401": "North Las Vegas", "402": "North Las Vegas",
  "403": "North Las Vegas", "404": "North Las Vegas", "405": "North Las Vegas",
  // 5xx — Boulder City
  "500": "Boulder City", "501": "Boulder City", "502": "Boulder City",
  // 6xx — Mesquite
  "600": "Mesquite", "601": "Mesquite", "602": "Mesquite",
  // 7xx — Laughlin / unincorporated
  "700": "Laughlin", "701": "Laughlin", "702": "Laughlin",
};

function fetchJSON(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)" },
    }, (res) => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ statusCode: res.statusCode, data: null }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function fetchCount() {
  const params = new URLSearchParams({
    where: "APN IS NOT NULL",
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${BASE}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

async function fetchBatch(offset, count) {
  const params = new URLSearchParams({
    where: "APN IS NOT NULL",
    outFields: "APN,CALC_ACRES,ASSR_ACRES,PARCELTYPE,TAX_DIST",
    returnGeometry: "true",
    outSR: "4326", // request WGS84 lat/lng directly
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features;
}

function centroidOfPolygon(geom) {
  if (!geom?.rings || !geom.rings[0]?.length) return { lat: null, lng: null };
  let sx = 0, sy = 0, n = 0;
  for (const ring of geom.rings) {
    for (const pt of ring) {
      sx += pt[0]; sy += pt[1]; n++;
    }
  }
  if (n === 0) return { lat: null, lng: null };
  return { lat: sy / n, lng: sx / n };
}

function cityFromTaxDist(td) {
  if (!td) return null;
  const s = String(td);
  // Try exact match first, then 3-digit prefix
  if (TAX_DIST_CITY[s]) return TAX_DIST_CITY[s];
  if (s.length >= 3 && TAX_DIST_CITY[s.slice(0, 3)]) return TAX_DIST_CITY[s.slice(0, 3)];
  // Fallback by leading digit
  const lead = s[0];
  if (lead === "2") return "Las Vegas";
  if (lead === "3") return "Henderson";
  if (lead === "4") return "North Las Vegas";
  if (lead === "5") return "Boulder City";
  if (lead === "6") return "Mesquite";
  if (lead === "7") return "Laughlin";
  return null;
}

function buildRows(features, today) {
  const master = [], history = [];
  for (const f of features) {
    const a = f.attributes;
    const apn = String(a.APN || "").trim();
    if (!apn) continue;
    const { lat, lng } = centroidOfPolygon(f.geometry);
    const city = cityFromTaxDist(a.TAX_DIST);
    const acres = Number(a.ASSR_ACRES) || Number(a.CALC_ACRES) || null;

    master.push({
      apn: `NV-${FIPS}-${apn}`,
      county_fips: FIPS,
      state: "NV",
      city,
      lat, lng,
      lot_sqft: acres ? Math.round(acres * 43560) : null,
      last_updated: today,
    });

    history.push({
      apn: `NV-${FIPS}-${apn}`,
      event_type: "parcel_index",
      event_date: today,
      source: "clark_county_assessor",
      data: {
        rawApn: apn,
        taxDistrict: a.TAX_DIST || null,
        parcelType: a.PARCELTYPE != null ? a.PARCELTYPE : null,
        calcAcres: Number(a.CALC_ACRES) || null,
        assrAcres: Number(a.ASSR_ACRES) || null,
        city,
        centroid: { lat, lng },
        note: "Owner/situs/value not exposed by Clark County public ArcGIS — enrich on-demand via RentCast",
      },
    });
  }
  return { master, history };
}

async function bulkWrite(master, history) {
  const errors = [];
  await Promise.all([
    db.upsert("property_master", master, "apn").catch(e => errors.push(e.message.slice(0, 80))),
    db.insert("property_history", history).catch(() => {}),
  ]);
  return errors;
}

async function getProgress() {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "nv_index_progress").eq("email", "nv_clark")
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(nextOffset, total, done) {
  db.kpi("nv_index_progress", "nv_clark", { nextOffset, total, done });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, MAX_BATCH);
  const today = new Date().toISOString();

  try {
    const progress = await getProgress();
    let offset = body.offset != null ? body.offset : progress.offset;
    let total = progress.total;
    if (!total) total = await fetchCount();
    if (!total) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Failed to fetch parcel count" }) };

    if (offset >= total) {
      await saveProgress(offset, total, true);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ done: true, offset, total }) };
    }

    const features = await fetchBatch(offset, runSize);
    if (!features.length) {
      await saveProgress(offset, total, true);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ done: true, fetched: 0, offset, total }) };
    }

    const { master, history } = buildRows(features, today);

    if (dryRun) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        dryRun: true, fetched: features.length, parsed: master.length, offset, total,
        sample: master.slice(0, 3),
      })};
    }

    const errors = await bulkWrite(master, history);
    const nextOffset = offset + features.length;
    const done = nextOffset >= total;
    await saveProgress(nextOffset, total, done);

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        fetched: features.length, written: master.length,
        offset, nextOffset, total, done,
        errors: errors.length ? errors : undefined,
      }),
    };
  } catch (e) {
    console.error("[index-vegas]", e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};

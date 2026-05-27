/**
 * PropertyDNA — Reno / Washoe County NV Indexer
 *
 * Source: Washoe County hosted ArcGIS
 *   https://services.arcgis.com/iCGWaR7ZHc5saRIl/arcgis/rest/services/Parcels/FeatureServer/7
 *
 * Schema is RICH — owner, situs, mailing, beds/baths/sqft, year built,
 * assessed + appraised values, last sale price/date. Comparable to Snohomish.
 *
 * Total parcels: ~188,641 (Reno, Sparks, Incline Village/Lake Tahoe, Sun Valley,
 * Verdi, unincorporated Washoe County).
 *
 * Filter: residential land use codes (200s) + has owner + has any value.
 *
 * POST /.netlify/functions/index-reno
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { offset?, batchSize?, dryRun? }
 */
const https = require("https");
const db = require("./_supabase");

const BASE = "https://services.arcgis.com/iCGWaR7ZHc5saRIl/arcgis/rest/services/Parcels/FeatureServer/7";
const FIPS = "32031"; // Washoe County NV
const DEFAULT_BATCH = 1000;
const MAX_BATCH = 2000;

// Residential land-use codes (NV: 200-299 series). Exclude vacant land (200/201).
const WHERE = "LASTNAME IS NOT NULL AND LAND_USE >= '210' AND LAND_USE < '300' AND TOTALAPR > 0";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
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
    where: WHERE,
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${BASE}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

async function fetchBatch(offset, count) {
  const outFields = [
    "APN","PIN","FullAddress","STREETNUM","STREETDIR","STREET","CITY","SITUSZIP",
    "FIRSTNAME","LASTNAME","MAILING1","MAILING2","MAILCITY","MAILSTATE","MAILZIP",
    "LAND_USE","ACREAGE","BEDROOMS","BATHS","YEARBLT","SQFEET","STORIES",
    "LANDASS","BUILDASS","TOTALASS","LANDAPR","BUILDAPR","TOTALAPR",
    "SALEDATE","SALEPRICE","NBHD","Zoning","TAXDIST",
  ].join(",");
  const params = new URLSearchParams({
    where: WHERE, outFields,
    returnGeometry: "true", outSR: "4326",
    resultOffset: String(offset), resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
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
    for (const pt of ring) { sx += pt[0]; sy += pt[1]; n++; }
  }
  if (n === 0) return { lat: null, lng: null };
  return { lat: sy / n, lng: sx / n };
}

function parseSaleDate(s) {
  // SALEDATE comes as "MM/DD/YYYY" string
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function buildRows(features, today) {
  const master = [], history = [];
  for (const f of features) {
    const a = f.attributes;
    const rawApn = String(a.APN || a.PIN || "").trim();
    if (!rawApn) continue;
    const { lat, lng } = centroidOfPolygon(f.geometry);
    const firstName = String(a.FIRSTNAME || "").trim();
    const lastName  = String(a.LASTNAME  || "").trim();
    const ownerName = [firstName, lastName].filter(Boolean).join(" ");
    const acres = Number(a.ACREAGE) || null;
    const totalAsr = Number(a.TOTALAPR) || Number(a.TOTALASS) || null;
    const mailState = String(a.MAILSTATE || "").trim().toUpperCase();
    const absentee = mailState && mailState !== "NV";

    master.push({
      apn: `NV-${FIPS}-${rawApn}`,
      county_fips: FIPS,
      address: String(a.FullAddress || "").trim() || null,
      city: String(a.CITY || "").trim() || null,
      state: "NV",
      zip: String(a.SITUSZIP || "").trim().slice(0, 5) || null,
      property_type: String(a.LAND_USE || "").trim() || null,
      beds: Number(a.BEDROOMS) || null,
      baths: Number(a.BATHS) || null,
      sqft: Number(a.SQFEET) || null,
      lot_sqft: acres ? Math.round(acres * 43560) : null,
      year_built: Number(a.YEARBLT) || null,
      tax_assessed_value: totalAsr,
      lat, lng,
      last_updated: today,
    });

    history.push({
      apn: `NV-${FIPS}-${rawApn}`,
      event_type: "assessment",
      event_date: today,
      source: "nv_washoe",
      data: {
        rawApn, pin: a.PIN || null,
        situs: {
          address: a.FullAddress || null,
          city: a.CITY || null, zip: a.SITUSZIP || null,
        },
        owner: {
          firstName, lastName, fullName: ownerName,
          mailing1: a.MAILING1 || null, mailing2: a.MAILING2 || null,
          city: a.MAILCITY || null, state: a.MAILSTATE || null, zip: a.MAILZIP || null,
          absentee,
        },
        property: {
          beds: Number(a.BEDROOMS) || null,
          baths: Number(a.BATHS) || null,
          sqft: Number(a.SQFEET) || null,
          stories: a.STORIES || null,
          yearBuilt: Number(a.YEARBLT) || null,
          acres,
          landUse: a.LAND_USE || null,
          neighborhood: a.NBHD || null,
          zoning: a.Zoning || null,
          taxDistrict: a.TAXDIST || null,
        },
        valuation: {
          landAssessed: Number(a.LANDASS) || null,
          buildingAssessed: Number(a.BUILDASS) || null,
          totalAssessed: Number(a.TOTALASS) || null,
          landAppraised: Number(a.LANDAPR) || null,
          buildingAppraised: Number(a.BUILDAPR) || null,
          totalAppraised: Number(a.TOTALAPR) || null,
        },
        sale: {
          date: parseSaleDate(a.SALEDATE),
          price: Number(a.SALEPRICE) || null,
        },
        centroid: { lat, lng },
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
    .eq("event_type", "nv_index_progress").eq("email", "nv_washoe")
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(nextOffset, total, done) {
  db.kpi("nv_index_progress", "nv_washoe", { nextOffset, total, done });
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
        sample: master.slice(0, 2), sampleHistory: history.slice(0, 1),
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
    console.error("[index-reno]", e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};

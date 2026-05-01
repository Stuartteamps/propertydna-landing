/**
 * PropertyDNA — Orange County Property Indexer
 *
 * Uses OC GIS public MapServer (no key required):
 * https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0
 *
 * Available fields: ASSESSMENT_NO (APN), SITE_ADDRESS, YEAR_BUILT, NBR_BEDROOMS
 * Note: OC does not expose improvement/land values via public API.
 * Values are populated when a user runs a PropertyDNA report (via RentCast AVM).
 *
 * ~1.1 million parcels. Stores APN + address as permanent ticker symbols.
 * Full DNA scoring added at report-time via RentCast + enrichment pipeline.
 *
 * POST /.netlify/functions/index-orangecounty
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const OC_BASE = "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0";
const DEFAULT_BATCH = 200;
const COUNTY_FIPS = "06059"; // Orange County

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function fetchJSON(url, timeoutMs = 20000) {
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

async function fetchParcels(offset, count) {
  // Filter to residential (YEAR_BUILT > 0 as proxy — excludes vacant land)
  const params = new URLSearchParams({
    where: "YEAR_BUILT > 0 AND ASSESSMENT_NO IS NOT NULL",
    outFields: "ASSESSMENT_NO,SITE_ADDRESS,YEAR_BUILT,NBR_BEDROOMS",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "ASSESSMENT_NO ASC",
    f: "json",
  });
  const res = await fetchJSON(`${OC_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function countParcels() {
  const params = new URLSearchParams({
    where: "YEAR_BUILT > 0 AND ASSESSMENT_NO IS NOT NULL",
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${OC_BASE}/query?${params}`);
  return res.data?.count || 0;
}

function parseYearBuilt(raw) {
  const n = parseInt(String(raw || "0").trim(), 10);
  return n > 1800 && n < 2100 ? n : null;
}

async function bulkWrite(masterRows, historyRows) {
  await Promise.all([
    db.upsert("property_master", masterRows, "apn").catch(e => console.warn("[oc:master]", e.message.slice(0, 80))),
    db.insert("property_history", historyRows).catch(() => {}),
  ]);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun  = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 500);
  const offset  = Number(body.offset) || 0;
  const total   = body.total || await countParcels();

  try {
    const rows = await fetchParcels(offset, runSize);

    if (!rows.length) {
      const trulyDone = total > 0 && offset >= total;
      if (trulyDone) return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: "ORANGE_COUNTY", done: true, total, dryRun }) };
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: "ORANGE_COUNTY", offset, newOffset: offset, total,
          processed: 0, retryable: true, message: "Empty batch — retryable" }) };
    }

    const masterRows  = [];
    const historyRows = [];
    const today       = new Date().toISOString().slice(0, 10);
    const sample      = [];

    for (const row of rows) {
      if (!row.ASSESSMENT_NO) continue;
      const apn      = String(row.ASSESSMENT_NO).trim();
      const address  = String(row.SITE_ADDRESS || "").trim();
      const yearBuilt = parseYearBuilt(row.YEAR_BUILT);
      const beds     = Number(row.NBR_BEDROOMS) || null;

      masterRows.push({
        apn,
        county_fips:  COUNTY_FIPS,
        address,
        state:        "CA",
        year_built:   yearBuilt,
        beds,
        last_updated: new Date().toISOString(),
      });

      historyRows.push({
        apn,
        event_type: "assessment",
        event_date: today,
        source:     "ocgis_parcels",
        data: { address, yearBuilt, beds, useCode: "residential", county: "Orange County" },
      });

      if (sample.length < 3) sample.push({ apn, address, yearBuilt, beds });
    }

    if (!dryRun && masterRows.length > 0) await bulkWrite(masterRows, historyRows);

    const newOffset = offset + rows.length;
    const done      = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;

    db.kpi("oc_property_indexed", null, { processed: rows.length, newOffset, total, dryRun });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        county: "ORANGE_COUNTY", offset, newOffset, total, pctComplete: pct,
        processed: rows.length, done, dryRun, sample,
        message: done ? `Orange County complete (${total})` : `OC: ${newOffset}/${total} (${pct}%)`,
      }),
    };
  } catch (err) {
    console.error("[index-orangecounty]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

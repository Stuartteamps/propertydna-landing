/**
 * PropertyDNA — Maricopa County AZ Luxury Indexer (Scottsdale, Paradise Valley)
 *
 * Source: Maricopa County Assessor Parcels MapServer (public, no key)
 * URL: https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0
 *
 * Fields: APN, OWNER_NAME, plus address/value via MaricopaDynamicQueryService
 * Targets: Scottsdale, Paradise Valley, Fountain Hills, Cave Creek, Carefree
 *
 * POST /.netlify/functions/index-maricopa
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { city?: string, offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const MARICOPA_BASE = "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0";
const DEFAULT_BATCH = 1000;
const COUNTY_FIPS = "04013"; // Maricopa County AZ

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// AZ luxury municipalities
const CITY_QUEUE = [
  "SCOTTSDALE",
  "PARADISE VALLEY",
  "FOUNTAIN HILLS",
  "CAVE CREEK",
  "CAREFREE",
  "CHANDLER",
  "GILBERT",
  "TEMPE",
  "PHOENIX",
  "PEORIA",
  "GLENDALE",
  "SURPRISE",
  "GOODYEAR",
  "AVONDALE",
  "BUCKEYE",
  "MESA",
];

const COST_SQFT = 250; // AZ desert luxury

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

function cityWhere(city) {
  const c = city.replace(/'/g, "''");
  return `OWNER_NAME IS NOT NULL AND APN IS NOT NULL`;
  // City filter added when field names are confirmed — start with all residential
}

async function fetchBatch(city, offset, count) {
  const params = new URLSearchParams({
    where: "OWNER_NAME IS NOT NULL AND APN IS NOT NULL",
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${MARICOPA_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount() {
  const params = new URLSearchParams({
    where: "OWNER_NAME IS NOT NULL AND APN IS NOT NULL",
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${MARICOPA_BASE}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function computeAZDNA(row) {
  const yrBlt   = Number(row.YEAR_BUILT || row.YearBuilt || row.YRBUILT) || 0;
  const sqft    = Number(row.BLDG_SQFT || row.TOTAL_SQFT || row.SQ_FT) || 0;
  const fmv     = Number(row.FULL_CASH_VALUE || row.ASSESSED_VALUE || row.APPR_VALUE) || 0;
  const land    = Number(row.LAND_VALUE || row.ASSESSED_LAND) || 0;
  const age     = yrBlt > 1800 ? new Date().getFullYear() - yrBlt : 30;
  const depr    = Math.max(0.20, 1 - age * 0.010);
  const expected = sqft > 0 ? sqft * COST_SQFT * depr : 0;
  const improv  = Math.max(0, fmv - land);
  const rr      = expected > 0 ? Math.round((improv / expected) * 100) / 100 : 1.0;
  const cond    = rr > 1.5 ? 93 : rr > 1.3 ? 82 : rr > 1.1 ? 72 : rr > 0.9 ? 63 : rr > 0.7 ? 50 : 38;
  return {
    renovationRatio: rr, conditionScore: cond,
    fullCashValue: fmv || null, landValue: land || null, improvValue: improv || null,
    dataQuality: sqft > 0 && yrBlt > 0 && fmv > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildRows(rows, today) {
  const master = [], history = [];
  for (const row of rows) {
    const apn = String(row.APN || "").trim().replace(/\s+/g, "-");
    if (!apn) continue;
    const ownerName = String(row.OWNER_NAME || "").trim();
    if (!ownerName) continue;
    const addr = String(row.SITUS_ADDR || row.ADDRESS || row.SITE_ADDRESS || "").trim();
    const city = String(row.SITUS_CITY || row.CITY || "").trim();
    const dna  = computeAZDNA(row);

    master.push({
      apn: `AZ-${COUNTY_FIPS}-${apn}`, county_fips: COUNTY_FIPS,
      address: addr || null, city: city || null, state: "AZ",
      zip: String(row.SITUS_ZIP || row.ZIP || "").trim().slice(0, 5) || null,
      sqft: Number(row.BLDG_SQFT || row.TOTAL_SQFT) || null,
      year_built: Number(row.YEAR_BUILT || row.YRBUILT) > 1800
        ? Number(row.YEAR_BUILT || row.YRBUILT) : null,
      tax_assessed_value: Number(row.FULL_CASH_VALUE || row.ASSESSED_VALUE) || null,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn: `AZ-${COUNTY_FIPS}-${apn}`, event_type: "assessment", event_date: today,
      source: "maricopa_assessor",
      data: {
        address: addr, city, apn,
        ownerName,
        ownerAddr: String(row.OWNER_ADDR || "").trim() || null,
        ownerCity: String(row.OWNER_CITY || "").trim() || null,
        ownerState: String(row.OWNER_STATE || "").trim() || null,
        ownerZip: String(row.OWNER_ZIP || "").trim() || null,
        yearBuilt: Number(row.YEAR_BUILT || row.YRBUILT) || null,
        sqft: Number(row.BLDG_SQFT || row.TOTAL_SQFT) || null,
        ...dna,
      },
    });
  }
  return { master, history };
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  await Promise.all([
    db.upsert("property_master", masterRows, "apn").catch(e => errors.push(e.message.slice(0, 80))),
    db.insert("property_history", historyRows).catch(() => {}),
  ]);
  return errors;
}

async function getProgress() {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "az_index_progress").eq("email", "az_maricopa")
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(nextOffset, total, done) {
  db.kpi("az_index_progress", "az_maricopa", { nextOffset, total, done });
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
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 1000);
  const prog = await getProgress();
  const offset = body.offset != null ? Number(body.offset) : (body.reset ? 0 : prog.offset);
  let total = prog.total;
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (!total) total = await fetchCount();
    console.log(`[index-maricopa] offset=${offset} | total=${total}`);

    const rows = await fetchBatch(null, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: "Maricopa", offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset = offset + rows.length;
    const done      = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;

    if (!dryRun) await saveProgress(done ? 0 : newOffset, total, done);
    db.kpi("az_property_indexed", null, { processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      county: "Maricopa AZ", fips: COUNTY_FIPS,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, errors: writeErrors.length, done, dryRun,
      message: done ? `Maricopa complete (${total})` : `Maricopa: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-maricopa]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

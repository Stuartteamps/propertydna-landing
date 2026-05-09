/**
 * PropertyDNA — New York State Luxury Market Indexer
 *
 * Source: NYS Tax Parcels Public FeatureServer (NYS ITS GIS, public, no key)
 * URL: https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1
 *
 * Covers: Suffolk (Hamptons), Westchester, Putnam, Rockland, Orange counties
 * Fields: PRIMARY_OWNER, PARCEL_ADDR, LOC_ZIP, COUNTY_NAME, SWIS,
 *         TOTAL_AV, FULL_MARKET_VAL, LAND_AV, YR_BLT, SQFT_LIVING,
 *         NBR_BEDROOMS, NBR_FULL_BATHS, PROP_CLASS, BLDG_STYLE_DESC
 *
 * Max 1,000 records per query — paginated by county using OBJECTID ranges.
 *
 * POST /.netlify/functions/index-newyork
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { county?: string, offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const NYS_BASE = "https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1";
const DEFAULT_BATCH = 200; // NYS ITS server is slow — keep batches small to fit Netlify 10s limit

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// Luxury NY counties in processing order — FIPS codes (state 36)
const COUNTY_QUEUE = [
  { name: "Suffolk",     fips: "36103", where: "COUNTY_NAME='Suffolk'" },
  { name: "Westchester", fips: "36119", where: "COUNTY_NAME='Westchester'" },
  { name: "Nassau",      fips: "36059", where: "COUNTY_NAME='Nassau'" },
  { name: "Putnam",      fips: "36079", where: "COUNTY_NAME='Putnam'" },
  { name: "Rockland",    fips: "36087", where: "COUNTY_NAME='Rockland'" },
  { name: "Orange",      fips: "36071", where: "COUNTY_NAME='Orange'" },
];

// Residential property class codes (NY ORPS): 200-299
const RES_CLASS_FILTER = "CAST(PROP_CLASS AS INTEGER) >= 200 AND CAST(PROP_CLASS AS INTEGER) < 300";

const FIELDS = [
  "OBJECTID","SBL","PRINT_KEY","SWIS","COUNTY_NAME",
  "PRIMARY_OWNER","ADD_OWNER",
  "PARCEL_ADDR","LOC_ST_NBR","LOC_STREET","LOC_ZIP",
  "TOTAL_AV","FULL_MARKET_VAL","LAND_AV",
  "YR_BLT","SQFT_LIVING","SQ_FT",
  "NBR_BEDROOMS","NBR_FULL_BATHS",
  "PROP_CLASS","BLDG_STYLE_DESC",
].join(",");

// Cost per sqft by NY market
const COST_SQFT = { Suffolk: 420, Westchester: 480, Nassau: 460, default: 380 };

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

async function fetchBatch(countyWhere, offset, count) {
  const where = `(${countyWhere}) AND (${RES_CLASS_FILTER}) AND PRIMARY_OWNER IS NOT NULL`;
  const params = new URLSearchParams({
    where,
    outFields: FIELDS,
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${NYS_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(countyWhere) {
  const where = `(${countyWhere}) AND (${RES_CLASS_FILTER}) AND PRIMARY_OWNER IS NOT NULL`;
  const params = new URLSearchParams({
    where,
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${NYS_BASE}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function computeNYDNA(row, countyName) {
  const yrBlt    = Number(row.YR_BLT) || 0;
  const sqft     = Number(row.SQFT_LIVING) || Number(row.SQ_FT) || 0;
  const mktVal   = Number(row.FULL_MARKET_VAL) || Number(row.TOTAL_AV) || 0;
  const landVal  = Number(row.LAND_AV) || 0;
  const improvVal = Math.max(0, mktVal - landVal);
  const age      = yrBlt > 1800 ? new Date().getFullYear() - yrBlt : 30;
  const cost     = COST_SQFT[countyName] || COST_SQFT.default;
  const depr     = Math.max(0.20, 1 - age * 0.010);
  const expected = sqft > 0 ? sqft * cost * depr : 0;
  const rr       = expected > 0 ? Math.round((improvVal / expected) * 100) / 100 : 1.0;
  const cond     = rr > 1.5 ? 93 : rr > 1.3 ? 82 : rr > 1.1 ? 72 : rr > 0.9 ? 63 : rr > 0.7 ? 50 : 38;

  return {
    renovationRatio: rr, conditionScore: cond,
    marketValue: mktVal || null, landValue: landVal || null, improvValue: improvVal || null,
    dataQuality: sqft > 0 && yrBlt > 0 && mktVal > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildRows(rows, fips, countyName, today) {
  const master = [], history = [];
  for (const row of rows) {
    const apn = String(row.SBL || row.PRINT_KEY || "").trim().replace(/\s+/g, "-");
    if (!apn) continue;
    const addr = [row.LOC_ST_NBR, row.LOC_STREET].filter(Boolean).join(" ").trim()
              || String(row.PARCEL_ADDR || "").trim();
    const dna = computeNYDNA(row, countyName);

    master.push({
      apn, county_fips: fips,
      address: addr || null,
      city: String(row.COUNTY_NAME || "").trim() || null,
      state: "NY",
      zip: row.LOC_ZIP ? String(row.LOC_ZIP).trim().slice(0, 5) : null,
      property_type: String(row.BLDG_STYLE_DESC || row.PROP_CLASS || "").trim() || null,
      beds: Number(row.NBR_BEDROOMS) || null,
      baths: Number(row.NBR_FULL_BATHS) || null,
      sqft: Number(row.SQFT_LIVING) || null,
      year_built: Number(row.YR_BLT) > 1800 ? Number(row.YR_BLT) : null,
      tax_assessed_value: Number(row.TOTAL_AV) || null,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "nys_tax_parcels",
      data: {
        address: addr, county: countyName, zip: row.LOC_ZIP,
        ownerName: String(row.PRIMARY_OWNER || "").trim() || null,
        addOwner: String(row.ADD_OWNER || "").trim() || null,
        swis: row.SWIS,
        totalAV: Number(row.TOTAL_AV) || null,
        fullMarketVal: Number(row.FULL_MARKET_VAL) || null,
        landAV: Number(row.LAND_AV) || null,
        yrBlt: Number(row.YR_BLT) || null,
        sqftLiving: Number(row.SQFT_LIVING) || null,
        beds: Number(row.NBR_BEDROOMS) || null,
        baths: Number(row.NBR_FULL_BATHS) || null,
        propClass: row.PROP_CLASS, bldgStyle: row.BLDG_STYLE_DESC,
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

async function getProgress(countyName) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "ny_index_progress").eq("email", `ny_county:${countyName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(countyName, nextOffset, total, done) {
  db.kpi("ny_index_progress", `ny_county:${countyName}`, { countyName, nextOffset, total, done });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun  = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 1000);
  let countyName = (body.county || "").trim() || null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  // Auto-advance to next incomplete county
  let countyDef = null;
  if (countyName) {
    countyDef = COUNTY_QUEUE.find(c => c.name.toLowerCase() === countyName.toLowerCase());
    if (!countyDef) return { statusCode: 400, headers: CORS,
      body: JSON.stringify({ error: `Unknown county. Valid: ${COUNTY_QUEUE.map(c => c.name).join(", ")}` }) };
    const prog = await getProgress(countyDef.name);
    if (offset == null) offset = body.resetCounty ? 0 : prog.offset;
    total = prog.total;
  } else {
    for (const c of COUNTY_QUEUE) {
      const prog = await getProgress(c.name);
      if (!prog.done) { countyDef = c; offset = prog.offset; total = prog.total; break; }
    }
    if (!countyDef) return { statusCode: 200, headers: CORS,
      body: JSON.stringify({ message: "All NY luxury counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(countyDef.where);
    console.log(`[index-newyork] ${countyDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(countyDef.where, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) { await saveProgress(countyDef.name, 0, total, true); }
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: countyDef.name, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, countyDef.fips, countyDef.name, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset  = offset + rows.length;
    const countyDone = rows.length < runSize || newOffset >= total;
    const pct        = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextCounty = countyDone ? (COUNTY_QUEUE[COUNTY_QUEUE.indexOf(countyDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(countyDef.name, countyDone ? 0 : newOffset, total, countyDone);
    db.kpi("ny_property_indexed", null, { county: countyDef.name, processed: master.length, newOffset, total, dryRun });

    const sample = master.slice(0, 3).map(m => ({
      apn: m.apn, address: m.address, zip: m.zip, yearBuilt: m.year_built,
      sqft: m.sqft, assessed: m.tax_assessed_value,
    }));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      county: countyDef.name, fips: countyDef.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, errors: writeErrors.length,
      countyDone, nextCounty, dryRun, sample,
      message: countyDone
        ? `${countyDef.name} complete (${total}). Next: ${nextCounty || "ALL DONE"}`
        : `${countyDef.name}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-newyork]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

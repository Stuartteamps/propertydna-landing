/**
 * PropertyDNA — New Jersey Statewide Indexer
 *
 * Source: NJ Office of GIS (NJOGIS) — Statewide Composite Parcels with MOD-IV tax
 *   attributes joined. OWNER_NAME redacted per Daniel's Law but ST_ADDRESS,
 *   land/improvement values, sales, year-built, square footage all retained.
 *   https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/ArcGIS/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0
 *
 * Targets luxury NJ counties: Bergen, Morris, Essex, Hudson, Middlesex, Monmouth,
 * Somerset, Hunterdon (the I-78/I-287 luxury corridor + Gold Coast).
 *
 * POST /.netlify/functions/index-newjersey
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const NJ_URL = "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/ArcGIS/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0";
const DEFAULT_BATCH = 1000;
const STATE = "NJ";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// Field "COUNTY" holds 4-letter prefix like "BERG" or full name; sample inspection
// shows it is the full county name in mixed case. We compare uppercase.
const COUNTY_QUEUE = [
  { name: "BERGEN",     fips: "34003" },
  { name: "MORRIS",     fips: "34027" },
  { name: "ESSEX",      fips: "34013" },
  { name: "HUDSON",     fips: "34017" },
  { name: "MIDDLESEX",  fips: "34023" },
  { name: "MONMOUTH",   fips: "34025" },
  { name: "SOMERSET",   fips: "34035" },
  { name: "HUNTERDON",  fips: "34019" },
  { name: "UNION",      fips: "34039" },
  { name: "PASSAIC",    fips: "34031" },
];

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

function whereCounty(name) {
  return `UPPER(COUNTY)='${name.replace(/'/g, "''")}' AND PROP_LOC IS NOT NULL`;
}

async function fetchBatch(name, offset, count) {
  const params = new URLSearchParams({
    where: whereCounty(name),
    outFields: "OBJECTID,PAMS_PIN,PCL_MUN,COUNTY,MUN_NAME,PROP_LOC,ST_ADDRESS,CITY_STATE,ZIP_CODE,ZIP5,LAND_VAL,IMPRVT_VAL,NET_VALUE,LAST_YR_TX,BLDG_DESC,LAND_DESC,CALC_ACRE,PROP_USE,BLDG_CLASS,DEED_BOOK,DEED_PAGE,DEED_DATE,YR_CONSTR,SALE_PRICE,SALES_CODE,DWELL,COMM_DWELL,PROP_CLASS",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${NJ_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(name) {
  const params = new URLSearchParams({
    where: whereCounty(name),
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${NJ_URL}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function buildRows(rows, cDef, today) {
  const master = [], history = [];
  for (const r of rows) {
    const pin = String(r.PAMS_PIN || r.OBJECTID || "").trim();
    if (!pin) continue;
    const apn = `NJ-${pin}`;
    const lotAcres = Number(r.CALC_ACRE) || 0;
    master.push({
      apn,
      address_line1: String(r.PROP_LOC || r.ST_ADDRESS || "").trim() || null,
      address: String(r.PROP_LOC || r.ST_ADDRESS || "").trim() || null,
      city: String(r.MUN_NAME || "").trim() || null,
      state: STATE,
      zip: String(r.ZIP5 || r.ZIP_CODE || "").trim().slice(0, 5) || null,
      year_built: Number(r.YR_CONSTR) > 1800 ? Number(r.YR_CONSTR) : null,
      lot_sqft: lotAcres > 0 ? Math.round(lotAcres * 43560) : null,
      tax_assessed_value: Number(r.NET_VALUE) || null,
      property_type: String(r.BLDG_DESC || r.PROP_CLASS || "").trim() || null,
      county_fips: cDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "nj_modiv",
      data: {
        county: cDef.name,
        municipality: r.MUN_NAME || null,
        propClass: r.PROP_CLASS || null,
        landValue: Number(r.LAND_VAL) || null,
        imprvtValue: Number(r.IMPRVT_VAL) || null,
        netValue: Number(r.NET_VALUE) || null,
        lastYearTax: Number(r.LAST_YR_TX) || null,
        bldgDesc: r.BLDG_DESC || null,
        landDesc: r.LAND_DESC || null,
        calcAcres: Number(r.CALC_ACRE) || null,
        propUse: r.PROP_USE || null,
        bldgClass: r.BLDG_CLASS || null,
        yrConstr: Number(r.YR_CONSTR) || null,
        salePrice: Number(r.SALE_PRICE) || null,
        salesCode: r.SALES_CODE || null,
        deedDate: r.DEED_DATE || null,
        dwellings: Number(r.DWELL) || null,
        commDwellings: Number(r.COMM_DWELL) || null,
      },
    });
  }
  return { master, history };
}

function dedupeByApn(rows) {
  const seen = new Set(); const out = [];
  for (const r of rows) { if (seen.has(r.apn)) continue; seen.add(r.apn); out.push(r); }
  return out;
}
function dedupeHistory(rows) {
  const seen = new Set(); const out = [];
  for (const r of rows) {
    const k = `${r.apn}|${r.event_type}|${r.event_date}|${r.source}`;
    if (seen.has(k)) continue; seen.add(k); out.push(r);
  }
  return out;
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  await Promise.all([
    db.upsert("property_master", dedupeByApn(masterRows), "apn").catch(e => errors.push(e.message.slice(0, 80))),
    db.insert("property_history", dedupeHistory(historyRows)).catch(() => {}),
  ]);
  return errors;
}

async function getProgress(name) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "nj_index_progress").eq("email", `nj_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("nj_index_progress", `nj_county:${name}`, { countyName: name, nextOffset, total, done });
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
  let countyName = (body.county || "").trim().toUpperCase() || null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  let cDef = null;
  if (countyName) {
    cDef = COUNTY_QUEUE.find(t => t.name === countyName);
    if (!cDef) return { statusCode: 400, headers: CORS,
      body: JSON.stringify({ error: `Unknown county. Valid: ${COUNTY_QUEUE.map(t => t.name).join(", ")}` }) };
    const prog = await getProgress(cDef.name);
    if (offset == null) offset = body.resetCounty ? 0 : prog.offset;
    total = prog.total;
  } else {
    for (const c of COUNTY_QUEUE) {
      const prog = await getProgress(c.name);
      if (!prog.done) { cDef = c; offset = prog.offset; total = prog.total; break; }
    }
    if (!cDef) return { statusCode: 200, headers: CORS,
      body: JSON.stringify({ message: "All NJ counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef.name);
    console.log(`[index-newjersey] ${cDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(cDef.name, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(cDef.name, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: cDef.name, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, cDef, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset = offset + rows.length;
    const cDone     = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextCounty = cDone ? (COUNTY_QUEUE[COUNTY_QUEUE.indexOf(cDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(cDef.name, cDone ? 0 : newOffset, total, cDone);
    db.kpi("nj_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      county: cDef.name, fips: cDef.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, fetched: rows.length, upserted: dryRun ? 0 : master.length, errors: writeErrors.length,
      done: cDone, nextCounty, dryRun,
      message: cDone
        ? `${cDef.name} complete (${total}). Next: ${nextCounty || "ALL DONE"}`
        : `${cDef.name}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-newjersey]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

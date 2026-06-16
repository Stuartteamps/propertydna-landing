/**
 * PropertyDNA — Utah Ski / Resort Luxury Indexer
 *
 * Source: Utah AGRC statewide Land Information Records (LIR) — per-county
 * standardized layers. Verified live for both Summit and Wasatch:
 *   • Summit County (Park City) — services1.arcgis.com/99lidPhWCzftIe9K
 *     Parcels_Summit_LIR / FeatureServer / 0 — 37,294 parcels
 *   • Wasatch County (Heber City / Midway / Deer Valley East) — same host
 *     Parcels_Wasatch_LIR / FeatureServer / 0 — 31,843 parcels
 *
 * Fields: PARCEL_ID, SERIAL_NUM, PARCEL_ADD, PARCEL_CITY, TOTAL_MKT_VALUE,
 *   LAND_MKT_VALUE, PARCEL_ACRES, PROP_CLASS, BLDG_SQFT, BUILT_YR, EFFBUILT_YR,
 *   SUBDIV_NAME, FLOORS_CNT, HOUSE_CNT, CONST_MATERIAL
 *
 * POST /.netlify/functions/index-utahluxury
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "UT";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const SUMMIT_URL  = "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/Parcels_Summit_LIR/FeatureServer/0";
const WASATCH_URL = "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/Parcels_Wasatch_LIR/FeatureServer/0";

const COUNTY_QUEUE = [
  { name: "Summit",  fips: "49043", url: SUMMIT_URL },
  { name: "Wasatch", fips: "49051", url: WASATCH_URL },
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

const WHERE = "PARCEL_ID IS NOT NULL";

async function fetchBatch(c, offset, count) {
  const params = new URLSearchParams({
    where: WHERE,
    outFields: "OBJECTID,COUNTY_NAME,PARCEL_ID,SERIAL_NUM,PARCEL_ADD,PARCEL_CITY,TAXEXEMPT_TYPE,TAX_DISTRICT,TOTAL_MKT_VALUE,LAND_MKT_VALUE,PARCEL_ACRES,PROP_CLASS,PRIMARY_RES,HOUSE_CNT,SUBDIV_NAME,BLDG_SQFT,FLOORS_CNT,BUILT_YR,EFFBUILT_YR,CONST_MATERIAL",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(c) {
  const params = new URLSearchParams({
    where: WHERE,
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function buildRows(rows, cDef, today) {
  const master = [], history = [];
  for (const r of rows) {
    const apnRaw = String(r.PARCEL_ID || r.SERIAL_NUM || "").trim();
    if (!apnRaw) continue;
    const apn = `UT-${cDef.fips}-${apnRaw}`;
    const acres = Number(r.PARCEL_ACRES) || 0;
    master.push({
      apn,
      address_line1: String(r.PARCEL_ADD || "").trim() || null,
      address: String(r.PARCEL_ADD || "").trim() || null,
      city: String(r.PARCEL_CITY || "").trim() || null,
      state: STATE,
      year_built: Number(r.BUILT_YR) > 1800 ? Number(r.BUILT_YR) : null,
      sqft: Number(r.BLDG_SQFT) || null,
      lot_sqft: acres > 0 ? Math.round(acres * 43560) : null,
      tax_assessed_value: Number(r.TOTAL_MKT_VALUE) || null,
      property_type: String(r.PROP_CLASS || "").trim() || null,
      county_fips: cDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "ut_agrc_lir",
      data: {
        county: cDef.name,
        serialNum: r.SERIAL_NUM || null,
        taxExemptType: r.TAXEXEMPT_TYPE || null,
        taxDistrict: r.TAX_DISTRICT || null,
        totalMktValue: Number(r.TOTAL_MKT_VALUE) || null,
        landMktValue: Number(r.LAND_MKT_VALUE) || null,
        parcelAcres: Number(r.PARCEL_ACRES) || null,
        propClass: r.PROP_CLASS || null,
        primaryRes: r.PRIMARY_RES || null,
        houseCount: Number(r.HOUSE_CNT) || null,
        subdivision: r.SUBDIV_NAME || null,
        bldgSqft: Number(r.BLDG_SQFT) || null,
        floorsCount: Number(r.FLOORS_CNT) || null,
        builtYr: Number(r.BUILT_YR) || null,
        effBuiltYr: Number(r.EFFBUILT_YR) || null,
        constMaterial: r.CONST_MATERIAL || null,
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
    .eq("event_type", "ut_index_progress").eq("email", `ut_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("ut_index_progress", `ut_county:${name}`, { countyName: name, nextOffset, total, done });
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

  let cDef = null;
  if (countyName) {
    cDef = COUNTY_QUEUE.find(t => t.name.toLowerCase() === countyName.toLowerCase());
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
      body: JSON.stringify({ message: "All UT luxury counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-utahluxury] ${cDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(cDef, offset, runSize);
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
    db.kpi("ut_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-utahluxury]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

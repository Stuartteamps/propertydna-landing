/**
 * PropertyDNA — Tennessee Statewide Indexer
 *
 * Sources (verified live):
 *   • Davidson (Nashville) — Nashville Metro Cadastral, full CAMA: owner+address+year_built+sqft+value
 *     https://maps.nashville.gov/arcgis/rest/services/Cadastral/Cadastral_Layers/MapServer/4
 *   • Williamson — KX hosted parcels (owner + assessed + eff_year + sqft)
 *     https://services1.arcgis.com/qTQ6qYkHpxlu0G82/.../kx_williamson_county_tennessee_parcels_SHP/FeatureServer/0
 *   • Sumner / Cheatham — TN State Property Boundaries Public Use (boundary + owner only, no value)
 *     https://services1.arcgis.com/YuVBSS7Y1of2Qud1/.../Tennessee_Property_Boundaries_Public_Use/FeatureServer/0
 *
 * POST /.netlify/functions/index-tennessee
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { county?: string, offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "TN";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const NASHVILLE_URL = "https://maps.nashville.gov/arcgis/rest/services/Cadastral/Cadastral_Layers/MapServer/4";
const WILLIAMSON_URL = "https://services1.arcgis.com/qTQ6qYkHpxlu0G82/arcgis/rest/services/kx_williamson_county_tennessee_parcels_SHP/FeatureServer/0";
const TN_STATE_URL = "https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0";

const COUNTY_QUEUE = [
  { name: "Davidson",   fips: "47037", source: "nashville",  url: NASHVILLE_URL },
  { name: "Williamson", fips: "47187", source: "williamson", url: WILLIAMSON_URL },
  { name: "Sumner",     fips: "47165", source: "tn_state",   url: TN_STATE_URL, stateWhere: "COUNTY_NAME='Sumner'" },
  { name: "Cheatham",   fips: "47021", source: "tn_state",   url: TN_STATE_URL, stateWhere: "COUNTY_NAME='Cheatham'" },
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

function whereFor(c) {
  if (c.source === "nashville")  return "IsActive='Y' AND Owner IS NOT NULL";
  if (c.source === "williamson") return "owner1 IS NOT NULL";
  return c.stateWhere; // tn_state
}

async function fetchBatch(c, offset, count) {
  const params = new URLSearchParams({
    where: whereFor(c),
    outFields: "*",
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
    where: whereFor(c),
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function nashvilleRow(r, fips) {
  const apn = String(r.APN || r.STANPAR || r.ParID || "").trim();
  if (!apn) return null;
  return {
    apn: `TN-${apn}`,
    address_line1: String(r.PropAddr || "").trim() || null,
    address: String(r.PropAddr || "").trim() || null,
    city: String(r.PropCity || "NASHVILLE").trim(),
    state: STATE,
    zip: String(r.PropZip || "").slice(0, 5) || null,
    year_built: null, // Nashville doesn't expose YR_BLT here
    sqft: Number(r.FinishArea) || null,
    lot_sqft: Number(r.Acres) ? Math.round(Number(r.Acres) * 43560) : null,
    tax_assessed_value: Number(r.TotlAssd) || Number(r.TotlAppr) || null,
    property_type: String(r.LUDesc || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function williamsonRow(r, fips) {
  const apn = String(r.parcel_id || r.GISLINK || r.lrsn || "").trim();
  if (!apn) return null;
  return {
    apn: `TN-${apn}`,
    address_line1: String(r.ADDRESS || "").trim() || null,
    address: String(r.ADDRESS || "").trim() || null,
    city: String(r.CITY || "").trim() || null,
    state: STATE,
    zip: null,
    year_built: Number(r.eff_year) > 1800 ? Number(r.eff_year) : null,
    sqft: Number(r.SQFT_ASSES) || null,
    tax_assessed_value: Number(r.total_asse) || null,
    property_type: String(r.property_T || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function tnStateRow(r, fips) {
  const apn = String(r.GISLINK || r.PARCELID || "").trim();
  if (!apn) return null;
  return {
    apn: `TN-${apn}`,
    address_line1: String(r.ADDRESS || "").trim() || null,
    address: String(r.ADDRESS || "").trim() || null,
    state: STATE,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "nashville")  m = nashvilleRow(r, c.fips);
    if (c.source === "williamson") m = williamsonRow(r, c.fips);
    if (c.source === "tn_state")   m = tnStateRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    history.push({
      apn: m.apn, event_type: "assessment", event_date: today, source: `tn_${c.source}`,
      data: {
        county: c.name,
        ownerName: String(r.Owner || r.owner1 || r.OWNER || "").trim() || null,
        ownerName2: String(r.owner2 || r.OWNER2 || "").trim() || null,
        ownerAddr: String(r.OwnAddr1 || r.own_street || "").trim() || null,
        ownerCity: String(r.OwnCity || r.own_city || "").trim() || null,
        ownerState: String(r.OwnState || r.own_state || "").trim() || null,
        ownerZip: String(r.OwnZip || r.own_zip || "").trim() || null,
        assessedTotal: m.tax_assessed_value,
        landAssd: Number(r.LandAssd || r.land_asses) || null,
        imprAssd: Number(r.ImprAssd || r.imp_assess) || null,
        salePrice: Number(r.SalePrice || r.considerat) || null,
        saleDate: r.OwnDate || r.pxfer_date || null,
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

async function getProgress(countyName) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "tn_index_progress").eq("email", `tn_county:${countyName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(countyName, nextOffset, total, done) {
  db.kpi("tn_index_progress", `tn_county:${countyName}`, { countyName, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All TN counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-tennessee] ${cDef.name} | offset=${offset} | total=${total}`);

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

    const newOffset  = offset + rows.length;
    const cDone   = rows.length < runSize || newOffset >= total;
    const pct        = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const next   = cDone ? (COUNTY_QUEUE[COUNTY_QUEUE.indexOf(cDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(cDef.name, cDone ? 0 : newOffset, total, cDone);
    db.kpi("tn_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      county: cDef.name, fips: cDef.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, fetched: rows.length, upserted: dryRun ? 0 : master.length, errors: writeErrors.length,
      done: cDone, nextCounty: next, dryRun,
      message: cDone
        ? `${cDef.name} complete (${total}). Next: ${next || "ALL DONE"}`
        : `${cDef.name}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-tennessee]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

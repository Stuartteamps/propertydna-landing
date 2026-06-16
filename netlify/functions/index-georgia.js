/**
 * PropertyDNA — Georgia Atlanta Metro Indexer
 *
 * Sources (verified live):
 *   • Fulton (Atlanta core) — Fulton 2020 Tax Parcels (358k, owner+assess+value)
 *     https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels2020/FeatureServer/0
 *   • DeKalb (East Atlanta) — DeKalb Co Tax Parcels (246k, owner+address+value)
 *     https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/FeatureServer/0
 *   • Atlanta-City (overlapping but more current) — City of Atlanta DPCD 2025
 *     https://gis.atlantaga.gov/dpcd/rest/services/AdministrativeArea/TaxParcel/MapServer/0
 *
 * Note: Cobb & Gwinnett don't expose their tax parcels via free ArcGIS REST
 * with owner/value data — they require permit/login access. Fallback paths
 * documented above. This indexer covers the 3 largest open sources (~775k
 * parcels) in metro Atlanta.
 *
 * POST /.netlify/functions/index-georgia
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "GA";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const FULTON_URL = "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels2020/FeatureServer/0";
const DEKALB_URL = "https://dcgis.dekalbcountyga.gov/mapping/rest/services/TaxParcels/FeatureServer/0";
const ATLANTA_URL = "https://gis.atlantaga.gov/dpcd/rest/services/AdministrativeArea/TaxParcel/MapServer/0";

const COUNTY_QUEUE = [
  { name: "Fulton",       fips: "13121", source: "fulton",  url: FULTON_URL },
  { name: "DeKalb",       fips: "13089", source: "dekalb",  url: DEKALB_URL },
  { name: "Atlanta-City", fips: "13121", source: "atlanta", url: ATLANTA_URL },
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
  if (c.source === "fulton")  return "Owner IS NOT NULL";
  if (c.source === "dekalb")  return "OWNERNME1 IS NOT NULL";
  return "OWNERNME1 IS NOT NULL"; // atlanta
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
  // Some MapServers (Atlanta DPCD) return outStatistics with uppercase CNT.
  // returnCountOnly is universally supported and case-safe.
  const params = new URLSearchParams({
    where: whereFor(c),
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function fultonRow(r, fips) {
  const apnRaw = String(r.ParcelID || "").trim();
  if (!apnRaw) return null;
  return {
    apn: `GA-FUL-${apnRaw}`,
    address_line1: String(r.Address || "").trim() || null,
    address: String(r.Address || "").trim() || null,
    state: STATE,
    tax_assessed_value: Number(r.TotAssess) || null,
    property_type: String(r.LUCode || "").trim() || null,
    lot_sqft: Number(r.LandAcres) ? Math.round(Number(r.LandAcres) * 43560) : null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function dekalbRow(r, fips) {
  const apnRaw = String(r.PARCELID || r.PRCLKEY || "").trim();
  if (!apnRaw) return null;
  return {
    apn: `GA-DEK-${apnRaw}`,
    address_line1: String(r.SITEADDRESS || "").trim() || null,
    address: String(r.SITEADDRESS || "").trim() || null,
    city: String(r.CITY || "").trim() || null,
    state: STATE,
    zip: String(r.ZIP || "").slice(0, 5) || null,
    tax_assessed_value: Number(r.CNTASSDVAL) || Number(r.TOTAPR1) || null,
    property_type: String(r.CLASSDSCRP || r.LANDUSE || "").trim() || null,
    lot_sqft: Number(r.ACREAGE) ? Math.round(Number(r.ACREAGE) * 43560) : null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function atlantaRow(r, fips) {
  const apnRaw = String(r.PARCELID || r.LOWPARCELID || "").trim();
  if (!apnRaw) return null;
  return {
    apn: `GA-ATL-${apnRaw}`,
    address_line1: String(r.SITEADDRESS || "").trim() || null,
    address: String(r.SITEADDRESS || "").trim() || null,
    city: String(r.SITECITY || "ATLANTA").trim(),
    state: STATE,
    zip: String(r.SITEZIP || "").slice(0, 5) || null,
    tax_assessed_value: Number(r.LANDASSESS || 0) + Number(r.IMPRASSESS || 0) || null,
    property_type: String(r.CLASSDSCRP || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "fulton")  m = fultonRow(r, c.fips);
    if (c.source === "dekalb")  m = dekalbRow(r, c.fips);
    if (c.source === "atlanta") m = atlantaRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    history.push({
      apn: m.apn, event_type: "assessment", event_date: today, source: `ga_${c.source}`,
      data: {
        county: c.name,
        ownerName: String(r.Owner || r.OWNERNME1 || "").trim() || null,
        ownerName2: String(r.OWNERNME2 || "").trim() || null,
        ownerAddr1: String(r.OwnerAddr1 || r.PSTLADDRESS || "").trim() || null,
        ownerAddr2: String(r.OwnerAddr2 || r.PSTLADDRESS2 || "").trim() || null,
        ownerCity: String(r.PSTLCITY || "").trim() || null,
        ownerState: String(r.PSTLSTATE || "").trim() || null,
        ownerZip: String(r.PSTLZIP5 || "").trim() || null,
        totAppr: Number(r.TotAppr || r.TOT_APPR || r.TOTAPR1) || null,
        landAppr: Number(r.LandAppr || r.LANDAPPR) || null,
        imprAppr: Number(r.ImprAppr || r.IMPR_APPR) || null,
        totAssess: Number(r.TotAssess || r.CNTASSDVAL) || null,
        landAcres: Number(r.LandAcres) || null,
        taxYear: r.TaxYear || r.TAXYEAR || null,
        classCode: r.ClassCode || r.CLASSCD || null,
        luCode: r.LUCode || null,
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
    .eq("event_type", "ga_index_progress").eq("email", `ga_county:${countyName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(countyName, nextOffset, total, done) {
  db.kpi("ga_index_progress", `ga_county:${countyName}`, { countyName, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All GA counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-georgia] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("ga_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-georgia]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

/**
 * PropertyDNA — North Carolina Statewide Indexer
 *
 * Sources (verified live):
 *   • Wake (Raleigh) — county MapServer with full CAMA + addr + sale + acreage
 *     https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0
 *   • Mecklenburg (Charlotte) — Charlotte GIS CLT_Ex includes owner, value, year_built, sqft
 *     https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer/4
 *   • Durham — Town of Chapel Hill OpenData mirror with full CAMA
 *     https://gis-portal.townofchapelhill.org/server/rest/services/OpenData/DurhamCountyParcels/MapServer/0
 *
 * POST /.netlify/functions/index-northcarolina
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "NC";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const WAKE_URL    = "https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0";
const MECK_URL    = "https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer/4";
const DURHAM_URL  = "https://gis-portal.townofchapelhill.org/server/rest/services/OpenData/DurhamCountyParcels/MapServer/0";

const COUNTY_QUEUE = [
  { name: "Wake",        fips: "37183", source: "wake",   url: WAKE_URL },
  { name: "Mecklenburg", fips: "37119", source: "meck",   url: MECK_URL },
  { name: "Durham",      fips: "37063", source: "durham", url: DURHAM_URL },
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
  if (c.source === "wake")   return "OWNER IS NOT NULL";
  if (c.source === "meck")   return "Owner_LastName IS NOT NULL";
  if (c.source === "durham") return "PROPERTY_OWNER IS NOT NULL";
  return "1=1";
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
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function wakeRow(r, fips) {
  const apn = String(r.PIN_NUM || r.REID || "").trim();
  if (!apn) return null;
  return {
    apn: `NC-${fips}-${apn}`,
    address_line1: String(r.ADDR1 || "").trim() || null,
    address: String(r.ADDR1 || "").trim() || null,
    city: String(r.ADDR2 || "").trim().split(",")[0] || null,
    state: STATE,
    zip: null,
    sqft: null,
    lot_sqft: Number(r.CALC_AREA) || null,
    property_type: null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function meckRow(r, fips) {
  const apn = String(r.Tax_ID || r.PID || r.Common_PID || "").trim();
  if (!apn) return null;
  return {
    apn: `NC-${fips}-${apn}`,
    address_line1: String(r.Location || "").trim() || null,
    address: String(r.Location || "").trim() || null,
    city: String(r.City || r.Municipality || "").trim() || null,
    state: STATE,
    zip: String(r.Zip_Code || "").trim().slice(0, 5) || null,
    year_built: Number(r.Year_Built) > 1800 ? Number(r.Year_Built) : null,
    sqft: Number(r.Heated_Sqft) || null,
    lot_sqft: Number(r.Total_Acreage) ? Math.round(Number(r.Total_Acreage) * 43560) : null,
    tax_assessed_value: Number(r.Total_Value) || null,
    property_type: String(r.Property_Use || r.Building_Type || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function durhamRow(r, fips) {
  const apn = String(r.PIN || r.REID || r.PARCEL_PK || "").trim();
  if (!apn) return null;
  return {
    apn: `NC-${fips}-${apn}`,
    address_line1: String(r.LOCATION_ADDR || "").trim() || null,
    address: String(r.LOCATION_ADDR || "").trim() || null,
    city: String(r.PHYADDR_CITY || r.CITY || "").trim() || null,
    state: STATE,
    zip: String(r.PHYADDR_ZIP || "").trim().slice(0, 5) || null,
    sqft: Number(r.HEATED_AREA) || null,
    lot_sqft: Number(r.CALCULATED_ACRES) ? Math.round(Number(r.CALCULATED_ACRES) * 43560) : null,
    tax_assessed_value: Number(r.TOTAL_PROP_VALUE) || null,
    property_type: String(r.LAND_USE_VALUE || r.PARCEL_TYPE || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "wake")   m = wakeRow(r, c.fips);
    if (c.source === "meck")   m = meckRow(r, c.fips);
    if (c.source === "durham") m = durhamRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    let ownerName = null;
    if (c.source === "wake")   ownerName = r.OWNER;
    if (c.source === "meck")   ownerName = `${r.Owner_FirstName || ""} ${r.Owner_LastName || ""}`.trim() || null;
    if (c.source === "durham") ownerName = r.PROPERTY_OWNER;
    history.push({
      apn: m.apn, event_type: "assessment", event_date: today, source: `nc_${c.source}`,
      data: {
        county: c.name,
        ownerName: ownerName || null,
        salePrice: Number(r.Price || r.PKG_SALE_PRICE) || null,
        saleDate: r.Sales_Date || r.PKG_SALE_DATE || null,
        landValue: Number(r.Land_Value || r.TOTAL_LAND_VALUE_ASSESSED) || null,
        bldgValue: Number(r.Building_Value || r.TOTAL_BLDG_VALUE_ASSESSED) || null,
        totalValue: Number(r.Total_Value || r.TOTAL_PROP_VALUE) || null,
        yearBuilt: Number(r.Year_Built) || null,
        buildingType: r.Building_Type || null,
        zoning: r.Zoning || null,
        ownerMailAddr: r.OWNER_MAIL_1 || r.Mailing_Address || null,
        ownerMailCity: r.OWNER_MAIL_CITY || null,
        ownerMailState: r.OWNER_MAIL_STATE || null,
        ownerMailZip: r.OWNER_MAIL_ZIP || null,
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
    .eq("event_type", "nc_index_progress").eq("email", `nc_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("nc_index_progress", `nc_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All NC counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-northcarolina] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("nc_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-northcarolina]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

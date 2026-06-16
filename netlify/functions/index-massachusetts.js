/**
 * PropertyDNA — Massachusetts Statewide Indexer
 *
 * Source: MassGIS Standardized (L3) Property Tax Parcels — public hosted FeatureServer
 *   https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0
 *
 * Fields: OWNER1, SITE_ADDR, CITY, ZIP, BLDG_VAL, TOTAL_VAL, YEAR_BUILT,
 *         BLD_AREA, RES_AREA, NUM_ROOMS, LOT_SIZE, USE_CODE, STYLE
 *
 * Targets Boston metro: Suffolk (Boston), Middlesex (Cambridge, Newton), Norfolk
 * (Brookline, Wellesley), Essex (North Shore), Plymouth (South Shore).
 *
 * Filters by CITY name. Counties don't exist as a field — we iterate luxury
 * cities per county. Hard-coded queue maps city -> county FIPS.
 *
 * POST /.netlify/functions/index-massachusetts
 * Body: { city?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const MA_URL = "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0";
const DEFAULT_BATCH = 1000;
const STATE = "MA";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// city name is exact (UPPERCASE). FIPS = state(25) + county
const CITY_QUEUE = [
  // Suffolk County (Boston metro core)
  { name: "BOSTON",     fips: "25025" },
  { name: "CHELSEA",    fips: "25025" },
  // Middlesex (Cambridge, Newton, Lexington, Concord, Belmont)
  { name: "CAMBRIDGE",  fips: "25017" },
  { name: "NEWTON",     fips: "25017" },
  { name: "LEXINGTON",  fips: "25017" },
  { name: "CONCORD",    fips: "25017" },
  { name: "BELMONT",    fips: "25017" },
  { name: "ARLINGTON",  fips: "25017" },
  { name: "WINCHESTER", fips: "25017" },
  { name: "WESTON",     fips: "25017" },
  { name: "WAYLAND",    fips: "25017" },
  // Norfolk County (Brookline, Wellesley, Dover, Needham, Dedham)
  { name: "BROOKLINE",  fips: "25021" },
  { name: "WELLESLEY",  fips: "25021" },
  { name: "DOVER",      fips: "25021" },
  { name: "NEEDHAM",    fips: "25021" },
  { name: "DEDHAM",     fips: "25021" },
  // Essex (North Shore — Marblehead, Manchester, Beverly, Salem, Andover)
  { name: "MARBLEHEAD", fips: "25009" },
  { name: "BEVERLY",    fips: "25009" },
  { name: "SALEM",      fips: "25009" },
  { name: "ANDOVER",    fips: "25009" },
  // Plymouth (South Shore — Duxbury, Hingham, Cohasset)
  { name: "DUXBURY",    fips: "25023" },
  { name: "HINGHAM",    fips: "25023" },
  { name: "COHASSET",   fips: "25023" },
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

function whereCity(cityName) {
  return `CITY='${cityName.replace(/'/g, "''")}' AND OWNER1 IS NOT NULL`;
}

async function fetchBatch(cityName, offset, count) {
  const params = new URLSearchParams({
    where: whereCity(cityName),
    outFields: "OBJECTID,PROP_ID,LOC_ID,OWNER1,OWN_ADDR,OWN_CITY,OWN_STATE,OWN_ZIP,OWN_CO,SITE_ADDR,LOCATION,CITY,ZIP,BLDG_VAL,LAND_VAL,OTHER_VAL,TOTAL_VAL,FY,LOT_SIZE,LS_DATE,LS_PRICE,USE_CODE,YEAR_BUILT,BLD_AREA,UNITS,RES_AREA,STYLE,NUM_ROOMS,STORIES",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${MA_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(cityName) {
  const params = new URLSearchParams({
    where: whereCity(cityName),
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${MA_URL}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function buildRows(rows, cityDef, today) {
  const master = [], history = [];
  for (const r of rows) {
    const apnRaw = String(r.PROP_ID || r.LOC_ID || "").trim();
    if (!apnRaw) continue;
    const apn = `MA-${cityDef.fips}-${apnRaw}`;
    master.push({
      apn,
      address_line1: String(r.SITE_ADDR || "").trim() || null,
      address: String(r.SITE_ADDR || "").trim() || null,
      city: String(r.CITY || cityDef.name).trim(),
      state: STATE,
      zip: String(r.ZIP || "").trim().slice(0, 5) || null,
      year_built: Number(r.YEAR_BUILT) > 1800 ? Number(r.YEAR_BUILT) : null,
      sqft: Number(r.RES_AREA) || Number(r.BLD_AREA) || null,
      lot_sqft: Number(r.LOT_SIZE) || null,
      tax_assessed_value: Number(r.TOTAL_VAL) || null,
      property_type: String(r.STYLE || r.USE_CODE || "").trim() || null,
      county_fips: cityDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "ma_massgis_l3",
      data: {
        city: cityDef.name,
        ownerName: String(r.OWNER1 || "").trim() || null,
        ownerAddr: String(r.OWN_ADDR || "").trim() || null,
        ownerCity: String(r.OWN_CITY || "").trim() || null,
        ownerState: String(r.OWN_STATE || "").trim() || null,
        ownerZip: String(r.OWN_ZIP || "").trim() || null,
        ownerCountry: String(r.OWN_CO || "").trim() || null,
        absentee: (r.OWN_STATE || "").trim().toUpperCase() !== "MA",
        bldgValue: Number(r.BLDG_VAL) || null,
        landValue: Number(r.LAND_VAL) || null,
        totalValue: Number(r.TOTAL_VAL) || null,
        salePrice: Number(r.LS_PRICE) || null,
        saleDate: r.LS_DATE || null,
        useCode: r.USE_CODE || null,
        style: r.STYLE || null,
        numRooms: Number(r.NUM_ROOMS) || null,
        stories: Number(r.STORIES) || null,
        units: Number(r.UNITS) || null,
        fiscalYear: r.FY || null,
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

async function getProgress(cityName) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "ma_index_progress").eq("email", `ma_city:${cityName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(cityName, nextOffset, total, done) {
  db.kpi("ma_index_progress", `ma_city:${cityName}`, { cityName, nextOffset, total, done });
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
  let cityName = (body.city || body.county || "").trim().toUpperCase() || null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  let cDef = null;
  if (cityName) {
    cDef = CITY_QUEUE.find(t => t.name === cityName);
    if (!cDef) return { statusCode: 400, headers: CORS,
      body: JSON.stringify({ error: `Unknown city. Valid: ${CITY_QUEUE.map(t => t.name).join(", ")}` }) };
    const prog = await getProgress(cDef.name);
    if (offset == null) offset = body.resetCity ? 0 : prog.offset;
    total = prog.total;
  } else {
    for (const c of CITY_QUEUE) {
      const prog = await getProgress(c.name);
      if (!prog.done) { cDef = c; offset = prog.offset; total = prog.total; break; }
    }
    if (!cDef) return { statusCode: 200, headers: CORS,
      body: JSON.stringify({ message: "All MA cities indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef.name);
    console.log(`[index-massachusetts] ${cDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(cDef.name, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(cDef.name, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ city: cDef.name, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, cDef, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset  = offset + rows.length;
    const cDone   = rows.length < runSize || newOffset >= total;
    const pct        = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const next   = cDone ? (CITY_QUEUE[CITY_QUEUE.indexOf(cDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(cDef.name, cDone ? 0 : newOffset, total, cDone);
    db.kpi("ma_property_indexed", null, { city: cDef.name, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      city: cDef.name, fips: cDef.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, fetched: rows.length, upserted: dryRun ? 0 : master.length, errors: writeErrors.length,
      done: cDone, nextCity: next, dryRun,
      message: cDone
        ? `${cDef.name} complete (${total}). Next: ${next || "ALL DONE"}`
        : `${cDef.name}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-massachusetts]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

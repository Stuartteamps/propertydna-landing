/**
 * PropertyDNA — Connecticut Luxury Market Indexer
 *
 * Source: Connecticut CAMA and Parcel Layer (CT Geodata Portal, public, no key)
 * URL: https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0
 *
 * Fields: OWNER_NAME, Co_Owner, Mailing_Address, Mailing_City, Mailing_State,
 *         Assessed_Total, Assessed_Land, Assessed_Building, Town
 *
 * Targets Fairfield County luxury towns: Greenwich, Westport, Darien, New Canaan,
 * Wilton, Weston, Ridgefield, Fairfield, Westport, Stamford, New Canaan
 *
 * POST /.netlify/functions/index-connecticut
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { town?: string, offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const CT_BASE = "https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0";
const DEFAULT_BATCH = 1000;
const STATE_FIPS = "09"; // Connecticut

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// Fairfield County luxury towns + surrounding CT luxury markets
// Town names as they appear in the CAMA layer (exact spelling TBD — may need adjustment)
const TOWN_QUEUE = [
  // Fairfield County — ultra luxury
  { name: "Greenwich",   fips: "09001" },
  { name: "Darien",      fips: "09001" },
  { name: "New Canaan",  fips: "09001" },
  { name: "Westport",    fips: "09001" },
  { name: "Weston",      fips: "09001" },
  { name: "Wilton",      fips: "09001" },
  { name: "Ridgefield",  fips: "09001" },
  { name: "Fairfield",   fips: "09001" },
  { name: "Stamford",    fips: "09001" },
  { name: "Norwalk",     fips: "09001" },
  { name: "Trumbull",    fips: "09001" },
  { name: "Monroe",      fips: "09001" },
  // New Haven County luxury towns
  { name: "Woodbridge",  fips: "09009" },
  { name: "Orange",      fips: "09009" },
  // Litchfield County
  { name: "Washington",  fips: "09005" },
  { name: "Roxbury",     fips: "09005" },
  { name: "Warren",      fips: "09005" },
];

// CT property type codes — residential typically "R" or similar
// Will filter on Assessed_Building > 0 (has improvements)
const COST_SQFT = 350; // CT luxury average

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

function townWhere(townName) {
  // Try both exact and upper-case — CT layer may use either
  const t = townName.replace(/'/g, "''");
  return `Town='${t}' AND Assessed_Building > 0 AND OWNER_NAME IS NOT NULL`;
}

async function fetchBatch(townName, offset, count) {
  const params = new URLSearchParams({
    where: townWhere(townName),
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${CT_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(townName) {
  const params = new URLSearchParams({
    where: townWhere(townName),
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${CT_BASE}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function computeCTDNA(row) {
  const assessed = Number(row.Assessed_Total || row.ASSESSED_TOTAL) || 0;
  const land     = Number(row.Assessed_Land  || row.ASSESSED_LAND)  || 0;
  const bldg     = Number(row.Assessed_Building || row.ASSESSED_BUILDING) || 0;
  const yrBlt    = Number(row.YEAR_BUILT || row.YR_BLT || row.YearBuilt) || 0;
  const sqft     = Number(row.SQFT || row.SqFt || row.TOTAL_SQFT || row.living_area) || 0;

  // CT assessed values are typically 70% of fair market value
  const marketEst = assessed > 0 ? assessed / 0.70 : 0;
  const improvEst = bldg > 0 ? bldg / 0.70 : Math.max(0, marketEst - land / 0.70);
  const age       = yrBlt > 1800 ? new Date().getFullYear() - yrBlt : 30;
  const depr      = Math.max(0.20, 1 - age * 0.010);
  const expected  = sqft > 0 ? sqft * COST_SQFT * depr : 0;
  const rr        = expected > 0 ? Math.round((improvEst / expected) * 100) / 100 : 1.0;
  const cond      = rr > 1.5 ? 93 : rr > 1.3 ? 82 : rr > 1.1 ? 72 : rr > 0.9 ? 63 : rr > 0.7 ? 50 : 38;

  return {
    renovationRatio: rr, conditionScore: cond,
    assessedTotal: assessed || null, assessedLand: land || null, assessedBldg: bldg || null,
    estMarketValue: Math.round(marketEst) || null,
    dataQuality: assessed > 0 && yrBlt > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildRows(rows, fips, townName, today) {
  const master = [], history = [];
  for (const row of rows) {
    // CT parcel IDs vary by town — use whatever ID field is available
    const apn = String(
      row.ParcelID || row.PARCEL_ID || row.MAP_LOT || row.GIS_PIN || row.OBJECTID || ""
    ).trim();
    if (!apn) continue;

    const ownerName = String(row.OWNER_NAME || "").trim();
    if (!ownerName || ownerName.toUpperCase() === "CURRENT OWNER") continue;

    const addr = String(row.Location || row.LOCATION || row.SITE_ADDRESS || row.SiteAddress || "").trim();
    const dna  = computeCTDNA(row);

    // Build a unique APN with town prefix to avoid collisions across towns
    const uniqueApn = `CT-${fips}-${apn}`;

    master.push({
      apn: uniqueApn, county_fips: fips,
      address: addr || null, city: townName, state: "CT",
      zip: String(row.ZIP || row.Zip || row.POSTAL_CODE || "").trim().slice(0, 5) || null,
      sqft: Number(row.SQFT || row.SqFt || row.living_area) || null,
      year_built: Number(row.YEAR_BUILT || row.YR_BLT || row.YearBuilt) > 1800
        ? Number(row.YEAR_BUILT || row.YR_BLT || row.YearBuilt) : null,
      tax_assessed_value: Number(row.Assessed_Total || row.ASSESSED_TOTAL) || null,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn: uniqueApn, event_type: "assessment", event_date: today, source: "ct_cama",
      data: {
        address: addr, town: townName,
        ownerName,
        coOwner: String(row.Co_Owner || row.CO_OWNER || "").trim() || null,
        mailingAddr: String(row.Mailing_Address || "").trim() || null,
        mailingCity: String(row.Mailing_City || "").trim() || null,
        mailingState: String(row.Mailing_State || "").trim() || null,
        zip: String(row.ZIP || row.Zip || "").trim() || null,
        assessedTotal: Number(row.Assessed_Total) || null,
        assessedLand: Number(row.Assessed_Land) || null,
        assessedBldg: Number(row.Assessed_Building) || null,
        preYearTotal: Number(row.Pre_Year_Assessed_Total) || null,
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

async function getProgress(townName) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "ct_index_progress").eq("email", `ct_town:${townName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(townName, nextOffset, total, done) {
  db.kpi("ct_index_progress", `ct_town:${townName}`, { townName, nextOffset, total, done });
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
  let townName = (body.town || "").trim() || null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  let townDef = null;
  if (townName) {
    townDef = TOWN_QUEUE.find(t => t.name.toLowerCase() === townName.toLowerCase());
    if (!townDef) return { statusCode: 400, headers: CORS,
      body: JSON.stringify({ error: `Unknown town. Valid: ${TOWN_QUEUE.map(t => t.name).join(", ")}` }) };
    const prog = await getProgress(townDef.name);
    if (offset == null) offset = body.resetTown ? 0 : prog.offset;
    total = prog.total;
  } else {
    for (const t of TOWN_QUEUE) {
      const prog = await getProgress(t.name);
      if (!prog.done) { townDef = t; offset = prog.offset; total = prog.total; break; }
    }
    if (!townDef) return { statusCode: 200, headers: CORS,
      body: JSON.stringify({ message: "All CT luxury towns indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(townDef.name);
    console.log(`[index-connecticut] ${townDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(townDef.name, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(townDef.name, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ town: townDef.name, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, townDef.fips, townDef.name, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset  = offset + rows.length;
    const townDone   = rows.length < runSize || newOffset >= total;
    const pct        = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextTown   = townDone ? (TOWN_QUEUE[TOWN_QUEUE.indexOf(townDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(townDef.name, townDone ? 0 : newOffset, total, townDone);
    db.kpi("ct_property_indexed", null, { town: townDef.name, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      town: townDef.name, fips: townDef.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, errors: writeErrors.length,
      townDone, nextTown, dryRun,
      message: townDone
        ? `${townDef.name} complete (${total}). Next: ${nextTown || "ALL DONE"}`
        : `${townDef.name}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-connecticut]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

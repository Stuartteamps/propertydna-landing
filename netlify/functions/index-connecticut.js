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
  const t = townName.replace(/'/g, "''");
  return `Town_Name='${t}' AND Assessed_Building > 0 AND Owner IS NOT NULL`;
}

async function fetchBatch(townName, offset, count) {
  const params = new URLSearchParams({
    where: townWhere(townName),
    outFields: [
      "OBJECTID","Parcel_ID","CAMA_Link","Town_Name","Location","Full_Address",
      "Property_City","Property_Zip",
      "Owner","Co_Owner","Mailing_Address","Mailing_City","Mailing_State","Mailing_Zip",
      "Assessed_Total","Assessed_Land","Assessed_Building",
      "Appraised_Land","Appraised_Building","Appraised_Outbuilding",
      "AYB","EYB","Living_Area","Condition",
      "Number_of_Bedroom","Number_of_Baths","Number_of_Half_Baths","Total_Rooms",
      "State_Use","State_Use_Description","Zone",
      "Sale_Price","Sale_Date","Prior_Sale_Price","Prior_Sale_Date",
      "FIPS",
    ].join(","),
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
  // CT CAMA has EYB (Effective Year Built) and AYB (Actual Year Built) — same renovation signal as FL
  const ayb      = Number(row.AYB) || 0;
  const eyb      = Number(row.EYB) || ayb;
  const sqft     = Number(row.Living_Area) || 0;
  const apprBldg = Number(row.Appraised_Building) || 0;
  const apprLand = Number(row.Appraised_Land) || 0;
  const totalAppraised = apprBldg + apprLand;

  const now     = new Date().getFullYear();
  const effAge  = eyb > 1800 ? now - eyb : 30;
  const actAge  = ayb > 1800 ? now - ayb : 30;
  const depr    = Math.max(0.20, 1 - effAge * 0.009);
  const expected = sqft > 0 ? sqft * COST_SQFT * depr : 0;
  const rr      = expected > 0 ? Math.round((apprBldg / expected) * 100) / 100 : 1.0;

  const renovRecognized = eyb > 1800 && ayb > 1800 && eyb > ayb + 10;
  const fullyRemod      = rr > 1.35 && renovRecognized;
  const cond    = rr > 1.5 ? 93 : rr > 1.3 ? 82 : rr > 1.1 ? 72 : rr > 0.9 ? 63 : rr > 0.7 ? 50 : 38;

  return {
    renovationRatio: rr, conditionScore: cond,
    effectiveYearBuilt: eyb || null,
    appraisedTotal: totalAppraised || null,
    appraisedLand: apprLand || null,
    appraisedBldg: apprBldg || null,
    detectedFeatures: { renovation_recognized: renovRecognized, fully_remodeled: fullyRemod },
    dataQuality: sqft > 0 && ayb > 0 && totalAppraised > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildRows(rows, fips, townName, today) {
  const master = [], history = [];
  for (const row of rows) {
    // CAMA_Link includes town code prefix (e.g. "08070-134-41A" for Bridgeport)
    // — guarantees uniqueness across CT towns, unlike bare Parcel_ID
    const rawApn = String(row.CAMA_Link || row.Parcel_ID || row.OBJECTID || "").trim();
    if (!rawApn) continue;
    const ownerName = String(row.Owner || "").trim();
    if (!ownerName || ownerName.toUpperCase() === "CURRENT OWNER") continue;

    const addr = String(row.Full_Address || row.Location || "").trim();
    const uniqueApn = `CT-${rawApn}`;
    const dna = computeCTDNA(row);

    master.push({
      apn: uniqueApn, county_fips: fips,
      address: String(row.Location || "").trim() || null,
      city: String(row.Property_City || townName).trim(),
      state: "CT",
      zip: String(row.Property_Zip || "").trim().slice(0, 5) || null,
      beds: Number(row.Number_of_Bedroom) || null,
      baths: Number(row.Number_of_Baths) || null,
      sqft: Number(row.Living_Area) || null,
      year_built: Number(row.AYB) > 1800 ? Number(row.AYB) : null,
      tax_assessed_value: Number(row.Assessed_Total) || null,
      property_type: String(row.State_Use_Description || "").trim() || null,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn: uniqueApn, event_type: "assessment", event_date: today, source: "ct_cama",
      data: {
        address: addr, town: townName,
        ownerName,
        coOwner: String(row.Co_Owner || "").trim() || null,
        mailingAddr: String(row.Mailing_Address || "").trim() || null,
        mailingCity: String(row.Mailing_City || "").trim() || null,
        mailingState: String(row.Mailing_State || "").trim() || null,
        mailingZip: String(row.Mailing_Zip || "").trim() || null,
        absentee: (row.Mailing_State || "").trim().toUpperCase() !== "CT",
        assessedTotal: Number(row.Assessed_Total) || null,
        assessedLand: Number(row.Assessed_Land) || null,
        assessedBldg: Number(row.Assessed_Building) || null,
        actualYearBuilt: Number(row.AYB) || null,
        salePrice: Number(row.Sale_Price) || null,
        saleDate: row.Sale_Date || null,
        beds: Number(row.Number_of_Bedroom) || null,
        baths: Number(row.Number_of_Baths) || null,
        condition: row.Condition || null,
        stateUse: row.State_Use_Description || null,
        fips: row.FIPS || null,
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

/**
 * PropertyDNA — Maryland Indexer
 *
 * Sources (verified live):
 *   • Anne Arundel — AA Co Planning OpenData (267k parcels, SDAT fields)
 *     https://gis.aacounty.org/arcgis/rest/services/OpenData/Planning_OpenData/MapServer/34
 *   • Baltimore County — BCo Property Tax parcels (374k, owner + value + year_built)
 *     https://bcgis.baltimorecountymd.gov/arcgis/rest/services/Property/Property/MapServer/1
 *
 * Note: Statewide MD SDAT data is not exposed via free ArcGIS — Montgomery and
 * Howard Counties don't have an open parcel-level feature server with assessment
 * data. Those will require SDAT API integration (separate task). This indexer
 * covers ~640k Maryland parcels via the two largest counties with open data.
 *
 * POST /.netlify/functions/index-maryland
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "MD";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const ANNE_ARUNDEL_URL = "https://gis.aacounty.org/arcgis/rest/services/OpenData/Planning_OpenData/MapServer/34";
const BALTIMORE_CO_URL = "https://bcgis.baltimorecountymd.gov/arcgis/rest/services/Property/Property/MapServer/1";

const COUNTY_QUEUE = [
  { name: "Anne Arundel", fips: "24003", source: "anne_arundel", url: ANNE_ARUNDEL_URL },
  { name: "Baltimore",    fips: "24005", source: "baltimore_co", url: BALTIMORE_CO_URL },
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
  if (c.source === "anne_arundel") return "ASST_FIRST_OWNER IS NOT NULL";
  return "OWNER_NA1 IS NOT NULL"; // baltimore_co
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
  // Some MapServers (Baltimore Co) return outStatistics with uppercase CNT.
  // returnCountOnly is universally supported, simpler, and case-safe.
  const params = new URLSearchParams({
    where: whereFor(c),
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${c.url}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function aaRow(r, fips) {
  const apnRaw = String(r.ASST_ACCOUNT_NO || r.PUID || "").trim();
  if (!apnRaw) return null;
  const houseNum = String(r.ASST_HOUSE_NO || "").trim();
  const dir = String(r.ASST_STREET_DIR || "").trim();
  const name = String(r.ASST_STREET_NAME || "").trim();
  const type = String(r.ASST_STREET_TYPE || "").trim();
  const addr = [houseNum, dir, name, type].filter(Boolean).join(" ").trim();
  return {
    apn: `MD-AA-${apnRaw}`,
    address_line1: addr || null,
    address: addr || null,
    city: String(r.ASST_POST_OFFICE || "").trim() || null,
    state: STATE,
    zip: String(r.ASST_ZIP_CODE || "").slice(0, 5) || null,
    year_built: Number(r.ASST_YR_BUILT) > 1800 ? Number(r.ASST_YR_BUILT) : null,
    lot_sqft: r.ASST_PROP_SIZE_TYP === "S" ? Number(r.ASST_PROP_SIZE) : null,
    property_type: String(r.ASST_DWELL_TYPE || r.PROPERTY_TYPE || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function bcRow(r, fips) {
  const apnRaw = String(r.TAXPIN || r.PIN || "").trim();
  if (!apnRaw) return null;
  const num = String(r.ST_NUM || "").trim();
  const dir = String(r.ST_DIR || "").trim();
  const name = String(r.STREETNAME || "").trim();
  const type = String(r.STREETTYPE || "").trim();
  const addr = String(r.PREMISE_ADDRESS || [num, dir, name, type].filter(Boolean).join(" ")).trim();
  return {
    apn: `MD-BC-${apnRaw}`,
    address_line1: addr || null,
    address: addr || null,
    city: String(r.CITY || "").trim() || null,
    state: STATE,
    zip: String(r.ZIP_CODE || "").slice(0, 5) || null,
    year_built: Number(r.YEAR_BUILT) > 1800 ? Number(r.YEAR_BUILT) : null,
    lot_sqft: Number(r.LAND_AREA) || null,
    tax_assessed_value: Number(r.TOTAL_VALUE) || null,
    property_type: String(r.BRF_PROPERTY_TYPE || r.GIS_LU_CODE || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "anne_arundel") m = aaRow(r, c.fips);
    if (c.source === "baltimore_co") m = bcRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    history.push({
      apn: m.apn, event_type: "assessment", event_date: today, source: `md_${c.source}`,
      data: {
        county: c.name,
        ownerName: String(r.ASST_FIRST_OWNER || r.FULL_OWNER_NAME || r.OWNER_NA1 || "").trim() || null,
        ownerName2: String(r.ASST_SECND_OWNER || r.OWNER_NA2 || "").trim() || null,
        ownerAddr: String(r.MADR_LINE_1 || r.ADDRESS_1 || "").trim() || null,
        ownerCity: String(r.OWNER_CITY || "").trim() || null,
        ownerState: String(r.OWNERSTATE || "").trim() || null,
        ownerZip: String(r.OWNER_ZIP || "").trim() || null,
        totalValue: Number(r.TOTAL_VALUE) || null,
        transferDate: r.ASST_TRANSFER_DATE || null,
      },
    });
  }
  return { master, history };
}

function dedupeByApn(rows) {
  // ArcGIS source can return condo/sub-parcel records with duplicate APNs;
  // Postgres ON CONFLICT rejects batches with intra-batch dupes. Keep first.
  const seen = new Set(); const out = [];
  for (const r of rows) {
    if (seen.has(r.apn)) continue;
    seen.add(r.apn); out.push(r);
  }
  return out;
}
function dedupeHistory(rows) {
  const seen = new Set(); const out = [];
  for (const r of rows) {
    const k = `${r.apn}|${r.event_type}|${r.event_date}|${r.source}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  const cleanMaster = dedupeByApn(masterRows);
  const cleanHistory = dedupeHistory(historyRows);
  await Promise.all([
    db.upsert("property_master", cleanMaster, "apn").catch(e => {
      console.error("[md upsert err]", e.message);
      errors.push(e.message.slice(0, 200));
    }),
    db.insert("property_history", cleanHistory).catch((e) => {
      // history dedupe relies on PK (apn,event_type,event_date,source) — silence
    }),
  ]);
  return errors;
}

async function getProgress(countyName) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "md_index_progress").eq("email", `md_county:${countyName}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(countyName, nextOffset, total, done) {
  db.kpi("md_index_progress", `md_county:${countyName}`, { countyName, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All MD counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-maryland] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("md_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-maryland]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

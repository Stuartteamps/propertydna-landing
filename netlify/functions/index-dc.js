/**
 * PropertyDNA — Washington DC Indexer
 *
 * Source: DC OCTO Property and Land Common Ownership Layer (137k records, public)
 *   https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40
 *
 * Fields: SSL (Square-Suffix-Lot APN), OWNERNAME, PREMISEADD, NEWLAND, NEWIMPR,
 *         NEWTOTAL, ASSESSMENT, ANNUALTAX, SALEPRICE, SALEDATE, USECODE
 *
 * District-wide (single jurisdiction). DC FIPS = 11001.
 *
 * POST /.netlify/functions/index-dc
 * Body: { offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DC_URL = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40";
const DEFAULT_BATCH = 1000;
const STATE = "DC";
const FIPS = "11001";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

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

const WHERE = "OWNERNAME IS NOT NULL AND PREMISEADD IS NOT NULL";

async function fetchBatch(offset, count) {
  const params = new URLSearchParams({
    where: WHERE,
    outFields: "OBJECTID,SSL,SQUARE,LOT,OWNERNAME,CAREOFNAME,ADDRESS1,ADDRESS2,CITYSTZIP,PREMISEADD,QUADRANT,QDRNTNAME,PRMSWARD,NBHDNAME,USECODE,LANDAREA,NEWLAND,NEWIMPR,NEWTOTAL,OLDTOTAL,ASSESSMENT,ANNUALTAX,SALEPRICE,SALEDATE,SALETYPE,UNITNUMBER,CLASSTYPE,EFFECTIVETAXYEAR,STREETNAME,LOWNUMBER",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${DC_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount() {
  // DC server uses MapServer (not FeatureServer) which doesn't reliably honor
  // outStatistics. Use returnCountOnly which works on all ArcGIS servers.
  const params = new URLSearchParams({
    where: WHERE,
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${DC_URL}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function parseDCAddress(premiseAdd) {
  if (!premiseAdd) return { city: "WASHINGTON", zip: null };
  // Format: "1600 PENNSYLVANIA AVE NW WASHINGTON DC 20500"
  const zipMatch = premiseAdd.match(/(\d{5})(-\d{4})?\s*$/);
  return {
    city: "WASHINGTON",
    zip: zipMatch ? zipMatch[1] : null,
  };
}

function buildRows(rows, today) {
  const master = [], history = [];
  for (const r of rows) {
    const apnRaw = String(r.SSL || "").trim().replace(/\s+/g, "");
    if (!apnRaw) continue;
    const apn = `DC-${apnRaw}`;
    const parsed = parseDCAddress(r.PREMISEADD);
    master.push({
      apn,
      address_line1: String(r.PREMISEADD || "").trim() || null,
      address: String(r.PREMISEADD || "").trim() || null,
      city: parsed.city,
      state: STATE,
      zip: parsed.zip,
      lot_sqft: Number(r.LANDAREA) || null,
      tax_assessed_value: Number(r.NEWTOTAL) || Number(r.ASSESSMENT) || null,
      property_type: String(r.USECODE || "").trim() || null,
      county_fips: FIPS,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "dc_octo_cama",
      data: {
        ssl: r.SSL, square: r.SQUARE, lot: r.LOT,
        ownerName: String(r.OWNERNAME || "").trim() || null,
        careOfName: String(r.CAREOFNAME || "").trim() || null,
        ownerAddr1: String(r.ADDRESS1 || "").trim() || null,
        ownerAddr2: String(r.ADDRESS2 || "").trim() || null,
        ownerCityStZip: String(r.CITYSTZIP || "").trim() || null,
        quadrant: r.QUADRANT || null,
        ward: r.PRMSWARD || null,
        neighborhood: r.NBHDNAME || null,
        useCode: r.USECODE || null,
        classType: r.CLASSTYPE || null,
        newLand: Number(r.NEWLAND) || null,
        newImpr: Number(r.NEWIMPR) || null,
        newTotal: Number(r.NEWTOTAL) || null,
        oldTotal: Number(r.OLDTOTAL) || null,
        annualTax: Number(r.ANNUALTAX) || null,
        salePrice: Number(r.SALEPRICE) || null,
        saleDate: r.SALEDATE || null,
        saleType: r.SALETYPE || null,
        taxYear: r.EFFECTIVETAXYEAR || null,
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

async function getProgress() {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "dc_index_progress").eq("email", "dc_district")
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(nextOffset, total, done) {
  db.kpi("dc_index_progress", "dc_district", { nextOffset, total, done });
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
  const prog = await getProgress();
  let offset = body.offset != null ? Number(body.offset) : (body.reset ? 0 : prog.offset);
  let total = prog.total;

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount();
    console.log(`[index-dc] offset=${offset} | total=${total}`);

    const rows = await fetchBatch(offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset  = offset + rows.length;
    const done   = rows.length < runSize || newOffset >= total;
    const pct        = total > 0 ? Math.round((newOffset / total) * 100) : null;

    if (!dryRun) await saveProgress(done ? 0 : newOffset, total, done);
    db.kpi("dc_property_indexed", null, { processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      fips: FIPS,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, fetched: rows.length, upserted: dryRun ? 0 : master.length, errors: writeErrors.length,
      done, dryRun,
      message: done
        ? `DC complete (${total}).`
        : `DC: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-dc]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

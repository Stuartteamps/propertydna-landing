/**
 * PropertyDNA — South Carolina Coastal/Upstate Indexer
 *
 * Sources (verified live):
 *   • Charleston County — services1.arcgis.com/G0z1RCvykC1mcsVI Parcels
 *     Fields: PID, OWNER, ADDR (sparse but ~394k parcels)
 *   • Greenville County — services3.arcgis.com/bjOyhhlaaCIcmO3H TaxParcel02172021_gdb
 *     Fields: PIN, OWNAM1, OWNAM2, STREET, CITY, ZIP5, TAXMKTVAL, BLDGVAL, LANDVAL,
 *     BATHRMS, BEDROOMS, SQFEET, SLPRICE, etc. (228k parcels, very rich)
 *
 * POST /.netlify/functions/index-southcarolina
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "SC";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const CHAR_URL = "https://services1.arcgis.com/G0z1RCvykC1mcsVI/arcgis/rest/services/Parcels/FeatureServer/0";
const GREEN_URL = "https://services3.arcgis.com/bjOyhhlaaCIcmO3H/arcgis/rest/services/TaxParcel02172021_gdb/FeatureServer/0";

const COUNTY_QUEUE = [
  { name: "Greenville", fips: "45045", source: "greenville", url: GREEN_URL },
  { name: "Charleston", fips: "45019", source: "charleston", url: CHAR_URL },
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
  if (c.source === "greenville") return "OWNAM1 IS NOT NULL";
  if (c.source === "charleston") return "OWNER IS NOT NULL";
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

function greenvilleRow(r, fips) {
  const apn = String(r.PIN || r.ACCTNO || "").trim();
  if (!apn) return null;
  return {
    apn: `SC-${fips}-${apn}`,
    address_line1: String(r.STREET || "").trim() || null,
    address: String(r.STREET || "").trim() || null,
    city: String(r.CITY || "").trim() || null,
    state: STATE,
    zip: String(r.ZIP5 || "").trim().slice(0, 5) || null,
    beds: Number(r.BEDROOMS) || null,
    baths: Number(r.BATHRMS) || null,
    sqft: Number(r.SQFEET) || null,
    lot_sqft: Number(r.TACRES) ? Math.round(Number(r.TACRES) * 43560) : null,
    tax_assessed_value: Number(r.TAXMKTVAL) || Number(r.FAIRMKTVAL) || null,
    property_type: String(r.LANDUSE || r.DESCR || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function charlestonRow(r, fips) {
  const apn = String(r.PID || "").trim();
  if (!apn) return null;
  return {
    apn: `SC-${fips}-${apn}`,
    address_line1: String(r.ADDR || "").trim() || null,
    address: String(r.ADDR || "").trim() || null,
    state: STATE,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "greenville") m = greenvilleRow(r, c.fips);
    if (c.source === "charleston") m = charlestonRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    history.push({
      apn: m.apn, event_type: c.source === "greenville" ? "assessment" : "boundary",
      event_date: today, source: `sc_${c.source}`,
      data: {
        county: c.name,
        ownerName: String(r.OWNAM1 || r.OWNER || "").trim() || null,
        ownerName2: String(r.OWNAM2 || "").trim() || null,
        salePrice: Number(r.SLPRICE) || null,
        bldgValue: Number(r.BLDGVAL) || null,
        landValue: Number(r.LANDVAL) || null,
        taxMktValue: Number(r.TAXMKTVAL) || null,
        fairMktValue: Number(r.FAIRMKTVAL) || null,
        totalTax: Number(r.TOTTAX) || null,
        sqft: Number(r.SQFEET) || null,
        beds: Number(r.BEDROOMS) || null,
        baths: Number(r.BATHRMS) || null,
        halfBaths: Number(r.HALFBATH) || null,
        acres: Number(r.TACRES) || null,
        landUse: r.LANDUSE || null,
        zoning: r.ZONECD || null,
        propType: r.PROPTYPE || null,
        subdivision: r.SUBDIV || null,
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
    .eq("event_type", "sc_index_progress").eq("email", `sc_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("sc_index_progress", `sc_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All SC counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-southcarolina] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("sc_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-southcarolina]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

/**
 * PropertyDNA — Wyoming Jackson Hole Luxury Indexer
 *
 * Source: 2024 Wyoming Statewide Parcels
 *   https://services1.arcgis.com/lDFzr3JyGEn5Eymu/arcgis/rest/services/2024_Wyoming_Parcels/FeatureServer/0
 *
 * Fields: OBJECTID, parcelnb, ownername1, actualvalu, assessedva
 * No county field; we filter by parcelnb LIKE '22%' for Teton (WY counties
 * alphabetical numeric code where Teton = 22). 4,253 parcels live.
 *
 * POST /.netlify/functions/index-wyomingluxury
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const WY_URL = "https://services1.arcgis.com/lDFzr3JyGEn5Eymu/arcgis/rest/services/2024_Wyoming_Parcels/FeatureServer/0";
const DEFAULT_BATCH = 1000;
const STATE = "WY";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const COUNTY_QUEUE = [
  // Wyoming statewide parcel layer prefixes parcelnb with a 2-digit county code.
  // Teton County (Jackson Hole) = 22.
  { name: "Teton", fips: "56039", prefix: "22" },
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

function whereCounty(prefix) {
  return `parcelnb LIKE '${prefix}%'`;
}

async function fetchBatch(prefix, offset, count) {
  const params = new URLSearchParams({
    where: whereCounty(prefix),
    outFields: "OBJECTID,parcelnb,ownername1,actualvalu,assessedva",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${WY_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(prefix) {
  const params = new URLSearchParams({
    where: whereCounty(prefix),
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${WY_URL}/query?${params}`);
  return Number(res.data?.count) || 0;
}

function buildRows(rows, cDef, today) {
  const master = [], history = [];
  for (const r of rows) {
    const parcelnb = String(r.parcelnb || "").trim();
    if (!parcelnb) continue;
    const apn = `WY-${cDef.fips}-${parcelnb}`;
    master.push({
      apn,
      state: STATE,
      city: cDef.name === "Teton" ? "JACKSON" : null,
      tax_assessed_value: Number(r.actualvalu) || null,
      county_fips: cDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "wy_state_2024",
      data: {
        county: cDef.name,
        parcelNb: parcelnb,
        ownerName: String(r.ownername1 || "").trim() || null,
        actualValue: Number(r.actualvalu) || null,
        assessedValue: Number(r.assessedva) || null,
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
    .eq("event_type", "wy_index_progress").eq("email", `wy_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("wy_index_progress", `wy_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All WY luxury counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef.prefix);
    console.log(`[index-wyomingluxury] ${cDef.name} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(cDef.prefix, offset, runSize);
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
    db.kpi("wy_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-wyomingluxury]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

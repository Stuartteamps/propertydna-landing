/**
 * PropertyDNA — Lake Tahoe Luxury Indexer (Placer CA, El Dorado CA, Douglas NV)
 *
 * Washoe NV (Reno + Incline Village) is already covered by index-reno.js — this
 * indexer fills the North Lake Tahoe (Placer/Tahoe City), South Tahoe (El Dorado),
 * and East Shore (Douglas NV) markets.
 *
 * Sources (verified live):
 *   • Placer County CA — services9.arcgis.com/ETP7IuCigkUz7iI9 Placer_County_Parcels
 *     197,000 parcels, full CAMA (APN, LandValue, StructureSF, EffectiveYr,
 *     SitusAddressFull, Mailing*, etc.)
 *   • El Dorado County CA — services.arcgis.com/0xnwbwUttaTjns4i Parcel_data_El_Dorado
 *     104,105 parcels, rich CAMA (PRCL_ID, OWNERNAME, OWNERADDR, STRUCTVAL, LANDVAL,
 *     USECDLIT, ACREAGE, CITY, SITUSSTRNB, SITUSSTRNA, SITUSSTRTY)
 *   • Douglas County NV — arcgis.water.nv.gov statewide layer filtered by COUNTY='DOUGLAS'
 *     (boundary + APN + SiteCity + Website only — NRS 250 restricts owner/value data)
 *
 * POST /.netlify/functions/index-tahoeluxury
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const PLACER_URL    = "https://services9.arcgis.com/ETP7IuCigkUz7iI9/arcgis/rest/services/Placer_County_Parcels/FeatureServer/0";
const ELDORADO_URL  = "https://services.arcgis.com/0xnwbwUttaTjns4i/arcgis/rest/services/Parcel_data_El_Dorado/FeatureServer/0";
const DOUGLAS_URL   = "https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0";

const COUNTY_QUEUE = [
  { name: "Placer",    fips: "06061", source: "placer",    url: PLACER_URL,    state: "CA" },
  { name: "ElDorado",  fips: "06017", source: "eldorado",  url: ELDORADO_URL,  state: "CA" },
  { name: "Douglas",   fips: "32005", source: "douglas",   url: DOUGLAS_URL,   state: "NV" },
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
  if (c.source === "placer")   return "APN IS NOT NULL";
  if (c.source === "eldorado") return "PRCL_ID IS NOT NULL";
  if (c.source === "douglas")  return "COUNTY='DOUGLAS'";
  return "1=1";
}

async function fetchBatch(c, offset, count) {
  const params = new URLSearchParams({
    where: whereFor(c),
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: c.source === "eldorado" ? "FID ASC" : "OBJECTID ASC",
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

function placerRow(r, cDef) {
  const apn = String(r.APN || "").trim();
  if (!apn) return null;
  return {
    apn: `CA-${cDef.fips}-${apn}`,
    address_line1: String(r.SitusAddressFull || r.FormattedSitus1 || "").trim() || null,
    address: String(r.SitusAddressFull || r.FormattedSitus1 || "").trim() || null,
    city: String(r.Community || "").trim() || null,
    state: cDef.state,
    zip: String(r.SitusZip || "").trim().slice(0, 5) || null,
    year_built: Number(r.EffectiveYr) > 1800 ? Number(r.EffectiveYr) : null,
    sqft: Number(r.StructureSF) || null,
    lot_sqft: Number(r.LandSF) || (Number(r.Acres) ? Math.round(Number(r.Acres) * 43560) : null),
    tax_assessed_value: (Number(r.LandValue) || 0) + (Number(r.Structure) || 0) || null,
    property_type: String(r.Use_Cd_N || r.Asmt_Desc || "").trim() || null,
    county_fips: cDef.fips,
    last_updated: new Date().toISOString(),
  };
}

function elDoradoRow(r, cDef) {
  const apn = String(r.PRCL_ID || r.GIS_ID || "").trim();
  if (!apn) return null;
  const num = String(r.SITUSSTRNB || "").trim();
  const street = String(r.SITUSSTRNA || "").trim();
  const sufx = String(r.SITUSSTRTY || "").trim();
  const addr = [num, street, sufx].filter(Boolean).join(" ") || null;
  return {
    apn: `CA-${cDef.fips}-${apn}`,
    address_line1: addr,
    address: addr,
    city: String(r.CITY || "").trim() || null,
    state: cDef.state,
    sqft: null,
    lot_sqft: Number(r.ACREAGE) ? Math.round(Number(r.ACREAGE) * 43560) : null,
    tax_assessed_value: (Number(r.STRUCTVAL) || 0) + (Number(r.LANDVAL) || 0) || null,
    property_type: String(r.USECDLIT || r.PRCLTYPE || "").trim() || null,
    county_fips: cDef.fips,
    last_updated: new Date().toISOString(),
  };
}

function douglasRow(r, cDef) {
  const apn = String(r.APN || r.PIN || "").trim();
  if (!apn) return null;
  return {
    apn: `NV-${cDef.fips}-${apn}`,
    city: String(r.SiteCity || "").trim() || null,
    state: cDef.state,
    lot_sqft: Number(r.Acres) ? Math.round(Number(r.Acres) * 43560) : null,
    county_fips: cDef.fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "placer")   m = placerRow(r, c);
    if (c.source === "eldorado") m = elDoradoRow(r, c);
    if (c.source === "douglas")  m = douglasRow(r, c);
    if (!m) continue;
    master.push(m);
    history.push({
      apn: m.apn, event_type: c.source === "douglas" ? "boundary" : "assessment",
      event_date: today, source: `tahoe_${c.source}`,
      data: {
        county: c.name,
        // Placer
        landValue: Number(r.LandValue || r.LANDVAL) || null,
        structureValue: Number(r.Structure || r.STRUCTVAL) || null,
        useCode: r.Use_Cd_N || r.USECDLIT || null,
        mailingAddr: String(r.MailingAdr1 || r.OWNERADDR || "").trim() || null,
        mailingCity: String(r.MailingCity || r.OWNERCITY || "").trim() || null,
        mailingState: String(r.MailingState || r.OWNERSTATE || "").trim() || null,
        mailingZip: String(r.MailingZip || r.OWNERZIP || "").trim() || null,
        ownerName: String(r.OWNERNAME || "").trim() || null,
        effectiveYear: Number(r.EffectiveYr) || null,
        structureSF: Number(r.StructureSF) || null,
        landSF: Number(r.LandSF) || null,
        acres: Number(r.Acres || r.ACREAGE) || null,
        subdivision: String(r.SUBDIV || r.SUBDIVLIT || "").trim() || null,
        legalDescr: String(r.LEGALDESCR || "").trim() || null,
        // Douglas
        website: r.Website || null,
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
    .eq("event_type", "tahoe_index_progress").eq("email", `tahoe_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("tahoe_index_progress", `tahoe_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All Tahoe-area counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-tahoeluxury] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("tahoe_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-tahoeluxury]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

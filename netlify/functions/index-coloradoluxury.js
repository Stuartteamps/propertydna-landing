/**
 * PropertyDNA — Colorado Ultra-Luxury Ski Resort Indexer
 *
 * Sources (verified live):
 *   • Pitkin (Aspen / Snowmass) — maps.pitkincounty.com hosted Parcels
 *     19,235 parcels, full CAMA (owner_name, situs, land/improvements actual+assessed,
 *     sale_price, sale_date, baths, bedrooms, area_sqft, actual_yr_built, last_remodel)
 *   • Eagle (Vail / Beaver Creek) — map.eaglecounty.us FlexApp Parcel_Viewer
 *     25,062 parcels (lightweight: PARCEL_NUM, URL, X/Y coords)
 *   • Summit (Breckenridge / Keystone) — services6.arcgis.com/dmNYNuTJZDtkcRJq SummitCnty_Parcels_Pictometry
 *     38,369 parcels — PPI, SitusAddress, OwnerFullName, TownName, Subdivision
 *   • Routt (Steamboat Springs) — services6.arcgis.com/VxFGFP4XeHMTNgVs Parcels
 *     25,460 parcels, very rich (own*, locAddress, totalImps/Land Value/Assessed,
 *     sqFt, totalAcres, salePrice, saleDate)
 *
 * POST /.netlify/functions/index-coloradoluxury
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const DEFAULT_BATCH = 1000;
const STATE = "CO";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const PITKIN_URL = "https://maps.pitkincounty.com/arcgis/rest/services/Hosted/Parcels/FeatureServer/0";
const EAGLE_URL  = "https://map.eaglecounty.us/arcgiswa/rest/services/FlexApp/Parcel_Viewer/FeatureServer/0";
const SUMMIT_URL = "https://services6.arcgis.com/dmNYNuTJZDtkcRJq/arcgis/rest/services/SummitCnty_Parcels_Pictometry/FeatureServer/0";
const ROUTT_URL  = "https://services6.arcgis.com/VxFGFP4XeHMTNgVs/arcgis/rest/services/Parcels/FeatureServer/0";

const COUNTY_QUEUE = [
  { name: "Pitkin", fips: "08097", source: "pitkin", url: PITKIN_URL },
  { name: "Eagle",  fips: "08037", source: "eagle",  url: EAGLE_URL },
  { name: "Summit", fips: "08117", source: "summit", url: SUMMIT_URL },
  { name: "Routt",  fips: "08107", source: "routt",  url: ROUTT_URL },
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
  if (c.source === "pitkin") return "owner_name IS NOT NULL";
  if (c.source === "eagle")  return "PARCEL_NUM IS NOT NULL";
  if (c.source === "summit") return "OwnerFullName IS NOT NULL";
  if (c.source === "routt")  return "OWNERSHIP IS NOT NULL";
  return "1=1";
}

async function fetchBatch(c, offset, count) {
  const params = new URLSearchParams({
    where: whereFor(c),
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: c.source === "pitkin" ? "objectid ASC" : "OBJECTID ASC",
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

function pitkinRow(r, fips) {
  const apn = String(r.parcel || r.accountnumber || r.pin || "").trim();
  if (!apn) return null;
  return {
    apn: `CO-${fips}-${apn}`,
    address_line1: String(r.situs_address || r.location || "").trim() || null,
    address: String(r.situs_address || r.location || "").trim() || null,
    city: String(r.city || "").trim() || null,
    state: STATE,
    beds: Number(r.bedrooms) || null,
    baths: Number(r.baths) || null,
    sqft: Number(r.heated_area) || Number(r.live_area) || Number(r.area_sqft) || null,
    lot_sqft: Number(r.platted_acres) ? Math.round(Number(r.platted_acres) * 43560) : null,
    year_built: Number(r.actual_yr_built) > 1800 ? Number(r.actual_yr_built) : null,
    tax_assessed_value: Number(r.final_actual_value) || null,
    property_type: String(r.model_type || r.account_type || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function eagleRow(r, fips) {
  const apn = String(r.PARCEL_NUM || r.SCHEDULE_N || "").trim();
  if (!apn) return null;
  return {
    apn: `CO-${fips}-${apn}`,
    state: STATE,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function summitRow(r, fips) {
  const apn = String(r.PPI || r.PropertyScheduleText || "").trim();
  if (!apn) return null;
  return {
    apn: `CO-${fips}-${apn}`,
    address_line1: String(r.SitusAddress || "").trim() || null,
    address: String(r.SitusAddress || "").trim() || null,
    city: String(r.TownName || "").trim() || null,
    state: STATE,
    property_type: null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function routtRow(r, fips) {
  const apn = String(r.accountNo || r.PIN || "").trim();
  if (!apn) return null;
  return {
    apn: `CO-${fips}-${apn}`,
    address_line1: String(r.locAddress || r.theAddress || "").trim() || null,
    address: String(r.locAddress || r.theAddress || "").trim() || null,
    city: String(r.locCity || "").trim() || null,
    state: STATE,
    sqft: Number(r.sqFt) || null,
    lot_sqft: Number(r.totalAcres) ? Math.round(Number(r.totalAcres) * 43560) : null,
    tax_assessed_value: (Number(r.totalImpsAssessed) || 0) + (Number(r.totalLandAssessed) || 0) || null,
    property_type: String(r.propUse || r.accountType || "").trim() || null,
    county_fips: fips,
    last_updated: new Date().toISOString(),
  };
}

function buildRows(rows, c, today) {
  const master = [], history = [];
  for (const r of rows) {
    let m = null;
    if (c.source === "pitkin") m = pitkinRow(r, c.fips);
    if (c.source === "eagle")  m = eagleRow(r, c.fips);
    if (c.source === "summit") m = summitRow(r, c.fips);
    if (c.source === "routt")  m = routtRow(r, c.fips);
    if (!m) continue;
    master.push(m);
    let ownerName = null;
    if (c.source === "pitkin") ownerName = r.owner_name;
    if (c.source === "summit") ownerName = r.OwnerFullName;
    if (c.source === "routt")  ownerName = r.OWNERSHIP;
    history.push({
      apn: m.apn, event_type: c.source === "eagle" ? "boundary" : "assessment",
      event_date: today, source: `co_${c.source}`,
      data: {
        county: c.name,
        ownerName: String(ownerName || "").trim() || null,
        // Pitkin extras
        ownerAddress: String(r.owner_address1 || r.ownAddLine1 || "").trim() || null,
        ownerCity: String(r.owner_city || r.ownCity || "").trim() || null,
        ownerState: String(r.owner_state || r.ownState || "").trim() || null,
        ownerZip: String(r.owner_zip || r.ownZip || "").trim() || null,
        landActual: Number(r.land_actual) || null,
        landAssessed: Number(r.land_assessed) || Number(r.totalLandAssessed) || null,
        improvementsActual: Number(r.improvements_actual) || null,
        improvementsAssessed: Number(r.improvements_assessed) || Number(r.totalImpsAssessed) || null,
        finalActualValue: Number(r.final_actual_value) || null,
        salePrice: Number(r.sale_price || r.salePrice) || null,
        saleDate: r.sale_date || r.saleDate || null,
        actualYearBuilt: Number(r.actual_yr_built) || null,
        lastRemodel: Number(r.last_remodel) || null,
        baths: Number(r.baths) || null,
        bedrooms: Number(r.bedrooms) || null,
        actualArea: Number(r.actual_area || r.area_sqft || r.sqFt) || null,
        heatedArea: Number(r.heated_area) || null,
        liveArea: Number(r.live_area) || null,
        stories: Number(r.stories) || null,
        subdivision: String(r.subname || r.subDivision || r.SubdivisionName || "").trim() || null,
        neighborhood: String(r.neighborhood || r.NBHD || "").trim() || null,
        // Eagle extras
        scheduleNum: String(r.SCHEDULE_N || "").trim() || null,
        // Summit extras
        propertyURL: r.PropertyURL || r.URL || null,
        townName: r.TownName || null,
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
    .eq("event_type", "co_index_progress").eq("email", `co_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("co_index_progress", `co_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All CO luxury counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-coloradoluxury] ${cDef.name} | offset=${offset} | total=${total}`);

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
    db.kpi("co_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-coloradoluxury]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

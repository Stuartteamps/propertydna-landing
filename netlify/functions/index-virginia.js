/**
 * PropertyDNA — Virginia NoVA Luxury Indexer
 *
 * Source mix (verified):
 *   • Fairfax County (rich CAMA) — services1.arcgis.com/ioennV6PpG5Xodq0
 *     - OpenData_A6 layer 1 = Parcels (PIN, address, situs)
 *     - OpenData_A6 layer 2 = Assessed Values (APRTOT, APRBLDG, APRLAND, TAXYR)
 *     We index Fairfax via the Assessed Values layer joined to Parcel layer in-process.
 *   • Arlington + Loudoun — VGIN VA_Parcels (boundary + LOCALITY + PARCELID; no value)
 *     https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0
 *
 * Strategy: this indexer indexes Fairfax first (rich), then loops through
 * Arlington/Loudoun with VGIN data (sparse but legitimate boundary capture).
 *
 * POST /.netlify/functions/index-virginia
 * Body: { county?, offset?, batchSize?, dryRun? }
 */

const https = require("https");
const db = require("./_supabase");

const FAIRFAX_PARCELS_URL  = "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A6/FeatureServer/1";
const FAIRFAX_ASSESSED_URL = "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A6/FeatureServer/2";
const VGIN_URL             = "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0";
const DEFAULT_BATCH = 1000;
const STATE = "VA";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const COUNTY_QUEUE = [
  { name: "Fairfax",   fips: "51059", source: "fairfax",   localityFilter: null },
  { name: "Arlington", fips: "51013", source: "vgin",      localityFilter: "Arlington County" },
  { name: "Loudoun",   fips: "51107", source: "vgin",      localityFilter: "Loudoun County" },
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

async function fetchFairfaxBatch(offset, count) {
  // Layer 1 = Tax Admin Parcel Data (PARID, TAXYR, LIVUNIT, LOCATION_DESC,
  // STREET1_DESC, LUC_DESC = land-use code). PARID is the master parcel id.
  const params = new URLSearchParams({
    where: "PARID IS NOT NULL",
    outFields: "OBJECTID,PARID,TAXYR,LIVUNIT,LOCATION_DESC,STREET1_DESC,LUC_DESC,UTIL1_DESC,UTIL2_DESC,UTIL3_DESC,ZONING_DESC",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${FAIRFAX_PARCELS_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchFairfaxAssessedMap(pins) {
  // Batch lookup assessed values by PARID for a slice of pins.
  // Field is PARID in the Assessed Values layer. Chunk to <= 100 to keep URL short.
  if (!pins || !pins.length) return {};
  const map = {};
  for (let i = 0; i < pins.length; i += 80) {
    const chunk = pins.slice(i, i + 80);
    const inList = chunk.map(p => `'${String(p).replace(/'/g, "''")}'`).join(",");
    const params = new URLSearchParams({
      where: `PARID IN (${inList})`,
      outFields: "PARID,TAXYR,APRLAND,APRBLDG,APRTOT,PRILAND,PRIBLDG,PRITOT",
      returnGeometry: "false",
      f: "json",
    });
    const res = await fetchJSON(`${FAIRFAX_ASSESSED_URL}/query?${params}`).catch(() => null);
    const features = res?.data?.features || [];
    for (const f of features) {
      const a = f.attributes;
      const key = String(a.PARID || "").trim();
      // keep most recent TAXYR per PARID
      const existing = map[key];
      if (!existing || (Number(a.TAXYR) || 0) > (Number(existing.TAXYR) || 0)) map[key] = a;
    }
  }
  return map;
}

async function fetchVginBatch(localityFilter, offset, count) {
  const params = new URLSearchParams({
    where: `LOCALITY='${localityFilter.replace(/'/g, "''")}'`,
    outFields: "OBJECTID,VGIN_QPID,FIPS,LOCALITY,PARCELID,PTM_ID,LASTUPDATE",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${VGIN_URL}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(cDef) {
  if (cDef.source === "fairfax") {
    const params = new URLSearchParams({
      where: "PARID IS NOT NULL",
      returnCountOnly: "true",
      f: "json",
    });
    const res = await fetchJSON(`${FAIRFAX_PARCELS_URL}/query?${params}`);
    return Number(res.data?.count) || 0;
  }
  // VGIN — count by locality; some layers reject count, so use returnCountOnly
  const params = new URLSearchParams({
    where: `LOCALITY='${cDef.localityFilter.replace(/'/g, "''")}'`,
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${VGIN_URL}/query?${params}`);
  return Number(res.data?.count) || 0;
}

async function buildFairfaxRows(rows, cDef, today) {
  const parids = rows.map(r => String(r.PARID || "")).filter(Boolean);
  const assessedMap = await fetchFairfaxAssessedMap(parids).catch(() => ({}));
  const master = [], history = [];
  for (const r of rows) {
    const parid = String(r.PARID || "").trim();
    if (!parid) continue;
    const apn = `VA-${cDef.fips}-${parid}`;
    const a = assessedMap[parid] || {};
    const street = String(r.STREET1_DESC || "").trim() || null;
    master.push({
      apn,
      address_line1: street,
      address: street,
      city: "FAIRFAX",
      state: STATE,
      tax_assessed_value: Number(a.APRTOT) || null,
      property_type: String(r.LUC_DESC || "").trim() || null,
      county_fips: cDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "assessment", event_date: today, source: "va_fairfax",
      data: {
        county: cDef.name,
        parid,
        taxYearParcel: Number(r.TAXYR) || null,
        livUnits: Number(r.LIVUNIT) || null,
        locationDesc: r.LOCATION_DESC || null,
        streetDesc: r.STREET1_DESC || null,
        landUseDesc: r.LUC_DESC || null,
        utility1: r.UTIL1_DESC || null,
        utility2: r.UTIL2_DESC || null,
        utility3: r.UTIL3_DESC || null,
        zoningDesc: r.ZONING_DESC || null,
        taxYearAssessed: Number(a.TAXYR) || null,
        apprLand: Number(a.APRLAND) || null,
        apprBldg: Number(a.APRBLDG) || null,
        apprTotal: Number(a.APRTOT) || null,
        prevLand: Number(a.PRILAND) || null,
        prevBldg: Number(a.PRIBLDG) || null,
        prevTotal: Number(a.PRITOT) || null,
      },
    });
  }
  return { master, history };
}

function buildVginRows(rows, cDef, today) {
  const master = [], history = [];
  for (const r of rows) {
    const pid = String(r.VGIN_QPID || r.PARCELID || r.OBJECTID || "").trim();
    if (!pid) continue;
    const apn = `VA-${cDef.fips}-${pid}`;
    master.push({
      apn,
      state: STATE,
      city: cDef.name.toUpperCase(),
      county_fips: cDef.fips,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn, event_type: "boundary", event_date: today, source: "va_vgin",
      data: {
        county: cDef.name,
        locality: r.LOCALITY || null,
        vginQpid: r.VGIN_QPID || null,
        parcelId: r.PARCELID || null,
        fips: r.FIPS || null,
        lastUpdate: r.LASTUPDATE || null,
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
    .eq("event_type", "va_index_progress").eq("email", `va_county:${name}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(name, nextOffset, total, done) {
  db.kpi("va_index_progress", `va_county:${name}`, { countyName: name, nextOffset, total, done });
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
      body: JSON.stringify({ message: "All VA counties indexed.", allDone: true }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (!total) total = await fetchCount(cDef);
    console.log(`[index-virginia] ${cDef.name} | offset=${offset} | total=${total} | src=${cDef.source}`);

    let rows;
    if (cDef.source === "fairfax")
      rows = await fetchFairfaxBatch(offset, runSize);
    else
      rows = await fetchVginBatch(cDef.localityFilter, offset, runSize);

    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(cDef.name, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: cDef.name, offset, done, retryable: !done }) };
    }

    let master, history;
    if (cDef.source === "fairfax")
      ({ master, history } = await buildFairfaxRows(rows, cDef, today));
    else
      ({ master, history } = buildVginRows(rows, cDef, today));

    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset = offset + rows.length;
    const cDone     = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextCounty = cDone ? (COUNTY_QUEUE[COUNTY_QUEUE.indexOf(cDef) + 1]?.name || null) : null;

    if (!dryRun) await saveProgress(cDef.name, cDone ? 0 : newOffset, total, cDone);
    db.kpi("va_property_indexed", null, { county: cDef.name, processed: master.length, newOffset, total, dryRun });

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
    console.error("[index-virginia]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

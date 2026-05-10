/**
 * PropertyDNA — Seattle / Western Washington Luxury Market Indexer
 *
 * Sources:
 *   Snohomish County: https://gis.snoco.org/sis/rest/services/Cadastral/Tax_Parcels/MapServer/0
 *     Fields: Owner_Name, yearhousebuilt
 *   King County: geometry-only via MapServer — uses KingCo_Parcels/MapServer/0 (PIN only)
 *     For King County we fall back to Snohomish pattern pending better data source.
 *
 * Luxury targets: Bellevue, Medina, Clyde Hill, Mercer Island (King),
 *                 Edmonds, Mukilteo, Shoreline, Bothell, Kirkland area (Snohomish)
 *
 * POST /.netlify/functions/index-seattle
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { source?: "snohomish"|"king", offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const SNOHOMISH_BASE = "https://gis.snoco.org/sis/rest/services/Cadastral/Tax_Parcels/MapServer/0";
const DEFAULT_BATCH = 1000;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// Source definitions — fields confirmed from live API inspection
const SOURCES = {
  snohomish: {
    base: SNOHOMISH_BASE,
    fips: "53061",
    label: "Snohomish County WA",
    where: "OWNERNAME IS NOT NULL AND PARCEL_ID IS NOT NULL AND USECODE LIKE '11%'",
    // ^ filter to residential use codes (11x in WA = residential)
  },
};

const COST_SQFT = 420; // Seattle/Snohomish luxury market

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

async function fetchBatch(src, offset, count) {
  const params = new URLSearchParams({
    where: src.where,
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${src.base}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(src) {
  const params = new URLSearchParams({
    where: src.where,
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${src.base}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

function buildSitusAddress(row) {
  return [row.SITUSHOUSE, row.SITUSPREFX, row.SITUSSTRT, row.SITUSTTYP, row.SITUSPOSTD]
    .map(s => String(s || "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildOwnerAddress(row) {
  return [row.OWNERLINE1, row.OWNERLINE2, row.OWNERLINE3]
    .map(s => String(s || "").trim()).filter(Boolean).join(", ");
}

function computeWADNA(row) {
  const lotSqft  = Number(row.GIS_SQ_FT) || 0;
  const mkImp    = Number(row.MKIMP) || 0;
  const mkLnd    = Number(row.MKLND) || 0;
  const mkTotal  = Number(row.MKTTL) || (mkImp + mkLnd);
  const cuTotal  = Number(row.CUIMP || 0) + Number(row.CULND || 0);
  // Snohomish doesn't expose year built in this service — use a generic ratio
  const expected = lotSqft > 0 ? lotSqft * 50 : 0; // rough land-only baseline
  const rr       = expected > 0 ? Math.round((mkTotal / expected) * 100) / 100 : 1.0;
  return {
    renovationRatio: rr,
    marketTotal: mkTotal || null, marketImp: mkImp || null, marketLand: mkLnd || null,
    currentUseTotal: cuTotal || null,
    dataQuality: mkTotal > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildRows(rows, src, today) {
  const master = [], history = [];
  for (const row of rows) {
    const apn = String(row.PARCEL_ID || row.OBJECTID || "").trim();
    if (!apn) continue;
    const ownerName = String(row.OWNERNAME || "").trim();
    if (!ownerName) continue;

    const situsAddr = buildSitusAddress(row);
    const dna = computeWADNA(row);

    master.push({
      apn: `WA-${src.fips}-${apn}`, county_fips: src.fips,
      address: situsAddr || null,
      city: String(row.SITUSCITY || "").trim() || null,
      state: "WA",
      zip: String(row.SITUSZIP || "").trim().slice(0, 5) || null,
      property_type: String(row.USECODE || "").trim() || null,
      tax_assessed_value: Number(row.MKTTL) || null,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn: `WA-${src.fips}-${apn}`, event_type: "assessment", event_date: today,
      source: "wa_snohomish",
      data: {
        address: situsAddr, city: row.SITUSCITY || null, zip: row.SITUSZIP || null,
        ownerName,
        ownerAddr: buildOwnerAddress(row),
        ownerCity: String(row.OWNERCITY || "").trim() || null,
        ownerState: String(row.OWNERSTATE || "").trim() || null,
        ownerZip: String(row.OWNERZIP || "").trim() || null,
        absentee: (row.OWNERSTATE || "").trim().toUpperCase() !== "WA",
        taxpayerName: String(row.TAXPRNAME || "").trim() || null,
        useCode: row.USECODE || null,
        marketTotal: Number(row.MKTTL) || null,
        marketImprovement: Number(row.MKIMP) || null,
        marketLand: Number(row.MKLND) || null,
        lotSqft: Number(row.GIS_SQ_FT) || null,
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

async function getProgress(sourceKey) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "wa_index_progress").eq("email", `wa_src:${sourceKey}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(sourceKey, nextOffset, total, done) {
  db.kpi("wa_index_progress", `wa_src:${sourceKey}`, { sourceKey, nextOffset, total, done });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun    = body.dryRun === true;
  const runSize   = Math.min(body.batchSize || DEFAULT_BATCH, 1000);
  const sourceKey = (body.source || "snohomish").toLowerCase();
  const src       = SOURCES[sourceKey];

  if (!src) return { statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: `Unknown source. Valid: ${Object.keys(SOURCES).join(", ")}` }) };

  const prog   = await getProgress(sourceKey);
  const offset = body.offset != null ? Number(body.offset) : (body.reset ? 0 : prog.offset);
  let total    = prog.total;
  const today  = new Date().toISOString().slice(0, 10);

  try {
    if (!total) total = await fetchCount(src);
    console.log(`[index-seattle] ${src.label} | offset=${offset} | total=${total}`);

    const rows = await fetchBatch(src, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(sourceKey, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ source: src.label, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, src, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset = offset + rows.length;
    const done      = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;

    if (!dryRun) await saveProgress(sourceKey, done ? 0 : newOffset, total, done);
    db.kpi("wa_property_indexed", null, { source: src.label, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      source: src.label, fips: src.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, errors: writeErrors.length, done, dryRun,
      message: done ? `${src.label} complete (${total})` : `${src.label}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error("[index-seattle]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

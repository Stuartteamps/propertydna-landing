/**
 * PropertyDNA — Los Angeles County Property Indexer
 *
 * Uses LA County Assessor PAIS MapServer (public, no key):
 * https://assessor.gis.lacounty.gov/assessor/rest/services/PAIS/pais_parcels/MapServer/0
 *
 * Available fields: AIN (APN), SAADDR/SASTR (address components)
 * Note: LA County does not expose improvement/land values via public API.
 * Values populated at report-time via RentCast AVM.
 *
 * ~2.7 million parcels — the largest property ticker registry in the US.
 * Stores AIN (Assessor Identification Number) as the permanent ticker.
 * Full DNA scoring added at report-time via RentCast + enrichment pipeline.
 *
 * POST /.netlify/functions/index-lacounty
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const LA_BASE = "https://assessor.gis.lacounty.gov/assessor/rest/services/PAIS/pais_parcels/MapServer/0";
const DEFAULT_BATCH = 200;
const COUNTY_FIPS = "06037"; // Los Angeles County

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function fetchJSON(url, timeoutMs = 20000) {
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

async function fetchParcels(offset, count) {
  const params = new URLSearchParams({
    where: "AIN IS NOT NULL AND SASTR IS NOT NULL",
    outFields: "AIN,FORMATTED_AIN,SAADDR,SAADDR2,SASTR,SANUM",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "AIN ASC",
    f: "json",
  });
  const res = await fetchJSON(`${LA_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function countParcels() {
  const params = new URLSearchParams({
    where: "AIN IS NOT NULL AND SASTR IS NOT NULL",
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetchJSON(`${LA_BASE}/query?${params}`);
  return res.data?.count || 0;
}

function buildAddress(row) {
  // LA County address components: SANUM (number) + SASTR (street)
  const parts = [
    row.SANUM  || "",
    row.SASTR  || "",
    row.SAADDR2 || "",
  ].map(s => String(s).trim()).filter(Boolean);
  const addr = parts.join(" ").replace(/\s+/g, " ").trim();
  return addr || String(row.SAADDR || "").trim();
}

async function bulkWrite(masterRows, historyRows) {
  await Promise.all([
    db.upsert("property_master", masterRows, "apn").catch(e => console.warn("[la:master]", e.message.slice(0, 80))),
    db.insert("property_history", historyRows).catch(() => {}),
  ]);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun  = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 500);
  const offset  = Number(body.offset) || 0;
  const total   = body.total || await countParcels();

  try {
    const rows = await fetchParcels(offset, runSize);

    if (!rows.length) {
      const trulyDone = total > 0 && offset >= total;
      if (trulyDone) return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: "LOS_ANGELES", done: true, total, dryRun }) };
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: "LOS_ANGELES", offset, newOffset: offset, total,
          processed: 0, retryable: true, message: "Empty batch — retryable" }) };
    }

    const masterRows  = [];
    const historyRows = [];
    const today       = new Date().toISOString().slice(0, 10);
    const sample      = [];

    for (const row of rows) {
      if (!row.AIN) continue;
      // LA County AIN format: 10-digit e.g. "4302015900"
      // Store as-is — this is the permanent ticker symbol
      const apn     = String(row.AIN).trim();
      const address = buildAddress(row);
      if (!address) continue;

      masterRows.push({
        apn,
        county_fips:  COUNTY_FIPS,
        address,
        state:        "CA",
        last_updated: new Date().toISOString(),
      });

      historyRows.push({
        apn,
        event_type: "assessment",
        event_date: today,
        source:     "lacounty_pais",
        data: { address, formattedAin: row.FORMATTED_AIN, county: "Los Angeles County" },
      });

      if (sample.length < 3) sample.push({ apn, address, formattedAin: row.FORMATTED_AIN });
    }

    if (!dryRun && masterRows.length > 0) await bulkWrite(masterRows, historyRows);

    const newOffset = offset + rows.length;
    const done      = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;

    db.kpi("la_property_indexed", null, { processed: rows.length, newOffset, total, dryRun });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        county: "LOS_ANGELES", offset, newOffset, total, pctComplete: pct,
        processed: rows.length, done, dryRun, sample,
        message: done ? `LA County complete (${total})` : `LA: ${newOffset}/${total} (${pct}%)`,
      }),
    };
  } catch (err) {
    console.error("[index-lacounty]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

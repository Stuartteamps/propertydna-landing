/**
 * PropertyDNA — San Diego County Property Indexer
 *
 * Uses SANDAG Parcels FeatureServer (public, no key):
 * https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0
 *
 * Fields available: apn, situs_address, situs_community (city), situs_zip,
 * total_lvg_area (sqft), bedrooms, baths, pool, acreage,
 * asr_land, asr_impr, asr_total (assessor values), year_effective, nucleus_use_cd
 *
 * ~1.2 million parcels total. Filters to residential use codes.
 * Stores to property_master + property_history (same schema as Riverside indexer).
 *
 * POST /.netlify/functions/index-sandiego
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { community?: string, offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const SANDAG_BASE = "https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0";
const DEFAULT_BATCH = 200;
const COUNTY_FIPS = "06073"; // San Diego County

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// San Diego communities in processing order (largest first for impact)
const COMMUNITY_QUEUE = [
  "SAN DIEGO", "CHULA VISTA", "OCEANSIDE", "ESCONDIDO", "EL CAJON",
  "VISTA", "CARLSBAD", "SAN MARCOS", "SANTEE", "ENCINITAS",
  "LA MESA", "NATIONAL CITY", "EL CAJON", "POWAY", "LAKESIDE",
  "SPRING VALLEY", "LEMON GROVE", "IMPERIAL BEACH", "CORONADO",
  "DEL MAR", "SOLANA BEACH", "LEUCADIA", "CARDIFF BY THE SEA",
  "RANCHO SANTA FE", "VALLEY CENTER", "FALLBROOK", "BONSALL",
  "RAMONA", "JULIAN", "ALPINE", "JAMUL", "SPRING VALLEY",
  "BONITA", "SANTEE", "LAKESIDE", "EL CAJON",
  "CAMPO", "POTRERO", "TECATE", "BOULEVARD",
  "BORREGO SPRINGS", "WARNER SPRINGS",
];

// SANDAG nucleus_use_cd is a 3-digit STRING. Residential = "1xx" (starts with "1").
// Examples: "109"=SFR, "110"=Condo, "117"=Mobile home, "120"=2-4 unit, "130"=5+ units
// "400"=Commercial, "300"=Commercial, "200"=Vacant — these are NOT residential.

// Replacement cost per sqft — San Diego (higher than inland)
const COST_PER_SQFT = {
  default: 250,
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

function buildWhere(community) {
  // nucleus_use_cd is a 3-char string; "1xx" = residential
  const resFilter = `nucleus_use_cd >= '100' AND nucleus_use_cd < '200'`;
  if (community && community !== "ALL") {
    return `situs_community='${community.replace(/'/g, "''")}' AND ${resFilter}`;
  }
  return resFilter;
}

function parseYear(raw) {
  if (!raw || String(raw).trim() === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  if (isNaN(n)) return null;
  // SANDAG stores 2-digit year: 00-25 = 2000-2025, 26-99 = 1926-1999
  if (n <= 25) return 2000 + n;
  if (n <= 99) return 1900 + n;
  return n; // already 4-digit
}

function parseNum(raw) {
  if (raw == null || raw === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  return isNaN(n) ? null : n;
}

function buildFullAddress(row) {
  // SANDAG situs_address is the street NUMBER (integer)
  const parts = [
    row.situs_address ? String(row.situs_address) : "",
    row.situs_pre_dir || "",
    row.situs_street  || "",
    row.situs_suffix  || "",
    row.situs_post_dir || "",
  ].map(s => String(s).trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchParcels(where, offset, count) {
  const params = new URLSearchParams({
    where,
    outFields: [
      "apn", "situs_address", "situs_pre_dir", "situs_street", "situs_suffix",
      "situs_post_dir", "situs_community", "situs_zip",
      "total_lvg_area", "bedrooms", "baths", "pool", "acreage",
      "asr_land", "asr_impr", "asr_total", "year_effective",
      "nucleus_use_cd", "qual_class_shape", "addition_area",
      "x_coord", "y_coord", "ownerocc", "par_view",
    ].join(","),
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "apn ASC",
    f: "json",
  });
  const res = await fetchJSON(`${SANDAG_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function countParcels(where) {
  const params = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
  const res = await fetchJSON(`${SANDAG_BASE}/query?${params}`);
  return res.data?.count || 0;
}

function computeSDDNA(row) {
  const sqft       = Number(row.total_lvg_area  || 0);
  const yearEff    = parseYear(row.year_effective) || 0;
  const improvVal  = Number(row.asr_impr         || 0);
  const landValue  = Number(row.asr_land         || 0);
  const totalValue = Number(row.asr_total        || improvVal + landValue);
  const hasPool    = String(row.pool  || "").trim().toUpperCase() === "Y";
  const hasView    = String(row.par_view || "").trim() !== "" && String(row.par_view).trim() !== "0";

  const costSqft  = COST_PER_SQFT.default;
  const age       = yearEff > 1800 ? new Date().getFullYear() - yearEff : 30;
  const depr      = Math.max(0.20, 1 - age * 0.011);
  const expected  = sqft > 0 ? sqft * costSqft * depr : 0;
  const renovRatio = expected > 0 ? Math.round((improvVal / expected) * 100) / 100 : 1.0;

  const fullyRemod = renovRatio > 1.35;
  const updated    = renovRatio >= 1.15 && !fullyRemod;
  const origCond   = renovRatio < 0.75 && age > 20;

  const condScore =
    renovRatio > 1.5 ? 93 :
    renovRatio > 1.3 ? 82 :
    renovRatio > 1.1 ? 72 :
    renovRatio > 0.9 ? 63 :
    renovRatio > 0.7 ? 50 : 38;

  return {
    renovationRatio:     renovRatio,
    conditionScore:      condScore,
    yearBuilt:           yearEff || null,
    assessorLandValue:   landValue || null,
    assessorImprovValue: improvVal || null,
    assessorTotalValue:  totalValue || null,
    detectedFeatures: {
      pool:              hasPool,
      golf_course:       false,
      waterfront:        false,
      view:              hasView,
      fully_remodeled:   fullyRemod,
      updated,
      original_condition: origCond,
    },
    dataQuality: sqft > 0 && yearEff > 0 && improvVal > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildMasterRow(row, dna) {
  const addr = buildFullAddress(row);
  return {
    apn:                String(row.apn || "").trim(),
    county_fips:        COUNTY_FIPS,
    address:            addr,
    city:               String(row.situs_community || "").trim(),
    state:              "CA",
    zip:                String(row.situs_zip || "").trim().slice(0, 5),
    property_type:      String(row.nucleus_use_cd || ""),
    beds:               parseNum(row.bedrooms),
    baths:              parseNum(row.baths),
    sqft:               Number(row.total_lvg_area) || null,
    lot_sqft:           row.acreage ? Math.round(Number(row.acreage) * 43560) : null,
    year_built:         dna.yearBuilt,
    lat:                row.y_coord || null,
    lng:                row.x_coord || null,
    tax_assessed_value: dna.assessorTotalValue,
    last_updated:       new Date().toISOString(),
  };
}

function buildHistoryRow(row, dna, today) {
  return {
    apn:        String(row.apn || "").trim(),
    event_type: "assessment",
    event_date: today,
    source:     "sandag_parcels",
    data: {
      address:          buildFullAddress(row),
      community:        row.situs_community,
      zip:              row.situs_zip,
      sqft:             Number(row.total_lvg_area) || null,
      beds:             parseNum(row.bedrooms),
      baths:            parseNum(row.baths),
      pool:             row.pool === "Y",
      acreage:          row.acreage,
      additionArea:     row.addition_area,
      yearEffective:    dna.yearBuilt,
      qualClassShape:   row.qual_class_shape,
      useCode:          row.nucleus_use_cd,
      parView:          row.par_view,
      ownerOcc:         row.ownerocc,
      lat:              row.y_coord,
      lng:              row.x_coord,
      landValue:        dna.assessorLandValue,
      improvValue:      dna.assessorImprovValue,
      totalValue:       dna.assessorTotalValue,
      renovationRatio:  dna.renovationRatio,
      conditionScore:   dna.conditionScore,
      dataQuality:      dna.dataQuality,
      detectedFeatures: dna.detectedFeatures,
    },
  };
}

async function bulkWrite(masterRows, historyRows) {
  await Promise.all([
    db.upsert("property_master", masterRows, "apn").catch(e => console.warn("[sd:master]", e.message.slice(0,80))),
    db.insert("property_history", historyRows).catch(() => {}),
  ]);
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun    = body.dryRun === true;
  const runSize   = Math.min(body.batchSize || DEFAULT_BATCH, 500);
  const community = (body.community || "ALL").toUpperCase().trim();
  const offset    = Number(body.offset) || 0;

  try {
    const where  = buildWhere(community);
    const total  = body.total || await countParcels(where);
    const rows   = await fetchParcels(where, offset, runSize);

    if (!rows.length) {
      const trulyDone = total > 0 && offset >= total;
      if (trulyDone) {
        const nextIdx = COMMUNITY_QUEUE.indexOf(community);
        const nextCommunity = COMMUNITY_QUEUE[nextIdx + 1] || null;
        return { statusCode: 200, headers: CORS,
          body: JSON.stringify({ community, done: true, nextCommunity, total, dryRun }) };
      }
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ community, offset, newOffset: offset, total,
          processed: 0, retryable: true, message: "Empty batch — retryable" }) };
    }

    const masterRows  = [];
    const historyRows = [];
    const today       = new Date().toISOString().slice(0, 10);
    const sample      = [];

    for (const row of rows) {
      if (!row.apn) continue;
      const dna = computeSDDNA(row);
      masterRows.push(buildMasterRow(row, dna));
      historyRows.push(buildHistoryRow(row, dna, today));
      if (sample.length < 3) {
        sample.push({
          apn: row.apn, address: buildFullAddress(row),
          city: row.situs_community, sqft: row.total_lvg_area,
          yearBuilt: dna.yearBuilt, renovRatio: dna.renovationRatio,
          condScore: dna.conditionScore, features: dna.detectedFeatures,
        });
      }
    }

    if (!dryRun && masterRows.length > 0) await bulkWrite(masterRows, historyRows);

    const newOffset = offset + rows.length;
    const cityDone  = rows.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextIdx   = COMMUNITY_QUEUE.indexOf(community);
    const nextCommunity = cityDone ? (COMMUNITY_QUEUE[nextIdx + 1] || null) : community;

    db.kpi("sd_property_indexed", null, { community, processed: rows.length, newOffset, total, dryRun });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        community, county: "SAN_DIEGO", offset, newOffset, total, pctComplete: pct,
        processed: rows.length, cityDone, nextCommunity, dryRun, sample,
        message: cityDone
          ? `${community} complete (${total}). Next: ${nextCommunity || "ALL SD DONE"}`
          : `${community}: ${newOffset}/${total} (${pct}%)`,
      }),
    };
  } catch (err) {
    console.error("[index-sandiego]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

exports.COMMUNITY_QUEUE = COMMUNITY_QUEUE;

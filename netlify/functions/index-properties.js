/**
 * PropertyDNA — Coachella Valley Property Indexer
 *
 * Queries Riverside County Assessor CREST tables (public ArcGIS REST API, no key)
 * to build our sovereign property_master database for all ~150k Coachella Valley parcels.
 *
 * Data: PIN, address, year built, sqft, beds/baths, pool, fairway, waterfront,
 *       land/improvement values, quality code, reassessment year.
 *
 * Proprietary DNA Permit Score computed from assessor improvement value vs.
 * expected replacement cost — tells us renovation quality without scraping
 * any permit portal.
 *
 * City processing order: Palm Springs → Rancho Mirage → Indian Wells →
 * La Quinta → Palm Desert → Cathedral City → Desert Hot Springs → Indio → Coachella
 *
 * Called by n8n cron job nightly. Each run processes BATCH_SIZE properties,
 * picks up where it left off via indexing_jobs table.
 *
 * POST /.netlify/functions/index-properties
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { city?: string, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const RIVCO_BASE = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer";
const BATCH_SIZE = 50; // properties per ArcGIS API call
const DEFAULT_RUN_SIZE = 200; // properties per nightly n8n invocation

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// City processing queue — order matters for our beta focus
const CITY_QUEUE = [
  "PALM SPRINGS",
  "RANCHO MIRAGE",
  "INDIAN WELLS",
  "LA QUINTA",
  "PALM DESERT",
  "CATHEDRAL CITY",
  "DESERT HOT SPRINGS",
  "INDIO",
  "COACHELLA",
];

// Residential class codes in Riverside County assessor system
const RESIDENTIAL_CLASS_CODES = [
  "Single Family Dwelling",
  "SFD with Secondary Unit(s)",
  "Condo or PUD",
  "Duplex",
  "Triplex",
  "Fourplex",
  "Residential Condominium",
  "PI-Single Family Dwelling",
  "PI-Residential Condominium",
  "MA-Single Family Dwelling",
  "MA-Residential Condominium",
  "Factory Built SFD",
  "Residential Exceptional",
  "MH on Foundation (MF)",
  "Retail w/Living Unit",
  "Residential Use Zoned Commercial",
  "Residential Common Area w/Improvements",
];

// Replacement cost per sqft by quality tier (Coachella Valley 2025)
const REPLACEMENT_COST_PER_SQFT = {
  EXCELLENT: 385,
  "VERY GOOD": 310,
  GOOD: 245,
  AVERAGE: 195,
  FAIR: 150,
  LOW: 115,
  default: 195,
};

// ── HTTP helper ───────────────────────────────────────────────────────────────

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
        catch { resolve({ statusCode: res.statusCode, data: null, raw: raw.slice(0, 200) }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${url.slice(0, 80)}`)); });
    req.on("error", reject);
    req.end();
  });
}

async function queryLayer(layerId, where, fields, offset = 0, count = 50) {
  const params = new URLSearchParams({
    where,
    outFields: fields.join(","),
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "PIN ASC",
    f: "json",
  });
  const res = await fetchJSON(`${RIVCO_BASE}/${layerId}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function countResidential(city) {
  const where = buildResidentialWhere(city);
  const params = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
  const res = await fetchJSON(`${RIVCO_BASE}/70/query?${params}`);
  return res.data?.count || 0;
}

function buildResidentialWhere(city) {
  const classClauses = RESIDENTIAL_CLASS_CODES
    .map(c => `CLASS_CODE='${c.replace(/'/g, "''")}'`)
    .join(" OR ");
  return `CITY='${city}' AND (${classClauses})`;
}

// ── Assessor data fetchers ────────────────────────────────────────────────────

async function fetchGeneralBatch(city, offset, batchSize) {
  return queryLayer(
    70,
    buildResidentialWhere(city),
    ["PIN", "STREET_NUMBER", "STREET_NUMBER_SFX", "STREET_PREDIRECTIONAL",
     "STREET_NAME", "STREET_TYPE", "CITY", "POSTAL_CD", "PRIME_BASE_YEAR", "CLASS_CODE"],
    offset,
    batchSize
  );
}

async function fetchPropCharBatch(pins) {
  if (!pins.length) return {};
  const where = `PIN IN (${pins.map(p => `'${p}'`).join(",")})`;
  const rows = await queryLayer(
    80, where,
    ["PIN", "YEAR_BUILT", "LIVING_AREA", "ACTUAL_AREA", "BEDROOM_COUNT", "BATH_COUNT",
     "HAS_POOL", "FAIRWAY", "WATERFRONT", "QUALITY_CODE", "DESIGN_TYPE",
     "GARAGE_TYPE", "GARAGE_SIZE", "NUMBER_OF_STORIES", "HAS_FIREPLACE", "CENTRAL_COOLING"],
    0, pins.length + 5
  );
  const map = {};
  for (const r of rows) { if (r.PIN) map[r.PIN] = r; }
  return map;
}

async function fetchTaxYearBatch(pins) {
  if (!pins.length) return {};
  const yr = new Date().getFullYear();
  const where = `PIN IN (${pins.map(p => `'${p}'`).join(",")}) AND (TAX_YEAR=${yr} OR TAX_YEAR=${yr - 1})`;
  const rows = await queryLayer(
    100, where,
    ["PIN", "TAX_YEAR", "LAND", "STRUCTURES", "LIVING_IMPROVEMENTS"],
    0, pins.length * 2 + 10
  );
  const map = {};
  for (const r of rows) {
    if (!r.PIN) continue;
    if (!map[r.PIN] || r.TAX_YEAR > map[r.PIN].TAX_YEAR) map[r.PIN] = r;
  }
  return map;
}

// ── Proprietary DNA Permit Score ──────────────────────────────────────────────
// Derived entirely from Riverside County Assessor data.
// Core insight: the assessor re-values improvement_value when permits are finaled.
// Ratio of actual vs. age-depreciated replacement cost reveals renovation quality.

function computeAssessorDNA(general, propChar, taxYear) {
  const yearBuilt   = propChar?.YEAR_BUILT || 0;
  const sqft        = propChar?.LIVING_AREA || propChar?.ACTUAL_AREA || 0;
  const quality     = (propChar?.QUALITY_CODE || "").toUpperCase();
  const structures  = taxYear?.STRUCTURES || 0;
  const livingImps  = taxYear?.LIVING_IMPROVEMENTS || 0;
  const landValue   = taxYear?.LAND || 0;
  const improvVal   = structures + livingImps;
  const primeBase   = general?.PRIME_BASE_YEAR || yearBuilt || 1980;

  // Replacement cost by quality
  const costKey = Object.keys(REPLACEMENT_COST_PER_SQFT).find(k => quality.includes(k)) || "default";
  const costPerSqft = REPLACEMENT_COST_PER_SQFT[costKey];

  // Age-adjusted expected improvement value (CA Prop 13 depreciation model)
  const currentYear = new Date().getFullYear();
  const age = yearBuilt > 0 ? currentYear - yearBuilt : 35;
  const depreciationFactor = Math.max(0.20, 1 - (age * 0.011));
  const expectedImprov = sqft > 0 ? sqft * costPerSqft * depreciationFactor : 0;

  // Renovation ratio: > 1.0 means improvements worth more than age-adjusted base
  const renovRatio = expectedImprov > 0 ? Math.round((improvVal / expectedImprov) * 100) / 100 : 1.0;

  // Reassessment gap — years between year_built and prime_base_year
  // Prop 13: property only gets reassessed when sold OR when significant improvement permit is finaled
  const reassessGap = (primeBase > (yearBuilt || 1900)) ? primeBase - (yearBuilt || primeBase) : 0;

  // Feature detection from assessor records
  const hasPool      = ["Y", "YES", "1", "TRUE"].includes(String(propChar?.HAS_POOL || "").toUpperCase());
  const hasFairway   = propChar?.FAIRWAY && !["N", "NONE", "NO", "", "NULL"].includes(String(propChar.FAIRWAY).toUpperCase());
  const hasWaterfront = propChar?.WATERFRONT && !["N", "NONE", "NO", "", "NULL"].includes(String(propChar.WATERFRONT).toUpperCase());

  // Renovation classification
  const fullyRemodeled  = renovRatio > 1.35 && reassessGap >= 5;
  const updated         = renovRatio >= 1.15 && !fullyRemodeled;
  const originalCond    = renovRatio < 0.75 && age > 20;

  // Condition score 0-100
  const conditionScore =
    renovRatio > 1.5 ? 93 :
    renovRatio > 1.3 ? 82 :
    renovRatio > 1.1 ? 72 :
    renovRatio > 0.9 ? 63 :
    renovRatio > 0.7 ? 50 :
    38;

  return {
    renovationRatio:     renovRatio,
    conditionScore,
    reassessmentYear:    primeBase || null,
    assessorImprovValue: improvVal || null,
    assessorLandValue:   landValue || null,
    assessorTotalValue:  (improvVal + landValue) || null,
    detectedFeatures: {
      pool:              hasPool,
      golf_course:       !!hasFairway,
      waterfront:        !!hasWaterfront,
      fully_remodeled:   fullyRemodeled,
      updated,
      original_condition: originalCond,
    },
    dataQuality: sqft > 0 && yearBuilt > 0 && improvVal > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildAddress(g) {
  const parts = [
    g.STREET_NUMBER,
    g.STREET_NUMBER_SFX || "",
    g.STREET_PREDIRECTIONAL || "",
    g.STREET_NAME || "",
    g.STREET_TYPE || "",
  ].map(s => String(s || "").trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ── Main indexing function ────────────────────────────────────────────────────

async function indexCity(city, offset, runSize, dryRun) {
  const processed = [], errors = [];

  const generalBatch = await fetchGeneralBatch(city, offset, runSize);
  if (!generalBatch.length) return { processed: [], errors: [], done: true };

  const pins = generalBatch.map(g => g.PIN).filter(Boolean);

  const [propChars, taxYears] = await Promise.all([
    fetchPropCharBatch(pins),
    fetchTaxYearBatch(pins),
  ]);

  for (const general of generalBatch) {
    const pin = general.PIN;
    if (!pin) continue;
    const propChar = propChars[pin] || {};
    const taxYear  = taxYears[pin]  || {};
    const address  = buildAddress(general);
    if (!address) continue;

    const dna = computeAssessorDNA(general, propChar, taxYear);

    if (!dryRun) {
      const row = {
        apn:                      pin,
        county_fips:              "06065",
        address,
        city:                     general.CITY || city,
        state:                    "CA",
        zip:                      general.POSTAL_CD || null,
        year_built:               propChar.YEAR_BUILT || null,
        sqft:                     propChar.LIVING_AREA || propChar.ACTUAL_AREA || null,
        beds:                     propChar.BEDROOM_COUNT || null,
        baths:                    propChar.BATH_COUNT || null,
        has_pool:                 dna.detectedFeatures.pool,
        has_fairway:              dna.detectedFeatures.golf_course,
        is_waterfront:            dna.detectedFeatures.waterfront,
        property_type:            propChar.DESIGN_TYPE || general.CLASS_CODE || null,
        quality_code:             propChar.QUALITY_CODE || null,
        stories:                  propChar.NUMBER_OF_STORIES || null,
        has_fireplace:            propChar.HAS_FIREPLACE === "Y" || null,
        has_central_cooling:      propChar.CENTRAL_COOLING === "Y" || null,
        assessor_land_value:      dna.assessorLandValue,
        assessor_improvement_val: dna.assessorImprovValue,
        assessor_total_value:     dna.assessorTotalValue,
        pdna_renovation_ratio:    dna.renovationRatio,
        pdna_condition_score:     dna.conditionScore,
        pdna_reassessment_year:   dna.reassessmentYear,
        pdna_detected_features:   dna.detectedFeatures,
        pdna_data_quality:        dna.dataQuality,
        pdna_scored_at:           dna.scoredAt,
        indexed_at:               new Date().toISOString(),
        index_source:             "rivco_assessor_crest",
      };
      await db.upsert("property_master", row, "apn")
        .catch(e => errors.push({ pin, error: e.message }));
    }

    processed.push({
      pin, address, city: general.CITY,
      yearBuilt: propChar.YEAR_BUILT,
      sqft: propChar.LIVING_AREA,
      renovationRatio: dna.renovationRatio,
      conditionScore: dna.conditionScore,
      features: dna.detectedFeatures,
    });
  }

  return { processed, errors, done: generalBatch.length < runSize };
}

// ── Job progress tracking ─────────────────────────────────────────────────────

async function getOrCreateJob(city) {
  const rows = await db.from("indexing_jobs")
    .select("id,city,offset,total,status")
    .eq("city", city)
    .limit(1)
    .get()
    .catch(() => []);

  if (Array.isArray(rows) && rows.length > 0) return rows[0];

  const total = await countResidential(city);
  const inserted = await db.insert("indexing_jobs", {
    city,
    offset: 0,
    total,
    status: "queued",
    started_at: new Date().toISOString(),
  }).catch(() => null);

  return Array.isArray(inserted) && inserted.length ? inserted[0] : { city, offset: 0, total, status: "queued" };
}

async function updateJobProgress(city, newOffset, total, done) {
  const status = done ? "completed" : "in_progress";
  const update = { offset: newOffset, status, updated_at: new Date().toISOString() };
  if (done) update.completed_at = new Date().toISOString();
  if (total != null) update.total = total;

  await db.from("indexing_jobs")
    .eq("city", city)
    .update(update)
    .catch(() => {});
}

async function getNextCity() {
  for (const city of CITY_QUEUE) {
    const rows = await db.from("indexing_jobs")
      .select("city,status")
      .eq("city", city)
      .limit(1)
      .get()
      .catch(() => []);

    if (!Array.isArray(rows) || !rows.length) return city;
    if (rows[0].status !== "completed") return city;
  }
  return null; // all cities done
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun   = body.dryRun   === true;
  const runSize  = Math.min(body.batchSize || DEFAULT_RUN_SIZE, 500);
  let   city     = (body.city || "").toUpperCase().trim() || null;

  if (!city) {
    city = await getNextCity();
    if (!city) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ message: "All Coachella Valley cities fully indexed.", allDone: true }),
      };
    }
  }

  if (!CITY_QUEUE.includes(city)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown city: ${city}. Valid: ${CITY_QUEUE.join(", ")}` }) };
  }

  try {
    const job = await getOrCreateJob(city);
    const offset = job.offset || 0;

    console.log(`[index-properties] ${city} | offset=${offset} | runSize=${runSize} | total=${job.total}`);

    const result = await indexCity(city, offset, runSize, dryRun);

    const newOffset = offset + result.processed.length;
    const cityDone = result.done || newOffset >= (job.total || Infinity);

    if (!dryRun) {
      await updateJobProgress(city, cityDone ? 0 : newOffset, job.total, cityDone);
    }

    // Log KPI
    db.kpi("property_indexed", null, {
      city, processed: result.processed.length, errors: result.errors.length, cityDone,
    });

    const nextCity = cityDone ? CITY_QUEUE[CITY_QUEUE.indexOf(city) + 1] || null : city;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        city,
        offset,
        processed: result.processed.length,
        errors:    result.errors.length,
        errorList: result.errors.slice(0, 5),
        newOffset,
        total:     job.total,
        pctComplete: job.total > 0 ? Math.round((newOffset / job.total) * 100) : null,
        cityDone,
        nextCity,
        dryRun,
        sample: result.processed.slice(0, 3),
      }),
    };
  } catch (err) {
    console.error("[index-properties]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// Export for direct use
exports.CITY_QUEUE = CITY_QUEUE;
exports.computeAssessorDNA = computeAssessorDNA;

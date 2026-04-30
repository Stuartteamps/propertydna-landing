/**
 * PropertyDNA — Coachella Valley Property Indexer
 *
 * Queries Riverside County Assessor CREST tables (public ArcGIS REST, no key needed)
 * to build our sovereign property database for all ~150k Coachella Valley parcels.
 *
 * Works with EXISTING Supabase schema (migrations 001-009):
 *   - property_master  → core columns (apn, address, beds, baths, sqft, year_built, etc.)
 *   - property_history → full assessor data + DNA scores as JSONB event
 *   - kpi_events       → progress tracking (no new tables needed)
 *
 * City order: Palm Springs → Rancho Mirage → Indian Wells → La Quinta →
 *             Palm Desert → Cathedral City → Desert Hot Springs → Indio → Coachella
 *
 * POST /.netlify/functions/index-properties
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { city?: string, batchSize?: number, dryRun?: boolean, resetCity?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const RIVCO_BASE = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer";
const DEFAULT_BATCH = 200;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

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

const RESIDENTIAL_CODES = [
  "Single Family Dwelling", "SFD with Secondary Unit(s)", "Condo or PUD",
  "Duplex", "Triplex", "Fourplex", "Residential Condominium",
  "PI-Single Family Dwelling", "PI-Residential Condominium",
  "MA-Single Family Dwelling", "MA-Residential Condominium",
  "Factory Built SFD", "Residential Exceptional", "MH on Foundation (MF)",
];

// Coachella Valley replacement cost per sqft by assessor quality code
const COST_PER_SQFT = {
  EXCELLENT: 385, "VERY GOOD": 310, GOOD: 245, AVERAGE: 195, FAIR: 150, LOW: 115, default: 195,
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
        catch { resolve({ statusCode: res.statusCode, data: null }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function arcgisQuery(layerId, where, fields, offset, count) {
  const params = new URLSearchParams({
    where, outFields: fields.join(","), returnGeometry: "false",
    resultOffset: String(offset), resultRecordCount: String(count),
    orderByFields: "PIN ASC", f: "json",
  });
  const res = await fetchJSON(`${RIVCO_BASE}/${layerId}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function arcgisCount(where) {
  const params = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
  const res = await fetchJSON(`${RIVCO_BASE}/70/query?${params}`);
  return res.data?.count || 0;
}

// ── Assessor data fetchers ────────────────────────────────────────────────────

function residentialWhere(city) {
  const cc = RESIDENTIAL_CODES.map(c => `CLASS_CODE='${c.replace(/'/g, "''")}'`).join(" OR ");
  return `CITY='${city}' AND (${cc})`;
}

async function fetchGeneralBatch(city, offset, size) {
  return arcgisQuery(70, residentialWhere(city),
    ["PIN","STREET_NUMBER","STREET_NUMBER_SFX","STREET_PREDIRECTIONAL",
     "STREET_NAME","STREET_TYPE","CITY","POSTAL_CD","PRIME_BASE_YEAR","CLASS_CODE"],
    offset, size);
}

async function fetchPropChars(pins) {
  if (!pins.length) return {};
  const where = `PIN IN (${pins.map(p => `'${p}'`).join(",")})`;
  const rows = await arcgisQuery(80, where,
    ["PIN","YEAR_BUILT","LIVING_AREA","ACTUAL_AREA","BEDROOM_COUNT","BATH_COUNT",
     "HAS_POOL","FAIRWAY","WATERFRONT","QUALITY_CODE","DESIGN_TYPE",
     "NUMBER_OF_STORIES","HAS_FIREPLACE","CENTRAL_COOLING","GARAGE_TYPE"],
    0, pins.length + 5);
  return Object.fromEntries(rows.filter(r => r.PIN).map(r => [r.PIN, r]));
}

async function fetchTaxYears(pins) {
  if (!pins.length) return {};
  const yr = new Date().getFullYear();
  const where = `PIN IN (${pins.map(p => `'${p}'`).join(",")}) AND (TAX_YEAR=${yr} OR TAX_YEAR=${yr - 1})`;
  const rows = await arcgisQuery(100, where,
    ["PIN","TAX_YEAR","LAND","STRUCTURES","LIVING_IMPROVEMENTS"],
    0, pins.length * 2 + 10);
  const map = {};
  for (const r of rows) {
    if (!r.PIN) continue;
    if (!map[r.PIN] || r.TAX_YEAR > map[r.PIN].TAX_YEAR) map[r.PIN] = r;
  }
  return map;
}

// ── Proprietary DNA Permit Score ──────────────────────────────────────────────
// Core formula: actual improvement value vs. age-depreciated replacement cost.
// The county assessor increases improvement_value when permits are finaled (Prop 13).
// So renovation_ratio > 1.0 means upgrades happened beyond normal age depreciation.

function computeAssessorDNA(general, pc, ty) {
  const yearBuilt  = pc?.YEAR_BUILT || 0;
  const sqft       = pc?.LIVING_AREA || pc?.ACTUAL_AREA || 0;
  const quality    = (pc?.QUALITY_CODE || "").toUpperCase();
  const improvVal  = (ty?.STRUCTURES || 0) + (ty?.LIVING_IMPROVEMENTS || 0);
  const landValue  = ty?.LAND || 0;
  const primeBase  = general?.PRIME_BASE_YEAR || yearBuilt || 1985;

  const costKey    = Object.keys(COST_PER_SQFT).find(k => quality.includes(k)) || "default";
  const costSqft   = COST_PER_SQFT[costKey];
  const age        = yearBuilt > 1800 ? new Date().getFullYear() - yearBuilt : 30;
  const depr       = Math.max(0.20, 1 - age * 0.011);
  const expected   = sqft > 0 ? sqft * costSqft * depr : 0;
  const renovRatio = expected > 0 ? Math.round((improvVal / expected) * 100) / 100 : 1.0;
  const reassessGap = (primeBase > (yearBuilt || 1900)) ? primeBase - (yearBuilt || primeBase) : 0;

  const hasPool       = ["Y","YES","1","TRUE"].includes(String(pc?.HAS_POOL  || "").toUpperCase());
  const hasFairway    = pc?.FAIRWAY    && !["N","NONE","NO","","NULL"].includes(String(pc.FAIRWAY).toUpperCase());
  const hasWaterfront = pc?.WATERFRONT && !["N","NONE","NO","","NULL"].includes(String(pc.WATERFRONT).toUpperCase());
  const fullyRemod    = renovRatio > 1.35 && reassessGap >= 5;
  const updated       = renovRatio >= 1.15 && !fullyRemod;
  const originalCond  = renovRatio < 0.75 && age > 20;

  const condScore =
    renovRatio > 1.5 ? 93 :
    renovRatio > 1.3 ? 82 :
    renovRatio > 1.1 ? 72 :
    renovRatio > 0.9 ? 63 :
    renovRatio > 0.7 ? 50 : 38;

  return {
    renovationRatio:     renovRatio,
    conditionScore:      condScore,
    reassessmentYear:    primeBase || null,
    assessorLandValue:   landValue || null,
    assessorImprovValue: improvVal || null,
    assessorTotalValue:  (improvVal + landValue) || null,
    detectedFeatures: {
      pool:              hasPool,
      golf_course:       !!hasFairway,
      waterfront:        !!hasWaterfront,
      fully_remodeled:   fullyRemod,
      updated,
      original_condition: originalCond,
    },
    dataQuality: sqft > 0 && yearBuilt > 0 && improvVal > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildAddress(g) {
  return [g.STREET_NUMBER, g.STREET_NUMBER_SFX || "", g.STREET_PREDIRECTIONAL || "",
          g.STREET_NAME || "", g.STREET_TYPE || ""]
    .map(s => String(s || "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// ── Progress tracking via kpi_events ─────────────────────────────────────────

async function getProgress(city) {
  const rows = await db.from("kpi_events")
    .select("metadata,created_at")
    .eq("event_type", "index_progress")
    .eq("email", `city:${city}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .get()
    .catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const meta = rows[0].metadata || {};
  return { offset: meta.nextOffset || 0, total: meta.total || null, done: meta.done || false };
}

async function saveProgress(city, nextOffset, total, done) {
  db.kpi("index_progress", `city:${city}`, { city, nextOffset, total, done, ts: new Date().toISOString() });
}

async function getNextCity() {
  for (const city of CITY_QUEUE) {
    const prog = await getProgress(city);
    if (!prog.done) return { city, offset: prog.offset, total: prog.total };
  }
  return null;
}

// ── Bulk write to existing schema (2 Supabase calls for entire batch) ─────────

function buildMasterRow(address, g, pc, dna) {
  return {
    apn:                g.PIN,
    county_fips:        "06065",
    address,
    city:               g.CITY || null,
    state:              "CA",
    zip:                g.POSTAL_CD || null,
    property_type:      pc?.DESIGN_TYPE || g.CLASS_CODE || null,
    beds:               pc?.BEDROOM_COUNT  || null,
    baths:              pc?.BATH_COUNT     || null,
    sqft:               pc?.LIVING_AREA    || pc?.ACTUAL_AREA || null,
    year_built:         pc?.YEAR_BUILT     || null,
    tax_assessed_value: dna.assessorTotalValue || null,
    last_updated:       new Date().toISOString(),
  };
}

function buildHistoryRow(address, g, pc, dna, today) {
  return {
    apn:        g.PIN,
    event_type: "assessment",
    event_date: today,
    source:     "rivco_assessor_crest",
    data: {
      address,
      yearBuilt:        pc?.YEAR_BUILT        || null,
      sqft:             pc?.LIVING_AREA        || null,
      qualityCode:      pc?.QUALITY_CODE       || null,
      designType:       pc?.DESIGN_TYPE        || null,
      stories:          pc?.NUMBER_OF_STORIES  || null,
      hasFireplace:     pc?.HAS_FIREPLACE === "Y",
      centralCooling:   pc?.CENTRAL_COOLING === "Y",
      garageType:       pc?.GARAGE_TYPE        || null,
      classCode:        g.CLASS_CODE           || null,
      primeBaseYear:    g.PRIME_BASE_YEAR      || null,
      postalCode:       g.POSTAL_CD            || null,
      landValue:        dna.assessorLandValue,
      improvValue:      dna.assessorImprovValue,
      totalValue:       dna.assessorTotalValue,
      renovationRatio:  dna.renovationRatio,
      conditionScore:   dna.conditionScore,
      reassessYear:     dna.reassessmentYear,
      dataQuality:      dna.dataQuality,
      detectedFeatures: dna.detectedFeatures,
    },
  };
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  await Promise.all([
    db.upsert("property_master", masterRows, "apn")
      .catch(e => errors.push(`master: ${e.message.slice(0, 80)}`)),
    db.insert("property_history", historyRows)
      .catch(e => { /* duplicate events are expected — ignore */ }),
  ]);
  return errors;
}

// ── Main handler ──────────────────────────────────────────────────────────────

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

  // Resolve city + offset
  let city   = (body.city || "").toUpperCase().trim() || null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  if (!city) {
    const next = await getNextCity();
    if (!next) {
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ message: "All Coachella Valley cities fully indexed.", allDone: true }) };
    }
    city   = next.city;
    offset = next.offset;
    total  = next.total;
  } else {
    const prog = await getProgress(city);
    if (offset == null) offset = body.resetCity ? 0 : prog.offset;
    total = prog.total;
  }

  if (!CITY_QUEUE.includes(city)) {
    return { statusCode: 400, headers: CORS,
      body: JSON.stringify({ error: `Unknown city. Valid: ${CITY_QUEUE.join(", ")}` }) };
  }

  try {
    // Get total count on first run for this city
    if (!total) {
      total = await arcgisCount(residentialWhere(city));
    }

    console.log(`[index-properties] ${city} | offset=${offset} | run=${runSize} | total=${total}`);

    // Fetch batch of general records
    const generalBatch = await fetchGeneralBatch(city, offset, runSize);

    // Guard: only mark city done if we've actually reached the end (offset >= total),
    // not on a transient empty response from ArcGIS outage.
    if (!generalBatch.length) {
      const trulyDone = total > 0 && offset >= total;
      if (trulyDone) {
        await saveProgress(city, 0, total, true);
        const nextIdx  = CITY_QUEUE.indexOf(city) + 1;
        const nextCity = CITY_QUEUE[nextIdx] || null;
        return { statusCode: 200, headers: CORS,
          body: JSON.stringify({ city, done: true, nextCity, total, dryRun }) };
      }
      // Empty batch but not at end = ArcGIS blip, return retry signal
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ city, offset, newOffset: offset, total, processed: 0, errors: 0,
          cityDone: false, nextCity: city, dryRun, retryable: true,
          message: `Empty batch at offset ${offset} — ArcGIS may be temporarily slow, retry` }) };
    }

    const pins = generalBatch.map(g => g.PIN).filter(Boolean);

    // Parallel fetch property characteristics + tax year
    const [propChars, taxYears] = await Promise.all([
      fetchPropChars(pins),
      fetchTaxYears(pins),
    ]);

    // Build all rows in memory first, then bulk-write in 2 Supabase calls
    const masterRows  = [];
    const historyRows = [];
    const sample      = [];
    const today       = new Date().toISOString().slice(0, 10);

    for (const g of generalBatch) {
      if (!g.PIN) continue;
      const pc   = propChars[g.PIN] || {};
      const ty   = taxYears[g.PIN]  || {};
      const addr = buildAddress(g);
      if (!addr) continue;

      const dna = computeAssessorDNA(g, pc, ty);
      masterRows.push(buildMasterRow(addr, g, pc, dna));
      historyRows.push(buildHistoryRow(addr, g, pc, dna, today));

      if (sample.length < 3) {
        sample.push({
          pin: g.PIN, address: addr, city: g.CITY,
          yearBuilt: pc?.YEAR_BUILT, sqft: pc?.LIVING_AREA,
          renovRatio: dna.renovationRatio, condScore: dna.conditionScore,
          features: dna.detectedFeatures,
        });
      }
    }

    let writeErrors = [];
    if (!dryRun && masterRows.length > 0) {
      writeErrors = await bulkWrite(masterRows, historyRows);
    }

    const processed = masterRows.length;
    const errors    = writeErrors.length;
    const newOffset = offset + generalBatch.length;
    const cityDone  = generalBatch.length < runSize || newOffset >= total;
    const pct       = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextIdx   = CITY_QUEUE.indexOf(city) + 1;
    const nextCity  = cityDone ? (CITY_QUEUE[nextIdx] || null) : city;

    if (!dryRun) {
      await saveProgress(city, cityDone ? 0 : newOffset, total, cityDone);
    }

    db.kpi("property_indexed", null, {
      city, processed, errors, offset: newOffset, total, cityDone, dryRun,
    });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        city, offset, newOffset, total, pctComplete: pct,
        processed, errors, cityDone, nextCity,
        dryRun, sample,
        message: cityDone
          ? `${city} complete (${total} properties). Next: ${nextCity || "ALL DONE"}`
          : `${city}: ${newOffset}/${total} (${pct}%)`,
      }),
    };
  } catch (err) {
    console.error("[index-properties]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

exports.CITY_QUEUE = CITY_QUEUE;
exports.computeAssessorDNA = computeAssessorDNA;

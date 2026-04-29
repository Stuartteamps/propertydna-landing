/**
 * PropertyDNA Data Sovereignty Engine
 *
 * Called automatically by save-report.js after every report generation.
 * Takes all data extracted by n8n and permanently maps it to the
 * properties, property_intelligence, neighborhood_index, permit_registry,
 * market_ticker, and property_data_sources tables.
 *
 * Over time, PropertyDNA builds the most comprehensive property
 * intelligence database — owned entirely in Supabase.
 *
 * Can also be called directly:
 *   POST /.netlify/functions/property-ingest
 *   Headers: x-internal-key: $INTERNAL_API_KEY
 */

const crypto = require("crypto");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function addressHash(address, city, state, zip, unit) {
  const normalized = [address, unit, city, state, zip]
    .map(s => (s || "").toLowerCase().trim().replace(/\s+/g, " "))
    .join("|");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function parseNum(v) {
  if (v == null || v === "—" || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function parseDate(v) {
  if (!v || v === "—") return null;
  try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
}

function desirabilityGrade(score) {
  if (score == null) return null;
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 72) return "A-";
  if (score >= 65) return "B+";
  if (score >= 57) return "B";
  if (score >= 50) return "B-";
  if (score >= 40) return "C+";
  if (score >= 30) return "C";
  return "D";
}

function computeDesirabilityScore(n) {
  const weights = {
    school:      0.20,
    crime:       0.15,  // inverted — lower crime = higher score
    walkability: 0.10,
    demand:      0.20,
    absorption:  0.10,  // inverted — lower months = higher demand
    luxury:      0.10,
    hazard:      0.15,  // inverted
  };

  const schoolScore    = parseNum(n.schoolScore)    ?? 50;
  const crimeScore     = 100 - (parseNum(n.crimeScore) ?? 50);  // invert
  const walkScore      = parseNum(n.walkScore)      ?? 50;
  const demandScore    = parseNum(n.demandScore)    ?? 50;
  const absorptionScore= Math.min(100, Math.max(0, 100 - (parseNum(n.absorptionRate) ?? 6) * 8));
  const luxuryScore    = n.isLuxury ? 80 : 50;
  const hazardScore    = 100 - (parseNum(n.hazardScore) ?? 30);  // invert

  const composite =
    schoolScore     * weights.school +
    crimeScore      * weights.crime +
    walkScore       * weights.walkability +
    demandScore     * weights.demand +
    absorptionScore * weights.absorption +
    luxuryScore     * weights.luxury +
    hazardScore     * weights.hazard;

  return Math.round(Math.min(100, Math.max(0, composite)));
}

function computeDataCompleteness(row) {
  const fields = [
    "beds", "baths", "sqft", "lot_sqft", "year_built",
    "latitude", "longitude", "last_sale_price", "current_estimated_value",
    "property_type_normalized",
  ];
  const filled = fields.filter(f => row[f] != null).length;
  return Math.round((filled / fields.length) * 100);
}

function permitCategory(description) {
  const d = (description || "").toLowerCase();
  if (d.includes("kitchen") || d.includes("bath") || d.includes("remodel") || d.includes("addition") || d.includes("adu"))
    return "value_add";
  if (d.includes("roof") || d.includes("hvac") || d.includes("plumb") || d.includes("electric"))
    return "maintenance";
  if (d.includes("new construction") || d.includes("new build"))
    return "new_construction";
  return "compliance";
}

function estimatePermitValueAdd(category, rawValue) {
  const val = parseNum(rawValue) || 0;
  const multipliers = { value_add: 1.4, maintenance: 0.5, new_construction: 1.0, compliance: 0.2 };
  return Math.round(val * (multipliers[category] || 0.5));
}

// ── Main ingest function ─────────────────────────────────────────────────────

async function ingestProperty({ reportData, address, unit, city, state, zip, reportId, features, dnaAdjusted }) {
  if (!reportData || !address) return { skipped: true, reason: "no reportData or address" };

  const n = reportData.normalized ?? {};
  const prop = n.property ?? {};
  const sub = n.subject ?? {};
  const sale = n.sale ?? {};
  const val = n.valuation ?? {};
  const demo = n.demographics ?? {};
  const hazard = n.hazard ?? {};
  const market = n.market ?? {};
  const permits = n.permits ?? {};

  const hash = addressHash(address, city, state, zip, unit);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // ── 1. Upsert canonical property record ────────────────────
  const propertyRow = {
    address:                   address,
    city:                      city || null,
    state:                     state || null,
    zip:                       zip || null,
    property_type_normalized:  prop.propertyType || null,
    beds:                      parseNum(prop.beds),
    baths:                     parseNum(prop.baths),
    sqft:                      parseNum(prop.sqft),
    lot_sqft:                  parseNum(prop.lotSize),
    year_built:                parseNum(prop.yearBuilt),
    effective_year_built:      parseNum(prop.effectiveYearBuilt || prop.yearBuilt),
    latitude:                  parseNum(sub.lat),
    longitude:                 parseNum(sub.lon),
    last_sale_date:            parseDate(sale.lastSaleDate),
    last_sale_price:           parseNum(sale.lastSalePrice),
    current_estimated_value:   parseNum(val.marketValue) || parseNum(dnaAdjusted?.adjMid),
    confidence_score:          parseNum(dnaAdjusted?.confidence) || parseNum(val.confidence),
    updated_at:                now,
  };

  // Try upsert by address — if exists, update; if not, insert
  let propertyId = null;
  const existing = await db.from("properties")
    .select("id")
    .eq("address", address)
    .eq("zip", zip || "")
    .limit(1)
    .get()
    .catch(() => []);

  if (Array.isArray(existing) && existing.length > 0) {
    propertyId = existing[0].id;
    await db.from("properties").eq("id", propertyId).update(propertyRow).catch(e => console.warn("[ingest:prop update]", e.message));
  } else {
    const inserted = await db.insert("properties", { ...propertyRow, created_at: now })
      .catch(e => { console.warn("[ingest:prop insert]", e.message); return null; });
    if (Array.isArray(inserted) && inserted.length) propertyId = inserted[0].id;
  }

  if (!propertyId) return { skipped: true, reason: "could not upsert property" };

  // ── 2. Property intelligence cache ──────────────────────────
  const rentcastValue = parseNum(val.marketValue);
  const hazardScore   = parseNum(hazard.score);
  const desirabilityInput = {
    schoolScore:    demo.schoolScore,
    crimeScore:     n.crime?.violentCrimeRatePer100k ? Math.min(100, n.crime.violentCrimeRatePer100k / 10) : null,
    walkScore:      null,
    demandScore:    market.demandScore,
    absorptionRate: market.absorptionRate,
    isLuxury:       features?.premium_community || features?.gated_community,
    hazardScore:    hazardScore,
  };

  const piRow = {
    property_id:            propertyId,
    address_hash:           hash,
    pdna_value_low:         dnaAdjusted?.adjLow   || parseNum(val.low),
    pdna_value_mid:         dnaAdjusted?.adjMid   || rentcastValue,
    pdna_value_high:        dnaAdjusted?.adjHigh  || parseNum(val.high),
    pdna_confidence:        dnaAdjusted?.confidence || null,
    pdna_grade:             desirabilityGrade(computeDesirabilityScore(desirabilityInput)),
    rentcast_value:         rentcastValue,
    rentcast_rent_estimate: parseNum(n.rent?.estimate),
    rentcast_fetched_at:    now,
    dna_adjustment_pct:     dnaAdjusted?.totalPctMid || null,
    dna_drivers:            dnaAdjusted?.drivers || null,
    dna_features:           Object.keys(features || {}).filter(k => features[k]) || null,
    hazard_composite_score: hazardScore,
    hazard_rating:          hazard.rating || null,
    hazard_wildfire_score:  parseNum(hazard.wildfire),
    hazard_flood_score:     parseNum(hazard.flood),
    hazard_earthquake_score:parseNum(hazard.earthquake),
    hazard_wind_score:      parseNum(hazard.wind),
    insurance_risk_tier:    hazard.insuranceTier || null,
    permit_count:           permits.total || 0,
    data_completeness_pct:  computeDataCompleteness(propertyRow),
    last_refreshed_at:      now,
  };

  await db.upsert("property_intelligence", piRow, "address_hash").catch(e => console.warn("[ingest:pi]", e.message));
  // refresh_count is incremented by a DB trigger (see migration 005).

  // ── 3. Property events — sale history ───────────────────────
  if (sale.lastSaleDate && sale.lastSalePrice && propertyId) {
    const saleEventExists = await db.from("property_events")
      .select("id")
      .eq("property_id", propertyId)
      .eq("event_type", "sale")
      .eq("event_date", parseDate(sale.lastSaleDate))
      .limit(1)
      .get()
      .catch(() => []);

    if (!Array.isArray(saleEventExists) || !saleEventExists.length) {
      await db.insert("property_events", {
        property_id:  propertyId,
        event_type:   "sale",
        event_date:   parseDate(sale.lastSaleDate),
        event_source: "rentcast",
        event_value:  parseNum(sale.lastSalePrice),
        event_notes:  "Sale recorded from RentCast property data",
        raw_payload:  { source: "rentcast", sale },
      }).catch(e => console.warn("[ingest:sale event]", e.message));
    }
  }

  // ── 4. Permits → permit_registry + property_events ──────────
  const permitList = permits.recent || [];
  for (const permit of permitList) {
    const category = permitCategory(permit.description);
    const valueAdd = estimatePermitValueAdd(category, permit.value);

    await db.upsert("permit_registry", {
      property_id:    propertyId,
      address:        address,
      city:           city || null,
      state:          state || null,
      zip:            zip || null,
      permit_number:  permit.permitNumber || null,
      permit_type:    permit.type || category,
      permit_category: category,
      description:    permit.description || null,
      issued_date:    parseDate(permit.date),
      status:         permit.status || "finaled",
      estimated_value:parseNum(permit.value),
      pdna_value_add: valueAdd,
      jurisdiction:   city || state || "unknown",
      source:         permits.source || "buildzoom",
      raw_data:       permit,
    }, "property_id,permit_number,jurisdiction").catch(e => console.warn("[ingest:permit]", e.message));

    // Also add to property_events timeline
    await db.insert("property_events", {
      property_id:  propertyId,
      event_type:   "permit",
      event_date:   parseDate(permit.date),
      event_source: permits.source || "buildzoom",
      event_value:  parseNum(permit.value),
      event_notes:  permit.description || permit.type || "Permit",
      raw_payload:  permit,
    }).catch(() => {}); // ignore duplicates
  }

  // ── 5. Market snapshots + ticker ────────────────────────────
  if (zip && market) {
    const snapRow = {
      geo_key:               zip,
      geo_type:              "zip",
      snapshot_date:         today,
      median_price:          parseNum(market.medianPrice),
      avg_price_per_sqft:    parseNum(market.pricePerSqft),
      median_dom:            parseNum(market.medianDom),
      active_listings:       parseNum(market.activeListings),
      pending_listings:      parseNum(market.pendingListings),
      sold_listings:         parseNum(market.soldListings),
      absorption_rate:       parseNum(market.absorptionRate),
      rent_estimate:         parseNum(n.rent?.estimate),
      appreciation_rate_yoy: parseNum(market.appreciationYoy),
      volatility_score:      parseNum(market.volatility),
      demand_score:          parseNum(market.demandScore),
    };

    await db.upsert("market_snapshots", snapRow, "geo_key,geo_type,snapshot_date")
      .catch(e => console.warn("[ingest:market snap]", e.message));

    // Market ticker tick (OHLC-style)
    if (market.medianPrice) {
      await db.upsert("market_ticker", {
        geo_key:           zip,
        geo_type:          "zip",
        tick_date:         today,
        close_price:       parseNum(market.medianPrice),
        volume:            parseNum(market.soldListings) || 0,
        median_sqft_price: parseNum(market.pricePerSqft),
        active_listings:   parseNum(market.activeListings),
        source:            "rentcast",
      }, "geo_key,geo_type,tick_date").catch(e => console.warn("[ingest:ticker]", e.message));
    }
  }

  // ── 6. Neighborhood index ────────────────────────────────────
  if (zip) {
    const desirabilityScore = computeDesirabilityScore(desirabilityInput);

    const existingNI = await db.from("neighborhood_index")
      .select("id,report_count,total_properties_tracked")
      .eq("geo_key", zip)
      .limit(1)
      .get()
      .catch(() => []);

    const niBase = {
      geo_key:            zip,
      geo_type:           "zip",
      state:              state || null,
      city:               city || null,
      desirability_score: desirabilityScore,
      desirability_grade: desirabilityGrade(desirabilityScore),
      median_price:       parseNum(market.medianPrice),
      median_price_sqft:  parseNum(market.pricePerSqft),
      absorption_rate:    parseNum(market.absorptionRate),
      demand_score:       parseNum(market.demandScore),
      volatility_score:   parseNum(market.volatility),
      last_computed_at:   now,
      updated_at:         now,
    };

    if (Array.isArray(existingNI) && existingNI.length > 0) {
      const prev = existingNI[0];
      await db.from("neighborhood_index").eq("geo_key", zip).update({
        ...niBase,
        report_count:             (prev.report_count || 0) + 1,
        total_properties_tracked: (prev.total_properties_tracked || 0) + 1,
      }).catch(e => console.warn("[ingest:ni update]", e.message));
    } else {
      await db.insert("neighborhood_index", { ...niBase, report_count: 1, total_properties_tracked: 1 })
        .catch(e => console.warn("[ingest:ni insert]", e.message));
    }
  }

  // ── 7. Log API calls ────────────────────────────────────────
  const sources = [
    { provider: "rentcast", success: !!(prop.beds || val.marketValue) },
    { provider: "fema",     success: !!(n.flood?.zone) },
    { provider: "census",   success: !!(demo.medianIncome) },
    { provider: "nws",      success: !!(n.weather?.summary) },
    { provider: "fema_nri", success: !!(hazard.score) },
  ];

  for (const s of sources) {
    db.insert("api_call_log", {
      provider:   s.provider,
      address:    address,
      geo_key:    zip || null,
      success:    s.success,
      cached_hit: false,
      report_id:  reportId || null,
    }).catch(() => {});
  }

  return {
    propertyId,
    hash,
    desirabilityScore: computeDesirabilityScore(desirabilityInput),
    permitsIngested:   permitList.length,
    marketStored:      !!(zip && market.medianPrice),
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  try {
    const result = await ingestProperty(body);
    db.kpi("property_ingested", body.email || null, {
      address: body.address,
      propertyId: result.propertyId,
      permits: result.permitsIngested,
    });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ingested: true, ...result }) };
  } catch (err) {
    console.error("[property-ingest]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// Export for direct use by save-report.js (avoids HTTP round-trip)
exports.ingestProperty = ingestProperty;

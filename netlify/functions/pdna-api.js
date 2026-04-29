/**
 * PropertyDNA External API
 *
 * When PropertyDNA has accumulated enough data, this becomes the
 * endpoint other companies pay to query. Currently in preview mode —
 * returns data for any property in the database.
 *
 * Authentication: API key in header (X-PDNA-Key)
 * Rate limiting: tracked in api_call_log
 *
 * GET /.netlify/functions/pdna-api?address=...&zip=...
 *
 * Future: Stripe metered billing per query, API key management portal
 */

const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-PDNA-Key",
};

const API_VERSION = "1.0.0";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "GET")  return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // API key check (preview mode: any key works, just logs it)
  const apiKey = event.headers["x-pdna-key"] || event.headers["X-PDNA-Key"];
  const isPreview = !process.env.PDNA_API_KEYS_ENABLED;

  if (!isPreview && !apiKey) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({
        error: "API key required. Get access at thepropertydna.com/api",
        docs: "https://thepropertydna.com/api/docs",
      }),
    };
  }

  const { address, zip, unit, city, state, propertyId } = event.queryStringParameters || {};

  if (!address && !propertyId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "address or propertyId required" }),
    };
  }

  try {
    let prop = null;
    let pi   = null;

    if (propertyId) {
      const rows = await db.from("properties").select("*").eq("id", propertyId).limit(1).get().catch(() => []);
      prop = Array.isArray(rows) && rows.length ? rows[0] : null;
    } else {
      const rows = await db.from("properties")
        .select("*")
        .eq("address", address)
        .eq("zip", zip || "")
        .limit(1)
        .get()
        .catch(() => []);
      prop = Array.isArray(rows) && rows.length ? rows[0] : null;
    }

    if (!prop) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({
          error: "Property not found in PropertyDNA database.",
          hint: "Submit this address at thepropertydna.com to generate a report and index the property.",
        }),
      };
    }

    // Fetch all intelligence layers
    const [piRows, permits, events, locationScore, neighborhoodIndex, marketHistory] = await Promise.all([
      db.from("property_intelligence").select("*").eq("property_id", prop.id).limit(1).get().catch(() => []),
      db.from("permit_registry").select("*").eq("property_id", prop.id).order("issued_date", { ascending: false }).limit(20).get().catch(() => []),
      db.from("property_events").select("*").eq("property_id", prop.id).order("event_date", { ascending: false }).limit(30).get().catch(() => []),
      db.from("location_scores").select("*").eq("property_id", prop.id).limit(1).get().then(r => Array.isArray(r) && r.length ? r[0] : null).catch(() => null),
      prop.zip ? db.from("neighborhood_index").select("*").eq("geo_key", prop.zip).limit(1).get().then(r => Array.isArray(r) && r.length ? r[0] : null).catch(() => null) : null,
      prop.zip ? db.from("market_snapshots").select("*").eq("geo_key", prop.zip).eq("geo_type", "zip").order("snapshot_date", { ascending: false }).limit(12).get().catch(() => []) : [],
    ]);

    pi = Array.isArray(piRows) && piRows.length ? piRows[0] : null;

    // Log API call
    db.insert("api_call_log", {
      provider:   "pdna_api",
      endpoint:   "property_query",
      address:    prop.address,
      geo_key:    prop.zip,
      success:    true,
      cached_hit: true,
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "X-PDNA-Version": API_VERSION,
        "X-PDNA-Preview": isPreview ? "true" : "false",
      },
      body: JSON.stringify({
        api_version: API_VERSION,
        preview_mode: isPreview,
        source: "PropertyDNA",
        generated_at: new Date().toISOString(),

        property: {
          id:                     prop.id,
          address:                prop.address,
          unit:                   prop.unit,
          city:                   prop.city,
          state:                  prop.state,
          zip:                    prop.zip,
          property_type:          prop.property_type_normalized,
          beds:                   prop.beds,
          baths:                  prop.baths,
          sqft:                   prop.sqft,
          lot_sqft:               prop.lot_sqft,
          year_built:             prop.year_built,
          effective_year_built:   prop.effective_year_built,
          latitude:               prop.latitude,
          longitude:              prop.longitude,
          last_sale_date:         prop.last_sale_date,
          last_sale_price:        prop.last_sale_price,
        },

        valuation: pi ? {
          pdna_low:       pi.pdna_value_low,
          pdna_mid:       pi.pdna_value_mid,
          pdna_high:      pi.pdna_value_high,
          confidence:     pi.pdna_confidence,
          grade:          pi.pdna_grade,
          rent_estimate:  pi.rentcast_rent_estimate,
          dna_adjustment_pct: pi.dna_adjustment_pct,
          adjustment_drivers: pi.dna_drivers,
          last_refreshed: pi.last_refreshed_at,
        } : null,

        hazard: pi ? {
          composite_score: pi.hazard_composite_score,
          rating:          pi.hazard_rating,
          wildfire:        pi.hazard_wildfire_score,
          flood:           pi.hazard_flood_score,
          earthquake:      pi.hazard_earthquake_score,
          wind:            pi.hazard_wind_score,
          insurance_tier:  pi.insurance_risk_tier,
        } : null,

        location: locationScore ? {
          neighborhood:        locationScore.neighborhood,
          subdivision:         locationScore.subdivision,
          gated_score:         locationScore.gated_score,
          view_score:          locationScore.view_score,
          walkability_score:   locationScore.walkability_score,
          school_score:        locationScore.school_score,
          micro_location_premium_pct: locationScore.micro_location_premium_pct,
        } : null,

        neighborhood: neighborhoodIndex ? {
          geo_key:            neighborhoodIndex.geo_key,
          desirability_score: neighborhoodIndex.desirability_score,
          desirability_grade: neighborhoodIndex.desirability_grade,
          median_price:       neighborhoodIndex.median_price,
          appreciation_1yr:   neighborhoodIndex.appreciation_1yr,
          demand_score:       neighborhoodIndex.demand_score,
          trend_signal:       neighborhoodIndex.trend_signal,
          trend_30d_change_pct: neighborhoodIndex.trend_30d_change_pct,
          properties_tracked: neighborhoodIndex.total_properties_tracked,
        } : null,

        market_history: Array.isArray(marketHistory) ? marketHistory.map(m => ({
          date:          m.snapshot_date,
          median_price:  m.median_price,
          price_per_sqft:m.avg_price_per_sqft,
          dom:           m.median_dom,
          absorption:    m.absorption_rate,
          demand_score:  m.demand_score,
          ma_30:         m.ma_30_day,
          ma_90:         m.ma_90_day,
        })) : [],

        permits: Array.isArray(permits) ? permits.map(p => ({
          type:        p.permit_type,
          category:    p.permit_category,
          description: p.description,
          date:        p.issued_date,
          status:      p.status,
          value:       p.estimated_value,
          value_add:   p.pdna_value_add,
        })) : [],

        event_timeline: Array.isArray(events) ? events.map(e => ({
          type:   e.event_type,
          date:   e.event_date,
          value:  e.event_value,
          source: e.event_source,
          notes:  e.event_notes,
        })) : [],
      }),
    };

  } catch (err) {
    console.error("[pdna-api]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

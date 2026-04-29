/**
 * PropertyDNA Cache-First Property Query
 *
 * Before n8n hits RentCast or any external API, call this.
 * If the property is already in the database, return it instantly.
 * This saves API costs and latency — and over time, PropertyDNA's
 * own data becomes richer than any single external source.
 *
 * Response includes:
 *   hit: true/false — whether we have this property
 *   freshness: 'fresh' | 'stale' | 'missing'
 *   data: full property intelligence object
 *   shouldRefresh: true if data is older than 30 days
 *
 * n8n usage: call this at the top of the workflow.
 * If hit=true and shouldRefresh=false, skip external API calls
 * and use our own data directly.
 */

const crypto = require("crypto");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const STALE_DAYS = 30;

function addressHash(address, city, state, zip, unit) {
  const normalized = [address, unit, city, state, zip]
    .map(s => (s || "").toLowerCase().trim().replace(/\s+/g, " "))
    .join("|");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function freshness(lastRefreshed) {
  if (!lastRefreshed) return "missing";
  const daysSince = (Date.now() - new Date(lastRefreshed).getTime()) / 86400000;
  return daysSince <= STALE_DAYS ? "fresh" : "stale";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { address, unit, city, state, zip } = body;
  if (!address) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "address required" }) };

  const hash = addressHash(address, city, state, zip, unit);

  try {
    // Check property_intelligence cache first (fastest lookup)
    const [piRows, propRows] = await Promise.all([
      db.from("property_intelligence")
        .select("*")
        .eq("address_hash", hash)
        .limit(1)
        .get()
        .catch(() => []),
      db.from("properties")
        .select("*")
        .eq("address", address)
        .eq("zip", zip || "")
        .limit(1)
        .get()
        .catch(() => []),
    ]);

    const pi   = Array.isArray(piRows)   && piRows.length   ? piRows[0]   : null;
    const prop = Array.isArray(propRows) && propRows.length ? propRows[0] : null;

    if (!pi && !prop) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ hit: false, freshness: "missing", shouldRefresh: true, data: null }),
      };
    }

    const lastRefreshed = pi?.last_refreshed_at || prop?.updated_at;
    const freshnessVal  = freshness(lastRefreshed);
    const shouldRefresh = freshnessVal !== "fresh";

    // Fetch permits and events for this property if we have a property_id
    const propertyId = prop?.id || pi?.property_id;
    let permits = [], events = [], locationScores = null, neighborhoodIndex = null;

    if (propertyId) {
      [permits, events, locationScores] = await Promise.all([
        db.from("permit_registry")
          .select("permit_type,permit_category,description,issued_date,status,estimated_value,pdna_value_add")
          .eq("property_id", propertyId)
          .order("issued_date", { ascending: false })
          .limit(10)
          .get()
          .catch(() => []),
        db.from("property_events")
          .select("event_type,event_date,event_source,event_value,event_notes")
          .eq("property_id", propertyId)
          .order("event_date", { ascending: false })
          .limit(20)
          .get()
          .catch(() => []),
        db.from("location_scores")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(1)
          .get()
          .then(r => (Array.isArray(r) && r.length ? r[0] : null))
          .catch(() => null),
      ]);
    }

    // Fetch neighborhood index for this zip
    if (zip) {
      neighborhoodIndex = await db.from("neighborhood_index")
        .select("*")
        .eq("geo_key", zip)
        .limit(1)
        .get()
        .then(r => (Array.isArray(r) && r.length ? r[0] : null))
        .catch(() => null);
    }

    // Fetch recent market snapshots
    let marketHistory = [];
    if (zip) {
      marketHistory = await db.from("market_snapshots")
        .select("snapshot_date,median_price,avg_price_per_sqft,median_dom,absorption_rate,demand_score,ma_30_day,ma_90_day")
        .eq("geo_key", zip)
        .eq("geo_type", "zip")
        .order("snapshot_date", { ascending: false })
        .limit(12)
        .get()
        .catch(() => []);
    }

    db.kpi("property_cache_hit", null, { address, hash, freshness: freshnessVal });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        hit:          true,
        freshness:    freshnessVal,
        shouldRefresh,
        data: {
          property:          prop,
          intelligence:      pi,
          locationScores,
          permits:           Array.isArray(permits)       ? permits       : [],
          events:            Array.isArray(events)        ? events        : [],
          neighborhoodIndex,
          marketHistory:     Array.isArray(marketHistory) ? marketHistory : [],
        },
      }),
    };
  } catch (err) {
    console.error("[property-query]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

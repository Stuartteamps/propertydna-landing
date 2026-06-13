/**
 * import-title-rep-csv — Bulk-import agent production data from a title-
 * company CSV (the kind your title rep can pull for free).
 *
 * Title companies maintain agent-production databases as a customer-
 * relationship tool. Dan's title rep can export every SoCal agent with
 * closing volume + listing count for any time period. This endpoint
 * accepts that CSV, normalizes it, and upserts into
 * agent_referral_network with production tiers calculated automatically.
 *
 * POST body (JSON):
 *   csv_data    text    — raw CSV content (UTF-8)
 *   year        number  — production year the data covers (default current)
 *   source      text    — descriptive (e.g. "First American Title - Riverside 2025")
 *
 * Auth: x-internal-key header.
 *
 * Expected CSV columns (case-insensitive, flexible mapping):
 *   agent name / agent / name
 *   email (optional)
 *   phone (optional)
 *   brokerage / company / firm
 *   city
 *   state
 *   license / DRE / license_number
 *   closings / units / transactions / sides
 *   volume / production / total_volume
 *   areas (semicolon or pipe separated)
 *
 * Production tiers (automatic):
 *   diamond   >= $100M     volume OR  >= 100 units
 *   platinum  >= $50M      OR  >= 50 units
 *   gold      >= $25M      OR  >= 25 units
 *   silver    >= $10M      OR  >= 10 units
 *   bronze    >= $3M       OR  >= 5 units
 *   prospect  below bronze
 */
const db = require("./_supabase");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

// Local in-area zips for out-of-area detection (Coachella Valley)
const LOCAL_ZIPS = new Set([
  "92210", "92211", "92240", "92241", "92253", "92260", "92262", "92264", "92270", "92276",
]);
const LOCAL_CITIES = new Set([
  "palm springs", "palm desert", "rancho mirage", "indian wells", "la quinta",
  "cathedral city", "desert hot springs", "indio", "coachella", "bermuda dunes",
  "thousand palms", "thermal", "mecca", "north palm springs",
]);

function parseCsv(text) {
  // Minimal CSV parser supporting quoted fields. Sufficient for title-co exports
  // which are typically clean. For edge cases (escaped quotes), swap in papaparse.
  const rows = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim());
  for (const line of lines) {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    rows.push(out.map(s => s.trim()));
  }
  return rows;
}

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const COLUMN_MAP = {
  agent_name:  ["agent", "name", "agentname", "fullname"],
  email:       ["email", "emailaddress"],
  phone:       ["phone", "phonenumber", "mobile", "cell"],
  brokerage:   ["brokerage", "company", "firm", "office"],
  city:        ["city"],
  state:       ["state"],
  zip:         ["zip", "zipcode", "postalcode"],
  license:     ["license", "licensenumber", "dre", "drenumber"],
  units:       ["units", "closings", "transactions", "sides", "closed", "deals"],
  volume:      ["volume", "production", "totalvolume", "salesvolume", "totalsales", "grossvolume"],
  areas:       ["areas", "market", "marketareas", "territory"],
};

function matchCol(header, target) {
  const h = normalize(header);
  return COLUMN_MAP[target].some(alias => h === alias || h.includes(alias));
}

function buildHeaderIndex(headers) {
  const idx = {};
  for (const key of Object.keys(COLUMN_MAP)) {
    idx[key] = headers.findIndex(h => matchCol(h, key));
  }
  return idx;
}

function parseNumber(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function calculateTier(volume, units) {
  if (!volume && !units) return "prospect";
  if ((volume && volume >= 100_000_000) || (units && units >= 100)) return "diamond";
  if ((volume && volume >=  50_000_000) || (units && units >=  50)) return "platinum";
  if ((volume && volume >=  25_000_000) || (units && units >=  25)) return "gold";
  if ((volume && volume >=  10_000_000) || (units && units >=  10)) return "silver";
  if ((volume && volume >=   3_000_000) || (units && units >=   5)) return "bronze";
  return "prospect";
}

function isOutOfArea({ city, zip, areas }) {
  if (zip && LOCAL_ZIPS.has(String(zip).slice(0, 5))) return false;
  if (city && LOCAL_CITIES.has(city.toLowerCase().trim())) return false;
  // If the agent serves multiple areas and any is local, count as in-area
  if (Array.isArray(areas) && areas.some(a => LOCAL_CITIES.has(a.toLowerCase().trim()))) return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  const internalKey = event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const csv = body.csv_data;
  if (!csv || csv.length < 50) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "csv_data required" }) };

  const year = body.year || new Date().getFullYear();
  const source = body.source || "title_rep_import";

  const rows = parseCsv(csv);
  if (rows.length < 2) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Need at least header + 1 data row" }) };

  const headers = rows[0];
  const idx = buildHeaderIndex(headers);

  if (idx.agent_name < 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Could not find agent name column", headers, expected: COLUMN_MAP.agent_name }) };
  }

  const summary = { inserted: 0, updated: 0, errors: 0, by_tier: { diamond: 0, platinum: 0, gold: 0, silver: 0, bronze: 0, prospect: 0 } };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[idx.agent_name]) continue;

    const volume = parseNumber(r[idx.volume]);
    const units  = parseNumber(r[idx.units]);
    const tier   = calculateTier(volume, units);
    const areas  = idx.areas >= 0 ? (r[idx.areas] || "").split(/[;|]/).map(s => s.trim()).filter(Boolean) : [];

    const row = {
      agent_name:           r[idx.agent_name].trim(),
      agent_email:          idx.email   >= 0 ? (r[idx.email]   || "").toLowerCase().trim() || null : null,
      agent_phone:          idx.phone   >= 0 ? r[idx.phone]    || null : null,
      brokerage:            idx.brokerage >= 0 ? r[idx.brokerage] || null : null,
      city:                 idx.city    >= 0 ? r[idx.city]     || null : null,
      state:                idx.state   >= 0 ? r[idx.state]    || null : null,
      license_number:       idx.license >= 0 ? r[idx.license]  || null : null,
      production_volume_usd: volume,
      production_units:     units,
      production_year:      year,
      production_tier:      tier,
      market_areas:         areas.length ? areas : null,
      is_out_of_area:       isOutOfArea({ city: idx.city >= 0 ? r[idx.city] : null, zip: idx.zip >= 0 ? r[idx.zip] : null, areas }),
      source,
      status:               "prospect",
    };

    if (!row.agent_email) {
      // Synthesize a placeholder email keyed off license# or name so the upsert
      // doesn't collide on null. Real email gets enriched later (Apollo).
      const slug = (row.license_number || row.agent_name).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
      row.agent_email = `pending+${slug}@enrichment.thepropertydna.com`;
    }

    try {
      await db.upsert("agent_referral_network", row, "agent_email");
      summary.inserted++;
      summary.by_tier[tier] = (summary.by_tier[tier] || 0) + 1;
    } catch {
      summary.errors++;
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: "ok", summary, year, source, ran_at: new Date().toISOString() }) };
};

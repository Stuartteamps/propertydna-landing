/**
 * ticker-lookup — Look up a property by its ticker symbol OR generate one.
 *
 * GET /.netlify/functions/ticker-lookup?symbol=XXX
 *   → Returns the property + valuation + history for that ticker
 *
 * GET /.netlify/functions/ticker-lookup?address=ADDR
 *   → Resolves address → ticker symbol (generating one if needed)
 *
 * Ticker symbol format: <STATE>-<ZIP>-<SHORT_HASH>
 *   Examples: CA-92270-A7K · FL-33139-XR3 · TX-78704-9PM
 *
 * Why this format:
 *   - State + ZIP keeps it locally readable (humans can guess location)
 *   - 3-char hash makes it unique within zip (~46K possible values per zip)
 *   - All-caps + dashes makes it stock-ticker-feeling
 */
const db = require("./_supabase");
const crypto = require("crypto");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Base32 alphabet (no I/L/0/1 to avoid confusion in print)
const B32 = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateTicker({ state, zip, apn, address }) {
  const stateCode = (state || "US").toUpperCase().slice(0, 2);
  const zipCode = (zip || "00000").toString().replace(/\D/g, "").padStart(5, "0").slice(0, 5);
  const seed = `${stateCode}${zipCode}${apn || ""}${address || ""}`;
  const hash = crypto.createHash("sha256").update(seed).digest();
  let suffix = "";
  for (let i = 0; i < 3; i++) {
    suffix += B32[hash[i] % B32.length];
  }
  return `${stateCode}-${zipCode}-${suffix}`;
}

async function lookupBySymbol(symbol) {
  const upper = (symbol || "").toUpperCase().trim();
  if (!/^[A-Z]{2}-\d{5}-[A-Z0-9]{3}$/.test(upper)) {
    return { error: "Invalid ticker format. Expected: XX-NNNNN-XXX (state-zip-hash)" };
  }

  // Try direct lookup
  const rows = await db.from("property_master")
    .select("apn,address_line1,city,state,zip,beds,baths,sqft,year_built,rentcast_value,market_price_yoy,last_sale_date,last_sale_price,latitude,longitude,ticker")
    .eq("ticker", upper).limit(1).get().catch(() => []);

  if (Array.isArray(rows) && rows.length) {
    return rows[0];
  }

  // If not cached, try to derive: parse state + zip, scan candidates, find match
  const m = upper.match(/^([A-Z]{2})-(\d{5})-([A-Z0-9]{3})$/);
  if (!m) return { error: "ticker_parse_failed" };
  const [, state, zip] = m;
  const candidates = await db.from("property_master")
    .select("apn,address_line1,city,state,zip,beds,baths,sqft,year_built,rentcast_value,market_price_yoy,last_sale_date,last_sale_price,latitude,longitude")
    .eq("state", state).eq("zip", zip).limit(500).get().catch(() => []);

  for (const row of (candidates || [])) {
    const t = generateTicker({ state: row.state, zip: row.zip, apn: row.apn, address: row.address_line1 });
    if (t === upper) {
      // Backfill ticker for future lookups
      db.from("property_master").eq("apn", row.apn).update({ ticker: t }).catch(() => {});
      return { ...row, ticker: t };
    }
  }

  return { error: "ticker_not_found", symbol: upper };
}

async function resolveAddress(address) {
  const a = (address || "").trim();
  if (!a) return { error: "address_required" };

  // Try address match
  const rows = await db.from("property_master")
    .select("apn,address_line1,city,state,zip,beds,baths,sqft,year_built,rentcast_value,market_price_yoy,last_sale_date,last_sale_price,latitude,longitude,ticker")
    .ilike("address_line1", a + "%").limit(5).get().catch(() => []);

  if (!Array.isArray(rows) || !rows.length) {
    return { error: "address_not_indexed", suggested_action: "Run a free DNA report to index this address.", run_report_url: `https://thepropertydna.com/property-dna?address=${encodeURIComponent(a)}` };
  }

  const row = rows[0];
  let ticker = row.ticker;
  if (!ticker) {
    ticker = generateTicker({ state: row.state, zip: row.zip, apn: row.apn, address: row.address_line1 });
    db.from("property_master").eq("apn", row.apn).update({ ticker }).catch(() => {});
  }
  return { ...row, ticker };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const { symbol, address } = event.queryStringParameters || {};
  try {
    let result;
    if (symbol) result = await lookupBySymbol(symbol);
    else if (address) result = await resolveAddress(address);
    else return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Provide ?symbol=XXX or ?address=ADDR" }) };

    if (result?.error) return { statusCode: 404, headers: CORS, body: JSON.stringify(result) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};

module.exports.generateTicker = generateTicker;

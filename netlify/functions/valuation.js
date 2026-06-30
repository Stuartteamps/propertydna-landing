/**
 * valuation.js — PropertyDNA valuation endpoint (RentCast-free).
 *
 * Pulls comparable sales from our OWN database (`properties`, MLS solds +
 * assessor) and runs the comp engine (_valuation-engine.js) to return an
 * independent fair value, the expected sale price vs a list price, and the
 * buyer-defense verdict (is this listing overpriced?).
 *
 * POST /.netlify/functions/valuation
 *   Body: { address, city, state, zip, sqft, lotSqft, beds, baths, yearBuilt,
 *           pool, listPrice?, propertyType? }
 * Public read (no key) — it only returns a valuation, never raw PII.
 */
const db = require("./_supabase");
const { computeValuation } = require("./_valuation-engine");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const norm = (c) => (c || "").trim().replace(/^via /i, "");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  let b; try { b = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "bad json" }) }; }

  const city = norm(b.city);
  if (!city || !b.sqft) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "city and sqft required" }) };

  // Pull recent comps from our own solds DB for this city (fallback statewide).
  const sinceCol = "last_sale_date";
  let comps = await db.from("properties")
    .select("address,city,last_sale_price,last_sale_date,sqft,lot_sqft,beds,baths,year_built")
    .ilike("city", city).gte("last_sale_price", 1)
    .order(sinceCol, { ascending: false }).limit(400).get().catch(() => []);
  if (!Array.isArray(comps) || comps.length < 5) {
    const st = (b.state || "CA").trim();
    comps = await db.from("properties").select("address,city,last_sale_price,last_sale_date,sqft,lot_sqft,beds,baths,year_built")
      .eq("state", st).gte("last_sale_price", 1).order(sinceCol, { ascending: false }).limit(600).get().catch(() => []);
  }

  const mapped = (comps || []).map(c => ({
    price: c.last_sale_price, sqft: c.sqft, lotSqft: c.lot_sqft, beds: c.beds, baths: c.baths,
    yearBuilt: c.year_built, saleDate: c.last_sale_date, city: norm(c.city),
    pool: 0, address: c.address,
  }));

  const subject = {
    sqft: b.sqft, lotSqft: b.lotSqft, beds: b.beds, baths: b.baths, yearBuilt: b.yearBuilt,
    pool: b.pool ? 1 : 0, city, listPrice: b.listPrice,
  };

  const val = computeValuation(subject, mapped);
  if (!val.fairValue && !val.expectedSale) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, reason: "insufficient_comps", compsAvailable: mapped.length, city }) };
  }

  db.kpi("valuation_computed", null, { city, compCount: val.compCount, hasList: !!b.listPrice, overpricedPct: val.overpricedPct });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...val, compsAvailable: mapped.length }) };
};

/**
 * avm.js — PropertyDNA's own AVM. Address in, value out. Our RentCast replacement.
 *
 * Unlike /valuation (which needs the caller to pass sqft/beds/etc.), this looks
 * the property up in our OWN index (property_master: 10M+ assessor parcels with
 * characteristics + assessed value), sources comps from our sales DB, and blends
 * multiple signals into one value — the way a real AVM does, on data we own.
 *
 * Signals:
 *   S1 COMPS      — the feature-rich comp engine (_valuation-engine). Primary
 *                   where arms-length sales exist. Independent of any list price.
 *   S2 ASSESSED   — assessor total assessed value x calibrated market multiple.
 *                   A value ANYWHERE we have assessor data, even with 0 comps.
 * Blend is confidence-weighted: strong comp set dominates; assessed carries when
 * comps are thin, and always sanity-bounds the comp value.
 *
 * GET/POST /.netlify/functions/avm?address=...&city=...   (public read)
 */
const db = require("./_supabase");
const { compFairValue, tierOf, TIER_SP_LP } = require("./_valuation-engine");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
const norm = (s) => (s || "").toString().trim();
const key = (s) => norm(s).toUpperCase().replace(/\s+/g, " ");
const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) || n === 0 ? null : n; };
// Market/assessed multiple. CA Prop-13 assessments lag market; calibrated to the
// CV sale-vs-assessed distribution (~1.6). Env-tunable per market as we calibrate.
const ASSESSED_MULT = Number(process.env.AVM_ASSESSED_MULT || 1.6);

async function lookupSubject(address, city) {
  const a = key(address);
  // Subject match in our parcel index (property_master). property_master.address
  // is a PLAIN b-tree index (default collation): equality uses it and is fast on
  // the 10M-row table, but `ilike` (even without wildcards) cannot use it and
  // sequential-scans → statement timeout. So probe a few INDEXED EQUALITY case
  // variants of the street line first (assessor feeds store UPPERCASE SITUS lines
  // like "123 MAIN ST"; user input arrives mixed-case). Only fall back to the
  // city-scoped prefix query (bounded by the city index) if none hit.
  const streetLine = a.split(",")[0].trim();
  // Case variants of the STREET LINE only (assessor SITUS is UPPERCASE; some
  // indexers store Title- or raw-case). The 3rd variant is the raw-case street
  // line — NOT the full address string, which would never match street-line
  // storage and just wastes a probe.
  const rawStreet = norm(address).split(",")[0].trim();
  const variants = [...new Set([streetLine, streetLine.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), rawStreet])].filter(Boolean);
  let rows = [];
  for (const v of variants) {
    rows = await db.from("property_master")
      .select("apn,address,city,sqft,beds,baths,lot_sqft,year_built,tax_assessed_value,property_type")
      .eq("address", v).limit(5).get().catch(() => []);
    if (Array.isArray(rows) && rows.length) break;
  }
  if ((!rows || !rows.length) && city) {
    rows = await db.from("property_master")
      .select("apn,address,city,sqft,beds,baths,lot_sqft,year_built,tax_assessed_value,property_type")
      .ilike("city", norm(city)).ilike("address", a.split(" ").slice(0, 2).join(" ") + "%").limit(5).get().catch(() => []);
  }
  // Disambiguate same-street-line collisions across cities: a street line can
  // exist in Palm Springs AND Palm Desert. Prefer the row whose city matches the
  // requested city so we never feed a wrong parcel's assessed value into the AVM.
  const cityLc = String(city || "").toLowerCase().trim();
  const r = (rows || []).find((x) => cityLc && String(x.city || "").toLowerCase().includes(cityLc)) || (rows || [])[0];
  if (!r) return null;
  return {
    apn: r.apn, matchedAddress: r.address, city: r.city,
    sqft: num(r.sqft), beds: num(r.beds), baths: num(r.baths),
    lotSqft: num(r.lot_sqft), yearBuilt: num(r.year_built),
    assessedValue: num(r.tax_assessed_value), propertyType: r.property_type,
  };
}

async function findComps(city, state) {
  let comps = await db.from("properties")
    .select("address,city,last_sale_price,last_sale_date,sqft,lot_sqft,beds,baths,year_built")
    .ilike("city", norm(city)).gte("last_sale_price", 1)
    .order("last_sale_date", { ascending: false }).limit(400).get().catch(() => []);
  if (!Array.isArray(comps) || comps.length < 5) {
    comps = await db.from("properties")
      .select("address,city,last_sale_price,last_sale_date,sqft,lot_sqft,beds,baths,year_built")
      .eq("state", norm(state) || "CA").gte("last_sale_price", 1)
      .order("last_sale_date", { ascending: false }).limit(600).get().catch(() => []);
  }
  return (comps || []).map(c => ({
    price: c.last_sale_price, sqft: c.sqft, lotSqft: c.lot_sqft, beds: c.beds, baths: c.baths,
    yearBuilt: c.year_built, saleDate: c.last_sale_date, city: c.city, pool: 0, address: c.address,
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  const q = event.httpMethod === "POST" ? (() => { try { return JSON.parse(event.body || "{}"); } catch { return {}; } })() : (event.queryStringParameters || {});
  const address = norm(q.address), city = norm(q.city), state = norm(q.state) || "CA";
  if (!address && !city) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "address or city required" }) };

  // 1) Resolve the subject from our own index (characteristics + assessed value).
  let subject = address ? await lookupSubject(address, city) : null;
  const overrides = { sqft: num(q.sqft), beds: num(q.beds), baths: num(q.baths), lotSqft: num(q.lotSqft), yearBuilt: num(q.yearBuilt), assessedValue: num(q.assessedValue) };
  if (!subject) subject = { matchedAddress: null, city, ...overrides };
  else for (const k of Object.keys(overrides)) if (overrides[k] != null) subject[k] = overrides[k];
  const subjCity = subject.city || city;
  if (!subject.sqft && !subject.assessedValue) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, reason: "property_not_found", address, hint: "Not in our index yet; pass sqft to value directly." }) };
  }

  // 2) Comps from our sales DB → S1 comp signal.
  const comps = await findComps(subjCity, state);
  const S1 = subject.sqft ? compFairValue({ ...subject, city: subjCity }, comps) : null;

  // 3) Assessed anchor → S2 (a value even with no comps).
  const S2 = subject.assessedValue ? Math.round(subject.assessedValue * ASSESSED_MULT) : null;

  // 4) Signal selection. In CA (Prop-13), the assessed TOTAL is NOT a reliable
  //    market proxy — it reflects the last purchase's base year, not today's
  //    value — so we do NOT let it clamp or drag a real comp value. Comps are
  //    the AVM; assessed is a labeled last-resort fallback when we have no comps.
  let avm = null, confidence = 0.3, basis = [];
  if (S1) {
    avm = S1.fairValue; confidence = S1.confidence; basis = ["comps"];
    // Assessed only nudges confidence: if it broadly agrees, we trust the comp more.
    if (S2 && avm >= S2 * 0.6 && avm <= S2 * 2.0) { confidence = Math.min(0.92, confidence + 0.05); basis.push("assessed_agrees"); }
  } else if (S2) {
    avm = S2; confidence = 0.4; basis = ["assessed_only"];
  }

  const listPrice = num(q.listPrice);
  let expectedSale = null, overpricedPct = null, verdict = null;
  if (avm) {
    if (listPrice) {
      const t = tierOf(avm);
      expectedSale = Math.round(listPrice * (TIER_SP_LP[t] ?? 0.97));
      overpricedPct = +(((listPrice - avm) / avm) * 100).toFixed(1);
      verdict = overpricedPct > 6 ? `overpriced by ${overpricedPct}%` : overpricedPct < -6 ? `priced ${Math.abs(overpricedPct)}% below value` : "fairly priced";
    }
  }
  if (!avm) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, reason: "insufficient_signals", compsAvailable: comps.length }) };

  db.kpi("avm_computed", null, { city: subjCity, basis: basis.join("+"), compCount: S1?.compCount || 0, hasList: !!listPrice });
  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: true, avmValue: avm,
      valueLow: S1 ? S1.fairValueLow : (S2 ? Math.round(S2 * 0.85) : null),
      valueHigh: S1 ? S1.fairValueHigh : (S2 ? Math.round(S2 * 1.15) : null),
      confidence: +confidence.toFixed(2), basis, compCount: S1?.compCount || 0,
      signals: { comp: S1 ? S1.fairValue : null, assessed: S2 },
      subject: { matchedAddress: subject.matchedAddress, apn: subject.apn, sqft: subject.sqft, beds: subject.beds, baths: subject.baths, yearBuilt: subject.yearBuilt, assessedValue: subject.assessedValue },
      expectedSale, overpricedPct, verdict,
      method: "propertydna_avm_v1 (own index + comps + assessor, RentCast-free)",
    }),
  };
};

/**
 * backtest-accuracy.js — measures PropertyDNA valuation accuracy against REAL
 * recorded sales, server-side (where SUPABASE_SERVICE_KEY lives).
 *
 * Ground truth = properties.last_sale_price (an actual transaction).
 * Predictions  = property_intelligence.pdna_value_mid (our value), with
 *                rentcast_value as an INDEPENDENT head-to-head benchmark, and
 *                properties.current_estimated_value as a fallback estimate.
 *
 * Joins properties → property_intelligence by address_hash (md5 of the
 * normalized address, identical to property-ingest.js).
 *
 * GET /.netlify/functions/backtest-accuracy?key=INTERNAL_API_KEY&months=12&limit=800&floor=50000
 *   (or header x-internal-key: INTERNAL_API_KEY)
 *
 * HONESTY: where pdna_value_mid was computed using the home's prior sale as an
 * anchor, this is a calibration check (not a fully blind holdout). The RentCast
 * head-to-head IS independent. The output states the match rate so you know how
 * much of the portfolio actually had a stored prediction.
 */
const crypto = require("crypto");
const db = require("./_supabase");

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function addressHash(address, city, state, zip, unit) {
  const normalized = [address, unit, city, state, zip]
    .map((s) => (s || "").toLowerCase().trim().replace(/\s+/g, " "))
    .join("|");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Accuracy stats for a set of {predicted, actual} pairs. */
function score(pairs) {
  const apes = [], signeds = [];
  for (const { predicted, actual } of pairs) {
    if (!predicted || !actual) continue;
    const signed = (predicted - actual) / actual;
    apes.push(Math.abs(signed));
    signeds.push(signed);
  }
  if (!apes.length) return { n: 0 };
  const within = (t) => apes.filter((a) => a <= t).length / apes.length;
  const mdape = median(apes);
  return {
    n: apes.length,
    mdapePct: +(mdape * 100).toFixed(2),
    mapePct: +((apes.reduce((a, b) => a + b, 0) / apes.length) * 100).toFixed(2),
    within5Pct: +(within(0.05) * 100).toFixed(1),
    within10Pct: +(within(0.1) * 100).toFixed(1),
    within20Pct: +(within(0.2) * 100).toFixed(1),
    biasPct: +(median(signeds) * 100).toFixed(2),
    defensibleAccuracyPct: Math.max(0, Math.round((1 - mdape) * 100)),
  };
}

function isoMonthsAgo(months) {
  // No Date.now drift concerns here (server runtime); compute a cutoff date.
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const key = event.headers["x-internal-key"] || (event.queryStringParameters || {}).key;
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const q = event.queryStringParameters || {};
  const months = Math.min(Math.max(parseInt(q.months || "12", 10), 1), 60);
  const limit = Math.min(Math.max(parseInt(q.limit || "800", 10), 10), 5000);
  const floor = Math.max(parseInt(q.floor || "50000", 10), 0);
  const cutoff = isoMonthsAgo(months);

  try {
    // 1) Recent recorded sales (ground truth).
    const solds = await db
      .from("properties")
      .select("address,unit,city,state,zip,last_sale_price,last_sale_date,current_estimated_value")
      .gte("last_sale_date", cutoff)
      .gte("last_sale_price", floor)
      .order("last_sale_date", { ascending: false })
      .limit(limit)
      .get();

    if (!Array.isArray(solds) || solds.length === 0) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          ok: true, soldsPulled: 0, cutoff,
          note: `No recorded sales since ${cutoff} with price >= $${floor.toLocaleString()}. Widen 'months' or check that the weekly FlexMLS solds are landing in the properties table.`,
        }, null, 2),
      };
    }

    // 2) Look up our stored predictions by address_hash, in chunks.
    const byHash = new Map();
    for (const p of solds) {
      byHash.set(addressHash(p.address, p.city, p.state, p.zip, p.unit), p);
    }
    const hashes = [...byHash.keys()];
    const CHUNK = 60;
    const piRows = [];
    for (let i = 0; i < hashes.length; i += CHUNK) {
      const slice = hashes.slice(i, i + CHUNK);
      const rows = await db
        .from("property_intelligence")
        .select("address_hash,pdna_value_mid,rentcast_value")
        .in("address_hash", slice)
        .get()
        .catch(() => []);
      if (Array.isArray(rows)) piRows.push(...rows);
    }
    const piByHash = new Map(piRows.map((r) => [r.address_hash, r]));

    // 3) Build comparison sets.
    const pdnaPairs = [], rentcastPairs = [], estPairs = [];
    for (const [hash, p] of byHash.entries()) {
      const actual = Number(p.last_sale_price);
      if (!actual) continue;
      const pi = piByHash.get(hash);
      if (pi && Number(pi.pdna_value_mid)) pdnaPairs.push({ predicted: Number(pi.pdna_value_mid), actual });
      if (pi && Number(pi.rentcast_value)) rentcastPairs.push({ predicted: Number(pi.rentcast_value), actual });
      if (Number(p.current_estimated_value)) estPairs.push({ predicted: Number(p.current_estimated_value), actual });
    }

    const propertydna = score(pdnaPairs);
    const rentcast = score(rentcastPairs);
    const indexEstimate = score(estPairs);

    const lines = [];
    lines.push(`PropertyDNA Back-Test — real recorded sales since ${cutoff}`);
    lines.push(`Solds pulled: ${solds.length} | matched to a stored PropertyDNA value: ${propertydna.n || 0} (${((propertydna.n || 0) / solds.length * 100).toFixed(0)}%)`);
    if (propertydna.n) {
      lines.push("");
      lines.push(`PropertyDNA  → MdAPE ${propertydna.mdapePct}% | within10 ${propertydna.within10Pct}% | bias ${propertydna.biasPct > 0 ? "+" : ""}${propertydna.biasPct}% | DEFENSIBLE ${propertydna.defensibleAccuracyPct}%`);
    }
    if (rentcast.n) lines.push(`RentCast AVM → MdAPE ${rentcast.mdapePct}% | within10 ${rentcast.within10Pct}% | bias ${rentcast.biasPct > 0 ? "+" : ""}${rentcast.biasPct}%  (independent benchmark)`);
    if (indexEstimate.n) lines.push(`Index est.   → MdAPE ${indexEstimate.mdapePct}% | within10 ${indexEstimate.within10Pct}%  (properties.current_estimated_value)`);
    if (propertydna.n && rentcast.n) {
      const edge = +(rentcast.mdapePct - propertydna.mdapePct).toFixed(2);
      lines.push("");
      lines.push(`Head-to-head: PropertyDNA is ${edge > 0 ? `${edge} pts TIGHTER` : `${Math.abs(edge)} pts wider`} than the raw RentCast AVM.`);
    }
    if ((propertydna.n || 0) < 50) lines.push(`\n⚠ ${propertydna.n || 0} matched samples — below 50; treat as directional. Run PropertyDNA on more of the weekly solds to grow this.`);

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true,
        ranAt: new Date().toISOString(),
        params: { months, limit, floor, cutoff },
        soldsPulled: solds.length,
        matchRatePct: +(((propertydna.n || 0) / solds.length) * 100).toFixed(1),
        propertydna,
        rentcast,
        indexEstimate,
        report: lines.join("\n"),
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

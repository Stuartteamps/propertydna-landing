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
const https = require("https");
const db = require("./_supabase");

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
const USING_SERVICE_KEY = !!process.env.SUPABASE_SERVICE_KEY;

/** Exact row count via PostgREST Content-Range (Prefer: count=exact). */
function countRows(table, filterQS = "") {
  return new Promise((resolve) => {
    const path = `/rest/v1/${table}?select=*${filterQS}`;
    const req = https.request(
      { hostname: new URL(SUPA_URL).hostname, path, method: "HEAD",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "count=exact", Range: "0-0" } },
      (res) => {
        const cr = res.headers["content-range"] || "";
        const total = cr.includes("/") ? cr.split("/")[1] : null;
        res.on("data", () => {}); res.on("end", () => resolve(total === "*" ? null : (total != null ? Number(total) : null)));
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

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
  const months = Math.min(Math.max(parseInt(q.months || "12", 10), 1), 240);
  const limit = Math.min(Math.max(parseInt(q.limit || "800", 10), 10), 5000);
  const floor = Math.max(parseInt(q.floor || "50000", 10), 0);
  // appreciate: annual % to age each prior sale forward to today, so an old
  // recorded sale can be compared to a current estimate without the time gap
  // showing up as false "error". 0 = off (raw sale price). Honest caveat:
  // results then depend on this assumed appreciation rate.
  const appreciate = Math.min(Math.max(parseFloat(q.appreciate || "0"), 0), 25) / 100;
  const cutoff = isoMonthsAgo(months);
  const nowMs = Date.now();

  try {
    // Count mode — definitive row counts to tell RLS-limited from sparse data.
    if (q.count) {
      const [pmTotal, pmRentcast, phTotal, phSales, piTotal, piValued, prTotal, propsTotal] = await Promise.all([
        countRows("property_master"),
        countRows("property_master", "&rentcast_value=gte.1"),
        countRows("property_history"),
        countRows("property_history", "&event_type=eq.sale"),
        countRows("property_intelligence"),
        countRows("property_intelligence", "&pdna_value_mid=gte.1"),
        countRows("property_reports"),
        countRows("properties"),
      ]);
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          ok: true, count: true, usingServiceKey: USING_SERVICE_KEY,
          property_master_total: pmTotal,
          property_master_with_rentcast_value: pmRentcast,
          property_history_total: phTotal,
          property_history_SALE_events: phSales,
          property_intelligence_total: piTotal,
          property_intelligence_with_pdna_value: piValued,
          property_reports_total: prTotal,
          properties_legacy_total: propsTotal,
          note: USING_SERVICE_KEY
            ? "Service key (RLS bypassed) — true totals. Ground truth = property_history SALE events; our model value = property_intelligence/property_reports."
            : "WARNING: SUPABASE_SERVICE_KEY not set — anon key, RLS may hide rows.",
        }, null, 2),
      };
    }

    // Probe mode — inspect what's actually populated in `properties`.
    if (q.probe) {
      const anyRows = await db.from("properties").select("address,city,state,zip,last_sale_price,last_sale_date,current_estimated_value,updated_at").limit(8).get().catch((e) => ({ _err: e.message }));
      const byDate = await db.from("properties").select("address,city,state,last_sale_price,last_sale_date").order("last_sale_date", { ascending: false }).limit(8).get().catch((e) => ({ _err: e.message }));
      const withPrice = await db.from("properties").select("address,city,state,last_sale_price,last_sale_date").gte("last_sale_price", 1).limit(8).get().catch((e) => ({ _err: e.message }));
      const piSample = await db.from("property_intelligence").select("address_hash,pdna_value_mid,rentcast_value").gte("pdna_value_mid", 1).limit(5).get().catch((e) => ({ _err: e.message }));
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          ok: true, probe: true,
          anyRows_count: Array.isArray(anyRows) ? anyRows.length : anyRows,
          sample_anyRows: anyRows,
          sample_orderedByLastSaleDate: byDate,
          sample_withLastSalePrice: withPrice,
          sample_property_intelligence: piSample,
        }, null, 2),
      };
    }

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
    // Also pull property_type from property_master for type-bucketed accuracy.
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
        .select("address_hash,pdna_value_mid,rentcast_value,property_type")
        .in("address_hash", slice)
        .get()
        .catch(() => []);
      if (Array.isArray(rows)) piRows.push(...rows);
    }
    const piByHash = new Map(piRows.map((r) => [r.address_hash, r]));

    // Type classifier (loaded inline so test caller doesn't need the module path)
    let classifyPropertyType;
    try {
      ({ classifyPropertyType } = require("./_valuation_profile"));
    } catch {
      classifyPropertyType = () => "unknown";
    }

    // 3) Build comparison sets (skipping junk rows; optionally time-adjusting).
    // Each pair is tagged with price tier + property type so we can break out
    // accuracy by bucket (essential for tracking progress toward the 97%
    // MdAPE target especially at $2M+ and on non-SFR property types).
    const pdnaPairs = [], rentcastPairs = [], estPairs = [];
    const ages = [];

    // Price-tier bucketing — actual sale price decides the bucket
    function priceTier(sale) {
      if (sale < 1_000_000) return 'under_1M';
      if (sale < 2_000_000) return '1M_to_2M';
      if (sale < 5_000_000) return '2M_to_5M';
      return '5M_plus';
    }

    for (const [hash, p] of byHash.entries()) {
      const sale = Number(p.last_sale_price);
      if (!sale || !p.last_sale_date) continue;
      if (!p.address || p.address === "--") continue; // junk row
      const yrs = Math.max(0, (nowMs - Date.parse(p.last_sale_date)) / (365.25 * 864e5));
      ages.push(yrs);
      const actual = appreciate > 0 ? sale * Math.pow(1 + appreciate, yrs) : sale;
      const pi = piByHash.get(hash);
      const tier = priceTier(sale);
      const propertyType = classifyPropertyType(pi?.property_type, {});
      const tags = { tier, propertyType };
      if (pi && Number(pi.pdna_value_mid)) pdnaPairs.push({ predicted: Number(pi.pdna_value_mid), actual, ...tags });
      if (pi && Number(pi.rentcast_value)) rentcastPairs.push({ predicted: Number(pi.rentcast_value), actual, ...tags });
      if (Number(p.current_estimated_value)) estPairs.push({ predicted: Number(p.current_estimated_value), actual, ...tags });
    }
    const medianAgeYrs = ages.length ? +median(ages).toFixed(1) : null;

    const propertydna = score(pdnaPairs);
    const rentcast = score(rentcastPairs);
    const indexEstimate = score(estPairs);

    // ── Bucketed breakdowns — the path to 97% accuracy ────────────────────
    // Per price tier and per property type. We score each sub-population
    // independently so we can see where the model is strongest/weakest.
    function bucketScore(pairs, key) {
      const buckets = {};
      for (const p of pairs) {
        const b = p[key] || 'unknown';
        (buckets[b] ||= []).push(p);
      }
      const out = {};
      for (const [b, sub] of Object.entries(buckets)) {
        out[b] = score(sub);
      }
      return out;
    }

    const propertydna_byTier = bucketScore(pdnaPairs, 'tier');
    const propertydna_byType = bucketScore(pdnaPairs, 'propertyType');
    const rentcast_byTier    = bucketScore(rentcastPairs, 'tier');
    // 97% target line (DEFENSIBLE = within 3% MdAPE)
    const TARGET_MDAPE_PCT = 3.0;

    const lines = [];
    lines.push(`PropertyDNA Back-Test — recorded sales since ${cutoff}`);
    lines.push(`Solds pulled: ${solds.length} | matched to a stored PropertyDNA value: ${propertydna.n || 0} (${((propertydna.n || 0) / solds.length * 100).toFixed(0)}%)`);
    if (medianAgeYrs != null) lines.push(`Median sale age: ${medianAgeYrs} yrs${appreciate > 0 ? ` | time-adjusted forward at ${(appreciate * 100).toFixed(1)}%/yr` : ` | NOT time-adjusted (old sales inflate error — add &appreciate=6)`}`);
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

    // ── Per-bucket breakdown to surface the 97% MdAPE gap ─────────────────
    function fmtBucketLine(label, s) {
      if (!s || !s.n) return `  ${label.padEnd(22)} (no samples)`;
      const onTarget = s.mdapePct <= TARGET_MDAPE_PCT ? '✓' : '✗';
      const gap = (s.mdapePct - TARGET_MDAPE_PCT).toFixed(1);
      return `  ${label.padEnd(22)} n=${String(s.n).padStart(3)} | MdAPE ${String(s.mdapePct).padStart(5)}% | within10 ${String(s.within10Pct).padStart(5)}% | ${onTarget} ${gap}pt vs 97% target`;
    }
    const TIER_ORDER = ['under_1M', '1M_to_2M', '2M_to_5M', '5M_plus'];
    const TYPE_ORDER = ['sfr', 'condo', 'townhouse', 'multifamily_small', 'multifamily_large', 'commercial', 'land', 'unknown'];

    if (propertydna.n) {
      lines.push("");
      lines.push(`── PropertyDNA accuracy by PRICE TIER (target: MdAPE ≤ ${TARGET_MDAPE_PCT}%) ──`);
      for (const t of TIER_ORDER) lines.push(fmtBucketLine(t, propertydna_byTier[t]));

      lines.push("");
      lines.push(`── PropertyDNA accuracy by PROPERTY TYPE (target: MdAPE ≤ ${TARGET_MDAPE_PCT}%) ──`);
      for (const t of TYPE_ORDER) {
        if (propertydna_byType[t]?.n) lines.push(fmtBucketLine(t, propertydna_byType[t]));
      }
    }
    if (rentcast.n) {
      lines.push("");
      lines.push(`── RentCast baseline by PRICE TIER (independent benchmark) ──`);
      for (const t of TIER_ORDER) {
        const s = rentcast_byTier[t];
        if (s?.n) lines.push(`  ${t.padEnd(22)} n=${String(s.n).padStart(3)} | MdAPE ${String(s.mdapePct).padStart(5)}%`);
      }
    }

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true,
        ranAt: new Date().toISOString(),
        targetMdapePct: TARGET_MDAPE_PCT,
        params: { months, limit, floor, cutoff, appreciatePct: appreciate * 100 },
        soldsPulled: solds.length,
        medianSaleAgeYrs: medianAgeYrs,
        matchRatePct: +(((propertydna.n || 0) / solds.length) * 100).toFixed(1),
        propertydna,
        propertydna_byTier,
        propertydna_byType,
        rentcast,
        rentcast_byTier,
        indexEstimate,
        report: lines.join("\n"),
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

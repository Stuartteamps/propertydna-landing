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
// ── LIVE-mode reuse: the CURRENT valuation stack (same modules enrich-report.js
// runs). We import the math — we do NOT fork or duplicate it — so ?live=1 scores
// the exact engine that ships today, not stale stored pdna values. ──
const { computeValuation, filterArmsLength } = require("./_valuation-engine");
const { rankCompsCommunityFirst } = require("./_community_comps");
const { lookupCommunityByAddress } = require("./_cv_luxury_index");

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
    // NON-STANDARD, generous "accuracy" = 100 - MdAPE. Not an industry metric.
    // Read within5/within10/within20 (already surfaced above) for a defensible
    // read of accuracy. Key renamed from the old flattering "defensibleAccuracyPct".
    nonStandardAccuracyPct_100_minus_MdAPE: Math.max(0, Math.round((1 - mdape) * 100)),
  };
}

function isoMonthsAgo(months) {
  // No Date.now drift concerns here (server runtime); compute a cutoff date.
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE BACK-TEST (?live=1) — measures the CURRENT engine, not stored pdna values.
//
// For every Coachella-Valley ground-truth sold (rows in `properties` with a real
// last_sale_price in the window), we recompute a valuation with TODAY's engine
// AS-OF that sale date and compare the predicted comp fair value to the actual
// recorded sale price.
//
// LEAKAGE SAFETY (two independent guards):
//   1. Comp set: for each subject we use ONLY sales that closed STRICTLY BEFORE
//      the subject's own sale date, in the subject's city, and we EXCLUDE the
//      subject address itself (any sale of it). No future comp can inform the
//      prediction; the subject can't be its own comp.
//   2. Anchor: computeValuation's "sale anchor" is the subject's OWN last sale —
//      which in a back-test IS the ground-truth answer. Feeding it back would be
//      circular, so we pass anchorValue=null and measure the BLIND comp fair
//      value. nowYear is set to the sale year so the engine's recency weighting
//      is dated as-of the sale, not today.
//
// The comp pull + community ranking + computeValuation mirror enrich-report.js's
// buildEngineValuation() (same modules, same shapes), minus the subject-sale
// anchor and with the before-date comp filter. READ-ONLY: SELECT only, never
// writes a pdna value.
// ═══════════════════════════════════════════════════════════════════════════
const numOr = (v) => { if (v == null) return null; const n = Number(v); return isNaN(n) || n === 0 ? null : n; };
const normCity = (c) => String(c || "").toLowerCase().trim().replace(/\s+/g, " ");
const normAddr = (a) => String(a || "").toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");

const CV_CITIES = ["palm springs", "palm desert", "indio", "la quinta", "rancho mirage",
  "indian wells", "cathedral city", "desert hot springs", "coachella", "thousand palms", "bermuda dunes"];
function isCoachellaValley(city, state) {
  const st = String(state || "").trim();
  if (st && st.toUpperCase() !== "CA" && st.toLowerCase() !== "california") return false;
  const c = String(city || "").toLowerCase();
  return CV_CITIES.some((x) => c.includes(x));
}
// Reuse the existing back-test price-tier buckets.
function liveTier(sale) {
  if (sale < 1_000_000) return "under_1M";
  if (sale < 2_000_000) return "1M_to_2M";
  if (sale < 5_000_000) return "2M_to_5M";
  return "5M_plus";
}

async function runLiveBacktest({ months, limit, floor, cutoff, dbg }) {
  const startMs = Date.now();
  const BUDGET_MS = 22000; // wall-clock guard (function timeout is 26s)
  const COMP_MIN_PRICE = 50000; // junk guard, mirrors enrich-report's comp filter
  const COMP_CAP = 250;         // mirrors enrich-report lookupSoldComps .limit(250)
  const COLS = "address,unit,city,state,zip,sqft,beds,baths,lot_sqft,year_built,last_sale_price,last_sale_date,property_type_normalized";

  // ── Pull the CV sold universe ONCE (windowed, paginated). It serves as BOTH
  //    the ground-truth subject set AND the comp pool; each subject only ever
  //    sees earlier-dated members of the same city. ──
  const universeCap = Math.min(Math.max(limit, 1000) + 7000, 25000);
  const PAGE = 1000;
  const universe = [];
  let rowsScanned = 0, pages = 0;
  for (let off = 0; off < universeCap; off += PAGE) {
    const rows = await db.from("properties")
      .select(COLS)
      .gte("last_sale_price", floor)
      .gte("last_sale_date", cutoff)
      .order("last_sale_date", { ascending: false })
      .range(off, off + PAGE - 1)
      .get().catch(() => []);
    pages++;
    if (!Array.isArray(rows) || rows.length === 0) break;
    rowsScanned += rows.length;
    for (const r of rows) {
      if (!r.last_sale_date || !isCoachellaValley(r.city, r.state)) continue;
      universe.push(r);
    }
    if (rows.length < PAGE) break;
    if (Date.now() - startMs > BUDGET_MS) break;
  }

  // ── Arms-length filter (shared with the engine). Drops CLEAR non-market
  //    transfers — trust deeds, quitclaims, probate, nominal/intra-family, and
  //    same-week re-recordings — from the universe. Because the universe is BOTH
  //    the ground-truth subject set AND the comp pool, this single pass cleans
  //    (a) the comps each subject values from and (b) the solds we score against.
  //    Junk "sales" are the source of the 2,566% MAPE (a $1.3M home "sold" $145K). ──
  const alUniverse = filterArmsLength(universe, { cohortKey: (r) => normCity(r.city) });
  const universeRaw = universe.length;
  const armsLengthStats = alUniverse.stats;
  const cleanUniverse = alUniverse.kept;

  // Universe is already last_sale_date DESC. Group by city for fast per-subject
  // comp selection (each city list stays DESC → newest comps first).
  const byCity = new Map();
  for (const r of cleanUniverse) {
    const k = normCity(r.city);
    if (!byCity.has(k)) byCity.set(k, []);
    byCity.get(k).push(r);
  }

  const subjects = cleanUniverse.slice(0, limit);
  const pairs = [];
  const diag = { no_sqft: 0, no_sale: 0, few_comps: 0, few_usable: 0, no_value: 0, valued: 0, budget_stopped: 0 };
  let compCountSum = 0;

  for (let i = 0; i < subjects.length; i++) {
    if (Date.now() - startMs > BUDGET_MS) { diag.budget_stopped = subjects.length - i; break; }
    const s = subjects[i];
    const actual = numOr(s.last_sale_price);
    const saleT = Date.parse(s.last_sale_date);
    if (!actual || isNaN(saleT)) { diag.no_sale++; continue; }
    const subjSqft = numOr(s.sqft);
    if (!subjSqft) { diag.no_sqft++; continue; }

    const cityLc = normCity(s.city);
    const subjAddr = normAddr(s.address);
    const cohort = byCity.get(cityLc) || [];

    // Leakage-safe comps: same city, SOLD STRICTLY BEFORE the subject's sale
    // date, and NOT the subject itself. Cohort is DESC, so we naturally collect
    // the most-recent-before-sale comps first, capped at COMP_CAP.
    const rawComps = [];
    for (const c of cohort) {
      if (rawComps.length >= COMP_CAP) break;
      const ct = Date.parse(c.last_sale_date);
      if (isNaN(ct) || ct >= saleT) continue;          // must have closed BEFORE the subject
      if (normAddr(c.address) === subjAddr) continue;   // exclude the subject itself
      const price = numOr(c.last_sale_price);
      if (!price || price < COMP_MIN_PRICE) continue;
      rawComps.push({
        address: c.address, city: c.city, distance: null,
        lotSize: numOr(c.lot_sqft), saleDate: c.last_sale_date,
        propertyType: c.property_type_normalized || null,
        sqft: numOr(c.sqft), price,
        beds: numOr(c.beds), baths: numOr(c.baths),
        yearBuilt: numOr(c.year_built), lat: null, lon: null,
      });
    }
    if (rawComps.length < 3) { diag.few_comps++; continue; }

    // Community-first ranking (identical to enrich-report.js), then computeValuation.
    const subjectCommunity = lookupCommunityByAddress(s.address, s.city) || null;
    const rankSubject = { propertyType: s.property_type_normalized, sqft: subjSqft, lotSize: numOr(s.lot_sqft), city: s.city };
    const ranked = rankCompsCommunityFirst(rankSubject, subjectCommunity, rawComps);
    const engineComps = ranked.map((c) => ({
      price: c.price, sqft: c.sqft, lotSqft: c.lotSize ?? null,
      beds: c.beds ?? null, baths: c.baths ?? null, yearBuilt: c.yearBuilt ?? null,
      saleDate: c.saleDate ?? null,
    }));
    const usable = engineComps.filter((c) => numOr(c.price) && numOr(c.sqft) && numOr(c.sqft) > 400).length;
    if (usable < 3) { diag.few_usable++; continue; }

    const engineSubject = { sqft: subjSqft, lotSqft: numOr(s.lot_sqft), beds: numOr(s.beds), baths: numOr(s.baths), yearBuilt: numOr(s.year_built) };
    const saleYear = new Date(saleT).getUTCFullYear();
    // anchorValue=null → BLIND comp fair value (subject's own sale is the target).
    const val = computeValuation(engineSubject, engineComps, { anchorValue: null, nowYear: saleYear });
    const predicted = val.fairValue;
    if (!predicted) { diag.no_value++; continue; }
    diag.valued++;
    compCountSum += val.compCount || usable;
    pairs.push({ predicted, actual, tier: liveTier(actual),
      _dbg: { address: s.address, city: s.city, sqft: subjSqft, psf: +(actual / subjSqft).toFixed(0),
        ape: +Math.abs((predicted - actual) / actual).toFixed(2) } });
  }
  // Diagnostic: the worst over/under predictions drive MAPE — surface them so the
  // arms-length thresholds can be calibrated against real offenders (temporary).
  const worstOffenders = dbg
    ? [...pairs].sort((a, b) => b._dbg.ape - a._dbg.ape).slice(0, 25).map((p) => ({ ...p._dbg, predicted: p.predicted, actual: p.actual }))
    : undefined;

  // ── Aggregate: overall + by price tier (reusing score()). ──
  const overall = score(pairs);
  const TIER_ORDER = ["under_1M", "1M_to_2M", "2M_to_5M", "5M_plus"];
  const byTier = {};
  for (const t of TIER_ORDER) byTier[t] = score(pairs.filter((p) => p.tier === t));

  const dir = overall.n ? (overall.biasPct > 0 ? "OVER-values" : overall.biasPct < 0 ? "UNDER-values" : "is centered") : "n/a";
  const lines = [];
  lines.push(`PropertyDNA LIVE Back-Test — CURRENT engine, as-of each sale date (recorded CV sales since ${cutoff})`);
  lines.push(`Leakage-safe: comps SOLD BEFORE the subject's sale date, same city, subject excluded; anchorValue=null (blind comp fair value); nowYear=sale year.`);
  lines.push(`CV solds pulled: ${universeRaw} (scanned ${rowsScanned} rows / ${pages} pages) | arms-length filter dropped ${armsLengthStats.dropped} non-market transfers (${JSON.stringify(armsLengthStats.reasons)}) → ${cleanUniverse.length} clean | subjects considered: ${subjects.length} | VALUED (n): ${overall.n || 0}` + (diag.budget_stopped ? ` | budget-stopped ${diag.budget_stopped}` : ""));
  lines.push(`Skips → no_sqft ${diag.no_sqft} | no/late comps ${diag.few_comps + diag.few_usable} | no_value ${diag.no_value} | no_sale ${diag.no_sale}`);
  if (overall.n) {
    lines.push("");
    lines.push(`OVERALL → MdAPE ${overall.mdapePct}% | MAPE ${overall.mapePct}% | within5 ${overall.within5Pct}% | within10 ${overall.within10Pct}% | within20 ${overall.within20Pct}% | bias ${overall.biasPct > 0 ? "+" : ""}${overall.biasPct}% (engine ${dir}) | n=${overall.n}`);
    lines.push("");
    lines.push(`── LIVE accuracy by PRICE TIER ──`);
    for (const t of TIER_ORDER) {
      const s = byTier[t];
      if (!s || !s.n) { lines.push(`  ${t.padEnd(10)} (no samples)`); continue; }
      lines.push(`  ${t.padEnd(10)} n=${String(s.n).padStart(4)} | MdAPE ${String(s.mdapePct).padStart(6)}% | within10 ${String(s.within10Pct).padStart(5)}% | bias ${s.biasPct > 0 ? "+" : ""}${s.biasPct}% (${s.biasPct > 0 ? "over" : s.biasPct < 0 ? "under" : "flat"})`);
    }
  } else {
    lines.push("");
    lines.push("No CV solds could be valued (n=0). Widen 'months' or check the properties sold feed.");
  }
  if ((overall.n || 0) < 50) lines.push(`\n⚠ ${overall.n || 0} valued samples — below 50; directional only.`);

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: true, live: true, usingServiceKey: USING_SERVICE_KEY,
      ranAt: new Date().toISOString(),
      runtimeMs: Date.now() - startMs,
      params: { months, limit, floor, cutoff, mode: "live_current_engine_as_of_sale_date" },
      leakageSafety: {
        compRule: "same city; last_sale_date STRICTLY < subject last_sale_date; subject address excluded; capped at 250 most-recent-before-sale; price >= $50k",
        anchor: "anchorValue=null (subject's own sale is the ground-truth target — never fed back)",
        recency: "computeValuation nowYear = subject sale year (as-of dating)",
        engine: "computeValuation + rankCompsCommunityFirst imported from _valuation-engine.js / _community_comps.js (no fork)",
      },
      universeSize: cleanUniverse.length,
      universeRaw,
      armsLengthFilter: armsLengthStats,
      rowsScanned, pages,
      subjectsConsidered: subjects.length,
      valued: overall.n || 0,
      avgCompCount: overall.n ? +(compCountSum / overall.n).toFixed(1) : null,
      diagnostics: diag,
      worstOffenders,
      overall,
      byTier,
      report: lines.join("\n"),
    }, null, 2),
  };
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
    // LIVE mode — recompute with the CURRENT engine as-of each sale date.
    if (q.live) {
      return await runLiveBacktest({ months, limit, floor, cutoff, dbg: !!q._dbg });
    }

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
    // sqft is needed for the PSF outlier filter that drops non-arms-length sales
    // (trust transfers, family deeds, distressed) from ground truth — without it
    // the under-$1M tier shows ~34% MdAPE driven by ground-truth pollution, not
    // model error.
    const solds = await db
      .from("properties")
      .select("address,unit,city,state,zip,sqft,last_sale_price,last_sale_date,current_estimated_value")
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

    // ── 1.5) Ground-truth PSF outlier filter ──────────────────────────────
    // The ground-truth `properties` table is populated from RentCast's
    // /listings/sale feed, which includes trust transfers, family deeds,
    // partial-interest conveyances, and distressed/auction sales. None of those
    // represent market value, but they're recorded as "sales" — and they pollute
    // accuracy measurement.
    //
    // Mirror the same arms-length guard `computeClosestCompAnchor` uses on the
    // comp side: compute median PSF within each (zip OR city) cohort with ≥3
    // ground-truth sales, then drop sales whose PSF is outside 0.5x–2.0x of
    // that median. Sales without sqft are kept (we can't judge; trust them).
    //
    // Validated against Palm Springs: this filter is what drove the
    // computeClosestCompAnchor MAPE down from ~61% to ~33% on the comp side
    // (per the inline comment in save-report.js).
    //
    // Toggle via ?psfFilter=1 to enable. Default OFF as of 2026-06-29: the
    // naive cohort-PSF filter dropped LEGITIMATE luxury sales (2M-5M went
    // 8→2 matched; 5M+ went 3→0) because luxury homes are PSF outliers
    // within mixed cohorts (cohort median is dragged down by regular homes).
    // Under-$1M MdAPE was unchanged. Re-enable when the filter is rewritten
    // to be tier-aware OR replaced with prediction-residual-based filtering
    // (e.g. drop sales where price < 0.6x or > 1.8x of RentCast AVM —
    // independent of cohort, catches non-arms-length without bucket bias).
    // ── Shared arms-length pre-filter (same helper the engine + live path use) ──
    // Drops CLEAR non-market transfers from ground truth (trust deeds, quitclaims,
    // probate, nominal/intra-family, same-week re-recordings) before the legacy
    // PSF / consensus filters. Conservative — keeps real sales. Toggle ?armsLength=0.
    const armsLengthOn = (q.armsLength || "1") !== "0";
    let solds1 = solds, armsLengthStats = { total: solds.length, kept: solds.length, dropped: 0, reasons: {} };
    if (armsLengthOn) {
      const al = filterArmsLength(solds, { cohortKey: (r) => `${(r.zip || "").trim()}|${(r.city || "").toLowerCase().trim()}` });
      solds1 = al.kept; armsLengthStats = al.stats;
    }

    const psfFilter = (q.psfFilter || "0") === "1";
    const filterStats = { soldsBeforeFilter: solds.length, droppedByArmsLength: armsLengthStats.dropped, droppedByPsf: 0, droppedNoSqft: 0, keptNoCohort: 0 };

    let cleanSolds = solds1;
    if (psfFilter) {
      // Group by (zip OR city) and compute median PSF for each cohort
      const cohorts = new Map();   // key → [psf values]
      const cohortKey = (p) => `${(p.zip || "").trim()}|${(p.city || "").toLowerCase().trim()}|${(p.state || "").toUpperCase().trim()}`;
      for (const p of solds1) {
        const sqft = Number(p.sqft);
        const sale = Number(p.last_sale_price);
        if (!sqft || sqft < 200 || !sale) continue;
        const psf = sale / sqft;
        if (psf < 10 || psf > 50000) continue; // obvious junk
        const k = cohortKey(p);
        if (!cohorts.has(k)) cohorts.set(k, []);
        cohorts.get(k).push(psf);
      }
      const cohortMedians = new Map();
      for (const [k, vals] of cohorts) {
        if (vals.length >= 3) cohortMedians.set(k, median(vals));
      }

      cleanSolds = solds1.filter((p) => {
        const sqft = Number(p.sqft);
        const sale = Number(p.last_sale_price);
        if (!sqft || sqft < 200) { filterStats.droppedNoSqft++; return true; } // can't judge — keep (counted)
        const k = cohortKey(p);
        const med = cohortMedians.get(k);
        if (!med) { filterStats.keptNoCohort++; return true; } // cohort too small — trust the row
        const psf = sale / sqft;
        const ratio = psf / med;
        if (ratio < 0.5 || ratio > 2.0) { filterStats.droppedByPsf++; return false; }
        return true;
      });
      // Reset the "noSqft" counter to only count those we actually kept under that branch
      // (filter currently RETURNS TRUE for them — they're kept, just flagged)
      filterStats.kept = cleanSolds.length;
      filterStats.cohortsBuilt = cohortMedians.size;
    }

    // 2) Look up our stored predictions by address_hash, in chunks.
    const byHash = new Map();
    for (const p of cleanSolds) {
      byHash.set(addressHash(p.address, p.city, p.state, p.zip, p.unit), p);
    }
    const hashes = [...byHash.keys()];
    const CHUNK = 60;
    const piRows = [];
    for (let i = 0; i < hashes.length; i += CHUNK) {
      const slice = hashes.slice(i, i + CHUNK);
      // property_intelligence has no property_type column — the per-type bucketing
      // would need a separate join to property_master.property_type via apn,
      // which we don't have a hash for here. Per-tier bucketing still works
      // (driven by ground-truth sale price, not property_type). Per-type
      // breakdown is a Phase-2 follow-up.
      const rows = await db
        .from("property_intelligence")
        .select("address_hash,pdna_value_mid,rentcast_value")
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

    // ── Consensus non-arms-length filter ──────────────────────────────────
    // Discovery 2026-06-29: top-10 under-$1M "overvaluations" all show
    // PropertyDNA + RentCast (two independent AVMs) AGREE on ~$1-2M values
    // while the "sale" was recorded at $145K-$650K — i.e. 25-50% of model.
    // Example: 700 N Prescott Dr — PDNA $1.30M, RC $1.16M, "sold" $365K.
    // Two independent AVMs do not agree by accident; the recorded transfer
    // is almost certainly a trust deed, quit claim, probate, or foreclosure,
    // not a market sale. Inclusion of these in ground truth corrupts the
    // measured bias by ~25-30pp at the low end.
    //
    // Rule: when BOTH AVMs are populated AND BOTH say the property is worth
    // ≥ 1/CONSENSUS_THRESHOLD of the recorded sale, drop it as non-arms-length.
    // Default 0.60 → if both AVMs say >$1.66×actual, drop. Strict consensus
    // — single AVM disagreement is NOT enough (could be model error).
    // DEFAULT OFF (B-10 data-integrity fix, 2026-07-23): this filter drops
    // GROUND-TRUTH sales using the model's OWN output (both AVMs > 1/threshold ×
    // sale), which is self-referential and can INFLATE measured accuracy by
    // silently discarding sales the model disagrees with. Opt in explicitly with
    // ?consensusFilter=1. When enabled, the effect is reported (consensusDropped
    // + consensusFlaggedSamples + a report line). Threshold via ?consensusThreshold
    // (0.70 default when enabled). Previously this defaulted ON and cut under-$1M
    // MdAPE from 24% → 12% — that improvement was measurement-hiding, not model gain.
    const consensusFilter = (q.consensusFilter || "0") === "1";
    const CONSENSUS_THRESHOLD = Number(q.consensusThreshold || 0.70);
    let consensusDropped = 0;
    const flaggedSamples = []; // first 10 dropped — surfaced for audit

    for (const [hash, p] of byHash.entries()) {
      const sale = Number(p.last_sale_price);
      if (!sale || !p.last_sale_date) continue;
      if (!p.address || p.address === "--") continue; // junk row
      const yrs = Math.max(0, (nowMs - Date.parse(p.last_sale_date)) / (365.25 * 864e5));
      ages.push(yrs);
      const actual = appreciate > 0 ? sale * Math.pow(1 + appreciate, yrs) : sale;
      const pi = piByHash.get(hash);

      // Consensus non-arms-length check: BOTH our AVM and RentCast must say
      // the property is worth significantly more than recorded sale price.
      // Single-AVM disagreement is NOT enough — that's a model error we
      // WANT to measure, not hide. Two-AVM consensus = transfer is not market.
      if (consensusFilter && pi) {
        const pdnaMid = Number(pi.pdna_value_mid) || 0;
        const rcMid   = Number(pi.rentcast_value) || 0;
        if (pdnaMid > 0 && rcMid > 0) {
          const pdnaRatio = sale / pdnaMid;
          const rcRatio   = sale / rcMid;
          if (pdnaRatio < CONSENSUS_THRESHOLD && rcRatio < CONSENSUS_THRESHOLD) {
            consensusDropped++;
            if (flaggedSamples.length < 10) {
              flaggedSamples.push({
                address: p.address,
                zip:     p.zip,
                sale,
                pdnaMid,
                rcMid,
                pdnaRatio: +pdnaRatio.toFixed(2),
                rcRatio:   +rcRatio.toFixed(2),
              });
            }
            continue; // skip this sale
          }
        }
      }

      const tier = priceTier(sale);
      // property_type not available on property_intelligence — bucketing falls
      // back to 'unknown' for the by-type breakdown. Phase 2: join to
      // property_master.property_type via apn.
      const propertyType = classifyPropertyType(null, {});
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
    if (armsLengthOn) {
      lines.push(`Arms-length filter ON: dropped ${armsLengthStats.dropped}/${armsLengthStats.total} non-market transfers (${JSON.stringify(armsLengthStats.reasons)}) → ${solds1.length} clean solds`);
    }
    if (psfFilter) {
      lines.push(`Ground-truth PSF filter ON (?psfFilter=1): pulled ${filterStats.soldsBeforeFilter} | dropped ${filterStats.droppedByPsf} by PSF | kept ${filterStats.kept || cleanSolds.length} (cohorts=${filterStats.cohortsBuilt || 0})`);
    }
    if (consensusFilter) {
      lines.push(`Consensus non-arms-length filter ON: dropped ${consensusDropped} sales where BOTH PDNA + RC AVMs > ${(1/CONSENSUS_THRESHOLD).toFixed(1)}× sale price (= trust/quit-claim/probate)`);
    }
    lines.push(`Matched to stored PropertyDNA value: ${propertydna.n || 0} (${((propertydna.n || 0) / (cleanSolds.length || 1) * 100).toFixed(0)}%)`);
    if (medianAgeYrs != null) lines.push(`Median sale age: ${medianAgeYrs} yrs${appreciate > 0 ? ` | time-adjusted forward at ${(appreciate * 100).toFixed(1)}%/yr` : ` | NOT time-adjusted (old sales inflate error — add &appreciate=6)`}`);
    if (propertydna.n) {
      lines.push("");
      lines.push(`PropertyDNA  → MdAPE ${propertydna.mdapePct}% | within5 ${propertydna.within5Pct}% | within10 ${propertydna.within10Pct}% | within20 ${propertydna.within20Pct}% | bias ${propertydna.biasPct > 0 ? "+" : ""}${propertydna.biasPct}% | nonStandardAcc(100-MdAPE) ${propertydna.nonStandardAccuracyPct_100_minus_MdAPE}%`);
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
        methodology: {
          mode: "calibration_check_NOT_blind_holdout",
          note: "DEFAULT path: predictions are stored pdna_value_mid values that were computed with the home's OWN prior sale as an anchor. This is a calibration check, NOT a leakage-free blind holdout — the headline MdAPE here is optimistic and must not be presented as blind out-of-sample accuracy.",
          leakageSafeMode: "Add ?live=1 for the leakage-safe back-test: it recomputes with the current engine as-of each sale date, excludes the subject, uses only comps sold strictly before the sale, and feeds anchorValue=null (blind comp fair value).",
          accuracyMetric: "nonStandardAccuracyPct_100_minus_MdAPE is a non-standard, generous definition (100 - MdAPE), not an industry metric. Prefer within5Pct / within10Pct / within20Pct and MdAPE for a defensible read.",
          consensusFilter: consensusFilter
            ? `ENABLED (?consensusFilter=1): dropped ${consensusDropped} ground-truth sales using the model's OWN AVM output (both PDNA + RC > ${(1 / CONSENSUS_THRESHOLD).toFixed(2)}× sale). Self-referential — can inflate measured accuracy.`
            : "OFF by default: the self-referential consensus ground-truth filter is NOT applied (no ground truth silently dropped). Enable with ?consensusFilter=1.",
        },
        targetMdapePct: TARGET_MDAPE_PCT,
        params: { months, limit, floor, cutoff, appreciatePct: appreciate * 100, armsLength: armsLengthOn, psfFilter, consensusFilter, consensusThreshold: CONSENSUS_THRESHOLD },
        soldsPulled: solds.length,
        soldsAfterArmsLength: solds1.length,
        armsLengthFilter: armsLengthStats,
        soldsAfterFilter: cleanSolds.length,
        groundTruthFilter: filterStats,
        consensusDropped,
        consensusFlaggedSamples: flaggedSamples,
        medianSaleAgeYrs: medianAgeYrs,
        matchRatePct: +(((propertydna.n || 0) / (cleanSolds.length || 1)) * 100).toFixed(1),
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

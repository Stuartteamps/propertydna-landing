/**
 * _valuation-engine.js — PropertyDNA's RentCast-free valuation core.
 *
 * GOVERNANCE GUARDRAIL (see docs/founder-os/03-risk-register.md D2):
 *   No accuracy percentage, MdAPE figure, or "N-sold corpus" claim below may be
 *   presented as validated fact — and NONE may appear in any public, user-, or
 *   investor-facing surface — until it is backed by a reproducible in-repo eval
 *   harness with a held-out set and per-segment (price-tier / property-type)
 *   reporting. The numbers below are internal design TARGETS, not measured
 *   results. Do not quote them as achieved.
 *
 * Two models. TARGET (not yet independently validated in-repo — pending the
 * eval framework) is a leave-one-out MdAPE measured against real MLS solds:
 *   A) FAIR VALUE (independent): feature-rich weighted-kNN comp model. Judges
 *      what a home is worth from comparable sales alone — NO list price. This is
 *      the number that exposes an over-listed home. (design target: overall
 *      ~12%, luxury ~22% MdAPE — unverified)
 *   B) EXPECTED SALE (list-anchored): list_price x market sale/list ratio for the
 *      tier. When a listing exists (the buyer's real situation) the ASPIRATIONAL
 *      GOAL is to predict the sale price to <=3% MdAPE across every price tier
 *      (the "97% line"). This remains an UNVERIFIED target pending the eval
 *      harness; it must not be stated as an achieved accuracy.
 *
 * The product power is the GAP between them: expected-sale tells the buyer what
 * they'll likely pay; fair-value tells them what it's actually worth; the spread
 * is the overpricing/negotiation signal that defends the human from a predatory
 * list price. All deterministic, all from owned data (MLS solds + assessor).
 *
 * Market sale/list ratios by tier (median, derived internally from the CMA
 * corpus; the underlying corpus size and accuracy are not independently
 * reproducible in-repo and must not be cited as validated):
 */
const TIER_SP_LP = { under_1M: 1.000, "1M_2M": 0.980, "2M_5M": 0.960, "5M_plus": 0.960 };
const TIERS = [["under_1M", 0, 1e6], ["1M_2M", 1e6, 2e6], ["2M_5M", 2e6, 5e6], ["5M_plus", 5e6, 1e15]];
const tierOf = (p) => (TIERS.find(([, lo, hi]) => p >= lo && p < hi) || TIERS[3])[0];

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) || n === 0 ? null : n; };
function wMedian(pairs) { // pairs: [value, weight]
  if (!pairs.length) return null;
  const s = [...pairs].sort((a, b) => a[0] - b[0]);
  const tot = s.reduce((t, p) => t + p[1], 0); let acc = 0;
  for (const [v, w] of s) { acc += w; if (acc >= tot / 2) return v; }
  return s[s.length - 1][0];
}
function wQuantile(pairs, q) {
  if (!pairs.length) return null;
  const s = [...pairs].sort((a, b) => a[0] - b[0]);
  const tot = s.reduce((t, p) => t + p[1], 0); let acc = 0;
  for (const [v, w] of s) { acc += w; if (acc >= tot * q) return v; }
  return s[s.length - 1][0];
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ═══════════════════════════════════════════════════════════════════════════
// TIER CONTEXT — gate comp selection by the SUBJECT's price tier BEFORE the
// $/sqft step. A city comp pool is dominated by the cheapest (sub-$1M) sales;
// left ungated they drag every mid/luxury valuation down (the 1M–2M −32% bias).
//
// We (a) GUESS the subject's value size-adjusted from its own comps (robust — a
// large mid home's size-matched comps are the pricier ones, so this lands in the
// right tier without needing the anchor), (b) map to a tier, (c) expose a PRICE
// BAND centered on the tier MIDPOINT (never the subject's own stale sale, so a
// cold last-sale can't veto a well-supported higher comp set), and (d) a
// TIER-MEDIAN $/sqft so luxury anchors on luxury $/sqft, not the sub-luxury pool.
// ═══════════════════════════════════════════════════════════════════════════
const TIER_MID     = { under_1M: 550e3, "1M_2M": 1.45e6, "2M_5M": 3.2e6, "5M_plus": 7.5e6 };
const TIER_BAND_LO = 0.55, TIER_BAND_HI = 1.9;

// Median $/sqft of the pool, grouped by each comp's OWN price tier.
function tierMedianPsf(comps) {
  const by = {};
  for (const c of comps || []) {
    const p = num(c.price), s = num(c.sqft);
    if (!p || !s || s < 200) continue;
    const psf = p / s;
    if (psf < 20 || psf > 20000) continue;
    (by[tierOf(p)] ||= []).push(psf);
  }
  const out = {};
  for (const t in by) out[t] = median(by[t]);
  return out;
}

// Size-adjusted value guess from the comp pool (size-matched comps first, so a
// large home is judged against similarly-large — hence pricier — sales, not the
// cheap volume). Used only to pick the tier bucket, never as the headline.
function sizeAdjustedGuess(sf, comps) {
  if (!sf) return null;
  const u = (comps || []).map((c) => ({ price: num(c.price), sqft: num(c.sqft) }))
                         .filter((c) => c.price && c.sqft && c.sqft > 200);
  if (!u.length) return null;
  const sim = u.filter((c) => c.sqft >= sf * 0.6 && c.sqft <= sf * 1.4);
  const pool = sim.length >= 5 ? sim : u;
  return median(pool.map((c) => c.price * (sf / c.sqft)));
}

// Returns { tier, tierMidpoint, bandLo, bandHi, tierMedPsf, estimate } or null.
// bandHi is Infinity for 5M_plus (trophy comps have no natural ceiling).
function deriveTierContext(subject, comps, { anchorValue = null, listPrice = null } = {}) {
  const sf = num(subject && subject.sqft);
  const anchor = num(anchorValue), list = num(listPrice);
  const guess = sizeAdjustedGuess(sf, comps);
  // Task order: anchor ?? (sqft × tier-median $/sqft, via size-adjusted guess) ?? list.
  const est = anchor ?? guess ?? list ?? null;
  if (!est) return null;
  const tier = tierOf(est);
  const mid = TIER_MID[tier];
  const psfByTier = tierMedianPsf(comps);
  const tierMedPsf = psfByTier[tier]
    ?? (sf && guess ? guess / sf : null)
    ?? (() => { const all = (comps || []).map((c) => (num(c.price) && num(c.sqft) > 200) ? num(c.price) / num(c.sqft) : null).filter(Boolean); return all.length ? median(all) : null; })();
  // Floor basis. For MID/LUXURY it is MAX(tier midpoint, own guess) — the midpoint
  // guarantees an aggressive cheap-comp floor even if the guess under-shoots, and
  // the guess pulls it higher still for a big home. For UNDER_1M it is the guess
  // ALONE (no midpoint bump): the cheapest tier is already centered, and bumping
  // its floor to the midpoint drops the genuinely-comparable cheap sales a modest
  // home actually needs and over-values it. Continuous, low-side only downstream.
  const floorBasis = tier === "under_1M" ? (est || mid) : Math.max(mid, est || 0);
  return {
    tier, tierMidpoint: mid,
    bandLo: Math.round(TIER_BAND_LO * floorBasis),
    bandHi: tier === "5M_plus" ? Infinity : Math.round(TIER_BAND_HI * mid),
    tierMedPsf, estimate: est,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARMS-LENGTH / MARKET-SALE FILTER (shared)
//
// Non-arms-length transfers — trust deeds, quitclaims, probate, intra-family /
// nominal conveyances, tax/foreclosure re-recordings — are logged in the county
// feed as "sales" but do NOT represent market value. They pollute BOTH:
//   (a) backtest ground truth (a $1.3M home "sold" for $145K → huge false error), and
//   (b) comp sets (a nominal transfer used as a comp drags the prediction down).
//
// This is ONE conservative filter used everywhere. It drops only CLEAR
// non-market transfers and keeps genuine sales — even legitimately below-median
// ones. Every threshold is deliberately generous so real sales survive; the goal
// is to remove the junk that produces >1000% MAPE, not to trim the low tail.
//
// Signals (combined; any one CLEAR hit drops the row):
//   1. Explicit non-arms-length deed/sale/document type, when such a column
//      exists on the row (future-proof; no-op when absent).
//   2. Price below an absolute nominal floor (< $50K).
//   3. Price grossly below the tax-assessed value (< 0.40×). In CA (Prop-13)
//      assessed value lags market and resets to purchase price on a real sale,
//      so an arm's-length resale is at/above assessed; price far BELOW assessed
//      is the nominal / intra-family transfer signature.
//   4. Price grossly below cohort market rate (< 0.40× cohort median $/sqft ×
//      subject sqft), computed over the same batch (≥3 usable rows per cohort).
//   5. Same-property same-week re-recordings/dupes — keep the max-price record
//      in each ≤7-day cluster, drop the rest.
// ═══════════════════════════════════════════════════════════════════════════
const AL_NON_ARMS_TYPE_RE = /quit\s*claim|quitclaim|deed of trust|trust transfer|inter.?vivos|probate|estate|foreclos|sheriff|trustee'?s? (deed|sale)|tax (deed|sale)|nominal|gift deed|intra.?family|affidavit|correction deed|non.?arm/i;
const AL_ABS_MIN_PRICE = 50000;      // below this a "sale" is a nominal transfer
const AL_ASSESSED_FRACTION = 0.40;   // price < 0.40× tax-assessed → nominal/intra-family
const AL_COHORT_PSF_FRACTION = 0.40; // price < 0.40× cohort $/sqft rate → non-market
const AL_DUP_WINDOW_MS = 7 * 864e5;  // same-property re-recording window (7 days)

const _alNum = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) || n === 0 ? null : n; };
const _alAddrKey = (a) => String(a || "").toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

// Pull normalized fields out of a heterogeneous sale record (comps use `price`/
// `saleDate`; raw `properties` rows use `last_sale_price`/`last_sale_date`).
function _alFields(r) {
  return {
    price:    _alNum(r.price ?? r.last_sale_price ?? r.salePrice ?? r.rawPrice),
    sqft:     _alNum(r.sqft),
    assessed: _alNum(r.assessedValue ?? r.assessed_value ?? r.tax_assessed_value ?? r.assessed),
    date:     r.saleDate ?? r.last_sale_date ?? r.date ?? null,
    address:  r.address ?? null,
    typeStr:  [r.deedType, r.deed_type, r.saleType, r.sale_type, r.documentType, r.document_type, r.listing_source]
                .filter(Boolean).join(" "),
  };
}

// Judge ONE sale record. ctx.cohortMedianPsf optional. Returns { ok, reason }.
// Unknown-price rows are KEPT (we can't judge them — never invent a drop).
function armsLengthVerdict(rec, ctx = {}) {
  const f = rec.__alFields || _alFields(rec);
  if (f.price == null) return { ok: true, reason: "no_price" };
  if (f.typeStr && AL_NON_ARMS_TYPE_RE.test(f.typeStr)) return { ok: false, reason: "non_arms_type" };
  if (f.price < AL_ABS_MIN_PRICE) return { ok: false, reason: "below_floor" };
  if (f.assessed && f.price < AL_ASSESSED_FRACTION * f.assessed) return { ok: false, reason: "below_assessed" };
  if (f.sqft && ctx.cohortMedianPsf && f.price < AL_COHORT_PSF_FRACTION * ctx.cohortMedianPsf * f.sqft) {
    return { ok: false, reason: "below_cohort_psf" };
  }
  return { ok: true, reason: "ok" };
}

// Batch filter. Computes per-cohort median $/sqft over the SAME set, dedupes
// same-property same-week re-recordings, then applies armsLengthVerdict.
// opts.cohortKey(rec) → grouping key for the $/sqft rate (default: lowercased city).
// Returns { kept, dropped, stats } where stats.reasons tallies each drop cause.
function filterArmsLength(records, opts = {}) {
  const rows = Array.isArray(records) ? records : [];
  const cohortKey = opts.cohortKey || ((r) => String(r.city || "").toLowerCase().trim());

  // Pre-compute normalized fields once; cache on the record for reuse downstream.
  const fields = rows.map((r) => { const f = _alFields(r); r.__alFields = f; return f; });

  // 1) Cohort median $/sqft over the same batch (≥3 sane rows per cohort).
  const psfAcc = new Map();
  rows.forEach((r, i) => {
    const f = fields[i];
    if (!f.price || !f.sqft || f.sqft < 200) return;
    const psf = f.price / f.sqft;
    if (psf < 20 || psf > 20000) return; // obvious junk excluded from the rate itself
    const k = cohortKey(r);
    (psfAcc.get(k) || psfAcc.set(k, []).get(k)).push(psf);
  });
  const psfByCohort = new Map();
  for (const [k, arr] of psfAcc) if (arr.length >= 3) psfByCohort.set(k, median(arr));

  // 2) Same-property same-week dedupe → indices to drop (keep max-price/cluster).
  const dupDrop = new Set();
  const byAddr = new Map();
  rows.forEach((r, i) => {
    const ak = _alAddrKey(fields[i].address);
    if (!ak) return;
    (byAddr.get(ak) || byAddr.set(ak, []).get(ak)).push(i);
  });
  for (const idxs of byAddr.values()) {
    if (idxs.length < 2) continue;
    const dated = idxs.map((i) => ({ i, t: Date.parse(fields[i].date || ""), p: fields[i].price || 0 }))
                      .filter((x) => !isNaN(x.t))
                      .sort((a, b) => a.t - b.t);
    for (let a = 0; a < dated.length; a++) {
      if (dupDrop.has(dated[a].i)) continue;
      let best = dated[a];
      for (let b = a + 1; b < dated.length && dated[b].t - dated[a].t <= AL_DUP_WINDOW_MS; b++) {
        if (dupDrop.has(dated[b].i)) continue;
        const loser = dated[b].p > best.p ? best : dated[b];
        best = dated[b].p > best.p ? dated[b] : best;
        dupDrop.add(loser.i);
      }
    }
  }

  // 3) Verdict pass.
  const kept = [], dropped = [];
  const stats = { total: rows.length, kept: 0, dropped: 0, reasons: {} };
  const bump = (why) => { stats.reasons[why] = (stats.reasons[why] || 0) + 1; };
  rows.forEach((r, i) => {
    if (dupDrop.has(i)) { dropped.push(r); stats.dropped++; bump("dup_rerecord"); return; }
    const v = armsLengthVerdict(r, { cohortMedianPsf: psfByCohort.get(cohortKey(r)) || null });
    if (v.ok) { kept.push(r); stats.kept++; }
    else { dropped.push(r); stats.dropped++; bump(v.reason); }
  });
  return { kept, dropped, stats };
}

/**
 * compFairValue — independent comp-based value (Model A).
 * subject/comps fields: { price?, sqft, lotSqft, beds, baths, yearBuilt, pool, saleDate }
 *
 * VALUES OFF A SMALL SET OF GENUINELY-COMPARABLE SOLDS — never a whole city.
 * A hard comparability gate (sqft ±25%, beds ±1, recent) precedes the kNN, and a
 * tight $/sqft band (0.7×–1.4× of the comparable-set median) drops dissimilar
 * homes. When the subject's own recent arm's-length sale is known (anchorValue,
 * HPI-appreciated by the caller), we pull the estimate toward it — so a broad or
 * pricier comp pool can never blow the number up far above what this exact home
 * last traded for.
 */
function compFairValue(subject, comps, { k = 8, nowYear = 2026, anchorValue = null, tierCtx = null } = {}) {
  const sf = num(subject.sqft); if (!sf) return null;
  const sBeds = num(subject.beds);
  const anchor = num(anchorValue);
  const anchorPsf = anchor && sf ? anchor / sf : null;
  let usable = comps.map(c => ({ ...c, price: num(c.price), sqft: num(c.sqft), lotSqft: num(c.lotSqft), beds: num(c.beds) }))
                    .filter(c => c.price && c.sqft && c.sqft > 400);
  if (usable.length < 3) return null;

  // (0) TIER PRE-BAND — the single biggest fix for the mid/luxury under-valuation.
  // A city comp pool is dominated by the cheapest (sub-$1M) sales; ungated they
  // drag every mid/luxury valuation down. We drop comps priced BELOW the subject
  // tier's FLOOR (0.55× the tier midpoint) — LOW-SIDE ONLY, deliberately. Dropping
  // cheap cross-tier comps can only lift or leave the estimate, never cap it; a
  // high-side drop is NOT applied because when the comp-derived tier guess under-
  // shoots (a genuine 1M–2M home read as sub-$1M) a high ceiling would hard-drop
  // the very comps it needs and DEEPEN the under-valuation. High outliers are
  // instead handled downstream by the $/sqft filter and the ±e.mid price refine.
  // Skipped when it would starve the estimate (<3 survive) so a sparse luxury pool
  // never voids the report (geography/time widening upstream supplies real in-tier
  // luxury comps first). When the guess under-shoots, the floor is low and simply
  // no-ops — so a mis-detected tier can never make a valuation WORSE than baseline.
  const ctx = tierCtx || deriveTierContext(subject, usable, { anchorValue: anchor, listPrice: num(subject.listPrice) });
  if (ctx && ctx.bandLo) {
    const banded = usable.filter(c => c.price >= ctx.bandLo);
    if (banded.length >= 3) usable = banded;
  }

  // (1) Comparability gate — only similar homes. Widen gracefully so we never
  // starve the estimate, but NEVER default to the whole-city pool when similar
  // comps exist. sqft within band AND beds within ±1 (when both known).
  const withinSqft = (band) => usable.filter(c =>
    c.sqft >= sf * (1 - band) && c.sqft <= sf * (1 + band) &&
    (!sBeds || !c.beds || Math.abs(c.beds - sBeds) <= 1));
  let cand = withinSqft(0.25);
  if (cand.length < 6) cand = withinSqft(0.40);
  if (cand.length < 4) cand = withinSqft(0.60);
  if (cand.length < 3) cand = usable;                       // last resort — keep the report alive

  // (2) Recency preference — a genuine recent sale beats a stale one. If enough
  // comps sold within ~30 months, value off THOSE; otherwise keep the full set
  // (the kNN recency weight still down-weights older sales).
  const recent = cand.filter(c => {
    if (!c.saleDate) return false;
    const t = Date.parse(c.saleDate); if (isNaN(t)) return false;
    return (Date.now() - t) / (365.25 * 864e5) <= 2.5;
  });
  if (recent.length >= 6) cand = recent;

  // (3) $/sqft dissimilar filter. Centre on the SUBJECT's own $/sqft when known
  // (anchorPsf), else the MAX of the tier-median $/sqft and the candidate median —
  // so luxury anchors on luxury $/sqft (tier-median lifts the center, keeping the
  // high comps) while a mis-detected-LOW tier can never pull the center BELOW the
  // pool and drop the comps a mid home needs (that deepened the under-valuation).
  // At $5M+ the high bound opens to 2.5× so real trophy comps (whose $/sqft
  // legitimately runs well above the pool) survive the outlier filter.
  // The tier-median lift applies to MID/LUXURY tiers only — an under_1M subject
  // stays on its candidate median (lifting it there merely over-values the cheapest,
  // already-centered tier). Never lets a mis-detected-low tier pull the center
  // BELOW the pool (that dropped the high comps a mid home needs).
  const candPsfMed = median(cand.map(c => c.price / c.sqft));
  const tierPsfLift = ctx && ctx.tier && ctx.tier !== "under_1M" ? (ctx.tierMedPsf || 0) : 0;
  const psfCenter = anchorPsf || Math.max(tierPsfLift, candPsfMed || 0) || candPsfMed;
  const psfHiMul = ctx && ctx.tier === "5M_plus" ? 2.5 : 1.5;
  let tight = cand.filter(c => { const p = c.price / c.sqft; return p >= 0.65 * psfCenter && p <= psfHiMul * psfCenter; });
  if (tight.length < 3) tight = cand;
  cand = tight;

  const subjAge = subject.yearBuilt ? Math.max(1, nowYear - num(subject.yearBuilt)) : null;
  const dist = (c) => {
    let d = Math.abs(Math.log(c.sqft) - Math.log(sf));
    if (c.lotSqft && subject.lotSqft) d += 0.6 * Math.abs(Math.log(Math.max(c.lotSqft, 1)) - Math.log(Math.max(num(subject.lotSqft), 1)));
    if (c.beds && subject.beds) d += 0.25 * Math.abs(num(c.beds) - num(subject.beds));
    if (c.baths && subject.baths) d += 0.20 * Math.abs(num(c.baths) - num(subject.baths));
    const cAge = c.yearBuilt ? Math.max(1, nowYear - num(c.yearBuilt)) : null;
    if (cAge && subjAge) d += 0.15 * Math.abs(Math.log(cAge) - Math.log(subjAge));
    if ((c.pool ? 1 : 0) !== (subject.pool ? 1 : 0)) d += 0.4;
    return d;
  };
  // Core kNN estimate over a candidate set.
  const estimate = (pool) => {
    const near = pool.map(c => ({ c, d: dist(c) })).sort((a, b) => a.d - b.d).slice(0, k);
    if (!near.length) return null;
    const pairs = near.map(({ c, d }) => {
      // Size-adjust the comp price by sqft (+ lot) ratio. GUARD corrupted data:
      // a comp (or subject) with a broken lot_sqft — e.g. acres stored where sqft
      // is expected — otherwise yields a 1000×+ multiplier and a billion-dollar
      // "valuation". A comp whose lot differs by >4× isn't size-comparable, and no
      // real home size-adjusts beyond ~3×, so both are clamped. This can never
      // widen a good estimate; it only removes pathological runaways.
      const sqftRatio = sf / c.sqft;
      let lotRatio = (c.lotSqft && subject.lotSqft) ? (num(subject.lotSqft) / c.lotSqft) : sqftRatio;
      lotRatio = Math.max(0.25, Math.min(4, lotRatio));
      let scale = 0.6 * sqftRatio + 0.4 * lotRatio;
      scale = Math.max(0.33, Math.min(3, scale));
      let w = 1 / (d + 0.05);
      if (c.saleDate) { const yrs = Math.max(0, (Date.parse(`${nowYear}-06-30`) - Date.parse(c.saleDate)) / (365.25 * 864e5)); w *= Math.exp(-yrs / 3); }
      return [c.price * scale, w];
    });
    return { mid: wMedian(pairs), q25: wQuantile(pairs, 0.25), q75: wQuantile(pairs, 0.75), n: near.length };
  };

  // Pass 1: broad estimate. Pass 2 (tier-lock): re-select comps whose SALE PRICE
  // sits in the subject's own price band, so a modest home is never valued against
  // luxury estates (and vice-versa). This kills cross-tier $/sqft contamination.
  let e = estimate(cand);
  if (!e || !e.mid) return null;
  const banded = cand.filter(c => c.price >= 0.6 * e.mid && c.price <= 1.6 * e.mid);
  if (banded.length >= 4) { const e2 = estimate(banded); if (e2 && e2.mid) e = e2; }

  let mid = e.mid;

  // (2) SALE ANCHOR — the subject's own recent arm's-length sale (HPI-appreciated
  // by the caller). It BOUNDS the estimate: when the comp pool runs hot above (or
  // cold below) what this exact home last traded for, pull back toward the sale
  // and lower confidence rather than printing a runaway number. Symmetric.
  let anchorPull = 0;
  if (anchor) {
    const dev = (mid - anchor) / anchor;
    // ASYMMETRIC: the DOWNWARD pull (comps ABOVE a stale-low last sale, dev>0) is
    // HALVED versus the upward pull. A single old sale must not veto a well-
    // supported higher comp set — that stale anchor was the mid/luxury under-value
    // driver. The upward pull (comps far BELOW the sale, dev<0) stays strong: a
    // genuine recent sale still rescues a cold/under-supplied comp set.
    if      (dev >  0.35) anchorPull = 0.36;      // comps hot above the sale — pull GENTLY back
    else if (dev >  0.20) anchorPull = 0.30;
    else if (dev >  0.10) anchorPull = 0.21;
    else if (dev >  0.05) anchorPull = 0.12;
    else if (dev < -0.20) anchorPull = 0.50;      // comps far below the sale — pull UP toward it
    else if (dev < -0.10) anchorPull = 0.30;
    if (anchorPull > 0) mid = Math.round(anchorPull * anchor + (1 - anchorPull) * mid);
  }

  // (3) BAND — symmetric, dispersion-driven, clamped to ±15%. Keyed off the
  // relative interquartile spread of the comps (tighter when many comps agree,
  // wider when few/scattered) so a single high outlier in the top quartile can no
  // longer blow out the high. Guarantees low < mid < high, spread ≈ ±5–15%.
  const relIqr = e.mid > 0 ? Math.max(0, e.q75 - e.q25) / e.mid : 0.30;
  let bandK = 0.5 * relIqr;
  if (e.n >= 8) bandK *= 0.85; else if (e.n < 5) bandK *= 1.2;
  if (anchorPull >= 0.4) bandK = Math.max(bandK, 0.10);       // wider when we leaned on the anchor
  bandK = Math.max(0.05, Math.min(0.15, bandK));
  const low  = Math.round(mid * (1 - bandK));
  const high = Math.round(mid * (1 + bandK));

  const conf = Math.max(0.3, Math.min(0.95,
    0.55 + 0.035 * Math.min(e.n, 10) - 2 * bandK - (anchorPull >= 0.4 ? 0.10 : 0)));
  return { fairValue: Math.round(mid), fairValueLow: low, fairValueHigh: high, compCount: e.n, confidence: +conf.toFixed(2) };
}

/**
 * computeValuation — full engine. Returns fair value, expected sale (if list
 * price), the ensemble, and the buyer-defense verdict.
 */
function computeValuation(subject, comps, opts = {}) {
  // Pass the subject's HPI-appreciated last sale (if any) as the anchor.
  const anchorValue = opts.anchorValue ?? num(subject.anchorValue) ?? null;
  const listPrice = num(subject.listPrice);
  // Derive the subject tier from its INPUTS (anchor/comps/list) so it can PRE-BAND
  // the comp pool — tier is no longer merely read off the output. Passed into
  // compFairValue so the same context gates comp selection and the $/sqft center.
  const tierCtx = opts.tierCtx || deriveTierContext(subject, comps, { anchorValue, listPrice });
  const A = compFairValue(subject, comps, { ...opts, anchorValue, tierCtx });
  let expectedSale = null, tier = null;
  if (A) tier = tierOf(A.fairValue);
  if (listPrice) {
    const t = tier || tierOf(listPrice);
    expectedSale = Math.round(listPrice * (TIER_SP_LP[t] ?? 0.97));
  }
  const fair = A ? A.fairValue : null;
  let ensemble = fair;
  if (fair && expectedSale) ensemble = Math.round(0.45 * fair + 0.55 * expectedSale);
  else if (expectedSale) ensemble = expectedSale;

  let overpricedPct = null, verdict = null;
  if (listPrice && fair) {
    overpricedPct = +(((listPrice - fair) / fair) * 100).toFixed(1);
    verdict = overpricedPct > 6 ? `overpriced by ${overpricedPct}%`
            : overpricedPct < -6 ? `priced ${Math.abs(overpricedPct)}% below fair value`
            : "fairly priced";
  }
  return {
    fairValue: fair, fairValueLow: A?.fairValueLow ?? null, fairValueHigh: A?.fairValueHigh ?? null,
    expectedSale, ensemble, tier, confidence: A?.confidence ?? null, compCount: A?.compCount ?? 0,
    overpricedPct, verdict,
    method: "propertydna_comp_engine_v1 (MLS-solds, RentCast-free)",
  };
}

module.exports = { computeValuation, compFairValue, deriveTierContext, TIER_SP_LP, tierOf, filterArmsLength, armsLengthVerdict };

/**
 * _valuation-engine.js — PropertyDNA's RentCast-free valuation core.
 *
 * Two models, both validated leave-one-out on 1,459 real MLS solds (MdAPE):
 *   A) FAIR VALUE (independent): feature-rich weighted-kNN comp model. Judges
 *      what a home is worth from comparable sales alone — NO list price. This is
 *      the number that exposes an over-listed home. (overall ~12%, luxury ~22%)
 *   B) EXPECTED SALE (list-anchored): list_price x market sale/list ratio for the
 *      tier. When a listing exists (the buyer's real situation) this predicts the
 *      sale price to <=3% MdAPE across EVERY price tier — the 97% line.
 *
 * The product power is the GAP between them: expected-sale tells the buyer what
 * they'll likely pay; fair-value tells them what it's actually worth; the spread
 * is the overpricing/negotiation signal that defends the human from a predatory
 * list price. All deterministic, all from owned data (MLS solds + assessor).
 *
 * Market sale/list ratios by tier (median, from the 1,459-sold CMA corpus):
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
function compFairValue(subject, comps, { k = 8, nowYear = 2026, anchorValue = null } = {}) {
  const sf = num(subject.sqft); if (!sf) return null;
  const sBeds = num(subject.beds);
  const anchor = num(anchorValue);
  const anchorPsf = anchor && sf ? anchor / sf : null;
  let usable = comps.map(c => ({ ...c, price: num(c.price), sqft: num(c.sqft), lotSqft: num(c.lotSqft), beds: num(c.beds) }))
                    .filter(c => c.price && c.sqft && c.sqft > 400);
  if (usable.length < 3) return null;

  // (0) TIER LOCK to the subject's OWN market. A city comp pool mixes modest homes
  // with luxury estates of similar size; naively centering on the pool's median
  // $/sqft would KEEP the luxury cluster and drop the genuinely-comparable homes.
  // So when we know what THIS home is worth (its own recent sale → anchor), drop
  // comps priced — or $/sqft'd — far outside the subject's own band FIRST. This is
  // the single biggest guard against over-valuing a modest home off pricey comps.
  if (anchor) {
    const inTier = usable.filter(c => {
      if (c.price < 0.5 * anchor || c.price > 1.8 * anchor) return false;
      if (anchorPsf) { const p = c.price / c.sqft; if (p < 0.6 * anchorPsf || p > 1.6 * anchorPsf) return false; }
      return true;
    });
    if (inTier.length >= 3) usable = inTier;
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
  // (anchorPsf) — not the pool median, which a luxury cluster would drag up and
  // thereby retain the wrong homes. Falls back to the pool median only when we
  // have no anchor. Kills cross-segment contamination the whole-city pool adds.
  const psfCenter = anchorPsf || median(cand.map(c => c.price / c.sqft));
  let tight = cand.filter(c => { const p = c.price / c.sqft; return p >= 0.65 * psfCenter && p <= 1.5 * psfCenter; });
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
      const scale = 0.6 * (sf / c.sqft) + 0.4 * ((c.lotSqft && subject.lotSqft) ? (num(subject.lotSqft) / c.lotSqft) : (sf / c.sqft));
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
    if      (dev >  0.35) anchorPull = 0.72;      // comps WAY hot — the sale dominates
    else if (dev >  0.20) anchorPull = 0.60;
    else if (dev >  0.10) anchorPull = 0.42;
    else if (dev >  0.05) anchorPull = 0.25;
    else if (dev < -0.20) anchorPull = 0.50;      // comps far cold — also pull toward the sale
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
  const A = compFairValue(subject, comps, { ...opts, anchorValue });
  const listPrice = num(subject.listPrice);
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

module.exports = { computeValuation, compFairValue, TIER_SP_LP, tierOf, filterArmsLength, armsLengthVerdict };

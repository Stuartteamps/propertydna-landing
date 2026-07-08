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
  const usable = comps.map(c => ({ ...c, price: num(c.price), sqft: num(c.sqft), lotSqft: num(c.lotSqft), beds: num(c.beds) }))
                      .filter(c => c.price && c.sqft && c.sqft > 400);
  if (usable.length < 3) return null;

  // (0) Comparability gate — only similar homes. Widen gracefully so we never
  // starve the estimate, but NEVER default to the whole-city pool when similar
  // comps exist. sqft within band AND beds within ±1 (when both known).
  const withinSqft = (band) => usable.filter(c =>
    c.sqft >= sf * (1 - band) && c.sqft <= sf * (1 + band) &&
    (!sBeds || !c.beds || Math.abs(c.beds - sBeds) <= 1));
  let cand = withinSqft(0.25);
  if (cand.length < 6) cand = withinSqft(0.40);
  if (cand.length < 4) cand = withinSqft(0.60);
  if (cand.length < 3) cand = usable;                       // last resort — keep the report alive

  // (0b) Recency preference — a genuine recent sale beats a stale one. If enough
  // comps sold within ~30 months, value off THOSE; otherwise keep the full set
  // (the kNN recency weight still down-weights older sales).
  const recent = cand.filter(c => {
    if (!c.saleDate) return false;
    const t = Date.parse(c.saleDate); if (isNaN(t)) return false;
    return (Date.now() - t) / (365.25 * 864e5) <= 2.5;
  });
  if (recent.length >= 6) cand = recent;

  // (1) Non-arms-length / dissimilar filter: TIGHT $/sqft band around the
  // comparable-set median (0.7×–1.4×). Kills the cross-segment contamination a
  // whole-city pool introduces (was 0.4×–2.5×, far too loose).
  const med = median(cand.map(c => c.price / c.sqft));
  let tight = cand.filter(c => { const p = c.price / c.sqft; return p >= 0.7 * med && p <= 1.4 * med; });
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
  const anchor = num(anchorValue);
  if (anchor) {
    const dev = (mid - anchor) / anchor;
    if      (dev >  0.20) anchorPull = 0.55;      // comps far hot — lean hard on the sale
    else if (dev >  0.10) anchorPull = 0.40;
    else if (dev >  0.05) anchorPull = 0.25;
    else if (dev < -0.20) anchorPull = 0.45;      // comps far cold — also pull toward the sale
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

module.exports = { computeValuation, compFairValue, TIER_SP_LP, tierOf };

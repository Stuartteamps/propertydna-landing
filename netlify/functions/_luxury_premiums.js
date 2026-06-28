/**
 * _luxury_premiums.js — weighted luxury premium scoring for CV trophy homes.
 *
 * Pure JS, no DB, no side effects. Consumes signals the pipeline ALREADY has
 * (autodetected features, _cv_luxury_index community tier, permit value-adj,
 * elevation_m, location_scores row, comp count) and produces:
 *   - nine 0-100 premium scores
 *   - a single capped luxury premium %
 *   - the five output fields used by the report.
 *
 * Integrates as Phase 1.5 inside computeDnaAdjustment (see save-report.js).
 */

const VALLEY_FLOOR_M = 140;        // ~460 ft — Coachella Valley floor baseline
const HILLSIDE_TROPHY_M = 230;     // ~755 ft — Southridge-class pad elevation

// Per-field max premium contribution (%). See docs/rebuild-plan/05-luxury-premiums.md §2
const FIELD_MAX_PCT = {
  view_score:                    18,
  elevation_score:               12,
  architecture_score:            20,
  scarcity_score:                16,
  privacy_score:                 12,
  terrain_score:                  8,
  renovation_quality_score:      14,
  historical_significance_score: 18,
  emotional_buyer_premium:       10,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const score100 = (n) => clamp(Math.round(n), 0, 100);

/**
 * deriveLuxuryScores — build the nine 0-100 scores from available signals.
 *
 * @param {object} ctx
 *   features            {object}  merged DNA feature flags (post profile filter)
 *   communityPremium    {object?} lookupCommunity() result { tier, pct_mid, ... }
 *   permitAdj           {object?} permitValueAdjustment() { estimatedValuePct, fullyRemodeled, recentAddition }
 *   elevationM          {number?} usgs/google elevation in metres
 *   locationScores      {object?} location_scores row { view_score, gated_score, road_noise_score, luxury_neighborhood_score, micro_location_premium_pct }
 *   lotSqft             {number?}
 *   compCount           {number?} qualifying comp count near subject (low => scarce)
 *   listingText         {string}  lowercased remarks (for terrain/boulder cues)
 */
function deriveLuxuryScores(ctx = {}) {
  const {
    features = {}, communityPremium = null, permitAdj = null,
    elevationM = null, locationScores = null, lotSqft = null,
    compCount = null, listingText = "",
  } = ctx;

  const tier = communityPremium?.tier || null;       // 'S' | 'A' | 'B' | null
  const tierRank = { S: 3, A: 2, B: 1 }[tier] || 0;
  const f = (k) => !!features[k];

  // ── view_score ────────────────────────────────────────────────────────────
  let view = 0;
  if (locationScores?.view_score != null) view = Number(locationScores.view_score);
  else {
    if (f("panoramic_mountain_views")) view = 88;
    else if (f("mountain_view"))       view = 60;
    // elevation lifts view when nothing else says so (hillside = sightlines)
    if (elevationM != null) view = Math.max(view, clamp((elevationM - VALLEY_FLOOR_M) / 1.2, 0, 80));
  }

  // ── elevation_score ───────────────────────────────────────────────────────
  // 0 at valley floor, ~100 at/above hillside-trophy pad elevation.
  let elevation = 0;
  if (elevationM != null) {
    elevation = (elevationM - VALLEY_FLOOR_M) / (HILLSIDE_TROPHY_M - VALLEY_FLOOR_M) * 100;
  }

  // ── architecture_score ────────────────────────────────────────────────────
  let architecture = 0;
  if (f("historic_architect"))            architecture += 70;
  if (f("mcm_authentic"))                 architecture += 25;
  if (f("architectural_digest_featured")) architecture += 25;

  // ── scarcity_score ────────────────────────────────────────────────────────
  // Tier prestige + oversized lot + thin comp set all signal scarcity.
  let scarcity = tierRank * 22;                       // S=66, A=44, B=22
  if (f("oversized_lot")) scarcity += 18;
  if (compCount != null) scarcity += clamp((4 - compCount) * 8, 0, 24); // <4 comps => scarce
  if (lotSqft && lotSqft >= 20000) scarcity += 10;

  // ── privacy_score ─────────────────────────────────────────────────────────
  let privacy = 0;
  if (f("gated_24hr_guard"))    privacy += 45;
  else if (f("gated_community")) privacy += 20;
  if (elevationM != null && elevationM > VALLEY_FLOOR_M + 40) privacy += 25; // hillside set-back
  if (lotSqft && lotSqft >= 20000) privacy += 20;
  if (locationScores?.road_noise_score != null) {
    // road_noise_score: higher = noisier => less privacy. Invert lightly.
    privacy += clamp((100 - Number(locationScores.road_noise_score)) * 0.15, 0, 15);
  }

  // ── terrain_score ─────────────────────────────────────────────────────────
  let terrain = 0;
  if (elevationM != null) terrain += clamp((elevationM - VALLEY_FLOOR_M) / 2, 0, 55);
  if (lotSqft && lotSqft >= 20000) terrain += 20;
  if (/\b(boulder|outcrop|hillside|cliff|promontory|rock formation|elevated\s+(lot|pad))\b/.test(listingText)) terrain += 35;

  // ── renovation_quality_score ──────────────────────────────────────────────
  let reno = 0;
  if (permitAdj?.estimatedValuePct) reno += clamp(permitAdj.estimatedValuePct * 5, 0, 70); // 15% cap → 70
  if (f("fully_remodeled")) reno += 40;
  else if (f("updated"))    reno += 15;
  if (permitAdj?.recentAddition) reno += 10;
  if (f("original_condition")) reno = Math.max(0, reno - 50);

  // ── historical_significance_score ─────────────────────────────────────────
  let historical = 0;
  if (f("celebrity_pedigree")) historical += 55;
  if (f("historic_enclave"))   historical += 30;
  if (tier === "S")            historical += 35;
  else if (tier === "A")       historical += 18;
  if (f("architectural_digest_featured")) historical += 15;

  const scores = {
    view_score:                    score100(view),
    elevation_score:               score100(elevation),
    architecture_score:            score100(architecture),
    scarcity_score:                score100(scarcity),
    privacy_score:                 score100(privacy),
    terrain_score:                 score100(terrain),
    renovation_quality_score:      score100(reno),
    historical_significance_score: score100(historical),
  };

  // ── emotional_buyer_premium (synergy) ─────────────────────────────────────
  // Trophy irreplaceability: rises sharply when MULTIPLE pillars are strong.
  const strongCount = Object.values(scores).filter(s => s >= 70).length;
  scores.emotional_buyer_premium = score100(
    strongCount >= 4 ? 90 : strongCount === 3 ? 65 : strongCount === 2 ? 35 : 0
  );

  return scores;
}

/**
 * isLuxuryMode — §3 trigger.
 */
function isLuxuryMode({ smartMid, communityPremium, scores }) {
  if (smartMid && smartMid > 2_000_000) return true;
  if (communityPremium && (communityPremium.tier === "S" || communityPremium.tier === "A")) return true;
  if (scores) {
    for (const k of ["view_score", "architecture_score", "privacy_score", "scarcity_score"]) {
      if ((scores[k] || 0) >= 70) return true;
    }
  }
  return false;
}

/**
 * computeLuxuryPremium — weighted, capped premium % from the nine scores.
 *
 * @returns { premiumPct, rawPremiumPct, contributions[], scores, capped }
 *   premiumPct  : the luxury premium % to apply ON TOP of the smart base,
 *                 AFTER comp reconciliation, hard-capped to fit within the
 *                 profile cap (default 60 for $3M+ SFR).
 */
function computeLuxuryPremium(scores, { profileCap = 60, alreadyLiftedPct = 0 } = {}) {
  const contributions = [];
  let raw = 0;
  for (const [field, maxPct] of Object.entries(FIELD_MAX_PCT)) {
    const s = scores[field] || 0;
    const pct = (s / 100) * maxPct;
    if (pct > 0.1) contributions.push({ field, score: s, pct: Math.round(pct * 10) / 10 });
    raw += pct;
  }
  contributions.sort((a, b) => b.pct - a.pct);

  // The premium must coexist with whatever the comp anchor already lifted and
  // the other DNA features already stacked. We let the luxury premium consume
  // the REMAINING headroom under the profile cap, with a 25% floor for true
  // trophies (raw >= 30) so a Southridge home clears the $3.5M->~$5M target.
  const headroom = Math.max(0, profileCap - alreadyLiftedPct);
  let premiumPct = Math.min(raw, headroom);
  let capped = premiumPct < raw;

  // Trophy floor: if the raw signal is overwhelmingly strong (>=30% pre-cap)
  // and headroom allows, guarantee at least a 25% premium.
  if (raw >= 30 && headroom >= 25) { premiumPct = Math.max(premiumPct, 25); }

  return {
    premiumPct: Math.round(premiumPct * 10) / 10,
    rawPremiumPct: Math.round(raw * 10) / 10,
    contributions: contributions.slice(0, 6),
    scores,
    capped,
  };
}

/**
 * buildLuxuryNarrative — human-readable explanation for the report.
 */
function buildLuxuryNarrative(scores, premium, { standardAvm, luxuryValue, gapPct, communityPremium }) {
  if (!premium || premium.premiumPct <= 0) return null;
  const top = premium.contributions.slice(0, 3)
    .map(c => `${c.field.replace(/_score|_premium/g, "").replace(/_/g, " ")} (+${c.pct}%)`)
    .join(", ");
  const enclave = communityPremium ? ` in ${communityPremium.label}` : "";
  const fmt = (n) => "$" + (n / 1e6).toFixed(2) + "M";
  return (
    `Standard automated models value this property${enclave} at ${fmt(standardAvm)}, but that figure ` +
    `relies on a thin set of comparable sales that cannot price the attributes driving this market. ` +
    `PropertyDNA's luxury layer scores the strongest premium drivers — ${top} — and reconciles them ` +
    `against true comparable trophy sales. The result is an adjusted value of ${fmt(luxuryValue)}, ` +
    `a ${gapPct >= 0 ? "+" : ""}${gapPct}% gap versus the standard estimate` +
    `${gapPct >= 15 ? ", indicating the property is materially undervalued by conventional models." : "."}`
  );
}

module.exports = {
  deriveLuxuryScores,
  isLuxuryMode,
  computeLuxuryPremium,
  buildLuxuryNarrative,
  FIELD_MAX_PCT,
};

/**
 * _community_comps.js — community-first comparable selection for CV luxury.
 *
 * Replaces radius-first comp ranking with the hierarchy:
 *   (1) same community/subdivision/HOA  (2) same luxury tier  (3) same type
 *   (4) view/elevation/privacy tier     (5) lot/terrain       (6) sale recency
 *   (7) distance — FINAL tiebreak only.
 *
 * Implemented as a strict lexicographic comparator so a closer comp can NEVER
 * outrank a same-community comp. Pure JS; no DB, no network, no side effects
 * (mirrors _valuation_profile.js style). The caller (save-report.js) decides the
 * blend; this module only RANKS and ANNOTATES — it never filters.
 *
 * THE MISSING-COMMUNITY-ON-COMPS GAP: RentCast comps carry no subdivision. We
 * always know the SUBJECT's community (owner-entered subdivision → lookupCommunity).
 * For each COMP we infer community best-effort from its street via
 * lookupCommunityByAddress (verified anchorStreets only); when that returns null
 * we fall back to a tier-proximity proxy (very-close comp in the subject's tier).
 * When no community signal exists at all, every affinity rung collapses to 0 and
 * the comparator degrades to pure distance ordering — i.e. the OLD behavior — so
 * non-CV / unknown-subdivision reports are never harmed and never lose comps.
 */
const { lookupCommunityByAddress } = require("./_cv_luxury_index");
const { classifyPropertyType }     = require("./_valuation_profile");

const TIER_RANK = { S: 3, A: 2, B: 1 };

function num(v) {
  if (v == null) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

// Space/punctuation-insensitive community key so "Southridge" and "South Ridge"
// (and "southridge dr") resolve to the same enclave identity across the
// subject-side lookupCommunity match and the comp-side street-anchor match.
function commKey(matched) {
  return String(matched || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Annotate a comp with its affinity to the subject. Higher rung values = better.
 * Null-safe throughout: any missing field simply yields 0 for that rung.
 * @param subject          { propertyType, lotSize, sqft, city }
 * @param subjectCommunity result of lookupCommunity() for the subject (or null)
 * @param comp             normalized comp ({ address, city, distance, lotSize, saleDate, propertyType, sqft })
 */
function affinityFor(subject, subjectCommunity, comp, tierBand = null) {
  const a = { sameCommunity: 0, sameTier: 0, priceBand: 0, sameType: 0, viewTier: 0, lotBand: 0, recency: 0, dist: Infinity, reasons: [] };
  subject = subject || {};
  comp = comp || {};

  // (0) TIER PRICE BAND — when the caller supplies the subject tier's price band,
  // rank comps whose sale price sits INSIDE it above out-of-band ones. This lifts
  // in-tier comps into the top-k the engine actually values from, so the dominant
  // cheap sub-$1M sales don't crowd out the genuinely-comparable mid/luxury comps.
  // Null-safe: no band → this rung stays 0 and ranking is unchanged.
  if (tierBand && num(comp.price) != null) {
    const p = num(comp.price);
    if (p >= tierBand.lo && (tierBand.hi == null || p <= tierBand.hi)) { a.priceBand = 1; a.reasons.push("in_tier_band"); }
  }

  // (1) Same community — strongest. Infer comp community from street anchors.
  const compComm = lookupCommunityByAddress(comp.address, comp.city || subject.city);
  if (subjectCommunity && compComm &&
      commKey(compComm.matched) === commKey(subjectCommunity.matched)) {
    a.sameCommunity = 1; a.reasons.push("same_community");
  }

  // (2) Same luxury tier (S/A/B). Use inferred comp community tier; fall back to a
  // tier-proximity proxy: a very-close comp with no inferable community is treated
  // as same-tier (it is almost certainly in the same enclave / price band).
  const subjTier = subjectCommunity ? subjectCommunity.tier : null;
  const compTier = compComm ? compComm.tier : null;
  if (subjTier && compTier && compTier === subjTier) {
    a.sameTier = 2; a.reasons.push("same_tier");
  } else if (subjTier && compTier && TIER_RANK[compTier] === TIER_RANK[subjTier] - 1) {
    a.sameTier = 1; a.reasons.push("adjacent_tier"); // adjacent tier — partial credit
  } else if (subjTier && !compTier && num(comp.distance) != null && num(comp.distance) <= 0.5) {
    a.sameTier = 1; a.reasons.push("tier_proximity_proxy");
  }

  // (3) Same property / architectural type
  const subjType = classifyPropertyType(subject.propertyType, { sqft: num(subject.sqft) });
  const compType = classifyPropertyType(comp.propertyType, { sqft: num(comp.sqft) });
  if (subjType !== "unknown" && subjType === compType) { a.sameType = 1; a.reasons.push("same_type"); }

  // (4) View / elevation / privacy tier — DATA GAP today (no per-comp view field).
  // Hook left in place: when comp-level view/elevation data exists, set a.viewTier here.
  a.viewTier = 0;

  // (5) Lot / terrain — within 0.5x-2.0x of subject lot
  const sl = num(subject.lotSize), cl = num(comp.lotSize);
  if (sl && cl) {
    const r = cl / sl;
    if (r >= 0.5 && r <= 2.0) { a.lotBand = 2; a.reasons.push("lot_match"); }
    else if (r >= 0.33 && r <= 3.0) a.lotBand = 1;
  }

  // (6) Sale recency — newer is better (bucketed; higher = newer)
  if (comp.saleDate) {
    const d = new Date(comp.saleDate);
    if (!isNaN(d.getTime())) {
      const months = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      a.recency = months <= 6 ? 3 : months <= 12 ? 2 : months <= 24 ? 1 : 0;
    }
  }

  // (7) Distance — final tiebreak only
  a.dist = num(comp.distance) != null ? num(comp.distance) : Infinity;
  return a;
}

/** Strict lexicographic comparator: criteria 1->7, distance last. */
function compareByHierarchy(x, y) {
  return (
    (y.sameCommunity - x.sameCommunity) ||
    (y.sameTier      - x.sameTier)      ||
    (y.priceBand     - x.priceBand)     ||
    (y.sameType      - x.sameType)      ||
    (y.viewTier      - x.viewTier)      ||
    (y.lotBand       - x.lotBand)       ||
    (y.recency       - x.recency)       ||
    (x.dist          - y.dist)            // distance: nearer wins, LAST
  );
}

/**
 * rankCompsCommunityFirst — returns comps sorted best->worst with `.affinity`.
 * Does NOT filter; caller applies PSF outlier drop + count gate. Stable + null-safe.
 */
function rankCompsCommunityFirst(subject, subjectCommunity, comps = [], opts = {}) {
  const tierBand = opts.tierBand || null;
  return (comps || [])
    .map((c) => ({ ...c, affinity: affinityFor(subject, subjectCommunity, c, tierBand) }))
    .sort((x, y) => compareByHierarchy(x.affinity, y.affinity));
}

/**
 * communityCompWeight — how hard to trust the ranked comp average over the AVM.
 * Same-community / same-tier comps get max trust (they ARE the market for this
 * address); generic nearby comps keep the conservative weight.
 */
function communityCompWeight(rankedTop, luxuryTier) {
  const n = (rankedTop || []).length;
  const communityHits = (rankedTop || []).filter(
    (c) => c.affinity && (c.affinity.sameCommunity || c.affinity.sameTier >= 2)
  ).length;
  if (communityHits >= 2) return Math.min(0.80, 0.45 + communityHits * 0.10); // enclave comps dominate
  if (luxuryTier)         return Math.min(0.75, 0.35 + n * 0.10);
  return Math.min(0.45, 0.30 + n * 0.05);
}

module.exports = { rankCompsCommunityFirst, communityCompWeight, affinityFor, compareByHierarchy };

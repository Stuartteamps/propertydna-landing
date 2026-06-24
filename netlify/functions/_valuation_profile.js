/**
 * _valuation_profile.js
 *
 * Property-type-aware valuation profiles. SFR (single family residence) is the
 * baseline; condo / townhouse / multifamily / commercial each apply different
 * weight multipliers, caps, and comp-selection rules.
 *
 * Background: pre-2026-06-23 the valuation was property-type-AGNOSTIC. All
 * DNA_ADJUSTMENTS in save-report.js were applied identically to a 1-bed condo
 * in a high-rise and a 5-acre estate. This caused:
 *   - Condos to over-weight pool/lot/STR features (none apply to a condo)
 *   - Multifamily 2-4 to value off SFR comps when it should anchor to cap rate
 *   - Commercial to be valued with residential features at all
 *
 * Audit pre-deploy: see docs/architecture/phase1-audit.md and the algorithm
 * map at /tmp/.../a688fb725dbdd6c70.output (Phase 1 valuation audit).
 *
 * Goal: move from current ~85% MdAPE on $2M+ luxury and ~70% on multifamily
 * up toward 97% MdAPE across all property types, especially at $2M+.
 *
 * EXPORTS:
 *   classifyPropertyType(raw, { beds, baths, sqft, units, lot_sqft })
 *   getValuationProfile(propertyType, smartMid)  // returns weights, caps, comp rules
 *   typeAwareAdjustmentMultiplier(propertyType)   // legacy convenience
 *
 * This module is pure JS, no side effects, no DB. Caller decides whether to
 * apply or skip the profile (opt-in via passing propertyType to
 * computeDnaAdjustment).
 */

// ── Classifier ──────────────────────────────────────────────────────────────
// Normalizes the wild mix of county-specific property_type codes into a
// stable set we can reason about. See property_type_code_map in the audit.
//
// The raw `property_type` field in property_master is whatever the source
// indexer wrote — could be "0100" (CA assessor), "Single Family Residential"
// (Colorado), "01" (Florida DOR_UC), "SFR", "Condominium", "Multi Family",
// "Commercial", numeric, etc. We pattern-match defensively.

const SFR_PATTERNS = [
  /single\s*family/i, /\bsfr\b/i, /detached/i,
  /^0?100$/, /^0?101$/, /^0?102$/, // CA / DC residential codes
  /^01$/, /^02$/,                    // FL DOR residential
];
const CONDO_PATTERNS = [
  /condo/i, /condominium/i,
  /^0?110$/,                         // CA condo code
  /^04$/,                            // FL condo
];
const TOWNHOUSE_PATTERNS = [
  /town\s*house/i, /townhome/i, /row\s*house/i, /attached\s*home/i,
  /^0?109$/,                         // CA townhouse-ish
];
const MULTIFAMILY_SMALL_PATTERNS = [
  /multi[\s-]?family/i, /duplex/i, /triplex/i, /fourplex/i, /quadplex/i,
  /^2-?4\s*units?/i, /\bdwelling\b.*\b[2-4]\s*units?\b/i,
  /^0?120$/, /^0?121$/,              // CA 2-4 unit
  /^03$/,                            // FL multifamily small
];
const MULTIFAMILY_LARGE_PATTERNS = [
  /apartment/i, /^[5-9]\+?\s*units?/i, /\b\d{2,}\s*units?\b/i,
  /five\s*or\s*more/i, /multi-?dwelling/i,
  /^0?130$/, /^0?131$/, /^0?140$/,   // CA 5+ unit / large multifamily
  /^08$/, /^09$/,                    // FL apt
];
const COMMERCIAL_PATTERNS = [
  /commercial/i, /office/i, /retail/i, /industrial/i, /warehouse/i,
  /hotel/i, /motel/i, /restaurant/i,
  /^0?[2-4]\d\d$/,                   // CA 200-499 commercial range
  /^1[0-9]$/, /^2[0-9]$/, /^3[0-9]$/, /^4[0-9]$/,  // FL commercial codes
];
const MIXED_USE_PATTERNS = [
  /mixed[\s-]?use/i,
  /^0?500$/,                         // some CA mixed-use
];
const LAND_PATTERNS = [
  /\bland\b/i, /vacant/i, /^lot\b/i, /unimproved/i,
  /^0?200$/, /^0?000$/,
];

function matchAny(raw, patterns) {
  if (!raw) return false;
  const s = String(raw).trim();
  return patterns.some(p => p.test(s));
}

/**
 * classifyPropertyType — returns one of:
 *   'sfr' | 'condo' | 'townhouse' | 'multifamily_small' | 'multifamily_large'
 *   | 'commercial' | 'mixed_use' | 'land' | 'unknown'
 *
 * Order of precedence matters: we check more-specific patterns before
 * fall-through. `units` count (when known) is the strongest signal — a
 * `property_type` field that says "Residential" with units=8 is large
 * multifamily regardless of the text.
 */
function classifyPropertyType(raw, hints = {}) {
  const { units = null, beds = null, sqft = null } = hints;

  // Strong signal from unit count first
  if (typeof units === 'number' && units > 0) {
    if (units >= 5) return 'multifamily_large';
    if (units >= 2) return 'multifamily_small';
    // units === 1 falls through to text-based classification
  }

  if (matchAny(raw, LAND_PATTERNS) && (!sqft || sqft < 200)) return 'land';
  if (matchAny(raw, COMMERCIAL_PATTERNS))         return 'commercial';
  if (matchAny(raw, MIXED_USE_PATTERNS))          return 'mixed_use';
  if (matchAny(raw, MULTIFAMILY_LARGE_PATTERNS))  return 'multifamily_large';
  if (matchAny(raw, MULTIFAMILY_SMALL_PATTERNS))  return 'multifamily_small';
  if (matchAny(raw, CONDO_PATTERNS))              return 'condo';
  if (matchAny(raw, TOWNHOUSE_PATTERNS))          return 'townhouse';
  if (matchAny(raw, SFR_PATTERNS))                return 'sfr';

  // Heuristic fallback: if it has beds + sqft and isn't classified, assume SFR.
  // This handles indexers that wrote nothing useful in property_type.
  if (beds && sqft && sqft > 400) return 'sfr';

  return 'unknown';
}

// ── Profiles ────────────────────────────────────────────────────────────────
//
// A profile = how we adjust the SFR-default math for a different property type.
//
//   featureMultiplier      : scale applied to DNA_ADJUSTMENTS pct values
//                            (lower = features matter less for this type)
//   adjustmentCap          : ± cap on total % adjustment after feature stack
//   compRules              : { radiusMi, corrPct, minComps, fallback }
//   valuationMethod        : 'sales_comp' | 'cap_rate' | 'cost_approach'
//                            (informational; future enhancement uses this to
//                            switch valuation track entirely)
//   featureAllowlist       : if set, only these DNA features are applied for
//                            this type. Prevents condos from getting
//                            "oversized_lot" credit (they don't own a lot).
//   featureBlocklist       : if set, these features are SUPPRESSED entirely
//                            even if upstream detection set them.
//
// Numbers grounded in:
//   - Audit of save-report.js current behavior (Phase 1 valuation audit)
//   - Industry standard valuation practice: condos appraise off building +
//     view + HOA; small multifamily off NOI/GRM; large multi off cap rate;
//     commercial off NNN lease income.
//   - Empirical: condos are 80-90% determined by building + floor + view;
//     idiosyncratic unit features matter much less than for SFR.

const PROFILES = {
  sfr: {
    featureMultiplier: 1.00,
    adjustmentCap: 40,              // ±40% (lifts to ±60% at $3M+; see save-report.js)
    compRules: { radiusMi: 0.30, corrPct: 95, minComps: 2, fallbackTopN: 3, fallbackCorrPct: 90 },
    valuationMethod: 'sales_comp',
    featureAllowlist: null,
    featureBlocklist: null,
  },
  condo: {
    featureMultiplier: 0.70,        // building dominates; unit features under-weighted
    adjustmentCap: 25,              // ±25%
    compRules: { radiusMi: 0.10, corrPct: 92, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 85 },
    valuationMethod: 'sales_comp',
    // Allow the features that DO apply to condos. Suppress lot/STR/pool which
    // are building-amenity, not unit-feature (the pool isn't yours; the
    // building has it).
    featureAllowlist: [
      'waterfront', 'lakefront', 'mountain_view', 'panoramic_mountain_views',
      'premium_community', 'fully_remodeled', 'updated', 'original_condition',
      'gated_community', 'gated_24hr_guard', 'historic_architect',
      'celebrity_pedigree', 'historic_enclave', 'architectural_digest_featured',
    ],
    featureBlocklist: [
      'pool', 'no_pool_desert_penalty', 'corner_lot', 'oversized_lot',
      'short_term_rental_friendly', 'golf_course', 'fairway_frontage',
    ],
  },
  townhouse: {
    featureMultiplier: 0.85,
    adjustmentCap: 35,
    compRules: { radiusMi: 0.20, corrPct: 93, minComps: 2, fallbackTopN: 4, fallbackCorrPct: 88 },
    valuationMethod: 'sales_comp',
    featureAllowlist: null,
    featureBlocklist: ['oversized_lot'],
  },
  multifamily_small: {              // 2-4 units (duplex/triplex/fourplex)
    featureMultiplier: 0.50,        // income dominates; cosmetic features matter much less
    adjustmentCap: 25,
    compRules: { radiusMi: 1.00, corrPct: 80, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 70 },
    valuationMethod: 'cap_rate',    // GRM or NOI / cap rate is the right anchor
    featureAllowlist: [
      'waterfront', 'lakefront', 'fully_remodeled', 'updated',
      'original_condition', 'oversized_lot', 'historic_architect',
    ],
    featureBlocklist: ['pool', 'golf_course', 'gated_24hr_guard', 'short_term_rental_friendly'],
  },
  multifamily_large: {              // 5+ units (apartment buildings)
    featureMultiplier: 0.30,        // pure income; features almost irrelevant
    adjustmentCap: 20,
    compRules: { radiusMi: 5.00, corrPct: 70, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 60 },
    valuationMethod: 'cap_rate',
    featureAllowlist: ['waterfront', 'fully_remodeled', 'updated', 'original_condition'],
    featureBlocklist: null,         // most don't apply but no harm scaling them down 70%
  },
  commercial: {
    featureMultiplier: 0.20,
    adjustmentCap: 15,
    compRules: { radiusMi: 5.00, corrPct: 65, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 55 },
    valuationMethod: 'cap_rate',
    featureAllowlist: ['waterfront', 'fully_remodeled', 'updated', 'original_condition'],
    featureBlocklist: null,
  },
  mixed_use: {
    featureMultiplier: 0.50,
    adjustmentCap: 25,
    compRules: { radiusMi: 1.00, corrPct: 75, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 65 },
    valuationMethod: 'cap_rate',
    featureAllowlist: null,
    featureBlocklist: null,
  },
  land: {
    featureMultiplier: 0.40,        // location/zoning dominate, no structure-related features
    adjustmentCap: 30,
    compRules: { radiusMi: 2.00, corrPct: 70, minComps: 2, fallbackTopN: 5, fallbackCorrPct: 60 },
    valuationMethod: 'sales_comp',
    featureAllowlist: ['waterfront', 'lakefront', 'mountain_view', 'panoramic_mountain_views', 'oversized_lot'],
    featureBlocklist: [
      'pool', 'fully_remodeled', 'updated', 'original_condition',
      'golf_course', 'fairway_frontage', 'no_pool_desert_penalty',
      'historic_architect', 'mcm_authentic',
    ],
  },
  unknown: {
    // When we can't classify, fall back to SFR defaults (current behavior).
    // Better to over-trust SFR features on an unclassified condo than to
    // completely zero out adjustments.
    featureMultiplier: 1.00,
    adjustmentCap: 40,
    compRules: { radiusMi: 0.30, corrPct: 95, minComps: 2, fallbackTopN: 3, fallbackCorrPct: 90 },
    valuationMethod: 'sales_comp',
    featureAllowlist: null,
    featureBlocklist: null,
  },
};

/**
 * getValuationProfile — returns the resolved profile for a property type,
 * with luxury-tier overrides applied where relevant.
 *
 * Luxury overrides (smartMid >= $3M):
 *   - SFR: cap lifts to ±60% (matches existing save-report.js)
 *   - condo: cap lifts to ±35% (trophy penthouses can stack features more)
 *   - townhouse: cap lifts to ±45%
 *   - multifamily/commercial: NO override (income-driven, % adjustments shouldn't compound)
 */
function getValuationProfile(propertyType = 'unknown', smartMid = null) {
  const base = PROFILES[propertyType] || PROFILES.unknown;
  const profile = { ...base, propertyType };

  // Luxury tier cap override (only applies where it makes sense)
  if (smartMid && smartMid >= 3_000_000) {
    if (propertyType === 'sfr')        profile.adjustmentCap = 60;
    if (propertyType === 'condo')      profile.adjustmentCap = 35;
    if (propertyType === 'townhouse')  profile.adjustmentCap = 45;
    // multifamily/commercial/land: leave alone
  }

  // For trophy ($5M+), widen comp radius even further on SFR — comp density
  // collapses; we need to look further afield (and longer back).
  if (smartMid && smartMid >= 5_000_000 && propertyType === 'sfr') {
    profile.compRules = {
      ...profile.compRules,
      radiusMi: Math.max(profile.compRules.radiusMi, 1.50),
      corrPct: Math.min(profile.compRules.corrPct, 85),
      fallbackCorrPct: Math.min(profile.compRules.fallbackCorrPct, 75),
    };
  }

  return profile;
}

/**
 * typeAwareAdjustmentMultiplier — convenience accessor when you only need
 * the feature multiplier (e.g. for legacy callers).
 */
function typeAwareAdjustmentMultiplier(propertyType) {
  return getValuationProfile(propertyType).featureMultiplier;
}

/**
 * filterFeaturesByProfile — given the auto-detected feature bag and a
 * resolved profile, return a new feature bag with allowlist/blocklist
 * applied. Used by computeDnaAdjustment to suppress lot/pool credit on a
 * condo, etc.
 */
function filterFeaturesByProfile(features, profile) {
  if (!features) return {};
  const allow = profile.featureAllowlist ? new Set(profile.featureAllowlist) : null;
  const block = profile.featureBlocklist ? new Set(profile.featureBlocklist) : null;

  const out = {};
  for (const [key, active] of Object.entries(features)) {
    if (!active) continue;
    if (allow && !allow.has(key)) continue;
    if (block && block.has(key))  continue;
    out[key] = true;
  }
  return out;
}

module.exports = {
  classifyPropertyType,
  getValuationProfile,
  typeAwareAdjustmentMultiplier,
  filterFeaturesByProfile,
  // exported for tests / inspection
  PROFILES,
};

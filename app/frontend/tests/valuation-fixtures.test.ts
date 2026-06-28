/**
 * app/frontend/tests/valuation-fixtures.test.ts
 *
 * QA fixtures for the 7 canonical CV property archetypes.
 * Tests the pure helper modules only — no Supabase, no HTTP, no env vars.
 *
 * Run: cd app/frontend && npx vitest run tests/valuation-fixtures.test.ts
 *
 * Helpers imported:
 *   _cv_luxury_index.js   — lookupCommunity, TIER_PREMIUM
 *   _valuation_profile.js — classifyPropertyType, getValuationProfile, filterFeaturesByProfile
 */
import { describe, it, expect } from 'vitest';

// Pure server-side helpers — safe to import in a node test environment.
import {
  lookupCommunity,
  TIER_PREMIUM,
} from '../../../netlify/functions/_cv_luxury_index.js';

import {
  classifyPropertyType,
  getValuationProfile,
  filterFeaturesByProfile,
} from '../../../netlify/functions/_valuation_profile.js';

// ── Thin DNA adjustment math (mirrors save-report.js Phase 2 without DB deps) ──
// Replicates the percentage-stacking logic at save-report.js:592-667 so we
// can unit-test it in isolation. KEEP IN SYNC with that function's core math.
const DNA_ADJUSTMENTS: Record<string, { pct_low: number; pct_mid: number; pct_high: number }> = {
  waterfront:               { pct_low: 8,  pct_mid: 12, pct_high: 20 },
  lakefront:                { pct_low: 6,  pct_mid: 10, pct_high: 18 },
  golf_course:              { pct_low: 3,  pct_mid: 5,  pct_high: 9  },
  fairway_frontage:         { pct_low: 6,  pct_mid: 10, pct_high: 18 },
  mountain_view:            { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  panoramic_mountain_views: { pct_low: 4,  pct_mid: 7,  pct_high: 12 },
  premium_community:        { pct_low: 3,  pct_mid: 6,  pct_high: 10 },
  fully_remodeled:          { pct_low: 5,  pct_mid: 8,  pct_high: 14 },
  updated:                  { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  original_condition:       { pct_low: -8, pct_mid: -5, pct_high: -2 },
  pool:                     { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  no_pool_desert_penalty:   { pct_low: -4, pct_mid: -2, pct_high: 0  },
  corner_lot:               { pct_low: -2, pct_mid: 0,  pct_high: 2  },
  oversized_lot:            { pct_low: 2,  pct_mid: 5,  pct_high: 10 },
  gated_community:          { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  gated_24hr_guard:         { pct_low: 6,  pct_mid: 10, pct_high: 15 },
  short_term_rental_friendly: { pct_low: 3, pct_mid: 6, pct_high: 12 },
  historic_architect:       { pct_low: 8,  pct_mid: 15, pct_high: 25 },
  celebrity_pedigree:       { pct_low: 5,  pct_mid: 10, pct_high: 18 },
  historic_enclave:         { pct_low: 5,  pct_mid: 10, pct_high: 18 },
  architectural_digest_featured: { pct_low: 3, pct_mid: 6, pct_high: 10 },
  mcm_authentic:            { pct_low: 4,  pct_mid: 8,  pct_high: 14 },
};

/** Minimal DNA phase-2 adjuster — percentage stack only, no sale anchor, no ADU/pool. */
function applyDnaFeaturePct(
  smartMid: number,
  features: Record<string, boolean>,
  propertyType: string,
  communityPct: number = 0,
  luxuryBoostPct: number = 0,
): { adjMid: number; totalPct: number } {
  const profile = getValuationProfile(propertyType, smartMid);
  const allowed = filterFeaturesByProfile(features, profile);
  const mult = profile.featureMultiplier;
  const cap  = profile.adjustmentCap;

  let totalMid = communityPct + luxuryBoostPct;
  for (const [key, active] of Object.entries(allowed)) {
    if (!active) continue;
    const adj = DNA_ADJUSTMENTS[key];
    if (adj) totalMid += adj.pct_mid * mult;
  }

  const capped = Math.max(-cap, Math.min(cap, totalMid));
  return {
    adjMid: Math.round(smartMid * (1 + capped / 100)),
    totalPct: Math.round(capped * 10) / 10,
  };
}

// ── Accuracy metric helper ────────────────────────────────────────────────────
function ape(adjMid: number, groundTruth: number): number {
  return Math.abs(adjMid - groundTruth) / groundTruth * 100;
}

// =============================================================================
// FIXTURE 1: Southridge hillside trophy — Palm Springs
// =============================================================================
describe('Fixture 1: Southridge hillside trophy (Palm Springs, Tier S SFR)', () => {
  const subdivision = 'Southridge';
  const city        = 'Palm Springs';
  const smartMid    = 8_500_000;

  it('lookupCommunity returns Tier S with 22% mid premium', () => {
    const r = lookupCommunity(subdivision, city);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe('S');
    expect(r!.pct_mid).toBe(TIER_PREMIUM.S.pct_mid); // 22
    expect(r!.pct_low).toBe(12);
    expect(r!.pct_high).toBe(38);
  });

  it('classifies as SFR', () => {
    expect(classifyPropertyType('Single Family Residential', { beds: 5, sqft: 8200 })).toBe('sfr');
  });

  it('profile at $8.5M SFR lifts adjustmentCap to 60% and widens comp radius to 1.5mi', () => {
    const profile = getValuationProfile('sfr', smartMid);
    expect(profile.adjustmentCap).toBe(60);                         // $3M+ override
    expect(profile.compRules.radiusMi).toBeGreaterThanOrEqual(1.5); // $5M+ trophy override
    expect(profile.featureMultiplier).toBe(1.00);
  });

  it('DNA stack: hillside trophy features push adjMid above smart base and hit cap', () => {
    // Features: panoramic views, pool, gated 24hr, historic architect,
    // celebrity pedigree, oversized lot. Community premium from lookupCommunity.
    const features: Record<string, boolean> = {
      panoramic_mountain_views: true, // +7%
      pool: true,                     // +4%
      gated_24hr_guard: true,         // +10%
      historic_architect: true,       // +15%
      celebrity_pedigree: true,       // +10%
      oversized_lot: true,            // +5%
    };
    const community = lookupCommunity(subdivision, city)!;
    const luxuryBoost = 12; // trophy $5M+ boost (pct_mid=12)

    const result = applyDnaFeaturePct(smartMid, features, 'sfr', community.pct_mid, luxuryBoost);

    // All premium features should push adjMid ABOVE smartMid
    expect(result.adjMid).toBeGreaterThan(smartMid);
    // Feature stack (51%) + community (22%) + luxury (12%) = 85% → capped at 60%
    expect(result.totalPct).toBe(60);
    // TODO: add APE assertion once back-test AVM anchors are live (Option A backfill).
  });

  it('pool feature is NOT blocked for SFR (only blocked for condo)', () => {
    const profile  = getValuationProfile('sfr', smartMid);
    const filtered = filterFeaturesByProfile({ pool: true }, profile);
    expect(filtered.pool).toBe(true);
  });
});

// =============================================================================
// FIXTURE 2: Old Las Palmas architectural — Palm Springs
// =============================================================================
describe('Fixture 2: Old Las Palmas architectural estate (Palm Springs, Tier A SFR)', () => {
  const subdivision = 'Old Las Palmas';
  const city        = 'Palm Springs';
  const smartMid    = 3_200_000;

  it('lookupCommunity returns Tier A with 13% mid premium', () => {
    const r = lookupCommunity(subdivision, city);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe('A');
    expect(r!.pct_mid).toBe(13);
    expect(r!.label).toContain('Luxury Community');
  });

  it('also matches "Vista Las Palmas" to Tier A (same row, prevents mis-tier)', () => {
    const r = lookupCommunity('Vista Las Palmas', 'Palm Springs');
    expect(r?.tier).toBe('A');
  });

  it('profile at $3.2M SFR has cap 60% (over $3M threshold)', () => {
    const profile = getValuationProfile('sfr', smartMid);
    expect(profile.adjustmentCap).toBe(60);
  });

  it('historic_architect + celebrity_pedigree + mcm_authentic stack hits 60% cap', () => {
    // Features: historic_architect(+15), celebrity_pedigree(+10), mcm_authentic(+8),
    // panoramic_mountain_views(+7), gated_community(+4), pool(+4) = 48%
    // + community(13%) + luxury(8%) = 69% → capped at 60%
    const features: Record<string, boolean> = {
      historic_architect: true,
      celebrity_pedigree: true,
      mcm_authentic: true,
      panoramic_mountain_views: true,
      gated_community: true,
      pool: true,
    };
    const community = lookupCommunity(subdivision, city)!;
    const luxuryBoost = 8; // $3-5M tier: pct_mid=8

    const result = applyDnaFeaturePct(smartMid, features, 'sfr', community.pct_mid, luxuryBoost);

    expect(result.adjMid).toBeGreaterThan(smartMid);
    expect(result.totalPct).toBe(60); // must hit the cap
  });

  it('adjMid is at most 60% above smartMid (cap enforced)', () => {
    const result = applyDnaFeaturePct(smartMid, {
      historic_architect: true, celebrity_pedigree: true, mcm_authentic: true,
      panoramic_mountain_views: true, gated_community: true, pool: true,
    }, 'sfr', 13, 8);
    expect(result.adjMid).toBeLessThanOrEqual(Math.round(smartMid * 1.60) + 1);
  });
});

// =============================================================================
// FIXTURE 3: Palmilla (La Quinta) — Tier B gated golf community
// =============================================================================
describe('Fixture 3: Palmilla, La Quinta (Tier B SFR)', () => {
  const subdivision = 'Palmilla';
  const city        = 'La Quinta';
  const smartMid    = 850_000;

  it('lookupCommunity returns Tier B with 6% mid premium', () => {
    const r = lookupCommunity(subdivision, city);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe('B');
    expect(r!.pct_mid).toBe(6);
    expect(r!.pct_low).toBe(3);
    expect(r!.pct_high).toBe(10);
  });

  it('classifies as SFR when sqft given (typical Palmilla villa)', () => {
    expect(classifyPropertyType('Single Family', { beds: 3, sqft: 2100 })).toBe('sfr');
  });

  it('profile at $850K does NOT get luxury cap override (under $3M threshold)', () => {
    const profile = getValuationProfile('sfr', smartMid);
    expect(profile.adjustmentCap).toBe(40);   // standard ±40%
    expect(profile.compRules.radiusMi).toBe(0.30);
  });

  it('DNA stack with golf + gated + pool + community B premium: 23% total, under 40% cap', () => {
    const features: Record<string, boolean> = {
      golf_course: true,     // +5%
      gated_community: true, // +4%
      pool: true,            // +4%
      mountain_view: true,   // +4%
    };
    // No luxury tier boost (under $1.5M threshold)
    const result = applyDnaFeaturePct(smartMid, features, 'sfr', 6, 0);

    // 5+4+4+4 (features) + 6 (community) = 23% — well under 40% cap
    expect(result.totalPct).toBeCloseTo(23, 0);
    expect(result.adjMid).toBeCloseTo(Math.round(smartMid * 1.23), -3);
    expect(result.totalPct).toBeLessThanOrEqual(40);
  });

  it('short_term_rental_friendly is NOT blocked for SFR Palmilla', () => {
    const profile  = getValuationProfile('sfr', smartMid);
    const filtered = filterFeaturesByProfile({ short_term_rental_friendly: true }, profile);
    expect(filtered.short_term_rental_friendly).toBe(true);
  });
});

// =============================================================================
// FIXTURE 4: Thunderbird Heights estate — Rancho Mirage
// =============================================================================
describe('Fixture 4: Thunderbird Heights (Rancho Mirage, Tier S SFR)', () => {
  const subdivision = 'Thunderbird Heights';
  const city        = 'Rancho Mirage';
  const smartMid    = 5_500_000;

  it('lookupCommunity returns Tier S (not Tier A Thunderbird Country Club)', () => {
    // Thunderbird Heights → Tier S wins over the "thunderbird" substring match on Tier A
    const r = lookupCommunity(subdivision, city);
    expect(r?.tier).toBe('S');
  });

  it('Thunderbird Country Club separately classifies Tier A', () => {
    const r = lookupCommunity('Thunderbird Country Club', 'Rancho Mirage');
    expect(r?.tier).toBe('A');
    expect(r?.pct_mid).toBe(13);
  });

  it('profile at $5.5M SFR: cap=60%, comp radius widens to >=1.5mi, corrPct<=85%', () => {
    const profile = getValuationProfile('sfr', smartMid);
    expect(profile.adjustmentCap).toBe(60);
    expect(profile.compRules.radiusMi).toBeGreaterThanOrEqual(1.5);
    expect(profile.compRules.corrPct).toBeLessThanOrEqual(85);
  });

  it('Tier S pct_mid=22% community premium stacks to exactly hit the 60% cap', () => {
    const community = lookupCommunity(subdivision, city)!;
    expect(community.pct_mid).toBe(22);

    const result = applyDnaFeaturePct(
      smartMid,
      { gated_24hr_guard: true, panoramic_mountain_views: true, pool: true, golf_course: true },
      'sfr',
      community.pct_mid,
      12, // trophy $5M+ luxury boost
    );

    // 10+7+4+5=26% features + 22% community + 12% luxury = 60% → exactly at cap
    expect(result.totalPct).toBe(60);
    expect(result.adjMid).toBeGreaterThan(smartMid);
  });

  it('cross-city guard: Southridge must NOT match Rancho Mirage', () => {
    // Southridge is only in Palm Springs. City mismatch must return null.
    expect(lookupCommunity('Southridge', 'Rancho Mirage')).toBeNull();
  });
});

// =============================================================================
// FIXTURE 5: Standard Palm Springs SFR (no community, no luxury tier)
// =============================================================================
describe('Fixture 5: Standard Palm Springs SFR (no community premium)', () => {
  const city     = 'Palm Springs';
  const smartMid = 650_000;

  it('lookupCommunity returns null for generic subdivisions', () => {
    expect(lookupCommunity('Sunrise Park', city)).toBeNull();
    expect(lookupCommunity('Desert Highlands', city)).toBeNull();
  });

  it('classifies generic "Single Family Residential" as sfr', () => {
    expect(classifyPropertyType('Single Family Residential', { beds: 3, sqft: 1600 })).toBe('sfr');
  });

  it('profile at $650K is baseline SFR: cap=40%, radius=0.30mi, mult=1.00, method=sales_comp', () => {
    const profile = getValuationProfile('sfr', smartMid);
    expect(profile.adjustmentCap).toBe(40);
    expect(profile.compRules.radiusMi).toBe(0.30);
    expect(profile.featureMultiplier).toBe(1.00);
    expect(profile.valuationMethod).toBe('sales_comp');
  });

  it('no_pool_desert_penalty fires for desert home without pool (-2% mid)', () => {
    const result = applyDnaFeaturePct(smartMid, { no_pool_desert_penalty: true }, 'sfr', 0, 0);
    expect(result.totalPct).toBe(-2); // DNA_ADJUSTMENTS.no_pool_desert_penalty.pct_mid
    expect(result.adjMid).toBeLessThan(smartMid);
  });

  it('pool feature produces higher adjMid than no_pool_desert_penalty', () => {
    const withPenalty = applyDnaFeaturePct(smartMid, { no_pool_desert_penalty: true }, 'sfr', 0, 0);
    const withPool    = applyDnaFeaturePct(smartMid, { pool: true }, 'sfr', 0, 0);
    expect(withPool.adjMid).toBeGreaterThan(withPenalty.adjMid);
  });

  it('original_condition penalty: -5% mid applied correctly', () => {
    const result = applyDnaFeaturePct(smartMid, { original_condition: true }, 'sfr', 0, 0);
    expect(result.totalPct).toBe(-5);
    expect(result.adjMid).toBeCloseTo(Math.round(smartMid * 0.95), -2);
  });
});

// =============================================================================
// FIXTURE 6: Palm Springs condo (blocked/allowed feature enforcement)
// =============================================================================
describe('Fixture 6: Palm Springs condo (feature blocklist enforcement)', () => {
  const smartMid = 450_000;

  it('classifies "Condominium", CA code "0110", and FL code "04" as condo', () => {
    expect(classifyPropertyType('Condominium', { beds: 1, sqft: 900 })).toBe('condo');
    expect(classifyPropertyType('0110', {})).toBe('condo'); // CA condo code
    expect(classifyPropertyType('04', {})).toBe('condo');   // FL condo code
  });

  it('condo profile: featureMultiplier=0.70, cap=25, radius=0.10mi', () => {
    const profile = getValuationProfile('condo', smartMid);
    expect(profile.featureMultiplier).toBe(0.70);
    expect(profile.adjustmentCap).toBe(25);
    expect(profile.compRules.radiusMi).toBe(0.10);
  });

  it('pool is BLOCKED for condo — shared building amenity, not unit value', () => {
    const profile  = getValuationProfile('condo', smartMid);
    const filtered = filterFeaturesByProfile({ pool: true }, profile);
    expect(filtered.pool).toBeUndefined();
  });

  it('oversized_lot is BLOCKED for condo', () => {
    const profile  = getValuationProfile('condo', smartMid);
    const filtered = filterFeaturesByProfile({ oversized_lot: true }, profile);
    expect(filtered.oversized_lot).toBeUndefined();
  });

  it('short_term_rental_friendly is BLOCKED for condo', () => {
    const profile  = getValuationProfile('condo', smartMid);
    const filtered = filterFeaturesByProfile({ short_term_rental_friendly: true }, profile);
    expect(filtered.short_term_rental_friendly).toBeUndefined();
  });

  it('mountain_view IS allowed for condo (unit-specific feature)', () => {
    const profile  = getValuationProfile('condo', smartMid);
    const filtered = filterFeaturesByProfile({ mountain_view: true }, profile);
    expect(filtered.mountain_view).toBe(true);
  });

  it('fully_remodeled IS allowed for condo', () => {
    const profile  = getValuationProfile('condo', smartMid);
    const filtered = filterFeaturesByProfile({ fully_remodeled: true }, profile);
    expect(filtered.fully_remodeled).toBe(true);
  });

  it('condo with mountain_view + fully_remodeled: adjustment is 0.70-scaled, pool excluded', () => {
    // mountain_view pct_mid=4, fully_remodeled pct_mid=8 → (4+8) × 0.70 = 8.4%
    // pool is in blocklist → excluded even though passed in features
    const result = applyDnaFeaturePct(
      smartMid,
      { mountain_view: true, fully_remodeled: true, pool: true },
      'condo',
      0, 0,
    );
    expect(result.totalPct).toBeCloseTo(8.4, 0);
    expect(result.adjMid).toBeGreaterThan(smartMid);
  });

  it('condo cap lifts to 35% at $3M+ trophy level', () => {
    const profile = getValuationProfile('condo', 3_500_000);
    expect(profile.adjustmentCap).toBe(35);
  });
});

// =============================================================================
// FIXTURE 7: Vacant land — Palm Desert (feature blocklist, land profile)
// =============================================================================
describe('Fixture 7: Vacant land parcel (Palm Desert)', () => {
  const smartMid = 180_000;

  it('classifies "Vacant", "land", "0200" (CA land code) as land when sqft is falsy or < 200', () => {
    expect(classifyPropertyType('Vacant', { sqft: 0 })).toBe('land');
    expect(classifyPropertyType('land', { sqft: 0 })).toBe('land');
    expect(classifyPropertyType('0200', { sqft: 0 })).toBe('land'); // CA land code
    expect(classifyPropertyType('Vacant', { sqft: 50 })).toBe('land');
  });

  it('Vacant with sqft >= 200 does NOT classify as land — falls to unknown with no beds', () => {
    // sqft=1200 fails the (!sqft || sqft < 200) guard; no beds → heuristic skips; → unknown
    expect(classifyPropertyType('Vacant', { sqft: 1200, beds: 0 })).toBe('unknown');
  });

  it('land profile: featureMultiplier=0.40, cap=30, radius=2.0mi, method=sales_comp', () => {
    const profile = getValuationProfile('land', smartMid);
    expect(profile.featureMultiplier).toBe(0.40);
    expect(profile.adjustmentCap).toBe(30);
    expect(profile.compRules.radiusMi).toBe(2.00);
    expect(profile.valuationMethod).toBe('sales_comp');
  });

  it('pool, fully_remodeled, golf_course, no_pool_desert_penalty, historic_architect, mcm_authentic are BLOCKED for land', () => {
    const profile  = getValuationProfile('land', smartMid);
    const filtered = filterFeaturesByProfile({
      pool: true, fully_remodeled: true, golf_course: true,
      no_pool_desert_penalty: true, historic_architect: true, mcm_authentic: true,
    }, profile);
    expect(filtered.pool).toBeUndefined();
    expect(filtered.fully_remodeled).toBeUndefined();
    expect(filtered.golf_course).toBeUndefined();          // not in land allowlist
    expect(filtered.no_pool_desert_penalty).toBeUndefined();
    expect(filtered.historic_architect).toBeUndefined();   // no structure → blocked
    expect(filtered.mcm_authentic).toBeUndefined();
  });

  it('oversized_lot IS allowed for land (zoning premium is real)', () => {
    const profile  = getValuationProfile('land', smartMid);
    const filtered = filterFeaturesByProfile({ oversized_lot: true }, profile);
    expect(filtered.oversized_lot).toBe(true);
  });

  it('mountain_view IS allowed for land (view lot premium is real)', () => {
    const profile  = getValuationProfile('land', smartMid);
    const filtered = filterFeaturesByProfile({ mountain_view: true }, profile);
    expect(filtered.mountain_view).toBe(true);
  });

  it('oversized_lot on land: pct_mid=5 × mult=0.40 = 2.0% total; pool blocked and excluded', () => {
    const result = applyDnaFeaturePct(smartMid, { oversized_lot: true, pool: true }, 'land', 0, 0);
    // oversized_lot pct_mid=5 × 0.40 = 2.0%; pool blocked → only oversized counts
    expect(result.totalPct).toBeCloseTo(2.0, 0);
    expect(result.adjMid).toBeGreaterThan(smartMid);
  });

  it('lookupCommunity can still match land in a luxury community — KNOWN GAP: community premium not gated by type', () => {
    // save-report.js applies communityPremium unconditionally regardless of propertyType.
    // A vacant lot in Palmilla gets the 6% B-tier premium even though the brand
    // value attaches to occupancy, not to raw dirt.
    // Track in valuation_accuracy_log to measure empirical impact.
    const r = lookupCommunity('Palmilla', 'La Quinta');
    expect(r).not.toBeNull(); // lookup returns a result...
    expect(r!.tier).toBe('B'); // ...at Tier B.
    // No assertion that community premium IS or IS NOT applied — that's production code.
  });
});

// =============================================================================
// ACCURACY METRIC MATH UNIT TESTS
// =============================================================================
describe('Accuracy metric computations', () => {
  it('APE formula: |adjMid - groundTruth| / groundTruth × 100', () => {
    expect(ape(1_050_000, 1_000_000)).toBeCloseTo(5.0, 1);
    expect(ape(900_000,   1_000_000)).toBeCloseTo(10.0, 1);
    expect(ape(1_000_000, 1_000_000)).toBe(0);
  });

  it('within-5% threshold', () => {
    expect(ape(1_049_000, 1_000_000)).toBeLessThan(5);
    expect(ape(1_051_000, 1_000_000)).toBeGreaterThan(5);
  });

  it('within-10% threshold', () => {
    expect(ape(1_099_000, 1_000_000)).toBeLessThan(10);
    expect(ape(1_101_000, 1_000_000)).toBeGreaterThan(10);
  });

  it('luxury-market MdAPE: filtered to adjMid >= $1.5M, median over sorted APEs', () => {
    const samples = [
      { adjMid: 1_600_000, groundTruth: 1_700_000 },  // ape ~5.9%
      { adjMid: 2_200_000, groundTruth: 2_000_000 },  // ape 10%
      { adjMid: 5_500_000, groundTruth: 5_000_000 },  // ape 10%
      { adjMid:   600_000, groundTruth:   650_000 },  // non-luxury, excluded
    ];
    const luxurySamples = samples.filter(s => s.adjMid >= 1_500_000);
    const apes = luxurySamples.map(s => ape(s.adjMid, s.groundTruth)).sort((a, b) => a - b);
    const mdape = apes[Math.floor(apes.length / 2)]; // median

    expect(luxurySamples.length).toBe(3);
    expect(mdape).toBeCloseTo(10.0, 0);
  });
});

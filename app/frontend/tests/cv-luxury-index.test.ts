import { describe, it, expect } from 'vitest';
// Server-side luxury valuation logic lives in netlify/functions, which the
// frontend build never touches. This is the first test that locks it in.
import { lookupCommunity, TIER_PREMIUM } from '../../../netlify/functions/_cv_luxury_index.js';

describe('CV luxury community pedigree index', () => {
  it('classifies Southridge (Palm Springs) as a Tier S trophy enclave', () => {
    const r = lookupCommunity('Southridge', 'Palm Springs');
    expect(r).not.toBeNull();
    expect(r.tier).toBe('S');
    expect(r.pct_mid).toBe(TIER_PREMIUM.S.pct_mid); // 22%
    expect(r.label).toContain('Trophy Enclave');
  });

  it('normalizes spacing/suffixes — "South Ridge Dr" still hits Southridge', () => {
    expect(lookupCommunity('South Ridge Dr', 'Palm Springs')?.tier).toBe('S');
  });

  it('classifies The Madison Club (La Quinta) as Tier S', () => {
    expect(lookupCommunity('The Madison Club', 'La Quinta')?.tier).toBe('S');
  });

  it('classifies Old Las Palmas (Palm Springs) as Tier A', () => {
    const r = lookupCommunity('Old Las Palmas', 'Palm Springs');
    expect(r?.tier).toBe('A');
    expect(r?.pct_mid).toBe(13);
  });

  it('classifies Palmilla (La Quinta) as Tier B', () => {
    const r = lookupCommunity('Palmilla', 'La Quinta');
    expect(r?.tier).toBe('B');
    expect(r?.pct_mid).toBe(6);
  });

  it('returns null for a non-luxury subdivision', () => {
    expect(lookupCommunity('Sunrise Park', 'Palm Springs')).toBeNull();
  });

  it('guards against cross-city name clashes (Southridge only in Palm Springs)', () => {
    // A "Southridge" in the wrong city must not inherit the Palm Springs premium.
    expect(lookupCommunity('Southridge', 'La Quinta')).toBeNull();
  });

  it('prefers the highest tier when a name could match multiple rows', () => {
    // "the reserve" appears under both Tier S (Indian Wells) and Tier A
    // (Palm Desert). With no city, the higher tier (S) must win.
    expect(lookupCommunity('The Reserve', '')?.tier).toBe('S');
  });
});

import { describe, it, expect } from 'vitest';
import { makeHeatValue, metricLabel } from '../src/lib/heatMetric';
import type { HeatParcel } from '../src/types/heatmap';

// Minimal parcel factory — only the fields the metric logic reads matter.
function mk(over: Partial<HeatParcel>): HeatParcel {
  return {
    id: 'x', address: '', street: '', city: '', state: '', zip: '',
    lat: 0, lon: 0, score: 50, confidence: 0.8, price: 0, pricePerSqft: 0,
    sqft: 0, bedrooms: 0, bathrooms: 0, yearBuilt: 0, dom: 0, permits: 0,
    propertyType: 'single_family', compsScore: 0, priceDeltaScore: 0,
    domScore: 0, permitsScore: 0, livability: 0, rentalDemand: 0,
    sparkline: [], polygon: [], neighborhood: '', ...over,
  };
}

describe('makeHeatValue', () => {
  it('passes the DNA score through unchanged (clamped 0–100)', () => {
    const f = makeHeatValue([], 'dna');
    expect(f(mk({ score: 73 }))).toBe(73);
    expect(f(mk({ score: 140 }))).toBe(100);
    expect(f(mk({ score: -5 }))).toBe(0);
  });

  it('min–max normalizes $/sqft across the parcel set', () => {
    const parcels = [mk({ pricePerSqft: 100 }), mk({ pricePerSqft: 200 }), mk({ pricePerSqft: 300 })];
    const f = makeHeatValue(parcels, 'ppsf');
    expect(f(mk({ pricePerSqft: 100 }))).toBe(0);
    expect(f(mk({ pricePerSqft: 200 }))).toBe(50);
    expect(f(mk({ pricePerSqft: 300 }))).toBe(100);
  });

  it('inverts velocity so faster sales (lower DOM) read hotter', () => {
    const parcels = [mk({ dom: 10 }), mk({ dom: 20 }), mk({ dom: 30 })];
    const f = makeHeatValue(parcels, 'velocity');
    expect(f(mk({ dom: 10 }))).toBe(100); // fastest → hottest
    expect(f(mk({ dom: 30 }))).toBe(0);   // slowest → coldest
  });

  it('treats missing/zero metric values as coldest', () => {
    const parcels = [mk({ pricePerSqft: 200 })];
    const f = makeHeatValue(parcels, 'ppsf');
    expect(f(mk({ pricePerSqft: 0 }))).toBe(0);
    expect(f(mk({ pricePerSqft: NaN }))).toBe(0);
  });

  it('does not throw on an empty parcel set', () => {
    expect(() => makeHeatValue([], 'ppsf')(mk({ pricePerSqft: 100 }))).not.toThrow();
  });
});

describe('metricLabel', () => {
  it('formats per metric', () => {
    expect(metricLabel(mk({ pricePerSqft: 642 }), 'ppsf')).toBe('$642');
    expect(metricLabel(mk({ dom: 18 }), 'velocity')).toBe('18d');
    expect(metricLabel(mk({ score: 81 }), 'dna')).toBe('81');
    expect(metricLabel(mk({ pricePerSqft: 0 }), 'ppsf')).toBe('');
  });
});

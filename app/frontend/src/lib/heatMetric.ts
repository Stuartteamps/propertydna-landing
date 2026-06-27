import type { HeatParcel } from '@/types/heatmap';

// The heat map can color by more than the DNA score. $/sqft and sales-velocity
// reuse fields already present on every HeatParcel, so no new data is needed.
export type HeatMetric = 'dna' | 'ppsf' | 'velocity';

export const METRIC_META: Record<HeatMetric, { label: string; legend: string }> = {
  dna: { label: 'DNA', legend: 'DNA Score' },
  ppsf: { label: '$/SqFt', legend: 'Price / SqFt' },
  velocity: { label: 'Velocity', legend: 'Sales Velocity' },
};

function rawValue(p: HeatParcel, metric: HeatMetric): number {
  return metric === 'ppsf' ? p.pricePerSqft : p.dom;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Returns a function mapping a parcel to a 0–100 heat value for the chosen
 * metric. DNA passes the score through; $/sqft and velocity are min–max
 * normalized across the current parcel set so the gradient always spans the
 * visible data. Velocity is inverted — faster sales (lower days-on-market)
 * read hotter. Missing/zero values fall to 0 (coldest).
 */
export function makeHeatValue(parcels: HeatParcel[], metric: HeatMetric): (p: HeatParcel) => number {
  if (metric === 'dna') return (p) => clamp(p.score);

  const vals = parcels.map((p) => rawValue(p, metric)).filter((v) => Number.isFinite(v) && v > 0);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = max - min || 1;

  return (p) => {
    const v = rawValue(p, metric);
    if (!Number.isFinite(v) || v <= 0) return 0;
    const norm = ((v - min) / span) * 100;
    return clamp(metric === 'velocity' ? 100 - norm : norm);
  };
}

/** Short value rendered on the parcel label for the active metric. */
export function metricLabel(p: HeatParcel, metric: HeatMetric): string {
  if (metric === 'ppsf') return p.pricePerSqft > 0 ? `$${Math.round(p.pricePerSqft)}` : '';
  if (metric === 'velocity') return p.dom > 0 ? `${Math.round(p.dom)}d` : '';
  return String(Math.round(p.score));
}

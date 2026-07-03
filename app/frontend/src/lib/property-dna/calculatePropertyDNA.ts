// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — derivation engine
//
// Pure functions that turn a small set of "known" facts (value, risk, growth)
// into the richer asset surface the UI renders. Keeping this separate from the
// mock data means the SAME math runs whether values come from mockMapData or a
// live provider via normalizePropertyData.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FutureValueScenario,
  RiskLevel,
  RiskProfile,
  SeriesPoint,
  TimeRange,
  ValueRange,
  ValueSeries,
} from './types';

export const TIME_RANGES: TimeRange[] = ['1M', '6M', '1Y', '3Y', '5Y'];

/** Number of monthly steps to render for each range. */
const RANGE_STEPS: Record<TimeRange, number> = {
  '1M': 30,
  '6M': 26,
  '1Y': 24,
  '3Y': 18,
  '5Y': 20,
};

/** Total months each range spans (for axis labelling + CAGR math). */
const RANGE_MONTHS: Record<TimeRange, number> = {
  '1M': 1,
  '6M': 6,
  '1Y': 12,
  '3Y': 36,
  '5Y': 60,
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic 0…1 pseudo-noise from a seed — keeps mock charts stable. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'elevated';
  return 'high';
}

/**
 * Risk-adjusted value: discount the headline value by a fraction of the overall
 * risk score (max ~12% haircut at risk=100). This is the "what a careful buyer
 * should actually pay" number.
 */
export function calcRiskAdjustedValue(dnaValue: number, riskOverall: number): number {
  const haircut = (riskOverall / 100) * 0.12;
  return Math.round((dnaValue * (1 - haircut)) / 1000) * 1000;
}

/**
 * Confidence (0…100) blends comp depth, data freshness, and value dispersion.
 * Tighter value range + more comps + lower risk volatility ⇒ higher confidence.
 */
export function calcConfidence(opts: {
  compCount: number;
  valueRange: ValueRange;
  riskOverall: number;
}): number {
  const { compCount, valueRange, riskOverall } = opts;
  const dispersion = valueRange.mid > 0 ? (valueRange.high - valueRange.low) / valueRange.mid : 0.4;
  const compTerm = Math.min(1, compCount / 8) * 40;          // up to 40 pts
  const tightnessTerm = Math.max(0, 1 - dispersion * 2.5) * 40; // up to 40 pts
  const riskTerm = (1 - riskOverall / 100) * 20;             // up to 20 pts
  return Math.round(Math.max(35, Math.min(99, compTerm + tightnessTerm + riskTerm)));
}

/** Build a ± value range around a midpoint given a spread fraction. */
export function calcValueRange(mid: number, spread = 0.08): ValueRange {
  return {
    low: Math.round((mid * (1 - spread)) / 1000) * 1000,
    mid: Math.round(mid / 1000) * 1000,
    high: Math.round((mid * (1 + spread)) / 1000) * 1000,
  };
}

/**
 * Synthesize a value-history series for every time range, ending at `currentValue`
 * with an overall `annualGrowthPct`. Adds light, deterministic monthly texture.
 */
export function buildValueHistory(
  currentValue: number,
  annualGrowthPct: number,
  seed = 1,
): ValueSeries[] {
  return TIME_RANGES.map((range) => {
    const steps = RANGE_STEPS[range];
    const months = RANGE_MONTHS[range];
    const totalGrowth = (annualGrowthPct / 100) * (months / 12);
    const startValue = currentValue / (1 + totalGrowth);

    const points: SeriesPoint[] = [];
    const now = new Date();
    for (let i = 0; i < steps; i++) {
      const frac = i / (steps - 1);
      const base = startValue + (currentValue - startValue) * frac;
      const wobble = (noise(seed + i * 1.7 + months) - 0.5) * base * 0.012;
      const value = Math.round((base + wobble) / 100) * 100;
      const d = new Date(now);
      d.setMonth(d.getMonth() - Math.round((1 - frac) * months));
      points.push({
        t: range === '1M' ? `${i + 1}` : MONTH_LABELS[d.getMonth()] + (months >= 24 ? ` '${String(d.getFullYear()).slice(2)}` : ''),
        value,
        date: d.toISOString(),
      });
    }
    // Force the last point to exactly the current value.
    points[points.length - 1].value = currentValue;
    return { range, points };
  });
}

/** Pull a single range's series out of a value-history array. */
export function seriesForRange(history: ValueSeries[], range: TimeRange): SeriesPoint[] {
  return history.find((s) => s.range === range)?.points ?? [];
}

/**
 * Forward projection: three scenarios over a 5-year horizon, anchored to the
 * risk-adjusted value and modulated by neighborhood momentum.
 */
export function buildFutureScenarios(
  baseValue: number,
  expectedCagrPct: number,
  seed = 1,
): FutureValueScenario[] {
  const horizonYears = 5;
  const specs: { label: FutureValueScenario['label']; delta: number }[] = [
    { label: 'conservative', delta: -2.5 },
    { label: 'expected', delta: 0 },
    { label: 'optimistic', delta: 3.0 },
  ];

  return specs.map((spec, si) => {
    const cagr = Math.max(0, expectedCagrPct + spec.delta);
    const points: SeriesPoint[] = [];
    const thisYear = new Date().getFullYear();
    for (let y = 0; y <= horizonYears; y++) {
      const drift = (noise(seed + si * 5 + y) - 0.5) * 0.006;
      const value = Math.round((baseValue * Math.pow(1 + cagr / 100 + drift, y)) / 1000) * 1000;
      points.push({ t: `${thisYear + y}`, value, date: `${thisYear + y}-01-01` });
    }
    return {
      label: spec.label,
      projectedValue: points[points.length - 1].value,
      cagrPct: Math.round(cagr * 10) / 10,
      points,
    };
  });
}

/**
 * Build a neighborhood-style index series (indexed to 100 at start) for one range
 * given a percent change over that range.
 */
export function buildIndexSeries(range: TimeRange, changePct: number, seed = 1): ValueSeries {
  const steps = RANGE_STEPS[range];
  const months = RANGE_MONTHS[range];
  const end = 100 * (1 + changePct / 100);
  const points: SeriesPoint[] = [];
  const now = new Date();
  for (let i = 0; i < steps; i++) {
    const frac = i / (steps - 1);
    const base = 100 + (end - 100) * frac;
    const wobble = (noise(seed + i * 2.3 + months) - 0.5) * 1.1;
    const d = new Date(now);
    d.setMonth(d.getMonth() - Math.round((1 - frac) * months));
    points.push({
      t: range === '1M' ? `${i + 1}` : MONTH_LABELS[d.getMonth()] + (months >= 24 ? ` '${String(d.getFullYear()).slice(2)}` : ''),
      value: Math.round(base * 100) / 100,
      date: d.toISOString(),
    });
  }
  points[points.length - 1].value = Math.round(end * 100) / 100;
  return { range, points };
}

/** Build a downward-good risk-index trend (lower = safer). */
export function buildRiskTrend(currentRisk: number, seed = 1): SeriesPoint[] {
  const years = 6;
  const points: SeriesPoint[] = [];
  const thisYear = new Date().getFullYear();
  for (let i = 0; i < years; i++) {
    const frac = i / (years - 1);
    const start = currentRisk * 0.82;
    const base = start + (currentRisk - start) * frac;
    const wobble = (noise(seed + i * 3.1) - 0.5) * 4;
    points.push({
      t: `${thisYear - (years - 1) + i}`,
      value: Math.max(0, Math.round(base + wobble)),
    });
  }
  points[points.length - 1].value = currentRisk;
  return points;
}

/** Roll individual risk-factor scores up into an overall RiskProfile. */
export function buildRiskProfile(
  factors: RiskProfile['factors'],
  seed = 1,
): RiskProfile {
  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / Math.max(1, factors.length));
  return {
    overall,
    level: riskLevelFromScore(overall),
    factors,
    trend: buildRiskTrend(overall, seed),
  };
}

/** Net-gain + ROI helper for an improvement opportunity. */
export function calcOpportunity(cost: number, valueAdded: number): { netGain: number; roiPct: number } {
  const netGain = valueAdded - cost;
  const roiPct = cost > 0 ? Math.round((netGain / cost) * 100) : 0;
  return { netGain, roiPct };
}

// ── Display formatters (shared by every map component) ────────────────────────

/** Full currency, no cents: $1,485,000. */
export function fmtUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** Compact currency: $1.49M / $925K / $0. */
export function fmtCompactUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Signed percent: +9.4% / -1.2%. */
export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function fmtSqft(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US')} sq ft`;
}

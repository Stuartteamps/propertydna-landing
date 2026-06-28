// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — live-data normalization seam
//
// The ONE place where messy provider payloads (county CREST, ATTOM, MLS-IDX,
// permit feeds, risk APIs) become a clean PropertyDNAAsset. Components never see
// raw provider fields. To wire a real source, populate `RawPropertyInput` from the
// provider response and call `normalizePropertyData()`.
//
// Anything not supplied is synthesized by calculatePropertyDNA so the UI always
// has a complete asset to render.
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildFutureScenarios,
  buildIndexSeries,
  buildRiskProfile,
  buildValueHistory,
  calcConfidence,
  calcOpportunity,
  calcRiskAdjustedValue,
  calcValueRange,
  TIME_RANGES,
} from './calculatePropertyDNA';
import type {
  ComparableSale,
  HeatLayerId,
  ImprovementOpportunity,
  PermitRecord,
  PropertyDNAAsset,
  PropertyType,
  RiskFactor,
  SaleHistory,
  TimeRange,
} from './types';
import type { HeatParcel } from '@/types/heatmap';

/**
 * Loose, source-agnostic input. Every field is optional; only an address +
 * coordinates + a value are really needed to render something useful.
 *
 * Mapping hints for live wiring:
 *  - county CREST → apn, lat/lon, sqft, lotSqft, yearBuilt, zoning, lastSalePrice
 *  - ATTOM        → avm (value), valueRange, comparableSales
 *  - MLS-IDX      → listPrice, daysOnMarket, beds/baths, saleHistory
 *  - permit feed  → permits[], unpermittedAdditionFlag, aduPotential
 *  - risk API     → fire/flood/heat/insurance scores
 */
export interface RawPropertyInput {
  id?: string;
  apn?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  lng?: number;

  propertyType?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;

  /** AVM / model value, or list price as a fallback. */
  value?: number;
  avm?: number;
  listPrice?: number;
  valueLow?: number;
  valueHigh?: number;
  appreciationPct?: number;

  zoning?: string;
  lotCoveragePct?: number;
  aduPotential?: PropertyDNAAsset['aduPotential'];
  unpermittedAdditionFlag?: boolean;
  nextBestPermit?: string;

  // Risk scores (0 safe … 100 severe). Missing ⇒ defaulted.
  fireScore?: number;
  floodScore?: number;
  heatScore?: number;
  insuranceScore?: number;
  hoaScore?: number;
  permitScore?: number;

  neighborhood?: string;
  topInsight?: string;

  saleHistory?: Partial<SaleHistory>[];
  comparableSales?: Partial<ComparableSale>[];
  permits?: Partial<PermitRecord>[];
  opportunities?: Partial<ImprovementOpportunity>[];
}

const PROPERTY_TYPES: PropertyType[] = ['single_family', 'condo', 'townhouse', 'multifamily', 'land', 'commercial'];

function coercePropertyType(raw?: string): PropertyType {
  if (!raw) return 'single_family';
  const n = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const hit = PROPERTY_TYPES.find((t) => n.includes(t) || t.includes(n));
  if (hit) return hit;
  if (n.includes('condo')) return 'condo';
  if (n.includes('town')) return 'townhouse';
  if (n.includes('multi') || n.includes('duplex')) return 'multifamily';
  if (n.includes('land') || n.includes('lot')) return 'land';
  if (n.includes('comm') || n.includes('retail') || n.includes('office')) return 'commercial';
  return 'single_family';
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const RISK_LABELS: Record<RiskFactor['key'], string> = {
  fire: 'Wildfire',
  flood: 'Flood',
  heat: 'Extreme Heat',
  insurance: 'Insurance Cost',
  hoa: 'HOA Exposure',
  permit: 'Permit / Legal',
};

function levelFor(score: number): RiskFactor['level'] {
  return score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'elevated' : 'high';
}

export function normalizePropertyData(raw: RawPropertyInput, index = 0): PropertyDNAAsset {
  const seed = index + 1;
  const lon = num(raw.lon ?? raw.lng, -116.5388);
  const lat = num(raw.lat, 33.8255);
  const sqft = Math.max(1, num(raw.sqft, 1800));
  const value = Math.round(num(raw.value ?? raw.avm ?? raw.listPrice, 750000));
  const growthPct = num(raw.appreciationPct, 6.5);
  const pricePerSqft = Math.round(value / sqft);

  const valueRange =
    raw.valueLow != null && raw.valueHigh != null
      ? { low: num(raw.valueLow), mid: value, high: num(raw.valueHigh) }
      : calcValueRange(value, 0.08);

  // ── Risk ──
  const factors: RiskFactor[] = (
    [
      ['fire', num(raw.fireScore, 22)],
      ['flood', num(raw.floodScore, 16)],
      ['heat', num(raw.heatScore, 60)],
      ['insurance', num(raw.insuranceScore, 40)],
      ['hoa', num(raw.hoaScore, 6)],
      ['permit', num(raw.permitScore, 24)],
    ] as [RiskFactor['key'], number][]
  ).map(([key, score]) => ({
    key,
    label: RISK_LABELS[key],
    level: levelFor(score),
    score,
    detail: `${RISK_LABELS[key]} exposure is ${levelFor(score)} for this parcel.`,
  }));
  const riskProfile = buildRiskProfile(factors, seed);
  const riskAdjustedValue = calcRiskAdjustedValue(value, riskProfile.overall);

  // ── Comps ──
  const comparableSales: ComparableSale[] = (raw.comparableSales ?? []).map((c, i) => ({
    id: c.id ?? `${raw.id ?? 'p'}-comp-${i}`,
    address: c.address ?? 'Nearby comparable',
    distanceMi: num(c.distanceMi, 0.3 + i * 0.2),
    salePrice: num(c.salePrice, value),
    pricePerSqft: num(c.pricePerSqft, pricePerSqft),
    beds: num(c.beds, num(raw.beds, 3)),
    baths: num(c.baths, num(raw.baths, 2)),
    sqft: num(c.sqft, sqft),
    saleDate: c.saleDate ?? new Date(Date.now() - (60 + i * 40) * 86400000).toISOString(),
    domDays: num(c.domDays, 21),
  }));

  const confidenceScore = calcConfidence({
    compCount: comparableSales.length || 3,
    valueRange,
    riskOverall: riskProfile.overall,
  });

  // ── Sales ──
  const saleHistory: SaleHistory[] = (raw.saleHistory ?? []).map((s, i) => ({
    id: s.id ?? `${raw.id ?? 'p'}-sale-${i}`,
    date: s.date ?? new Date(Date.now() - (i + 1) * 365 * 86400000).toISOString(),
    price: num(s.price, value),
    pricePerSqft: num(s.pricePerSqft, Math.round(num(s.price, value) / sqft)),
    event: s.event ?? 'sale',
    source: s.source ?? 'county',
  }));

  // ── Permits ──
  const permits: PermitRecord[] = (raw.permits ?? []).map((p, i) => ({
    id: p.id ?? `${raw.id ?? 'p'}-permit-${i}`,
    date: p.date ?? new Date().toISOString(),
    type: p.type ?? 'Permit',
    description: p.description ?? '',
    value: num(p.value, 0),
    status: p.status ?? 'final',
    isAdu: p.isAdu,
    source: p.source ?? 'county',
  }));

  // ── Opportunities ──
  const opportunities: ImprovementOpportunity[] = (raw.opportunities ?? []).map((o, i) => {
    const cost = num(o.estimatedCost, 50000);
    const add = num(o.valueAdded, 80000);
    const { netGain, roiPct } = calcOpportunity(cost, add);
    return {
      id: o.id ?? `${raw.id ?? 'p'}-opp-${i}`,
      title: o.title ?? 'Improvement',
      description: o.description ?? '',
      estimatedCost: cost,
      valueAdded: add,
      netGain: o.netGain ?? netGain,
      roiPct: o.roiPct ?? roiPct,
      confidence: num(o.confidence, 0.7),
    };
  });

  // ── Index ──
  const changePct: Record<TimeRange, number> = {
    '1M': Math.round((growthPct / 12) * 10) / 10,
    '6M': Math.round((growthPct / 2) * 10) / 10,
    '1Y': growthPct,
    '3Y': Math.round(growthPct * 2.6 * 10) / 10,
    '5Y': Math.round(growthPct * 4.1 * 10) / 10,
  };
  const indexSeries = TIME_RANGES.map((r) => buildIndexSeries(r, changePct[r], seed + 7));

  const aduPotential = raw.aduPotential ?? 'possible';
  const heatValues: Record<HeatLayerId, number> = {
    'recent-sales': clamp01(saleHistory.length / 5),
    'price-per-sqft': clamp01(pricePerSqft / 950),
    'days-on-market': clamp01(0.5),
    appreciation: clamp01(growthPct / 12),
    'inventory-pressure': clamp01(0.5),
    'risk-score': clamp01(riskProfile.overall / 100),
    'permit-opportunity': clamp01(aduPotential === 'strong' ? 0.9 : aduPotential === 'possible' ? 0.55 : 0.2),
    'future-equity': clamp01(0.4 + changePct['5Y'] / 120),
  };

  return {
    id: raw.id ?? raw.apn ?? `asset-${index}`,
    address: raw.address ?? 'Unknown address',
    city: raw.city ?? '',
    state: raw.state ?? 'CA',
    zip: raw.zip ?? '',
    lat,
    lon,
    lng: lon,
    propertyType: coercePropertyType(raw.propertyType),
    beds: num(raw.beds, 3),
    baths: num(raw.baths, 2),
    sqft,
    lotSqft: num(raw.lotSqft, 8000),
    yearBuilt: num(raw.yearBuilt, 1975),

    dnaValue: value,
    riskAdjustedValue,
    confidenceScore,
    valueRange,
    pricePerSqft,

    neighborhoodTrendPct: growthPct,
    marketMomentum: {
      label: growthPct > 8 ? 'Accelerating' : growthPct > 4 ? 'Steady' : 'Cooling',
      score: Math.round((growthPct - 5) * 12),
      direction: growthPct > 6 ? 'up' : growthPct < 3 ? 'down' : 'flat',
    },
    topInsight: raw.topInsight ?? 'Tracked as an asset — value, risk, and upside in one view.',

    valueHistory: buildValueHistory(value, growthPct, seed),
    saleHistory,
    comparableSales,

    permits,
    unpermittedAdditionFlag: raw.unpermittedAdditionFlag ?? false,
    aduPotential,
    lotCoveragePct: num(raw.lotCoveragePct, 30),
    zoning: raw.zoning ?? '—',
    nextBestPermit: raw.nextBestPermit ?? 'Run a permit-feasibility check to surface the best next move.',

    riskProfile,
    opportunities,

    neighborhood: {
      name: raw.neighborhood ?? raw.city ?? 'Neighborhood',
      currentIndex: indexSeries[2].points[indexSeries[2].points.length - 1].value,
      cityIndex: 100 + growthPct * 0.82,
      zipIndex: 100 + growthPct * 1.04,
      series: indexSeries,
      changePct,
    },

    futureScenarios: buildFutureScenarios(riskAdjustedValue, Math.max(2.5, growthPct * 0.7), seed + 3),

    heatValues,
  };
}

/** Batch helper. */
export function normalizePropertyList(rows: RawPropertyInput[]): PropertyDNAAsset[] {
  return rows.map((r, i) => normalizePropertyData(r, i));
}

// ─────────────────────────────────────────────────────────────────────────────
// HeatParcel → PropertyDNAAsset
//
// Converts the scored parcel shape returned by get-heatmap-parcels (HeatParcel)
// into a full PropertyDNAAsset. Real sub-scores (compsScore, domScore, etc.)
// are mapped directly onto heatValues after the base normalization runs;
// synthesized fields (risk factors, ADU potential, opportunities) are derived
// via calculatePropertyDNA as usual.
// ─────────────────────────────────────────────────────────────────────────────

function synthesizeInsight(p: HeatParcel): string {
  if (p.score >= 80) return `Top-scored property in ${p.neighborhood} — strong fundamentals across all signals.`;
  if (p.permitsScore >= 75) return `Recent permit activity in ${p.neighborhood} — renovation premium likely.`;
  if (p.dom > 0 && p.dom < 20) return `Fast absorption (${p.dom} days) in ${p.neighborhood} — high demand signal.`;
  if (p.priceDeltaScore >= 70) return `Competitively priced vs. ${p.neighborhood} comps — potential value play.`;
  return `Tracked as an asset in ${p.neighborhood} — value, risk, and upside in one view.`;
}

/**
 * Convert a single HeatParcel (from get-heatmap-parcels) into a PropertyDNAAsset.
 *
 * Real fields:     id, address, city, state, zip, lat/lon, price, sqft,
 *                  bedrooms, bathrooms, yearBuilt, propertyType, dom,
 *                  score, confidence, compsScore, priceDeltaScore,
 *                  domScore, permitsScore, livability, sparkline
 *
 * Synthesized:     fireScore, floodScore, heatScore, insuranceScore,
 *                  hoaScore, aduPotential, saleHistory, comparableSales,
 *                  permits, opportunities, futureScenarios (via calculatePropertyDNA)
 */
export function normalizeHeatParcel(p: HeatParcel, index = 0): PropertyDNAAsset {
  // Derive annualized appreciation from the 30-day sparkline
  const sparkLen = p.sparkline.length;
  const sparkStart = sparkLen > 0 ? p.sparkline[0] : 100;
  const sparkEnd = sparkLen > 0 ? p.sparkline[sparkLen - 1] : 100;
  const appreciationPct =
    sparkStart > 0
      ? Math.min(15, Math.max(-3, ((sparkEnd - sparkStart) / sparkStart) * 100 * (365 / 30)))
      : 6.5;

  // ADU potential inferred from property type + size
  const aduPotential: PropertyDNAAsset['aduPotential'] =
    p.propertyType === 'single_family' && p.sqft > 2500
      ? 'strong'
      : p.propertyType === 'single_family' && p.sqft > 1400
        ? 'possible'
        : 'none';

  // Map to RawPropertyInput — zeros become undefined so normalizePropertyData
  // falls back to sensible defaults rather than dividing by zero.
  const raw: RawPropertyInput = {
    id: p.id,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    lat: p.lat,
    lon: p.lon,
    propertyType: p.propertyType === 'multi_family' ? 'multifamily' : p.propertyType,
    beds: p.bedrooms > 0 ? p.bedrooms : undefined,
    baths: p.bathrooms > 0 ? p.bathrooms : undefined,
    sqft: p.sqft > 0 ? p.sqft : undefined,
    yearBuilt: p.yearBuilt > 0 ? p.yearBuilt : undefined,
    value: p.price,
    appreciationPct,
    neighborhood: p.neighborhood,
    // Risk synthesis (0=safe…100=severe, inverted from HeatParcel's 0=bad…100=good)
    heatScore: 65,                                               // Desert / SW default
    fireScore: Math.max(10, Math.round(50 - p.livability * 0.25)),
    floodScore: 15,
    insuranceScore: 40,
    hoaScore: p.propertyType === 'condo' ? 55 : 5,
    permitScore: Math.max(5, Math.round(60 - p.permitsScore * 0.4)),
    aduPotential,
    topInsight: synthesizeInsight(p),
  };

  const asset = normalizePropertyData(raw, index);

  // Override confidenceScore with the real model confidence from HeatParcel
  const confidenceScore = Math.max(35, Math.min(99, Math.round(p.confidence * 100)));

  // Override heatValues with REAL HeatParcel sub-scores (replacing synthesized placeholders)
  const sparkTrend =
    sparkStart > 0
      ? Math.max(0, Math.min(1, ((sparkEnd - sparkStart) / sparkStart) * 12 + 0.5))
      : 0.5;

  return {
    ...asset,
    confidenceScore,
    heatValues: {
      'recent-sales':       Math.max(0, Math.min(1, p.dom > 0 ? 1 - p.dom / 90 : 0.5)),
      'price-per-sqft':     Math.max(0, Math.min(1, p.pricePerSqft > 0 ? p.pricePerSqft / 950 : 0.5)),
      'days-on-market':     Math.max(0, Math.min(1, p.domScore / 100)),
      appreciation:         sparkTrend,
      'inventory-pressure': Math.max(0, Math.min(1, p.priceDeltaScore / 100)),
      'risk-score':         Math.max(0, Math.min(1, (100 - p.score) / 100)),
      'permit-opportunity': Math.max(0, Math.min(1, p.permitsScore / 100)),
      'future-equity':      Math.max(0, Math.min(1, (p.score / 100) * 0.7 + sparkTrend * 0.3)),
    },
  };
}

/** Batch-normalize a HeatParcel[] into PropertyDNAAsset[]. */
export function normalizeHeatParcelList(parcels: HeatParcel[]): PropertyDNAAsset[] {
  return parcels.map((p, i) => normalizeHeatParcel(p, i));
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — core asset data model
//
// Every property on the premium map is treated as a FINANCIAL ASSET: it has a
// value, a value history, risk, permits, comparable "trades", and forward-looking
// equity scenarios. These interfaces are the single source of truth shared by the
// map, the bottom sheet, and the charts.
//
// The shape is intentionally source-agnostic. `normalizePropertyData.ts` maps raw
// county CREST / ATTOM / MLS-IDX / permit / risk payloads onto this model so the
// UI never depends on any one provider.
// ─────────────────────────────────────────────────────────────────────────────

/** Mapbox base-style selector shown as the Standard / Satellite / Hybrid toggle. */
export type MapStyleId = 'standard' | 'satellite' | 'hybrid';

/** The 8 selectable heat layers. */
export type HeatLayerId =
  | 'recent-sales'
  | 'price-per-sqft'
  | 'days-on-market'
  | 'appreciation'
  | 'inventory-pressure'
  | 'risk-score'
  | 'permit-opportunity'
  | 'future-equity';

/** Time windows used by every chart and the neighborhood index. */
export type TimeRange = '1M' | '6M' | '1Y' | '3Y' | '5Y';

export type PropertyType =
  | 'single_family'
  | 'condo'
  | 'townhouse'
  | 'multifamily'
  | 'land'
  | 'commercial';

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

/** A single point on any value / index / projection series. */
export interface SeriesPoint {
  /** Short axis label, e.g. "Jan", "2021", "Q3". */
  t: string;
  value: number;
  /** Optional ISO date for sorting / tooltips. */
  date?: string;
}

/** A value series bound to a time range (used by PropertyValueChart). */
export interface ValueSeries {
  range: TimeRange;
  points: SeriesPoint[];
}

export interface ValueRange {
  low: number;
  mid: number;
  high: number;
}

export interface MarketMomentum {
  /** Human label, e.g. "Accelerating", "Cooling". */
  label: string;
  /** -100 … 100, signed momentum. */
  score: number;
  direction: 'up' | 'down' | 'flat';
}

/** One recorded sale / listing / price-change event. */
export interface SaleHistory {
  id: string;
  date: string;        // ISO
  price: number;
  pricePerSqft: number;
  event: 'sale' | 'listing' | 'price_change' | 'pending';
  /** Provenance: 'county' | 'mls' | 'attom' | 'estimate'. */
  source: string;
}

/** A nearby closed comparable — the "trades" tape for a property. */
export interface ComparableSale {
  id: string;
  address: string;
  distanceMi: number;
  salePrice: number;
  pricePerSqft: number;
  beds: number;
  baths: number;
  sqft: number;
  saleDate: string;    // ISO
  domDays: number;
}

/** A single permit on file. */
export interface PermitRecord {
  id: string;
  date: string;        // ISO
  type: string;        // e.g. "Re-roof", "Pool", "ADU"
  description: string;
  value: number;       // declared valuation
  status: 'final' | 'active' | 'expired' | 'pending';
  isAdu?: boolean;
  source: string;
}

export interface RiskFactor {
  key: 'fire' | 'flood' | 'heat' | 'insurance' | 'hoa' | 'permit';
  label: string;
  level: RiskLevel;
  /** 0 (safe) … 100 (severe). */
  score: number;
  detail: string;
}

export interface RiskProfile {
  /** Blended 0 (safe) … 100 (severe). */
  overall: number;
  level: RiskLevel;
  factors: RiskFactor[];
  /** Risk-index trend over the last several years (lower is better). */
  trend: SeriesPoint[];
}

/** A concrete "find hidden equity" opportunity. */
export interface ImprovementOpportunity {
  id: string;
  title: string;
  description: string;
  estimatedCost: number;
  valueAdded: number;
  netGain: number;     // valueAdded - estimatedCost
  /** ROI as a percentage of cost. */
  roiPct: number;
  /** 0 … 1 model confidence. */
  confidence: number;
}

export interface NeighborhoodIndex {
  name: string;
  /** Indexed to 100 at series start. */
  currentIndex: number;
  cityIndex: number;
  zipIndex: number;
  /** One series per time range, each indexed to 100 at its start. */
  series: ValueSeries[];
  /** Percent change for each range. */
  changePct: Record<TimeRange, number>;
}

export interface FutureValueScenario {
  label: 'conservative' | 'expected' | 'optimistic';
  /** Projected value at the end of the horizon. */
  projectedValue: number;
  /** Compound annual growth rate, percent. */
  cagrPct: number;
  points: SeriesPoint[];
}

/** The full asset. */
export interface PropertyDNAAsset {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  /** Alias for `lon` (Mapbox `lngLat` ergonomics). */
  lng: number;

  propertyType: PropertyType;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;

  // ── Valuation (the "position") ──────────────────────────────────────────────
  dnaValue: number;
  riskAdjustedValue: number;
  /** 0 … 100. */
  confidenceScore: number;
  valueRange: ValueRange;
  pricePerSqft: number;

  // ── Overview ────────────────────────────────────────────────────────────────
  neighborhoodTrendPct: number;
  marketMomentum: MarketMomentum;
  topInsight: string;

  // ── History & comps ─────────────────────────────────────────────────────────
  valueHistory: ValueSeries[];
  saleHistory: SaleHistory[];
  comparableSales: ComparableSale[];

  // ── Permits & zoning ────────────────────────────────────────────────────────
  permits: PermitRecord[];
  unpermittedAdditionFlag: boolean;
  aduPotential: 'none' | 'possible' | 'strong';
  lotCoveragePct: number;
  zoning: string;
  nextBestPermit: string;

  // ── Risk ────────────────────────────────────────────────────────────────────
  riskProfile: RiskProfile;

  // ── Upside ──────────────────────────────────────────────────────────────────
  opportunities: ImprovementOpportunity[];

  // ── Index ───────────────────────────────────────────────────────────────────
  neighborhood: NeighborhoodIndex;

  // ── Future ──────────────────────────────────────────────────────────────────
  futureScenarios: FutureValueScenario[];

  /** Per-heat-layer intensity, 0 … 1. Drives pin tint + sheet badges. */
  heatValues: Record<HeatLayerId, number>;
}

/** A scattered heat grid sample (decoupled from pins) for the heat overlay. */
export interface HeatPoint {
  lat: number;
  lon: number;
  values: Record<HeatLayerId, number>;
}

/** A single moving-average overlay returned by get-value-series. */
export interface MovingAverage {
  /** Trailing window in days (e.g. 90, 365). */
  windowDays: number;
  /** Human legend label, e.g. "90-Day Avg". */
  label: string;
  points: SeriesPoint[];
}

/** One row in the market-ticker strip (neighborhood / city / metro momentum). */
export interface TickerEntry {
  key: string;
  label: string;
  /** Latest median value for the geo (USD). */
  value: number | null;
  /** % change for the geo's index. */
  changePct: number;
  dir: 'up' | 'down' | 'flat';
}

/**
 * Response from the get-value-series Netlify function — a REAL value/index
 * time-series + computed moving averages + ticker momentum for a geo.
 */
export interface ValueSeriesResponse {
  ok: boolean;
  /** 'market_ticker' | 'sales' | 'assessments' | 'empty' | 'error'. */
  source: string;
  geo_key: string | null;
  geo_type: 'zip' | 'city';
  city: string;
  state: string;
  sampleSize: number;
  /** Reference value for the dashed baseline (period-start). */
  baseline: number | null;
  /** % change start → end of the series. */
  changePct: number;
  series: SeriesPoint[];
  movingAverages: { short: MovingAverage | null; long: MovingAverage | null };
  ticker: TickerEntry[];
}

/** Display config for one heat layer. */
export interface MapLayerConfig {
  id: HeatLayerId;
  label: string;
  shortLabel: string;
  description: string;
  /** Empowerment-framed one-liner shown in the controls. */
  blurb: string;
  /** Low → high color ramp (hex). */
  colorStops: [string, string, string];
}

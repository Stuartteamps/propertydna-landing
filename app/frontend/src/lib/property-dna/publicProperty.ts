// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Public Property view-model
//
// The single client-side shape the public `/property/:slug` page renders, plus
// the slug helpers and the fetch contract against the `public-property` Netlify
// function. All heavy logic (scores, explainable valuation) lives in TS libs and
// runs here, so the function stays a thin, cache-friendly data fetcher.
//
// Golden rule: never fabricate. Missing inputs surface as `null` / empty arrays
// and set `insufficientData = true`, which drives a `noindex` + "Data unavailable"
// treatment on the page.
// ─────────────────────────────────────────────────────────────────────────────
import type { PropertyScores } from './scores';
import type { ValuationExplanation } from './valuationExplanation';
import { SITE_ORIGIN } from '@/lib/seo/head';

// Empty valuation shell for thin parcel bundles that carry no report_data.
// The numbers themselves are NEVER computed on the client — they arrive
// pre-computed in the bundle from the canonical engine (netlify/functions/
// _intelligence.js), so the page can never disagree with the developer API.
const EMPTY_VALUATION: ValuationExplanation = {
  estimatedValue: null,
  lowRange: null,
  highRange: null,
  confidenceScore: null,
  keyDrivers: [],
  positiveAdjustments: [],
  negativeAdjustments: [],
  comparableSalesUsed: [],
  dataLimitations: ['No report data is available for this address yet.'],
  lastUpdated: null,
  method: null,
};

// ── Slug helpers ─────────────────────────────────────────────────────────────
// "50220 Via Puente, La Quinta, CA 92253" → "50220-via-puente-la-quinta-ca-92253"
export function slugifyAddress(address: string): string {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
}

export function propertyUrl(slug: string): string {
  return `${SITE_ORIGIN}/property/${slug}`;
}

// ── DTO returned by the public-property Netlify function ─────────────────────
export interface PublicPropertyBundle {
  ok: boolean;
  slug: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  apn: string | null;
  lat: number | null;
  lon: number | null;
  /** Raw report_data (dna) — same shape ReportView consumes. May be partial. */
  report_data: any | null;
  /** Proprietary scores computed server-side by the canonical engine. */
  scores: PropertyScores | null;
  /** Explainable valuation computed server-side by the canonical engine. */
  valuation: ValuationExplanation | null;
  status: string | null;
  lastUpdated: string | null;
  isPublic: boolean;
  /** 'report' | 'parcel' — where the data came from. */
  source: string | null;
  error?: string;
}

// ── Rich view-model the page renders ─────────────────────────────────────────
export interface DataSourceGroup {
  category: 'Public record' | 'Licensed data' | 'User-provided' | 'PropertyDNA analysis';
  sources: string[];
}

export interface PublicProperty {
  slug: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  apn: string | null;
  lat: number | null;
  lon: number | null;

  // Vitals
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string | null;

  // Valuation
  estimatedValue: number | null;
  lowRange: number | null;
  highRange: number | null;
  confidenceScore: number | null;
  pricePerSqft: number | null;
  areaPricePerSqft: number | null;

  // Intelligence
  dnaScore: number | null;
  dnaGrade: string | null;
  scores: PropertyScores | null;
  valuation: ValuationExplanation;

  neighborhoodTrendPct: number | null;
  marketDirection: string | null;

  buyerPros: string[];
  buyerCons: string[];
  sellerGuidance: string | null;
  riskFactors: { label: string; detail: string; level?: string }[];

  dataSources: DataSourceGroup[];
  lastUpdated: string | null;

  /** True when there is not enough real data to publish a rich, indexable page. */
  insufficientData: boolean;
}

const numOf = (v: unknown): number | null => {
  if (v == null || v === '' || v === '—') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Fetch the public bundle for a slug from the Netlify function. */
export async function fetchPublicProperty(slug: string): Promise<PublicPropertyBundle> {
  const res = await fetch(`/api/property/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to load property (${res.status})`);
  }
  const data = (await res.json()) as PublicPropertyBundle;
  return data;
}

/** Build the rich view-model from a bundle. Pure — safe to unit-test. */
export function buildPublicProperty(bundle: PublicPropertyBundle): PublicProperty {
  const dna = bundle.report_data ?? {};
  const n = dna?.normalized ?? {};
  const sub = n.subject ?? {};
  const prop = n.property ?? {};
  const val = n.valuation ?? {};
  const demo = n.demographics ?? {};
  const flood = n.flood ?? {};
  const enr = dna?.enrichment ?? {};
  const hazE = enr?.hazardEnrichment ?? {};

  // Numbers are authoritative from the server engine — the page renders them,
  // it does not recompute. This is what keeps the page and the /api/v1 developer
  // endpoints byte-for-byte in sync.
  const valuation = bundle.valuation ?? EMPTY_VALUATION;
  const scores = bundle.scores ?? null;

  const sqft = numOf(sub.sqft ?? prop.sqft);
  const estimatedValue = valuation.estimatedValue;
  const pricePerSqft = estimatedValue && sqft ? Math.round(estimatedValue / sqft) : null;
  const areaPricePerSqft = numOf(enr?.marketData?.medianPricePerSqft) ?? numOf(demo.medianPricePerSqft);

  const dnaScore = scores?.propertyDnaScore.available ? scores.propertyDnaScore.score : null;
  const dnaGrade = scores?.propertyDnaScore.available ? scores.propertyDnaScore.label : null;

  // Buyer pros / cons — pulled from engine signals, never invented.
  const buyerPros: string[] = [];
  const buyerCons: string[] = [];
  if (Array.isArray(dna?.buyerPros)) buyerPros.push(...dna.buyerPros.map(String));
  if (Array.isArray(dna?.buyerCons)) buyerCons.push(...dna.buyerCons.map(String));
  if (!buyerPros.length) {
    if (scores?.buyerConfidenceScore.available && scores.buyerConfidenceScore.score >= 60) buyerPros.push('Valuation is well-supported by comparable sales.');
    if (scores?.luxuryScore.available && scores.luxuryScore.score >= 70) buyerPros.push('Sits in the luxury tier for its market.');
    if (scores?.climateResilienceScore.available && scores.climateResilienceScore.score >= 70) buyerPros.push('Low climate-hazard exposure.');
    if (numOf(sub.lastSalePrice)) buyerPros.push('Clear recorded sale history to anchor value.');
  }
  if (!buyerCons.length) {
    if (scores?.hiddenRiskScore.available && scores.hiddenRiskScore.score >= 55) buyerCons.push('Elevated hidden-risk exposure — review hazards closely.');
    if (scores?.insuranceDifficultyScore.available && scores.insuranceDifficultyScore.score >= 55) buyerCons.push('Likely harder-than-average to insure.');
    if (valuation.confidenceScore != null && valuation.confidenceScore < 50) buyerCons.push('Valuation confidence is limited by available data.');
  }

  const sellerGuidance =
    dna?.sellerAngle ||
    dna?.sellerNarrative ||
    (scores?.sellerTimingScore.available
      ? `${scores.sellerTimingScore.label}. ${scores.sellerTimingScore.explanation}`
      : null);

  // Risk factors from normalized hazards.
  const riskFactors: PublicProperty['riskFactors'] = [];
  if (flood.zone && flood.zone !== '—') {
    riskFactors.push({
      label: 'FEMA flood zone',
      detail: `Zone ${flood.zone}${flood.highRisk ? ' — Special Flood Hazard Area' : ''}`,
      level: flood.highRisk ? 'high' : 'low',
    });
  }
  if (hazE?.seismic?.seismicRiskLevel) riskFactors.push({ label: 'Seismic risk', detail: `USGS: ${hazE.seismic.seismicRiskLevel}` });
  const wildfire = hazE?.wildfire?.severity ?? n.wildfire?.severity;
  if (wildfire) riskFactors.push({ label: 'Wildfire severity', detail: String(wildfire) });
  if (hazE?.airQuality?.aqi != null) riskFactors.push({ label: 'Air quality', detail: `AQI ${hazE.airQuality.aqi}${hazE.airQuality.aqiCategory ? ` (${hazE.airQuality.aqiCategory})` : ''}` });

  // Data-source transparency, grouped by provenance.
  const dataSources = buildDataSources(dna, bundle);

  const neighborhoodTrendPct = numOf(dna?.neighborhoodTrendPct) ?? numOf(enr?.marketData?.appreciation1yr);
  const marketDirection =
    enr?.marketData?.direction ||
    (neighborhoodTrendPct != null ? (neighborhoodTrendPct > 1 ? 'Appreciating' : neighborhoodTrendPct < -1 ? 'Cooling' : 'Stable') : null);

  const insufficientData =
    bundle.status === 'insufficient_data' ||
    bundle.status === 'failed' ||
    (estimatedValue == null && (Array.isArray(n.comps) ? n.comps.length : 0) === 0);

  return {
    slug: bundle.slug,
    address: bundle.address || sub.matchedAddress || sub.address || '',
    city: bundle.city ?? sub.city ?? prop.city ?? null,
    state: bundle.state ?? sub.state ?? prop.state ?? null,
    zip: bundle.zip ?? sub.zip ?? prop.zip ?? null,
    apn: bundle.apn ?? sub.apn ?? prop.apn ?? null,
    lat: bundle.lat ?? numOf(sub.lat),
    lon: bundle.lon ?? numOf(sub.lon),

    beds: numOf(sub.beds ?? prop.beds),
    baths: numOf(sub.baths ?? prop.baths),
    sqft,
    lotSqft: numOf(prop.lotSize ?? prop.lotSqft),
    yearBuilt: numOf(sub.yearBuilt ?? prop.yearBuilt),
    propertyType: prop.propertyType ?? sub.propertyType ?? null,

    estimatedValue,
    lowRange: valuation.lowRange,
    highRange: valuation.highRange,
    confidenceScore: valuation.confidenceScore,
    pricePerSqft,
    areaPricePerSqft,

    dnaScore,
    dnaGrade,
    scores,
    valuation,

    neighborhoodTrendPct,
    marketDirection,

    buyerPros: buyerPros.slice(0, 6),
    buyerCons: buyerCons.slice(0, 6),
    sellerGuidance: sellerGuidance ? String(sellerGuidance) : null,
    riskFactors,

    dataSources,
    lastUpdated: bundle.lastUpdated,

    insufficientData,
  };
}

function buildDataSources(dna: any, bundle: PublicPropertyBundle): DataSourceGroup[] {
  const n = dna?.normalized ?? {};
  const enr = dna?.enrichment ?? {};
  const publicRec: string[] = [];
  const licensed: string[] = [];
  const user: string[] = [];
  const analysis: string[] = ['PropertyDNA proprietary scoring & valuation adjustment'];

  if (bundle.apn || n.subject?.apn) publicRec.push('County assessor parcel record');
  if (n.subject?.lastSalePrice || n.sale?.lastSalePrice) publicRec.push('Recorded deed / sale history');
  if (n.flood?.zone && n.flood.zone !== '—') publicRec.push('FEMA National Flood Hazard Layer');
  if (enr?.hazardEnrichment?.seismic) publicRec.push('USGS seismic hazard data');
  if (enr?.hazardEnrichment?.airQuality) publicRec.push('EPA / AirNow air-quality data');
  if (n.demographics?.medianIncome || n.demographics?.population) publicRec.push('U.S. Census ACS demographics');

  if (Array.isArray(n.comps) && n.comps.length) licensed.push('MLS-derived comparable sales (where licensed)');
  if (enr?.marketData) licensed.push('Local market statistics feed');
  if (n.valuation?.valuationSource) licensed.push(`Automated valuation model (${String(n.valuation.valuationSource).replace(/_/g, ' ')})`);

  const groups: DataSourceGroup[] = [];
  if (publicRec.length) groups.push({ category: 'Public record', sources: dedupe(publicRec) });
  if (licensed.length) groups.push({ category: 'Licensed data', sources: dedupe(licensed) });
  if (user.length) groups.push({ category: 'User-provided', sources: dedupe(user) });
  groups.push({ category: 'PropertyDNA analysis', sources: analysis });
  return groups;
}

function dedupe(a: string[]): string[] {
  return Array.from(new Set(a.filter(Boolean)));
}

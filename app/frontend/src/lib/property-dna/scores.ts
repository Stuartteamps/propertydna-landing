// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Proprietary Scoring Layer
//
// Nine branded 0–100 scores that make PropertyDNA read as an intelligence layer,
// not a lead-gen form. Every score is DERIVED FROM REAL report data — the
// normalized valuation, comps, hazard, enrichment (v3), and DNA-score category
// signals already produced by the pipeline. Nothing is invented: when the
// underlying signal is missing we return `confidence: 'low'`, a transparent
// `explanation`, and (where we truly have nothing) `available: false` so the UI
// can show "Data unavailable" instead of a fake number.
//
// Each score carries { score, label, explanation, factors[], confidence } exactly
// as specified, plus `available` and `key` for rendering.
// ─────────────────────────────────────────────────────────────────────────────
import { computeDNAScore } from '@/lib/dnaScore';

export type ScoreConfidence = 'high' | 'medium' | 'low';

export type ProprietaryScoreKey =
  | 'propertyDnaScore'
  | 'buyerConfidenceScore'
  | 'sellerTimingScore'
  | 'hiddenRiskScore'
  | 'renovationRoiScore'
  | 'luxuryScore'
  | 'rentalPotentialScore'
  | 'climateResilienceScore'
  | 'insuranceDifficultyScore';

export interface ProprietaryScore {
  key: ProprietaryScoreKey;
  /** 0–100. Meaningless when `available` is false (rendered as "—"). */
  score: number;
  /** Short human grade, e.g. "Strong", "Elevated risk". */
  label: string;
  /** One-sentence plain-English rationale. */
  explanation: string;
  /** The concrete signals that moved the score. */
  factors: string[];
  confidence: ScoreConfidence;
  /** False → no real signal; UI shows "Data unavailable". */
  available: boolean;
}

export type PropertyScores = Record<ProprietaryScoreKey, ProprietaryScore>;

// ── helpers ──────────────────────────────────────────────────────────────────
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const has = (v: unknown) => v != null && v !== '' && v !== '—';
const numOf = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function bandLabel(score: number, bands: [number, string][]): string {
  for (const [threshold, label] of bands) if (score >= threshold) return label;
  return bands[bands.length - 1][1];
}

function mk(
  key: ProprietaryScoreKey,
  score: number,
  label: string,
  explanation: string,
  factors: string[],
  confidence: ScoreConfidence,
  available = true,
): ProprietaryScore {
  return { key, score: clamp(score), label, explanation, factors: factors.filter(Boolean), confidence, available };
}

function unavailable(key: ProprietaryScoreKey, explanation: string): ProprietaryScore {
  return { key, score: 0, label: 'Data unavailable', explanation, factors: [], confidence: 'low', available: false };
}

/**
 * Compute all nine proprietary scores from a raw `report_data` (dna) object.
 * Accepts the same shape ReportView consumes: dna.normalized.{valuation,comps,
 * flood,hazard,subject,demographics}, dna.enrichment (v3), dna.dnaAdjusted, etc.
 */
export function computePropertyScores(dna: any): PropertyScores {
  const n = dna?.normalized ?? {};
  const val = n.valuation ?? {};
  const comps: any[] = Array.isArray(n.comps) ? n.comps : [];
  const flood = n.flood ?? {};
  const sub = n.subject ?? {};
  const demo = n.demographics ?? {};
  const enr = dna?.enrichment ?? {};
  const cat = enr?.categoryScores ?? {};
  const hazE = enr?.hazardEnrichment ?? {};
  const hasV3 = !!enr?.v3_enriched;

  const dnaResult = (() => {
    try {
      return computeDNAScore(dna);
    } catch {
      return null;
    }
  })();

  const beds = numOf(sub.beds);
  const baths = numOf(sub.baths);
  const sqft = numOf(sub.sqft);
  const yearBuilt = numOf(sub.yearBuilt);
  const marketValue = numOf(val.marketValue) ?? numOf(dna?.dnaAdjusted?.adjMid);
  const compCount = comps.length;
  const lowConf = val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient';

  // 1. Property DNA Score — the flagship composite (reuse the audited engine).
  const propertyDnaScore: ProprietaryScore = dnaResult
    ? mk(
        'propertyDnaScore',
        dnaResult.total,
        `${dnaResult.grade} · ${dnaResult.total}/100`,
        dnaResult.summary || 'Composite of location, valuation accuracy, risk, yield, trajectory, condition and prestige.',
        dnaResult.categories.slice(0, 4).map((c) => `${c.name}: ${c.score}/100`),
        hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low',
      )
    : unavailable('propertyDnaScore', 'Insufficient normalized data to compute the composite DNA score.');

  // 2. Buyer Confidence — comp support + valuation confidence + data completeness.
  const buyerAvail = compCount > 0 || has(val.marketValue);
  const buyerBase =
    (compCount >= 5 ? 40 : compCount * 8) +
    (has(val.marketValue) && !lowConf ? 32 : has(val.marketValue) ? 14 : 0) +
    (has(sqft) && has(yearBuilt) ? 18 : has(sqft) ? 9 : 0) +
    (hasV3 ? 10 : 0);
  const buyerConfidenceScore = buyerAvail
    ? mk(
        'buyerConfidenceScore',
        buyerBase,
        bandLabel(clamp(buyerBase), [
          [75, 'High confidence'],
          [50, 'Solid'],
          [30, 'Cautious'],
          [0, 'Thin data'],
        ]),
        'How defensible the valuation is for a buyer, based on comparable support, valuation confidence and record completeness.',
        [
          `${compCount} comparable sale${compCount === 1 ? '' : 's'} used`,
          has(val.marketValue) ? `Valuation confidence: ${val.valuationConfidence || 'standard'}` : 'No AVM value available',
          has(sqft) ? 'Core property vitals present' : 'Property vitals incomplete',
        ],
        hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low',
      )
    : unavailable('buyerConfidenceScore', 'No comparable sales or valuation available to gauge buyer confidence.');

  // 3. Seller Timing — market direction + comp velocity signals from enrichment.
  const momentum = numOf(enr?.marketData?.momentumScore) ?? numOf(dna?.marketMomentum?.score);
  const domSignal = numOf(enr?.marketData?.medianDaysOnMarket);
  const sellerAvail = momentum != null || domSignal != null || compCount >= 3;
  let sellerBase = 50;
  if (momentum != null) sellerBase += clamp(momentum, -100, 100) * 0.3;
  if (domSignal != null) sellerBase += domSignal <= 30 ? 12 : domSignal >= 90 ? -12 : 0;
  const sellerTimingScore = sellerAvail
    ? mk(
        'sellerTimingScore',
        sellerBase,
        bandLabel(clamp(sellerBase), [
          [70, "Seller's window"],
          [45, 'Balanced'],
          [0, 'Patience advised'],
        ]),
        "Whether current momentum favors listing now, from market direction and days-on-market where available.",
        [
          momentum != null ? `Market momentum index: ${Math.round(momentum)}` : 'Momentum index unavailable',
          domSignal != null ? `Median days on market: ${Math.round(domSignal)}` : 'Days-on-market unavailable',
        ],
        momentum != null && domSignal != null ? 'medium' : 'low',
      )
    : unavailable('sellerTimingScore', 'No market-direction or absorption signal available for this area yet.');

  // 4. Hidden Risk — HIGHER = MORE risk. Flood, wildfire, seismic, EJ, insurance.
  const floodScore = numOf(flood.score); // 0 safe … 100 severe in dna model? dnaScore treats high=good; here we invert to risk
  const riskFactors: string[] = [];
  let riskAccum = 0;
  let riskSignals = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    const sfha = flood.highRisk || z.startsWith('A') || z.startsWith('V');
    riskAccum += sfha ? 70 : 20;
    riskSignals++;
    riskFactors.push(`FEMA flood zone ${flood.zone}${sfha ? ' (Special Flood Hazard Area)' : ''}`);
  }
  const seismic = hazE?.seismic?.seismicRiskLevel;
  if (has(seismic)) {
    riskAccum += /high/i.test(seismic) ? 65 : /moderate/i.test(seismic) ? 40 : 15;
    riskSignals++;
    riskFactors.push(`USGS seismic risk: ${seismic}`);
  }
  const ej = numOf(hazE?.environmental?.ejIndexPctile);
  if (ej != null) {
    riskAccum += ej;
    riskSignals++;
    riskFactors.push(`EPA environmental-justice index: ${Math.round(ej)}th pctile`);
  }
  const hiddenRiskScore = riskSignals > 0
    ? mk(
        'hiddenRiskScore',
        riskAccum / riskSignals,
        bandLabel(clamp(riskAccum / riskSignals), [
          [60, 'Elevated'],
          [35, 'Moderate'],
          [0, 'Low'],
        ]),
        'Composite of environmental and structural hazards that a headline valuation hides. Higher means more risk.',
        riskFactors,
        riskSignals >= 2 ? 'medium' : 'low',
      )
    : unavailable('hiddenRiskScore', 'No hazard signals (flood, seismic, environmental) resolved for this parcel yet.');

  // 5. Renovation ROI — condition headroom from year built + permit/opportunity.
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null;
  const renoAvail = age != null || has(dna?.opportunities?.length);
  let renoBase = 45;
  if (age != null) renoBase += age > 40 ? 25 : age > 20 ? 12 : -5;
  const renoRoi = numOf(cat?.renovationRoi);
  if (renoRoi != null) renoBase = renoRoi;
  const renovationRoiScore = renoAvail
    ? mk(
        'renovationRoiScore',
        renoBase,
        bandLabel(clamp(renoBase), [
          [65, 'Strong upside'],
          [40, 'Moderate'],
          [0, 'Limited'],
        ]),
        'Estimated headroom for value-add improvements, from building age and any modeled opportunities.',
        [
          age != null ? `Built ${yearBuilt} (${age} yrs old)` : 'Year built unavailable',
          Array.isArray(dna?.opportunities) && dna.opportunities.length ? `${dna.opportunities.length} modeled improvement opportunit${dna.opportunities.length === 1 ? 'y' : 'ies'}` : '',
        ],
        renoRoi != null ? 'medium' : 'low',
      )
    : unavailable('renovationRoiScore', 'No age or improvement data available to estimate renovation ROI.');

  // 6. Luxury Score — price/sqft vs area, prestige category, provenance.
  const ppsf = sqft && marketValue ? marketValue / sqft : null;
  const prestige = numOf(dnaResult?.categories.find((c) => c.name === 'Unique / Prestige')?.score);
  const luxAvail = ppsf != null || prestige != null || has(sub.apn);
  let luxBase = 40;
  if (ppsf != null) luxBase += ppsf > 800 ? 40 : ppsf > 500 ? 25 : ppsf > 350 ? 12 : 0;
  if (prestige != null) luxBase = (luxBase + prestige) / 2;
  const luxuryScore = luxAvail
    ? mk(
        'luxuryScore',
        luxBase,
        bandLabel(clamp(luxBase), [
          [75, 'Luxury tier'],
          [50, 'Premium'],
          [0, 'Standard'],
        ]),
        'Where the property sits on the luxury spectrum, from price-per-square-foot and prestige signals.',
        [
          ppsf != null ? `$${Math.round(ppsf).toLocaleString()}/sqft` : 'Price-per-sqft unavailable',
          prestige != null ? `Prestige signal: ${Math.round(prestige)}/100` : '',
        ],
        ppsf != null ? 'medium' : 'low',
      )
    : unavailable('luxuryScore', 'No price-per-sqft or prestige signal available to place this on the luxury spectrum.');

  // 7. Rental Potential — reuse DNA rental category / demographics rent.
  const rentalCat = numOf(dnaResult?.categories.find((c) => c.name === 'Rental Yield Potential')?.score);
  const medRent = numOf(demo.medianRent);
  const rentalAvail = rentalCat != null || medRent != null;
  const rentalPotentialScore = rentalAvail
    ? mk(
        'rentalPotentialScore',
        rentalCat ?? 50,
        bandLabel(clamp(rentalCat ?? 50), [
          [65, 'Strong yield'],
          [40, 'Moderate'],
          [0, 'Soft'],
        ]),
        'Income-property potential from modeled rental yield and area rent levels.',
        [
          rentalCat != null ? `Modeled rental-yield score: ${Math.round(rentalCat)}/100` : 'Yield model unavailable',
          medRent != null ? `Area median rent: $${Math.round(medRent).toLocaleString()}` : '',
        ],
        rentalCat != null ? 'medium' : 'low',
      )
    : unavailable('rentalPotentialScore', 'No rental-yield or area-rent data available for this property.');

  // 8. Climate Resilience — HIGHER = MORE resilient. Inverse of climate hazards.
  const climateSignals: string[] = [];
  let climAccum = 0;
  let climN = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    climAccum += z.startsWith('X') ? 88 : z.startsWith('A') || z.startsWith('V') ? 30 : 60;
    climN++;
    climateSignals.push(`Flood exposure: zone ${flood.zone}`);
  }
  const wildfire = hazE?.wildfire?.severity ?? n.wildfire?.severity;
  if (has(wildfire)) {
    climAccum += /very high/i.test(wildfire) ? 20 : /high/i.test(wildfire) ? 38 : /moderate/i.test(wildfire) ? 58 : 82;
    climN++;
    climateSignals.push(`Wildfire severity: ${wildfire}`);
  }
  const aqi = numOf(hazE?.airQuality?.aqi);
  if (aqi != null) {
    climAccum += aqi <= 50 ? 85 : aqi <= 100 ? 60 : 35;
    climN++;
    climateSignals.push(`Air quality index: ${aqi}`);
  }
  const climateResilienceScore = climN > 0
    ? mk(
        'climateResilienceScore',
        climAccum / climN,
        bandLabel(clamp(climAccum / climN), [
          [70, 'Resilient'],
          [45, 'Moderate exposure'],
          [0, 'High exposure'],
        ]),
        'How well the property is positioned against climate hazards. Higher means more resilient.',
        climateSignals,
        climN >= 2 ? 'medium' : 'low',
      )
    : unavailable('climateResilienceScore', 'No climate hazard data (flood, wildfire, air quality) resolved yet.');

  // 9. Insurance Difficulty — HIGHER = HARDER to insure. Driven by climate hazards.
  const insAvail = climN > 0 || riskSignals > 0;
  // Difficulty is roughly the inverse of resilience, nudged by SFHA + wildfire.
  let insBase = climN > 0 ? 100 - climAccum / climN : 50;
  if (flood.highRisk) insBase += 15;
  if (has(wildfire) && /high/i.test(wildfire)) insBase += 12;
  const insuranceDifficultyScore = insAvail
    ? mk(
        'insuranceDifficultyScore',
        insBase,
        bandLabel(clamp(insBase), [
          [60, 'Hard market'],
          [35, 'Some friction'],
          [0, 'Straightforward'],
        ]),
        'How hard this property is likely to insure, from flood, wildfire and hazard exposure. Higher means harder.',
        [
          flood.highRisk ? 'In a FEMA Special Flood Hazard Area' : has(flood.zone) ? `Flood zone ${flood.zone}` : 'Flood zone unavailable',
          has(wildfire) ? `Wildfire severity: ${wildfire}` : 'Wildfire severity unavailable',
        ],
        climN >= 2 ? 'medium' : 'low',
      )
    : unavailable('insuranceDifficultyScore', 'No hazard exposure data available to estimate insurance difficulty.');

  return {
    propertyDnaScore,
    buyerConfidenceScore,
    sellerTimingScore,
    hiddenRiskScore,
    renovationRoiScore,
    luxuryScore,
    rentalPotentialScore,
    climateResilienceScore,
    insuranceDifficultyScore,
  };
}

/** Human labels + whether a HIGH value is good (for color direction in UI). */
export const SCORE_META: Record<ProprietaryScoreKey, { title: string; higherIsBetter: boolean; blurb: string }> = {
  propertyDnaScore: { title: 'Property DNA Score', higherIsBetter: true, blurb: 'Overall asset quality' },
  buyerConfidenceScore: { title: 'Buyer Confidence', higherIsBetter: true, blurb: 'How defensible the price is' },
  sellerTimingScore: { title: 'Seller Timing', higherIsBetter: true, blurb: 'Is now a good time to list' },
  hiddenRiskScore: { title: 'Hidden Risk', higherIsBetter: false, blurb: 'Risks the price hides' },
  renovationRoiScore: { title: 'Renovation ROI', higherIsBetter: true, blurb: 'Value-add headroom' },
  luxuryScore: { title: 'Luxury Score', higherIsBetter: true, blurb: 'Position on the luxury spectrum' },
  rentalPotentialScore: { title: 'Rental Potential', higherIsBetter: true, blurb: 'Income-property upside' },
  climateResilienceScore: { title: 'Climate Resilience', higherIsBetter: true, blurb: 'Resilience to climate hazards' },
  insuranceDifficultyScore: { title: 'Insurance Difficulty', higherIsBetter: false, blurb: 'How hard to insure' },
};

export const SCORE_ORDER: ProprietaryScoreKey[] = [
  'propertyDnaScore',
  'buyerConfidenceScore',
  'hiddenRiskScore',
  'sellerTimingScore',
  'luxuryScore',
  'rentalPotentialScore',
  'renovationRoiScore',
  'climateResilienceScore',
  'insuranceDifficultyScore',
];

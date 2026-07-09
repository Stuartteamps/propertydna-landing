// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Proprietary Scoring (TYPES + presentation only)
//
// The scoring ALGORITHM lives in ONE place: netlify/functions/_intelligence.js.
// That engine is executed server-side by public-property.js (page data) and
// api-property.js (developer API), so the /property page and the /api/v1
// endpoints return byte-identical numbers — no per-path assumptions, no drift.
//
// This module intentionally holds NO compute logic. It defines the shape the
// engine emits and the presentation metadata (titles, ordering, colour
// direction) the UI needs to render it.
// ─────────────────────────────────────────────────────────────────────────────

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

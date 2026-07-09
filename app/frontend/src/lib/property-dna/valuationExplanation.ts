// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Explainable Valuation (TYPES only)
//
// The valuation ALGORITHM lives in ONE place: netlify/functions/_intelligence.js
// (buildValuationExplanation). It runs server-side and is delivered pre-computed
// in the public-property bundle and the /api/v1 endpoints, so every consumer —
// the page, the developer API, and any AI tool — sees the same explanation.
//
// This module defines only the shape the engine emits.
// ─────────────────────────────────────────────────────────────────────────────

export interface ComparableSaleUsed {
  address: string;
  salePrice: number | null;
  pricePerSqft: number | null;
  distanceMi: number | null;
  saleDate: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  /** 0–100 similarity to the subject, when the engine provides it. */
  similarity: number | null;
  adjustmentNote: string | null;
}

export interface ValuationExplanation {
  estimatedValue: number | null;
  lowRange: number | null;
  highRange: number | null;
  /** 0–100. */
  confidenceScore: number | null;
  keyDrivers: string[];
  positiveAdjustments: string[];
  negativeAdjustments: string[];
  comparableSalesUsed: ComparableSaleUsed[];
  dataLimitations: string[];
  lastUpdated: string | null;
  /** Provenance of the headline value, e.g. "AVM + DNA adjustment". */
  method: string | null;
}

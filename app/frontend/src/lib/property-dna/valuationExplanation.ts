// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Explainable Valuation
//
// Every value estimate ships with a machine- and human-readable explanation so a
// consumer (and an AI assistant) understands WHY the number is what it is. Built
// from the same `report_data` (dna) the pipeline already produces — the AVM /
// DNA-adjusted midpoint, the comps actually used, and the drivers/adjustments the
// engine recorded. Nothing is fabricated: absent inputs become explicit
// `dataLimitations` entries.
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

const numOf = (v: unknown): number | null => {
  if (v == null || v === '' || v === '—') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function buildValuationExplanation(dna: any, lastUpdatedIso?: string | null): ValuationExplanation {
  const n = dna?.normalized ?? {};
  const val = n.valuation ?? {};
  const sub = n.subject ?? {};
  const adj = dna?.dnaAdjusted ?? null;
  const comps: any[] = Array.isArray(n.comps) ? n.comps : [];

  const subjectSqft = numOf(sub.sqft);

  // Headline value: prefer DNA-adjusted midpoint, then AVM market value.
  const estimatedValue = numOf(adj?.adjMid) ?? numOf(val.marketValue);
  const lowRange = numOf(adj?.adjLow) ?? numOf(val.low);
  const highRange = numOf(adj?.adjHigh) ?? numOf(val.high);

  let confidenceScore: number | null = null;
  if (adj?.confidence != null) confidenceScore = Math.round(numOf(adj.confidence)! * 100);
  else if (val.valuationConfidence === 'high') confidenceScore = 82;
  else if (val.valuationConfidence === 'medium') confidenceScore = 62;
  else if (val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient') confidenceScore = 35;

  const method = adj?.adjMid != null
    ? 'AVM baseline + PropertyDNA adjustment'
    : val.valuationSource
      ? `AVM (${String(val.valuationSource).replace(/_/g, ' ')})`
      : val.marketValue != null
        ? 'Automated valuation model'
        : null;

  // Drivers + adjustments recorded by the engine.
  const keyDrivers: string[] = [];
  const positiveAdjustments: string[] = [];
  const negativeAdjustments: string[] = [];

  if (Array.isArray(adj?.drivers)) {
    for (const d of adj.drivers) {
      const label = typeof d === 'string' ? d : d?.label || d?.name;
      if (!label) continue;
      keyDrivers.push(String(label));
      const dir = typeof d === 'object' ? (d.direction || d.sign || (numOf(d.impact) ?? 0)) : 0;
      const positive = dir === 'up' || dir === '+' || (typeof dir === 'number' && dir > 0);
      const negative = dir === 'down' || dir === '-' || (typeof dir === 'number' && dir < 0);
      if (positive) positiveAdjustments.push(String(label));
      else if (negative) negativeAdjustments.push(String(label));
    }
  }
  if (adj?.baseAdjustment?.label) keyDrivers.unshift(String(adj.baseAdjustment.label));
  if (adj?.aduUplift) positiveAdjustments.push(`ADU / casita uplift (+$${Math.round(numOf(adj.aduUplift)!).toLocaleString()})`);
  if (numOf(sub.lastSalePrice)) keyDrivers.push(`Last recorded sale: $${Math.round(numOf(sub.lastSalePrice)!).toLocaleString()}${sub.lastSaleDate ? ` (${sub.lastSaleDate})` : ''}`);
  if (comps.length) keyDrivers.push(`${comps.length} comparable sale${comps.length === 1 ? '' : 's'} within the local market`);

  // Comparable sales actually used.
  const comparableSalesUsed: ComparableSaleUsed[] = comps.slice(0, 12).map((c) => {
    const price = numOf(c.rawPrice) ?? numOf(c.price) ?? numOf(c.salePrice);
    const csqft = numOf(c.sqft);
    return {
      address: c.address || '—',
      salePrice: price,
      pricePerSqft: numOf(c.pricePerSqft) ?? (price && csqft ? Math.round(price / csqft) : null),
      distanceMi: numOf(c.distanceMi) ?? numOf(c.distance),
      saleDate: c.saleDate || c.soldDate || c.date || null,
      beds: numOf(c.beds),
      baths: numOf(c.baths),
      sqft: csqft,
      similarity: numOf(c.similarity) ?? numOf(c.similarityScore),
      adjustmentNote: c.adjustmentNote || c.note || null,
    };
  });

  // Transparent data limitations.
  const dataLimitations: string[] = [];
  if (estimatedValue == null) dataLimitations.push('No automated valuation could be resolved for this address.');
  if (!comps.length) dataLimitations.push('No comparable sales were available in the local market window.');
  if (subjectSqft == null) dataLimitations.push('Living area (square footage) is missing, which widens the value range.');
  if (confidenceScore != null && confidenceScore < 45) dataLimitations.push('Confidence is low — treat this as a preliminary estimate, not an appraisal.');
  if (val.confidenceNote && typeof val.confidenceNote === 'string') dataLimitations.push(val.confidenceNote);

  return {
    estimatedValue,
    lowRange,
    highRange,
    confidenceScore,
    keyDrivers: dedupe(keyDrivers).slice(0, 8),
    positiveAdjustments: dedupe(positiveAdjustments).slice(0, 6),
    negativeAdjustments: dedupe(negativeAdjustments).slice(0, 6),
    comparableSalesUsed,
    dataLimitations: dedupe(dataLimitations),
    lastUpdated: lastUpdatedIso ?? null,
    method,
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

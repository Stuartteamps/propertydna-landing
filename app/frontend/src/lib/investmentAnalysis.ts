// PropertyDNA investment analysis — the real-ROI engine shared by site + app.
// No external (CoStar) data required for residential: ARV comes from the AVM /
// comps already in the report; everything else is a transparent, editable
// assumption with an investor-standard default. Multi-family / commercial use
// the income approach (NOI / cap rate). When richer income data (CoStar) is
// wired later, feed it in via the `incomeOverride` fields — the math is the same.

export type PropertyClass =
  | 'residential'   // single family, condo, townhome — flip + buy-and-hold
  | 'multifamily'   // 2-4 units + apartment — income approach
  | 'commercial'    // office/retail/industrial — income approach (data-limited)
  | 'land'          // raw land — no income model
  | 'unknown';

export function classifyProperty(propertyType?: string | null): PropertyClass {
  const t = (propertyType || '').toLowerCase();
  if (!t || t === '—') return 'unknown';
  if (/(multi|duplex|triplex|fourplex|apartment|2-4|units)/.test(t)) return 'multifamily';
  if (/(commercial|office|retail|industrial|warehouse|mixed)/.test(t)) return 'commercial';
  if (/(land|lot|vacant)/.test(t)) return 'land';
  if (/(single|condo|town|residential|sfr|duplex)/.test(t)) return 'residential';
  return 'residential'; // default: treat unknown habitable as residential
}

export function isResidentialData(cls: PropertyClass): boolean {
  return cls === 'residential';
}

/** ARV derived from comps (median price-per-sqft × subject sqft). Returns null
 *  when there isn't enough comp data — caller falls back to the AVM. */
export function arvFromComps(
  comps: Array<{ rawPrice?: number; price?: any; sqft?: any }>,
  subjectSqft: number,
): number | null {
  if (!subjectSqft || subjectSqft <= 0) return null;
  const ppsf: number[] = [];
  for (const c of comps || []) {
    const price = Number(c.rawPrice ?? parseFloat(String(c.price).replace(/[^0-9.]/g, '')));
    const sqft = Number(typeof c.sqft === 'number' ? c.sqft : parseFloat(String(c.sqft).replace(/[^0-9.]/g, '')));
    if (price > 0 && sqft > 0) ppsf.push(price / sqft);
  }
  if (ppsf.length === 0) return null;
  ppsf.sort((a, b) => a - b);
  const median = ppsf[Math.floor(ppsf.length / 2)];
  return Math.round(median * subjectSqft);
}

// ── Flip (fix-and-flip / value-add resale) ─────────────────────────────────

export interface FlipAssumptions {
  arvPct: number;          // "70% rule" — max purchase as a fraction of ARV
  rehabPerSqft: number;    // rehab budget per square foot
  holdMonths: number;      // carrying period
  propertyTaxRatePct: number; // annual property tax as % of ARV
  insuranceAnnual: number; // hazard insurance for the hold
  utilitiesMonthly: number;
  loanRatePct: number;     // annual interest on the acquisition loan (hard money)
  loanLtvPct: number;      // % of purchase price financed
  buyClosingPct: number;   // buy-side closing as % of purchase
  sellClosingPct: number;  // sell-side (agent + closing) as % of ARV
}

export const DEFAULT_FLIP: FlipAssumptions = {
  arvPct: 0.70,
  rehabPerSqft: 45,        // moderate rehab
  holdMonths: 6,
  propertyTaxRatePct: 1.1, // ~US avg effective rate
  insuranceAnnual: 1800,
  utilitiesMonthly: 250,
  loanRatePct: 10.5,       // typical hard-money
  loanLtvPct: 0.80,
  buyClosingPct: 0.02,
  sellClosingPct: 0.07,    // ~6% commission + ~1% closing
};

export const REHAB_PRESETS = [
  { label: 'Cosmetic', perSqft: 25 },
  { label: 'Moderate', perSqft: 45 },
  { label: 'Full gut', perSqft: 85 },
] as const;

export interface FlipResult {
  arv: number;
  arvCeiling: number;          // ARV × arvPct  (the "70% of ARV" reference ceiling)
  rehab: number;
  maoWithRehab: number;        // ARV × arvPct − rehab  (recommended max offer)
  purchase: number;            // price the deal is modeled at (defaults to MAO)
  carrying: {
    propertyTax: number;
    insurance: number;
    utilities: number;
    loanInterest: number;
    total: number;
  };
  buyClosing: number;
  sellClosing: number;
  totalProjectCost: number;    // purchase + rehab + carrying + buy closing
  cashInvested: number;        // total cost − financed amount
  saleProceeds: number;        // ARV − sell closing
  netProfit: number;
  roiOnCashPct: number;        // net profit / cash invested
  marginPct: number;           // net profit / ARV
}

// `purchasePrice` defaults to the 70%-rule max allowable offer (ARV×arvPct − rehab),
// which is the price the rule is designed to produce. Pass an explicit value to
// model a different offer.
export function analyzeFlip(arv: number, sqft: number, a: FlipAssumptions = DEFAULT_FLIP, purchasePrice?: number): FlipResult {
  const arvCeiling = arv * a.arvPct;
  const rehab = Math.max(0, (sqft || 0) * a.rehabPerSqft);
  const maoWithRehab = Math.max(0, arvCeiling - rehab);
  const purchase = purchasePrice != null ? purchasePrice : maoWithRehab;

  const financed = purchase * a.loanLtvPct;
  const loanInterest = financed * (a.loanRatePct / 100) * (a.holdMonths / 12);
  const propertyTax = arv * (a.propertyTaxRatePct / 100) * (a.holdMonths / 12);
  const insurance = a.insuranceAnnual * (a.holdMonths / 12);
  const utilities = a.utilitiesMonthly * a.holdMonths;
  const carryingTotal = loanInterest + propertyTax + insurance + utilities;

  const buyClosing = purchase * a.buyClosingPct;
  const sellClosing = arv * a.sellClosingPct;

  const totalProjectCost = purchase + rehab + carryingTotal + buyClosing;
  const cashInvested = totalProjectCost - financed;
  const saleProceeds = arv - sellClosing;
  const netProfit = saleProceeds - totalProjectCost;
  const roiOnCashPct = cashInvested > 0 ? (netProfit / cashInvested) * 100 : 0;
  const marginPct = arv > 0 ? (netProfit / arv) * 100 : 0;

  return {
    arv: Math.round(arv),
    arvCeiling: Math.round(arvCeiling),
    rehab: Math.round(rehab),
    maoWithRehab: Math.round(maoWithRehab),
    purchase: Math.round(purchase),
    carrying: {
      propertyTax: Math.round(propertyTax),
      insurance: Math.round(insurance),
      utilities: Math.round(utilities),
      loanInterest: Math.round(loanInterest),
      total: Math.round(carryingTotal),
    },
    buyClosing: Math.round(buyClosing),
    sellClosing: Math.round(sellClosing),
    totalProjectCost: Math.round(totalProjectCost),
    cashInvested: Math.round(cashInvested),
    saleProceeds: Math.round(saleProceeds),
    netProfit: Math.round(netProfit),
    roiOnCashPct: Math.round(roiOnCashPct * 10) / 10,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}

// ── Buy-and-hold / multi-family / commercial (income approach) ──────────────

export interface RentalAssumptions {
  units: number;
  grossMonthlyRentPerUnit: number;
  vacancyPct: number;          // % of gross rent
  operatingExpensePct: number; // % of effective gross income (taxes/ins/maint/mgmt)
  downPaymentPct: number;
  loanRatePct: number;
  loanTermYears: number;
}

export const DEFAULT_RENTAL: RentalAssumptions = {
  units: 1,
  grossMonthlyRentPerUnit: 0,
  vacancyPct: 6,
  operatingExpensePct: 45,     // ~50% rule, slightly optimistic
  downPaymentPct: 0.25,
  loanRatePct: 7.0,
  loanTermYears: 30,
};

export interface RentalResult {
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  capRatePct: number;          // NOI / price
  grm: number;                 // price / gross annual rent
  annualDebtService: number;
  annualCashFlow: number;      // NOI − debt service
  cashInvested: number;        // down payment + ~3% closing
  cashOnCashPct: number;
  onePercentRuleMet: boolean;  // monthly rent ≥ 1% of price
}

export function analyzeRental(price: number, a: RentalAssumptions = DEFAULT_RENTAL): RentalResult {
  const grossAnnualRent = a.grossMonthlyRentPerUnit * a.units * 12;
  const vacancyLoss = grossAnnualRent * (a.vacancyPct / 100);
  const effectiveGrossIncome = grossAnnualRent - vacancyLoss;
  const operatingExpenses = effectiveGrossIncome * (a.operatingExpensePct / 100);
  const noi = effectiveGrossIncome - operatingExpenses;

  const capRatePct = price > 0 ? (noi / price) * 100 : 0;
  const grm = grossAnnualRent > 0 ? price / grossAnnualRent : 0;

  const loanAmount = price * (1 - a.downPaymentPct);
  const monthlyRate = a.loanRatePct / 100 / 12;
  const nPmts = a.loanTermYears * 12;
  const monthlyDebt = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPmts)) / (Math.pow(1 + monthlyRate, nPmts) - 1)
    : loanAmount / nPmts;
  const annualDebtService = monthlyDebt * 12;
  const annualCashFlow = noi - annualDebtService;

  const cashInvested = price * a.downPaymentPct + price * 0.03;
  const cashOnCashPct = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
  const monthlyRentTotal = a.grossMonthlyRentPerUnit * a.units;
  const onePercentRuleMet = price > 0 ? monthlyRentTotal >= price * 0.01 : false;

  return {
    grossAnnualRent: Math.round(grossAnnualRent),
    effectiveGrossIncome: Math.round(effectiveGrossIncome),
    operatingExpenses: Math.round(operatingExpenses),
    noi: Math.round(noi),
    capRatePct: Math.round(capRatePct * 100) / 100,
    grm: Math.round(grm * 10) / 10,
    annualDebtService: Math.round(annualDebtService),
    annualCashFlow: Math.round(annualCashFlow),
    cashInvested: Math.round(cashInvested),
    cashOnCashPct: Math.round(cashOnCashPct * 10) / 10,
    onePercentRuleMet,
  };
}

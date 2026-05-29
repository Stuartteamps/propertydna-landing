import { useMemo, useState } from 'react';
import {
  classifyProperty, isResidentialData, analyzeFlip, analyzeRental,
  DEFAULT_FLIP, DEFAULT_RENTAL, REHAB_PRESETS,
  type FlipAssumptions, type RentalAssumptions,
} from '@/lib/investmentAnalysis';

interface Props {
  propertyType?: string | null;
  marketValue: number;            // AVM market value — primary ARV
  arvFromComps?: number | null;   // comp-derived ARV (corroboration)
  sqft: number;
  monthlyRentEstimate?: number;   // from report enrichment, if any
  units?: number;
}

const GOLD = '#C9A84C';
const TXT = '#F0EBE0';
const MUTE = '#6B6252';
const UI = 'Jost, sans-serif';
const SERIF = 'Cormorant Garamond, serif';

const money = (n: number) =>
  isFinite(n) ? '$' + Math.round(n).toLocaleString() : '—';
const pct = (n: number) => (isFinite(n) ? `${n}%` : '—');

function Row({ label, value, accent, strong }: { label: string; value: string; accent?: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontFamily: UI, fontSize: 12, color: MUTE }}>{label}</span>
      <span style={{ fontFamily: UI, fontSize: strong ? 15 : 13, fontWeight: strong ? 600 : 400, color: accent || TXT }}>{value}</span>
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; step?: number;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: UI, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTE }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
        {prefix && <span style={{ fontFamily: UI, fontSize: 12, color: MUTE, padding: '0 0 0 10px' }}>{prefix}</span>}
        <input
          type="number" value={value} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ fontFamily: UI, fontSize: 13, color: TXT, background: 'transparent', border: 'none', outline: 'none', padding: '9px 10px', width: '100%' }}
        />
        {suffix && <span style={{ fontFamily: UI, fontSize: 12, color: MUTE, padding: '0 10px 0 0' }}>{suffix}</span>}
      </div>
    </label>
  );
}

export default function InvestmentAnalysis({ propertyType, marketValue, arvFromComps, sqft, monthlyRentEstimate, units }: Props) {
  const cls = classifyProperty(propertyType);
  if (cls === 'land') {
    return (
      <Wrapper cls={cls} propertyType={propertyType}>
        <div style={{ fontFamily: UI, fontSize: 13, color: MUTE, lineHeight: 1.7 }}>
          This parcel is classified as land. An income or fix-and-flip ROI model doesn't apply — value is driven by entitlement, zoning, and development potential. Run a comp-based valuation above for market value.
        </div>
      </Wrapper>
    );
  }

  const arv = marketValue || arvFromComps || 0;
  const [mode, setMode] = useState<'flip' | 'hold'>(cls === 'residential' ? 'flip' : 'hold');
  const [flip, setFlip] = useState<FlipAssumptions>(DEFAULT_FLIP);
  const [purchaseOverride, setPurchaseOverride] = useState<number | null>(null);
  const [rental, setRental] = useState<RentalAssumptions>({
    ...DEFAULT_RENTAL,
    units: units || (cls === 'multifamily' ? 4 : 1),
    grossMonthlyRentPerUnit: monthlyRentEstimate || Math.round((arv * 0.007)), // ~0.7% rule fallback
  });

  const flipResult = useMemo(() => analyzeFlip(arv, sqft, flip, purchaseOverride ?? undefined), [arv, sqft, flip, purchaseOverride]);
  const rentalResult = useMemo(() => analyzeRental(arv, rental), [arv, rental]);

  const roiColor = (n: number) => (n >= 20 ? '#52B788' : n >= 10 ? GOLD : '#C94C4C');

  return (
    <Wrapper cls={cls} propertyType={propertyType}>
      {/* ARV header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: UI, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: MUTE }}>After-Repair / Market Value (ARV)</div>
          <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 300, color: GOLD }}>{money(arv)}</div>
        </div>
        {arvFromComps ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: UI, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTE }}>Comp-derived ARV</div>
            <div style={{ fontFamily: UI, fontSize: 14, color: TXT }}>{money(arvFromComps)}</div>
          </div>
        ) : null}
      </div>

      {/* Mode toggle (residential gets both) */}
      {cls === 'residential' && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 18, border: '1px solid rgba(255,255,255,0.1)' }}>
          {(['flip', 'hold'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, fontFamily: UI, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', padding: '10px 0', cursor: 'pointer', border: 'none',
                background: mode === m ? GOLD : 'transparent', color: mode === m ? '#000' : MUTE }}>
              {m === 'flip' ? 'Fix & Flip' : 'Buy & Hold'}
            </button>
          ))}
        </div>
      )}

      {/* FLIP */}
      {mode === 'flip' && cls === 'residential' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 18 }}>
            <NumField label="Purchase @ % of ARV" value={Math.round(flip.arvPct * 100)} suffix="%" onChange={v => setFlip({ ...flip, arvPct: v / 100 })} />
            <NumField label="Rehab / sqft" value={flip.rehabPerSqft} prefix="$" onChange={v => setFlip({ ...flip, rehabPerSqft: v })} />
            <NumField label="Hold (months)" value={flip.holdMonths} onChange={v => setFlip({ ...flip, holdMonths: v })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {REHAB_PRESETS.map(p => (
              <button key={p.label} onClick={() => setFlip({ ...flip, rehabPerSqft: p.perSqft })}
                style={{ fontFamily: UI, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer',
                  background: flip.rehabPerSqft === p.perSqft ? 'rgba(201,168,76,0.15)' : 'transparent', color: flip.rehabPerSqft === p.perSqft ? GOLD : MUTE, border: `1px solid ${flip.rehabPerSqft === p.perSqft ? GOLD : 'rgba(255,255,255,0.12)'}` }}>
                {p.label} ${p.perSqft}/sqft
              </button>
            ))}
            <div style={{ minWidth: 150 }}>
              <NumField label="Your offer (purchase)" value={purchaseOverride != null ? purchaseOverride : flipResult.maoWithRehab} prefix="$" step={1000} onChange={v => setPurchaseOverride(v)} />
            </div>
            {purchaseOverride != null && (
              <button onClick={() => setPurchaseOverride(null)} style={{ fontFamily: UI, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer', background: 'transparent', color: MUTE, border: '1px solid rgba(255,255,255,0.12)' }}>↺ Use MAO</button>
            )}
          </div>
          <Row label={`ARV ceiling (${Math.round(flip.arvPct * 100)}% of ARV)`} value={money(flipResult.arvCeiling)} />
          <Row label="Estimated rehab" value={money(flipResult.rehab)} />
          <Row label="Max allowable offer (70% rule − rehab)" value={money(flipResult.maoWithRehab)} accent={GOLD} />
          <Row label="Modeled at purchase price" value={money(flipResult.purchase)} strong />
          <Row label={`Carrying cost (${flip.holdMonths} mo: tax/ins/util/interest)`} value={money(flipResult.carrying.total)} />
          <Row label="Buy-side closing" value={money(flipResult.buyClosing)} />
          <Row label="Sell-side closing (agent + fees)" value={money(flipResult.sellClosing)} />
          <Row label="Total project cost" value={money(flipResult.totalProjectCost)} />
          <Row label="Cash invested (after financing)" value={money(flipResult.cashInvested)} />
          <Row label="Net profit at resale" value={money(flipResult.netProfit)} accent={roiColor(flipResult.marginPct)} strong />
          <Row label="ROI on cash invested" value={pct(flipResult.roiOnCashPct)} accent={roiColor(flipResult.roiOnCashPct)} strong />
        </>
      )}

      {/* HOLD / INCOME (residential buy-hold, multifamily, commercial) */}
      {(mode === 'hold' || cls !== 'residential') && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 18 }}>
            <NumField label="Units" value={rental.units} onChange={v => setRental({ ...rental, units: Math.max(1, v) })} />
            <NumField label="Rent / unit / mo" value={rental.grossMonthlyRentPerUnit} prefix="$" onChange={v => setRental({ ...rental, grossMonthlyRentPerUnit: v })} />
            <NumField label="Op. expense" value={rental.operatingExpensePct} suffix="%" onChange={v => setRental({ ...rental, operatingExpensePct: v })} />
            <NumField label="Vacancy" value={rental.vacancyPct} suffix="%" onChange={v => setRental({ ...rental, vacancyPct: v })} />
            <NumField label="Down payment" value={Math.round(rental.downPaymentPct * 100)} suffix="%" onChange={v => setRental({ ...rental, downPaymentPct: v / 100 })} />
            <NumField label="Loan rate" value={rental.loanRatePct} suffix="%" onChange={v => setRental({ ...rental, loanRatePct: v })} />
          </div>
          <Row label="Gross annual rent" value={money(rentalResult.grossAnnualRent)} />
          <Row label="Net operating income (NOI)" value={money(rentalResult.noi)} />
          <Row label="Cap rate (NOI / price)" value={pct(rentalResult.capRatePct)} accent={roiColor(rentalResult.capRatePct * 2)} strong />
          <Row label="Gross rent multiplier (GRM)" value={isFinite(rentalResult.grm) ? `${rentalResult.grm}×` : '—'} />
          <Row label="Annual debt service" value={money(rentalResult.annualDebtService)} />
          <Row label="Annual cash flow (after debt)" value={money(rentalResult.annualCashFlow)} accent={roiColor(rentalResult.annualCashFlow > 0 ? 20 : 0)} />
          <Row label="Cash invested (down + closing)" value={money(rentalResult.cashInvested)} />
          <Row label="Cash-on-cash return" value={pct(rentalResult.cashOnCashPct)} accent={roiColor(rentalResult.cashOnCashPct * 2)} strong />
          <Row label="1% rule (rent ≥ 1% of price)" value={rentalResult.onePercentRuleMet ? 'Met ✓' : 'Not met'} accent={rentalResult.onePercentRuleMet ? '#52B788' : MUTE} />
        </>
      )}
    </Wrapper>
  );
}

function Wrapper({ cls, propertyType, children }: { cls: ReturnType<typeof classifyProperty>; propertyType?: string | null; children: React.ReactNode }) {
  const nonResidential = !isResidentialData(cls) && cls !== 'unknown';
  return (
    <section style={{ marginTop: 32, border: '1px solid rgba(201,168,76,0.25)', background: 'linear-gradient(135deg, rgba(201,168,76,0.05) 0%, rgba(201,168,76,0.01) 100%)', padding: '24px' }}>
      <div style={{ fontFamily: UI, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
        Investment Analysis · Real ROI
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 300, color: TXT, marginBottom: 16 }}>
        What the numbers actually say.
      </div>

      {(nonResidential || cls === 'commercial' || cls === 'multifamily') && (
        <div style={{ marginBottom: 18, padding: '12px 14px', border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.06)', fontFamily: UI, fontSize: 11, color: GOLD, lineHeight: 1.6 }}>
          {cls === 'commercial'
            ? 'COMMERCIAL ESTIMATE — Modeled with the income approach (NOI / cap rate). PropertyDNA\'s verified residential data does not include commercial lease rolls, tenant credit, or NNN terms. Treat these figures as a directional framework; institutional-grade commercial comps (CoStar) are coming.'
            : cls === 'multifamily'
            ? 'MULTI-FAMILY — Modeled with the income approach. Rent and unit count default to estimates; enter actuals from the rent roll for precision.'
            : 'NOTE — This analysis uses PropertyDNA\'s residential valuation data. For non-residential property, treat figures as directional.'}
        </div>
      )}

      {children}

      <div style={{ marginTop: 18, fontFamily: UI, fontSize: 10, color: 'rgba(107,98,82,0.8)', lineHeight: 1.6 }}>
        ARV/value sourced from PropertyDNA's AVM + comparable sales. Rehab, carrying, and financing are editable assumptions with investor-standard defaults — adjust to your deal. All figures are estimates, not an appraisal or investment advice.
      </div>
    </section>
  );
}

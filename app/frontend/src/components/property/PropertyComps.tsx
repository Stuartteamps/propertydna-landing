// ─────────────────────────────────────────────────────────────────────────────
// PropertyComps — reusable comparable-sales display.
// <PropertyComps comps={p.valuation.comparableSalesUsed} pricePerSqft={p.pricePerSqft} />
// Responsive: a real <table> on desktop, stacked cards on mobile. Missing cells
// render as "—". Empty comps → "Data unavailable".
// ─────────────────────────────────────────────────────────────────────────────
import type { ComparableSaleUsed } from '@/lib/property-dna/valuationExplanation';
import { T, labelStyle, money, dash } from './_shared';

interface Props {
  comps: ComparableSaleUsed[];
  /** Subject property $/sqft, for an at-a-glance benchmark row. */
  pricePerSqft?: number | null;
}

const num = (v: number | null, suffix = '') => (v == null ? '—' : `${v.toLocaleString()}${suffix}`);
const ppsf = (v: number | null) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`);
const dist = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)} mi`);

const COLS = [
  'Address',
  'Distance',
  'Sold price',
  'Sold date',
  'Beds',
  'Baths',
  'Sq ft',
  '$/Sq ft',
  'Similarity',
  'Notes',
] as const;

export default function PropertyComps({ comps, pricePerSqft }: Props) {
  if (!comps || comps.length === 0) {
    return (
      <div
        style={{
          fontFamily: T.sans,
          fontSize: 13,
          color: T.muted,
          background: T.panel,
          border: `1px solid ${T.border}`,
          padding: '20px 24px',
        }}
      >
        Data unavailable — no comparable sales were resolved in the local market window.
      </div>
    );
  }

  const th: React.CSSProperties = {
    ...labelStyle,
    textAlign: 'left',
    padding: '0 14px 10px 0',
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    fontFamily: T.sans,
    fontSize: 12,
    color: T.muted,
    padding: '12px 14px 12px 0',
    borderBottom: `1px solid ${T.borderSoft}`,
    verticalAlign: 'top',
  };

  return (
    <div>
      {pricePerSqft != null && (
        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.muted, marginBottom: 16 }}>
          Subject property benchmark:{' '}
          <span style={{ color: T.gold }}>${Math.round(pricePerSqft).toLocaleString()}/sq ft</span>
        </div>
      )}

      {/* Desktop table */}
      <div className="pc-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              {COLS.map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i}>
                <td style={{ ...td, color: T.cream, fontSize: 13 }}>{dash(c.address)}</td>
                <td style={td}>{dist(c.distanceMi)}</td>
                <td style={{ ...td, fontFamily: T.serif, fontSize: 15, color: T.gold }}>{money(c.salePrice)}</td>
                <td style={td}>{c.saleDate ? String(c.saleDate).slice(0, 10) : '—'}</td>
                <td style={td}>{dash(c.beds)}</td>
                <td style={td}>{dash(c.baths)}</td>
                <td style={td}>{num(c.sqft)}</td>
                <td style={td}>{ppsf(c.pricePerSqft)}</td>
                <td style={td}>{c.similarity == null ? '—' : `${Math.round(c.similarity)}/100`}</td>
                <td style={{ ...td, minWidth: 160 }}>{dash(c.adjustmentNote)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="pc-cards" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
        {comps.map((c, i) => (
          <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.cream, lineHeight: 1.4 }}>{dash(c.address)}</div>
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.gold, whiteSpace: 'nowrap' }}>{money(c.salePrice)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px' }}>
              <Cell label="Distance" value={dist(c.distanceMi)} />
              <Cell label="Sold date" value={c.saleDate ? String(c.saleDate).slice(0, 10) : '—'} />
              <Cell label="Beds / Baths" value={`${dash(c.beds)} / ${dash(c.baths)}`} />
              <Cell label="Sq ft" value={num(c.sqft)} />
              <Cell label="$/Sq ft" value={ppsf(c.pricePerSqft)} />
              <Cell label="Similarity" value={c.similarity == null ? '—' : `${Math.round(c.similarity)}/100`} />
            </div>
            {c.adjustmentNote && (
              <div style={{ marginTop: 10, fontFamily: T.sans, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{c.adjustmentNote}</div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .pc-table { display: none; }
          .pc-cards { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.cream }}>{value}</div>
    </div>
  );
}

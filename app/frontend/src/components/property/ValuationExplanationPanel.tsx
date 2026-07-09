// ─────────────────────────────────────────────────────────────────────────────
// ValuationExplanationPanel — the "why this number" block. Renders the headline
// estimate, range, confidence, method, key drivers, +/- adjustments and the
// transparent data limitations from the ValuationExplanation view-model.
// ─────────────────────────────────────────────────────────────────────────────
import type { ValuationExplanation } from '@/lib/property-dna/valuationExplanation';
import { T, labelStyle, money, confColor } from './_shared';

export default function ValuationExplanationPanel({ v }: { v: ValuationExplanation }) {
  const hasValue = v.estimatedValue != null;

  return (
    <div>
      {/* Headline value + range + confidence */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: 'clamp(20px, 3vw, 28px)', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-end' }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Estimated value</div>
            <div style={{ fontFamily: T.serif, fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 300, color: hasValue ? T.gold : T.muted, lineHeight: 1 }}>
              {hasValue ? money(v.estimatedValue) : 'Data unavailable'}
            </div>
          </div>
          {v.lowRange != null && v.highRange != null && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Value range</div>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 300, color: T.cream }}>
                {money(v.lowRange)} – {money(v.highRange)}
              </div>
            </div>
          )}
          {v.confidenceScore != null && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Confidence</div>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 300, color: confColor(v.confidenceScore) }}>
                {v.confidenceScore}<span style={{ fontSize: 13, color: T.muted }}>/100</span>
              </div>
            </div>
          )}
        </div>
        {v.method && (
          <div style={{ marginTop: 16, fontFamily: T.sans, fontSize: 11, color: T.muted, letterSpacing: 1 }}>
            Method: {v.method}
          </div>
        )}
      </div>

      {/* Drivers */}
      {v.keyDrivers.length > 0 && (
        <Block title="Key value drivers">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {v.keyDrivers.map((d, i) => (
              <li key={i} style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 300, color: T.cream, lineHeight: 1.8, display: 'flex', gap: 10 }}>
                <span style={{ color: T.gold, flexShrink: 0 }}>—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* Adjustments */}
      {(v.positiveAdjustments.length > 0 || v.negativeAdjustments.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 20 }}>
          {v.positiveAdjustments.length > 0 && (
            <AdjustList title="Positive adjustments" items={v.positiveAdjustments} color={T.goodSoft} sign="+" />
          )}
          {v.negativeAdjustments.length > 0 && (
            <AdjustList title="Negative adjustments" items={v.negativeAdjustments} color={T.bad} sign="−" />
          )}
        </div>
      )}

      {/* Limitations — transparency */}
      {v.dataLimitations.length > 0 && (
        <div style={{ marginTop: 20, background: 'rgba(184,82,69,0.06)', border: '1px solid rgba(184,82,69,0.25)', borderLeft: `3px solid ${T.bad}`, padding: '16px 20px' }}>
          <div style={{ ...labelStyle, color: T.bad, marginBottom: 10 }}>Data limitations</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {v.dataLimitations.map((d, i) => (
              <li key={i} style={{ fontFamily: T.sans, fontSize: 13, color: T.cream, lineHeight: 1.7, display: 'flex', gap: 8 }}>
                <span style={{ color: T.bad, flexShrink: 0 }}>—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function AdjustList({ title, items, color, sign }: { title: string; items: string[]; color: string; sign: string }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '16px 20px' }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>{title}</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontFamily: T.sans, fontSize: 13, color: T.cream, lineHeight: 1.7, display: 'flex', gap: 8 }}>
            <span style={{ color, flexShrink: 0, fontWeight: 500 }}>{sign}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProprietaryScores — renders the 9 branded scores from p.scores using
// SCORE_ORDER + SCORE_META. Color direction respects higherIsBetter (green=good;
// for risk-style scores where higherIsBetter=false, a high score reads red).
// Unavailable scores show "—" with their transparent explanation.
// ─────────────────────────────────────────────────────────────────────────────
import type { PropertyScores } from '@/lib/property-dna/scores';
import { SCORE_ORDER, SCORE_META } from '@/lib/property-dna/scores';
import { T, labelStyle, scoreColor } from './_shared';

const CONF_COLOR: Record<string, string> = { high: T.good, medium: T.gold, low: T.muted };

export default function ProprietaryScores({ scores }: { scores: PropertyScores | null }) {
  if (!scores) {
    return (
      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.muted }}>
        Data unavailable — not enough normalized data to compute Property DNA scores.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: T.border }}>
      {SCORE_ORDER.map((key) => {
        const s = scores[key];
        const meta = SCORE_META[key];
        const color = s.available ? scoreColor(s.score, meta.higherIsBetter) : T.muted;
        return (
          <div key={key} style={{ background: T.bg, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 300, color: T.cream }}>{meta.title}</div>
              <div style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 300, color, whiteSpace: 'nowrap' }}>
                {s.available ? s.score : '—'}
                {s.available && <span style={{ fontSize: 13, color: T.muted }}>/100</span>}
              </div>
            </div>

            {/* progress bar */}
            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${s.available ? s.score : 0}%`, height: '100%', background: color }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.sans, fontSize: 12, color }}>{s.label}</span>
              <span
                style={{
                  ...labelStyle,
                  fontSize: 8,
                  color: CONF_COLOR[s.confidence] ?? T.muted,
                  border: `1px solid ${(CONF_COLOR[s.confidence] ?? T.muted)}44`,
                  padding: '2px 7px',
                }}
              >
                {s.confidence} confidence
              </span>
            </div>

            <p style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 300, color: 'rgba(240,235,224,0.6)', lineHeight: 1.65, margin: '0 0 12px' }}>
              {s.explanation}
            </p>

            {s.factors.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 'auto' }}>
                {s.factors.map((f, i) => (
                  <li key={i} style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, lineHeight: 1.7, display: 'flex', gap: 8 }}>
                    <span style={{ color: T.gold, flexShrink: 0 }}>—</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

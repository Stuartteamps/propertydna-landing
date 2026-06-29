// ─────────────────────────────────────────────────────────────────────────────
// MarketTickerStrip — the real-estate analog of Fidelity's DJIA / NASDAQ / S&P
// strip. Shows neighborhood / city / metro index momentum with red/green % moves.
// Clean white, mono-ish numerals, tight typography. Mobile-first.
// ─────────────────────────────────────────────────────────────────────────────

import type { TickerEntry } from '@/lib/property-dna/types';

const INK = '#2C2825';
const MUTED = '#6B5F55';
const GREEN = '#1E8E5A';
const RED = '#C94B3A';

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function MarketTickerStrip({ entries }: { entries: TickerEntry[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div
      className="pdna-hide-scroll"
      style={{
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        borderTop: '1px solid rgba(44,40,37,0.08)',
        borderBottom: '1px solid rgba(44,40,37,0.08)',
        background: 'rgba(44,40,37,0.015)',
      }}
    >
      {entries.map((e, i) => {
        const color = e.dir === 'down' ? RED : e.dir === 'up' ? GREEN : MUTED;
        const arrow = e.dir === 'down' ? '▾' : e.dir === 'up' ? '▴' : '·';
        return (
          <div
            key={e.key}
            style={{
              flex: '1 0 auto',
              minWidth: 96,
              padding: '8px 14px',
              borderLeft: i === 0 ? 'none' : '1px solid rgba(44,40,37,0.07)',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: 0.4, color: MUTED, textTransform: 'uppercase', fontWeight: 600 }}>
              {e.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {arrow} {fmtPct(e.changePct)}
              </span>
              {e.value != null && (
                <span style={{ fontSize: 11, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                  {compact(e.value)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

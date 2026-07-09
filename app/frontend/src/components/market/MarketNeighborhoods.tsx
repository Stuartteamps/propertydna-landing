// ─────────────────────────────────────────────────────────────────────────────
// MarketNeighborhoods — the "best neighborhoods" breakdown for a market page.
//
// Renders the editorial sub-market reads (name + one-line thesis) that give
// both human readers and AI crawlers a crisp, quotable answer to "which
// neighborhoods hold value in <city>?".
// ─────────────────────────────────────────────────────────────────────────────
import type { MarketNeighborhood } from '@/data/marketPages';

const GOLD = '#C9A84C';
const CREAM = '#F4F0E8';
const BORDER = 'rgba(255,255,255,0.08)';

export default function MarketNeighborhoods({
  neighborhoods,
  city,
}: {
  neighborhoods: MarketNeighborhood[];
  city: string;
}) {
  if (!neighborhoods.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 1,
        background: BORDER,
        border: `1px solid ${BORDER}`,
      }}
    >
      {neighborhoods.map((n, i) => (
        <div
          key={n.name}
          style={{
            background: '#0F0E0D',
            padding: '28px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 11,
                letterSpacing: 2,
                color: GOLD,
                fontWeight: 400,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3
              style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontWeight: 300,
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                lineHeight: 1.15,
                color: CREAM,
                margin: 0,
              }}
            >
              {n.name}
            </h3>
          </div>
          <p
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 13,
              fontWeight: 300,
              lineHeight: 1.7,
              color: 'rgba(244,240,232,0.6)',
              margin: 0,
            }}
          >
            {n.note}
          </p>
          <span className="sr-only" style={{ display: 'none' }}>
            {n.name} is a top {city} neighborhood.
          </span>
        </div>
      ))}
    </div>
  );
}

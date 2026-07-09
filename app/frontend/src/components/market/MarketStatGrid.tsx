// ─────────────────────────────────────────────────────────────────────────────
// MarketStatGrid — the live/est. stat tiles for a market page.
//
// Each tile renders a headline market figure (median value, sales velocity,
// price/sqft, direction, days-on-market, inventory) with an explicit provenance
// badge: LIVE (hydrated from the get-value-series feed), EST. (editorial
// fallback), or a muted "Data unavailable" — we NEVER invent a number.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketStatStatus = 'live' | 'est' | 'unavailable';

export interface MarketStat {
  /** Uppercase eyebrow label, e.g. "Median Home Value". */
  label: string;
  /** Formatted display value, or "Data unavailable". */
  value: string;
  /** Optional context line under the value. */
  sub?: string;
  status: MarketStatStatus;
}

const GOLD = '#C9A84C';
const CREAM = '#F4F0E8';
const BORDER = 'rgba(255,255,255,0.08)';

function StatusBadge({ status }: { status: MarketStatStatus }) {
  const map: Record<MarketStatStatus, { text: string; color: string; dot: string }> = {
    live: { text: 'Live', color: GOLD, dot: '#7BC47F' },
    est: { text: 'Est.', color: 'rgba(244,240,232,0.5)', dot: 'rgba(201,168,76,0.7)' },
    unavailable: { text: 'No data', color: 'rgba(244,240,232,0.35)', dot: 'rgba(255,255,255,0.2)' },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'Jost, sans-serif',
        fontSize: 9,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: s.color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.text}
    </span>
  );
}

function Tile({ stat, loading }: { stat: MarketStat; loading: boolean }) {
  const dim = stat.status === 'unavailable';
  return (
    <div
      style={{
        background: '#0F0E0D',
        padding: '26px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 132,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: GOLD,
          }}
        >
          {stat.label}
        </span>
        {!loading && <StatusBadge status={stat.status} />}
      </div>

      {loading ? (
        <div
          aria-hidden
          style={{
            height: 34,
            width: '60%',
            borderRadius: 3,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            animation: 'mktShimmer 1.4s ease-in-out infinite',
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontWeight: 300,
            fontSize: 'clamp(26px, 3.4vw, 38px)',
            lineHeight: 1.05,
            color: dim ? 'rgba(244,240,232,0.4)' : CREAM,
            letterSpacing: '-0.5px',
          }}
        >
          {stat.value}
        </div>
      )}

      {!loading && stat.sub && (
        <div
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 12,
            fontWeight: 300,
            lineHeight: 1.55,
            color: 'rgba(244,240,232,0.5)',
          }}
        >
          {stat.sub}
        </div>
      )}
    </div>
  );
}

export default function MarketStatGrid({
  stats,
  loading = false,
}: {
  stats: MarketStat[];
  loading?: boolean;
}) {
  return (
    <div>
      <style>{`@keyframes mktShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: BORDER,
          border: `1px solid ${BORDER}`,
        }}
      >
        {stats.map((s) => (
          <Tile key={s.label} stat={s} loading={loading} />
        ))}
      </div>
    </div>
  );
}

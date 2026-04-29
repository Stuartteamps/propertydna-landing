import { Link } from 'react-router-dom';

interface MarketHeatMapPreviewProps {
  isPremium?: boolean;
  onUpgrade?: () => void;
}

const SAMPLE_ZONES = [
  { label: 'Palm Springs',     heat: 0.88, pct: '+9.2%', color: '#C94C4C' },
  { label: 'Rancho Mirage',    heat: 0.74, pct: '+6.8%', color: '#D4784A' },
  { label: 'Indian Wells',     heat: 0.82, pct: '+8.1%', color: '#C94C4C' },
  { label: 'Palm Desert',      heat: 0.65, pct: '+5.3%', color: '#C9A84C' },
  { label: 'La Quinta',        heat: 0.71, pct: '+7.4%', color: '#D4784A' },
  { label: 'Cathedral City',   heat: 0.48, pct: '+3.9%', color: '#4A7EC9' },
  { label: 'Indio',            heat: 0.42, pct: '+3.1%', color: '#4A7EC9' },
  { label: 'Desert Hot Springs', heat: 0.35, pct: '+2.8%', color: '#6B84C9' },
];

/**
 * Sample-state market heat map preview.
 * Shows realistic-looking zone bars with intensity colors.
 * TODO: Replace SAMPLE_ZONES with live market_snapshots data from Supabase
 *       once the market data pipeline is connected.
 */
export default function MarketHeatMapPreview({ isPremium = false, onUpgrade }: MarketHeatMapPreviewProps) {
  return (
    <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#B89355', marginBottom: 4 }}>
            Market Intelligence
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#F4F0E8' }}>
            Coachella Valley Heat Index
          </div>
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>
          Sample Preview
        </div>
      </div>

      {/* Zone bars */}
      <div style={{ padding: '20px 24px', filter: isPremium ? 'none' : 'blur(0px)' }}>
        {SAMPLE_ZONES.map((z, i) => (
          <div key={z.label} style={{ marginBottom: i < SAMPLE_ZONES.length - 1 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: isPremium ? '#F4F0E8' : (i < 3 ? '#F4F0E8' : 'rgba(244,240,232,0.4)'), letterSpacing: 1 }}>
                {z.label}
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: z.color, filter: !isPremium && i >= 3 ? 'blur(4px)' : 'none' }}>
                {z.pct}
              </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${z.heat * 100}%`,
                background: z.color,
                opacity: !isPremium && i >= 3 ? 0.25 : 0.85,
                filter: !isPremium && i >= 3 ? 'blur(3px)' : 'none',
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Locked state */}
      {!isPremium && (
        <div style={{
          padding: '0 24px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            border: '1px solid rgba(184,147,85,0.15)',
            padding: '20px 24px',
            textAlign: 'center',
            marginTop: 16,
          }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#B89355', marginBottom: 8 }}>
              Premium Market Intelligence
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.5)', lineHeight: 1.7, marginBottom: 16 }}>
              Unlock street-level heat maps, market velocity, pricing movement, and opportunity zones.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {onUpgrade ? (
                <button
                  onClick={onUpgrade}
                  style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase',
                    color: '#0F0E0D', background: '#B89355', border: 'none',
                    padding: '10px 22px', cursor: 'pointer',
                  }}
                >
                  Unlock Premium
                </button>
              ) : (
                <Link
                  to="/market-heatmaps"
                  style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase',
                    color: '#0F0E0D', background: '#B89355',
                    padding: '10px 22px', textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  See Full Map →
                </Link>
              )}
              <Link
                to="/#pricing"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2,
                  textTransform: 'uppercase', color: 'rgba(244,240,232,0.4)',
                  textDecoration: 'none', padding: '10px 4px',
                }}
              >
                View Plans →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

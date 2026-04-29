import { teaserScore } from '@/lib/dnaScore';

interface TeaserCardProps {
  address: string;
  onSignIn: () => void;
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const BLURRED_STATS = [
  { label: 'Estimated Market Value',  preview: '$███,███' },
  { label: 'Risk Category',           preview: '████████' },
  { label: 'Investment Score',        preview: '██ / 100' },
];

export default function TeaserCard({ address, onSignIn }: TeaserCardProps) {
  const { score, hex } = teaserScore(address);

  const label = score >= 70 ? 'Strong' : score >= 55 ? 'Moderate' : 'Caution';

  return (
    <div style={{
      margin: '28px auto 0',
      maxWidth: 420,
      background: 'rgba(15,14,13,0.92)',
      border: `1px solid ${hex}40`,
      padding: '28px 28px 24px',
      textAlign: 'left',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 160, height: 160,
        background: `radial-gradient(circle at 100% 0%, ${hex}22, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{
        fontFamily: 'Jost, sans-serif', fontSize: 9,
        letterSpacing: '3px', textTransform: 'uppercase',
        color: 'rgba(244,240,232,0.4)', marginBottom: 16,
      }}>
        PropertyDNA Preview
      </div>

      {/* Address */}
      <div style={{
        fontFamily: 'Cormorant Garamond, serif', fontSize: 15,
        fontWeight: 300, color: '#F4F0E8',
        marginBottom: 20, lineHeight: 1.4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {address}
      </div>

      {/* Score ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30"
              fill="none" stroke={hex} strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 30}`}
              strokeDashoffset={`${2 * Math.PI * 30 * (1 - score / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F4F0E8', lineHeight: 1 }}>
              {score}
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(244,240,232,0.4)', marginBottom: 4 }}>
            DNA Score
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: hex }}>
            {label}
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.3)', marginTop: 2 }}>
            Sign in for full breakdown
          </div>
        </div>
      </div>

      {/* Blurred data points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 22 }}>
        {BLURRED_STATS.map(({ label: l, preview }) => (
          <div key={l} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'rgba(244,240,232,0.25)' }}>
                <LockIcon />
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(244,240,232,0.35)' }}>
                {l}
              </div>
            </div>
            <div style={{
              fontFamily: 'Cormorant Garamond, serif', fontSize: 15,
              color: 'rgba(244,240,232,0.2)',
              filter: 'blur(5px)',
              userSelect: 'none',
            }}>
              {preview}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onSignIn}
        style={{
          width: '100%', padding: '14px 20px',
          background: hex, border: 'none', cursor: 'pointer',
          fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
          letterSpacing: '3px', textTransform: 'uppercase',
          color: score >= 55 ? '#0F0E0D' : '#F4F0E8',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        See Full Report — Sign In Free
      </button>

      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: 'rgba(244,240,232,0.2)', marginTop: 10, textAlign: 'center', letterSpacing: '0.5px' }}>
        Free account · No credit card required
      </div>
    </div>
  );
}

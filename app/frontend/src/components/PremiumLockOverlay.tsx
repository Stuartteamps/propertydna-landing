import { Link } from 'react-router-dom';

interface PremiumLockOverlayProps {
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onUpgrade?: () => void;
  compact?: boolean;
}

/**
 * Full glass overlay rendered on top of blurred/partial content.
 * Works standalone or inside PremiumPreviewCard.
 */
export default function PremiumLockOverlay({
  headline = 'Premium Intelligence Locked',
  body = 'Upgrade to view live market movement, comparable trend charts, micro-market heat maps, opportunity scoring, and saved property intelligence.',
  ctaLabel = 'Unlock Premium',
  ctaHref = '/#pricing',
  onUpgrade,
  compact = false,
}: PremiumLockOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(15,14,13,0.55) 0%, rgba(15,14,13,0.94) 55%)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        padding: compact ? '20px 24px' : '32px 40px',
        textAlign: 'center',
        zIndex: 10,
      }}
    >
      {/* Lock icon */}
      <div style={{
        width: compact ? 32 : 40, height: compact ? 32 : 40,
        border: '1px solid rgba(184,147,85,0.45)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: compact ? 10 : 16,
      }}>
        <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7" width="10" height="8" rx="1" stroke="#B89355" strokeWidth="1.2"/>
          <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#B89355" strokeWidth="1.2" fill="none"/>
        </svg>
      </div>

      <div style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: compact ? 9 : 10,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: '#B89355',
        marginBottom: compact ? 6 : 10,
      }}>
        Premium Intelligence
      </div>

      {!compact && (
        <div style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(18px,2.5vw,24px)',
          fontWeight: 300, color: '#F4F0E8',
          marginBottom: 12, lineHeight: 1.2,
        }}>
          {headline}
        </div>
      )}

      <div style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: compact ? 11 : 13,
        color: 'rgba(244,240,232,0.55)',
        lineHeight: 1.7,
        maxWidth: compact ? 280 : 400,
        marginBottom: compact ? 16 : 24,
      }}>
        {body}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onUpgrade ? (
          <button
            onClick={onUpgrade}
            style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
              letterSpacing: 3, textTransform: 'uppercase',
              color: '#0F0E0D', background: '#B89355', border: 'none',
              padding: compact ? '10px 20px' : '12px 28px', cursor: 'pointer',
            }}
          >
            {ctaLabel}
          </button>
        ) : (
          <Link
            to={ctaHref!}
            style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
              letterSpacing: 3, textTransform: 'uppercase',
              color: '#0F0E0D', background: '#B89355',
              padding: compact ? '10px 20px' : '12px 28px',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            {ctaLabel}
          </Link>
        )}
        <Link
          to="/#pricing"
          style={{
            fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', color: 'rgba(244,240,232,0.45)',
            textDecoration: 'none', padding: compact ? '10px 8px' : '12px 8px',
          }}
        >
          View Plans →
        </Link>
      </div>
    </div>
  );
}

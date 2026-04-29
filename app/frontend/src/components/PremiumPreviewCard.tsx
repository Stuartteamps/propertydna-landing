import { useState } from 'react';
import PremiumLockOverlay from './PremiumLockOverlay';

interface PremiumPreviewCardProps {
  tag: string;
  title: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  preview: React.ReactNode;
  isPremium?: boolean;
  /** Percentage of preview to show before blur kicks in (0–100) */
  revealPct?: number;
  onUpgrade?: () => void;
  style?: React.CSSProperties;
}

/**
 * Shows a partial content preview with a locked overlay.
 * If isPremium=true, renders the full preview with no overlay.
 * Uses existing PremiumLockOverlay for the gated state.
 */
export default function PremiumPreviewCard({
  tag, title, headline, body, ctaLabel, preview,
  isPremium = false, revealPct = 30,
  onUpgrade, style,
}: PremiumPreviewCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${isPremium ? 'rgba(184,147,85,0.3)' : 'rgba(255,255,255,0.07)'}`,
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#B89355', marginBottom: 4 }}>
            {tag}
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F4F0E8' }}>
            {title}
          </div>
        </div>
        {!isPremium && (
          <div style={{
            fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: '#0F0E0D', background: '#B89355', padding: '4px 10px',
          }}>
            Pro
          </div>
        )}
      </div>

      {/* Preview content */}
      <div style={{ position: 'relative' }}>
        {/* Visible portion */}
        <div style={{
          maxHeight: isPremium ? 'none' : `${revealPct * 3}px`,
          overflow: isPremium ? 'visible' : 'hidden',
          padding: '24px',
        }}>
          {preview}
        </div>

        {/* Gradient bleed into lock overlay */}
        {!isPremium && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
            background: 'linear-gradient(transparent, #0F0E0D)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Lock overlay — rendered as fixed-height block below preview */}
      {!isPremium && (
        <div style={{ padding: '0 24px 24px', paddingTop: 0 }}>
          <div style={{
            border: '1px solid rgba(184,147,85,0.15)',
            background: hovered ? 'rgba(184,147,85,0.04)' : 'transparent',
            padding: '20px 24px',
            textAlign: 'center',
            transition: 'background 0.3s',
          }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#B89355', marginBottom: 8 }}>
              {tag}
            </div>
            {headline && (
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F4F0E8', marginBottom: 8 }}>
                {headline}
              </div>
            )}
            {body && (
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.45)', lineHeight: 1.7, marginBottom: 16, maxWidth: 340, margin: '0 auto 16px' }}>
                {body}
              </div>
            )}
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
                  {ctaLabel ?? 'Upgrade Access'}
                </button>
              ) : (
                <a
                  href="/#pricing"
                  style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase',
                    color: '#0F0E0D', background: '#B89355',
                    padding: '10px 22px', textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  {ctaLabel ?? 'Upgrade Access'}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

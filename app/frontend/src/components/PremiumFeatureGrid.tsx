import { Link } from 'react-router-dom';

interface Feature {
  tag: string;
  title: string;
  desc: string;
  locked: boolean;
}

interface PremiumFeatureGridProps {
  features: Feature[];
  onUpgrade?: () => void;
}

/**
 * A grid showing a mix of free and premium-locked features.
 * Locked cards show a blurred body + upgrade CTA.
 */
export default function PremiumFeatureGrid({ features, onUpgrade }: PremiumFeatureGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 1,
      background: 'rgba(255,255,255,0.04)',
    }}>
      {features.map((f) => (
        <div
          key={f.title}
          style={{
            position: 'relative',
            padding: '28px 28px 32px',
            background: '#0F0E0D',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: f.locked ? 'rgba(184,147,85,0.45)' : '#B89355', marginBottom: 10 }}>
            {f.tag}
            {f.locked && (
              <span style={{ marginLeft: 8, fontSize: 8, color: '#B89355', border: '1px solid rgba(184,147,85,0.35)', padding: '2px 6px' }}>
                Pro
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, fontWeight: 300, color: f.locked ? 'rgba(244,240,232,0.5)' : '#F4F0E8', marginBottom: 10, filter: f.locked ? 'blur(0px)' : 'none' }}>
            {f.title}
          </div>
          <div style={{
            fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(244,240,232,0.4)',
            lineHeight: 1.75, filter: f.locked ? 'blur(3px)' : 'none',
            userSelect: f.locked ? 'none' : 'auto',
          }}>
            {f.desc}
          </div>

          {f.locked && (
            <div style={{ marginTop: 20 }}>
              {onUpgrade ? (
                <button
                  onClick={onUpgrade}
                  style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase',
                    color: '#0F0E0D', background: '#B89355', border: 'none',
                    padding: '9px 18px', cursor: 'pointer',
                  }}
                >
                  Unlock →
                </button>
              ) : (
                <Link
                  to="/#pricing"
                  style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase',
                    color: '#0F0E0D', background: '#B89355',
                    padding: '9px 18px', textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  Unlock →
                </Link>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

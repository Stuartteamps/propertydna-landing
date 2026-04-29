import { Link } from 'react-router-dom';

interface LockedModuleProps {
  title: string;
  tag: string;
  description: string;
  preview?: React.ReactNode;
  onUnlock?: () => void;
}

export default function LockedModule({ title, tag, description, preview, onUnlock }: LockedModuleProps) {
  return (
    <div style={{ position: 'relative', border: '1px solid rgba(184,147,85,0.18)', marginBottom: 24 }}>
      {/* Blurred preview behind overlay */}
      <div style={{ filter: 'blur(4px)', opacity: 0.35, pointerEvents: 'none', userSelect: 'none', padding: '32px 40px', minHeight: 160 }}>
        {preview ?? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: i % 3 === 0 ? 48 : 24, background: 'rgba(184,147,85,0.25)', borderRadius: 2 }} />
            ))}
          </div>
        )}
      </div>

      {/* Lock overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(15,14,13,0.7) 0%, rgba(15,14,13,0.92) 100%)',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#B89355', marginBottom: 12 }}>
          {tag}
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F4F0E8', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.5)', lineHeight: 1.7, maxWidth: 380, marginBottom: 24 }}>
          {description}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {onUnlock ? (
            <button
              onClick={onUnlock}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                letterSpacing: 3, textTransform: 'uppercase',
                color: '#000', background: '#B89355', border: 'none',
                padding: '12px 24px', cursor: 'pointer',
              }}
            >
              Unlock — $49/mo →
            </button>
          ) : (
            <Link
              to="/#pricing"
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                letterSpacing: 3, textTransform: 'uppercase',
                color: '#000', background: '#B89355',
                padding: '12px 24px', textDecoration: 'none', display: 'inline-block',
              }}
            >
              Unlock — $49/mo →
            </Link>
          )}
          <Link
            to="/sample-report"
            style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2,
              textTransform: 'uppercase', color: 'rgba(244,240,232,0.5)',
              textDecoration: 'none', padding: '12px 0',
            }}
          >
            View Sample →
          </Link>
        </div>
      </div>
    </div>
  );
}

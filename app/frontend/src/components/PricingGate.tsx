import React from 'react';

interface PricingGateProps {
  isOpen: boolean;
  email: string;
  address: string;
  formData: Record<string, string>;
  onClose: () => void;
  onSelect: (mode: 'per_report' | 'subscription' | 'enterprise') => void;
  loading: boolean;
}

const PricingGate: React.FC<PricingGateProps> = ({ isOpen, onClose, onSelect, loading }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 'clamp(32px,4vw,52px)',
        width: '100%', maxWidth: 560,
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 20, background: 'none', border: 'none', color: '#6B6252', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
        >×</button>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
          Your free report has been used
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 8, lineHeight: 1.1 }}>
          Choose how to continue.
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.75, marginBottom: 36 }}>
          You've used your complimentary report. Choose $4.99 for this report, $49/month for unlimited Pro access, or Enterprise for full intelligence.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {/* Per Report */}
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252' }}>
              Single Report
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <sup style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'rgba(240,235,224,0.6)', alignSelf: 'flex-start', marginTop: 8 }}>$</sup>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 48, fontWeight: 300, color: '#F0EBE0', lineHeight: 1 }}>4.99</span>
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', lineHeight: 1.6 }}>
              One report, delivered now.
            </div>
            <button
              disabled={loading}
              onClick={() => onSelect('per_report')}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px',
                textTransform: 'uppercase', color: '#F0EBE0',
                background: loading ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '12px 16px', cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 'auto', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#F0EBE0'; }}
            >
              {loading ? 'Loading…' : 'Pay $4.99 →'}
            </button>
          </div>

          {/* Subscription / Pro */}
          <div style={{
            border: '2px solid #C9A84C', padding: '20px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
            background: 'linear-gradient(160deg, rgba(184,147,85,0.08), transparent)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -11, left: 12,
              fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px',
              textTransform: 'uppercase', color: '#0A0908', background: '#C9A84C',
              padding: '4px 8px',
            }}>Best Value</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>
              Pro
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <sup style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 12, color: 'rgba(240,235,224,0.6)', alignSelf: 'flex-start', marginTop: 6 }}>$</sup>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, color: '#F0EBE0', lineHeight: 1 }}>49</span>
              <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginLeft: 3 }}>/mo</span>
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', lineHeight: 1.5 }}>
              Unlimited reports + market trends + moving averages.
            </div>
            <button
              disabled={loading}
              onClick={() => onSelect('subscription')}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px',
                textTransform: 'uppercase', color: '#000',
                background: loading ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                border: 'none', padding: '11px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 'auto', transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#cfa366'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#C9A84C'; }}
            >
              {loading ? 'Loading…' : 'Pro $49/mo →'}
            </button>
          </div>

          {/* Enterprise */}
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252' }}>
              Enterprise
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F0EBE0', lineHeight: 1 }}>Custom</span>
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', lineHeight: 1.5 }}>
              Micro-location scoring, heat maps, adjustment factor breakdowns.
            </div>
            <button
              disabled={loading}
              onClick={() => onSelect('enterprise')}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px',
                textTransform: 'uppercase', color: '#F0EBE0',
                background: loading ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.2)', padding: '11px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 'auto', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#F0EBE0'; }}
            >
              {loading ? 'Loading…' : 'Enterprise →'}
            </button>
          </div>
        </div>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 20 }}>
          Secure payment via Stripe · Cancel subscription anytime
        </div>
      </div>
    </div>
  );
};

export default PricingGate;

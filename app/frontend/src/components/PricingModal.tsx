import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { isNative } from '@/lib/nativeFeatures';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillEmail?: string;
}

// Web pivots to two B2B pro tiers: agents (Realtor Pro $149/mo) and investors
// ($299/mo). The consumer $49 / $479 tier has been retired — iOS is free for
// consumers, and the web is positioned as the power tool for professionals.
type Mode = 'realtor_pro' | 'investor';

const TIERS = [
  {
    mode: 'realtor_pro' as Mode,
    stripeMode: 'realtor_pro',
    label: 'Realtor Pro',
    price: 149,
    period: '/mo',
    highlight: true,
    features: [
      'Unlimited property reports',
      'Client-ready PDF + share links',
      'Comparable trend charts',
      'Listing intelligence + valuation deltas',
      'Saved property dashboard',
      'Buyer / seller talking points',
      'Cancel anytime',
    ],
    cta: 'Start Realtor Pro',
  },
  {
    mode: 'investor' as Mode,
    stripeMode: 'investor',
    label: 'Investor',
    price: 299,
    period: '/mo',
    highlight: false,
    features: [
      'Everything in Realtor Pro',
      'Portfolio genome mapping',
      'Bulk address lookup (CSV)',
      'API access for ROI / cap-rate workflows',
      'Multi-market heat maps',
      'Off-market signal alerts',
      'Priority support',
    ],
    cta: 'Start Investor',
  },
];

export default function PricingModal({ isOpen, onClose, prefillEmail = '' }: PricingModalProps) {
  // Apple Guideline 3.1.1: the iOS app exposes no subscription or paid tier
  // surfaces. PricingModal is a no-op on native — the early return happens
  // after all hooks so hooks stay unconditional (rules-of-hooks).
  const native = isNative();

  const { user } = useAuth();
  const [email, setEmail] = useState(() => {
    try { return prefillEmail || sessionStorage.getItem('pdna_email') || ''; } catch { return prefillEmail; }
  });
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email]);

  if (native) return null;
  if (!isOpen) return null;

  const handleSelect = async (tier: typeof TIERS[0]) => {
    const e = (user?.email || email).trim().toLowerCase();
    if (!e || !e.includes('@')) { setError('Enter a valid work email to continue.'); return; }
    setError('');
    setLoading(tier.mode);
    try { sessionStorage.setItem('pdna_email', e); } catch { /* sessionStorage unavailable */ }
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, fullName: user?.user_metadata?.full_name || '', address: 'subscription-only', mode: tier.stripeMode }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Checkout unavailable — please try again.');
        setLoading(null);
      }
    } catch {
      setError('Network error — please try again.');
      setLoading(null);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#0F0E0D', border: '1px solid rgba(255,255,255,0.1)', padding: 'clamp(28px,4vw,48px)', width: '100%', maxWidth: 800, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 20, background: 'none', border: 'none', color: '#6B6252', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
        >×</button>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 10 }}>
          Free for the humans. Pay only if you sell houses for a living.
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 16, lineHeight: 1.1 }}>
          One tier for buyers.<br /><em style={{ color: '#C9A84C' }}>Three for professionals.</em>
        </div>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300, color: 'rgba(240,235,224,0.55)', lineHeight: 1.75, marginBottom: 28 }}>
          The consumer iOS app + every report on this site stays free. Realtor Pro, Investor, and Enterprise tiers fund the tool so we can keep it free for the homebuyers and homesellers actually being targeted.
        </p>

        {/* FREE CONSUMER TIER — top of modal, always visible */}
        <div style={{ border: '1px solid rgba(0,255,136,0.3)', background: 'linear-gradient(160deg, rgba(0,255,136,0.05), transparent)', padding: '18px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#00cc77', marginBottom: 6 }}>
              Consumer · Free forever
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F0EBE0', marginBottom: 4, lineHeight: 1.2 }}>
              Every feature. Every report. $0.
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(240,235,224,0.55)', lineHeight: 1.6 }}>
              Unlimited search · Full DNA reports · Heat map · Watch list · Off-market matches · iOS + web. No credit card.
            </div>
          </div>
          <a
            href="https://apps.apple.com/app/id6745688826"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#0F0E0D', background: '#00cc77', padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Download iOS →
          </a>
        </div>

        {/* Email — hidden if already signed in */}
        {user?.email ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C9A84C' }}>
            Checking out as <strong>{user.email}</strong>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 8 }}>
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@brokerage.com"
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>
        )}

        {error && (
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', marginBottom: 16, padding: '10px 14px', background: 'rgba(185,82,69,0.1)', border: '1px solid rgba(185,82,69,0.25)' }}>
            {error}
          </div>
        )}

        {/* Tier grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {TIERS.map(tier => (
            <div
              key={tier.mode}
              style={{ border: tier.highlight ? '2px solid #C9A84C' : '1px solid rgba(255,255,255,0.1)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: tier.highlight ? 'linear-gradient(160deg, rgba(184,147,85,0.08), transparent)' : '#0A0908', position: 'relative' }}
            >
              {tier.highlight && (
                <div style={{ position: 'absolute', top: -10, left: 12, fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#0A0908', background: '#C9A84C', padding: '4px 8px' }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: tier.highlight ? '#C9A84C' : '#6B6252' }}>{tier.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <sup style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'rgba(240,235,224,0.6)', alignSelf: 'flex-start', marginTop: 6 }}>$</sup>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, fontWeight: 300, color: '#F0EBE0', lineHeight: 1 }}>{tier.price}</span>
                <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginLeft: 2 }}>{tier.period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#C9A84C', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>—</span>
                    <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(240,235,224,0.6)', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                disabled={loading !== null}
                onClick={() => handleSelect(tier)}
                style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: tier.highlight ? '#000' : '#F0EBE0', background: loading === tier.mode ? 'rgba(201,168,76,0.4)' : (tier.highlight ? '#C9A84C' : 'transparent'), border: tier.highlight ? 'none' : '1px solid rgba(255,255,255,0.2)', padding: '12px 16px', cursor: loading !== null ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'all 0.2s' }}
                onMouseEnter={e => { if (!loading) { if (!tier.highlight) { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; } else { e.currentTarget.style.background = '#cfa366'; } } }}
                onMouseLeave={e => { if (!loading) { if (!tier.highlight) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#F0EBE0'; } else { e.currentTarget.style.background = '#C9A84C'; } } }}
              >
                {loading === tier.mode ? 'Redirecting to Stripe…' : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* ENTERPRISE CTA — the monetization arm */}
        <div style={{ marginTop: 24, padding: '20px 22px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', marginBottom: 6 }}>
              Enterprise · Talk to us
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0', marginBottom: 4 }}>
              Bulk data, API, white-label
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(240,235,224,0.5)', lineHeight: 1.6 }}>
              Lenders, insurers, iBuyers, hedge funds, prop-tech. 3.58M parcels, REST + bulk. Custom pricing.
            </div>
          </div>
          <a
            href="mailto:enterprise@thepropertydna.com?subject=Enterprise%20data%20access"
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.25)', padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Contact sales →
          </a>
        </div>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 20 }}>
          Secure checkout via Stripe · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>
  );
}

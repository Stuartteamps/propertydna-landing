import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { isNative } from '@/lib/nativeFeatures';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillEmail?: string;
}

type Mode = 'pro' | 'enterprise';

const TIERS = [
  {
    mode: 'pro' as Mode,
    stripeMode: 'subscription',
    label: 'Pro',
    price: 49,
    period: '/mo',
    highlight: true,
    features: [
      '75 property reports per month',
      'Full DNA valuation + risk profile',
      'Comparable trend charts',
      'Market velocity index',
      'Saved property dashboard',
      'Priority PDF delivery',
      'Cancel anytime',
    ],
    cta: 'Start Pro',
  },
  {
    mode: 'enterprise' as Mode,
    stripeMode: 'enterprise',
    label: 'Enterprise',
    price: 149,
    period: '/mo',
    highlight: false,
    features: [
      '200 property reports per month',
      'Portfolio genome mapping',
      'Temporal drift modelling',
      'Bulk report API access',
      'White-label export',
      'Dedicated account manager',
    ],
    cta: 'Start Enterprise',
  },
];

// Apple IAP product IDs (must match the App Store Connect "PropertyDNA Pro" group).
const IAP_PRODUCT_ID = {
  monthly: 'com.thepropertydna.app.pro.monthly',
  yearly:  'com.thepropertydna.app.pro.yearly',
} as const;

export default function PricingModal({ isOpen, onClose, prefillEmail = '' }: PricingModalProps) {
  // Apple Guideline 3.1.1: the iOS app exposes no subscription or paid tier
  // surfaces. PricingModal is a no-op on native.
  if (isNative()) return null;
  const native = false;
  const { user } = useAuth();
  const [email, setEmail] = useState(() => {
    try { return prefillEmail || sessionStorage.getItem('pdna_email') || ''; } catch { return prefillEmail; }
  });
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  // Auto-fill from signed-in user
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email]);

  // IAP result events (iOS) — close on success, surface errors, clear loading
  useEffect(() => {
    if (!native) return;
    const onSuccess = () => { setLoading(null); onClose(); };
    const onCancelled = () => setLoading(null);
    const onError = (ev: any) => {
      const msg = ev?.detail?.error || 'Purchase failed. Please try again.';
      setError(String(msg).slice(0, 200));
      setLoading(null);
    };
    const onRestored = (ev: any) => {
      setLoading(null);
      if (ev?.detail?.active) onClose();
      else setError('No active purchase found on this Apple ID.');
    };
    window.addEventListener('pdna:purchase-success', onSuccess);
    window.addEventListener('pdna:purchase-cancelled', onCancelled);
    window.addEventListener('pdna:purchase-error', onError);
    window.addEventListener('pdna:purchase-restored', onRestored);
    return () => {
      window.removeEventListener('pdna:purchase-success', onSuccess);
      window.removeEventListener('pdna:purchase-cancelled', onCancelled);
      window.removeEventListener('pdna:purchase-error', onError);
      window.removeEventListener('pdna:purchase-restored', onRestored);
    };
  }, [native, onClose]);

  if (!isOpen) return null;

  const handleSelect = async (tier: typeof TIERS[0]) => {
    // Native iOS → In-App Purchase (StoreKit). Enterprise has no IAP product —
    // hidden from the tier grid on iOS, so handleSelect only sees Pro there.
    if (native && tier.mode === 'pro') {
      const productId = billing === 'annual' ? IAP_PRODUCT_ID.yearly : IAP_PRODUCT_ID.monthly;
      const wk: any = (window as any).webkit?.messageHandlers?.pdnaPurchase;
      if (!wk?.postMessage) {
        setError('In-App Purchase is unavailable on this device.');
        return;
      }
      setError('');
      setLoading(tier.mode);
      wk.postMessage({ productId });
      return; // wait for pdna:purchase-* event handlers above
    }

    // Web → Stripe Checkout
    const e = (user?.email || email).trim().toLowerCase();
    if (!e || !e.includes('@')) { setError('Enter a valid email to continue.'); return; }
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

  const handleRestore = () => {
    const wk: any = (window as any).webkit?.messageHandlers?.pdnaRestorePurchases;
    if (!wk?.postMessage) {
      setError('Restore is unavailable on this device.');
      return;
    }
    setError('');
    setLoading('pro');
    wk.postMessage({});
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
          Upgrade Your Access
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 28, lineHeight: 1.1 }}>
          Choose the plan that fits<br /><em style={{ color: '#C9A84C' }}>how you invest.</em>
        </div>

        {/* Email — hidden if already signed in */}
        {user?.email ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C9A84C' }}>
            Checking out as <strong>{user.email}</strong>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 8 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
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

        {/* Billing period toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', border: '1px solid rgba(255,255,255,0.12)' }}>
            {(['monthly', 'annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', padding: '9px 18px', cursor: 'pointer', border: 'none',
                  background: billing === b ? '#C9A84C' : 'transparent', color: billing === b ? '#000' : '#6B6252' }}>
                {b === 'monthly' ? 'Monthly' : 'Annual · 2 mo free'}
              </button>
            ))}
          </div>
        </div>

        {/* Tier grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(native ? TIERS.filter(t => t.mode === 'pro') : TIERS).map(baseTier => {
            const annual = billing === 'annual' && baseTier.mode === 'pro';
            const tier = annual
              ? { ...baseTier, stripeMode: 'subscription_annual', price: 479, period: '/yr', cta: 'Start Pro · Annual' }
              : baseTier;
            return (
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
              {annual && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 1, color: '#74C69D' }}>
                  $479/yr — save $109 vs monthly
                </div>
              )}
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
            );
          })}
        </div>

        {native ? (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            {/* Apple Guideline 3.1.2(c): explicit subscription title, length, price */}
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#F0EBE0', textAlign: 'center', lineHeight: 1.6, maxWidth: 560 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>PropertyDNA Pro — Auto-Renewable Subscription</div>
              <div style={{ color: '#6B6252' }}>
                {billing === 'annual'
                  ? '1-year subscription · $479.99 / year (≈$40.00 / month equivalent)'
                  : '1-month subscription · $49.99 / month'}
              </div>
            </div>
            <button
              onClick={handleRestore}
              disabled={loading !== null}
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', background: 'transparent', border: '1px solid rgba(201,168,76,0.4)', padding: '10px 18px', cursor: loading ? 'not-allowed' : 'pointer' }}>
              Restore Purchases
            </button>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', lineHeight: 1.6, maxWidth: 560 }}>
              Payment is charged to your Apple ID at confirmation of purchase. The subscription auto-renews at the same price unless canceled at least 24 hours before the end of the current period. Renewals can be turned off and the subscription managed in your iOS Settings → Apple ID → Subscriptions.
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" style={{ color: '#C9A84C', textDecoration: 'none' }}>Terms of Use (EULA)</a>
              <span>·</span>
              <a href="https://thepropertydna.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#C9A84C', textDecoration: 'none' }}>Privacy Policy</a>
              <span>·</span>
              <a href="https://thepropertydna.com/terms" target="_blank" rel="noreferrer" style={{ color: '#C9A84C', textDecoration: 'none' }}>Service Terms</a>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 20 }}>
            Secure checkout via Stripe · Cancel anytime · No hidden fees
          </div>
        )}
      </div>
    </div>
  );
}

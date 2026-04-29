import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'signin' | 'pricing';
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    description: 'First report on us. No card required.',
    features: ['1 PropertyDNA report', 'Valuation + comps', 'Risk profile', 'Neighborhood data'],
    cta: 'Get Free Report',
    mode: 'free' as const,
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'Unlimited reports + market intelligence.',
    features: ['Unlimited reports', 'Market trend charts', '30/60/90-day moving averages', 'Absorption rate + demand score', 'Dashboard access'],
    cta: 'Start Pro',
    mode: 'subscription' as const,
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Full intelligence suite for teams.',
    features: ['Everything in Pro', 'Micro-location scoring', 'Adjustment factor breakdown', 'Property event timeline', 'API access', 'Priority support'],
    cta: 'Talk to Sales',
    mode: 'enterprise' as const,
    highlighted: false,
  },
];

export default function AuthModal({ isOpen, onClose, initialView = 'signin' }: AuthModalProps) {
  const { user, signInWithGoogle, signInWithApple, signInWithFacebook, signOut, tier } = useAuth();
  const [view, setView]         = useState<'signin' | 'pricing'>(initialView);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail]       = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSignedIn = !!user;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const avatarUrl   = user?.user_metadata?.avatar_url;

  async function handlePlanSelect(plan: typeof PLANS[0]) {
    if (plan.mode === 'enterprise') {
      window.location.href = '/contact';
      return;
    }
    if (plan.mode === 'free') {
      onClose();
      const el = document.getElementById('form');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email || email,
          fullName: displayName,
          address: '',
          mode: plan.mode,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setCheckoutLoading(null);
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.09)',
        width: '100%', maxWidth: view === 'pricing' ? 860 : 440,
        position: 'relative', transition: 'max-width 0.3s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 18,
          background: 'none', border: 'none', color: '#6B6252',
          fontSize: 22, cursor: 'pointer', lineHeight: 1, zIndex: 2,
        }}>×</button>

        {/* ── SIGN IN VIEW ── */}
        {view === 'signin' && !isSignedIn && (
          <div style={{ padding: 'clamp(36px,5vw,52px)' }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
              PropertyDNA
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,34px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 8, lineHeight: 1.1 }}>
              Property intelligence,<br />starting now.
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, marginBottom: 32 }}>
              Sign in to access reports, save searches, and unlock your plan. First report is free.
            </div>

            {/* OAuth providers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

              {/* Google */}
              <button
                onClick={signInWithGoogle}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '13px 20px', border: '1px solid rgba(255,255,255,0.15)',
                  background: '#fff', cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 500, color: '#1a1a1a',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Apple */}
              <button
                onClick={signInWithApple}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '13px 20px', border: '1px solid rgba(255,255,255,0.15)',
                  background: '#000', cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 500, color: '#fff',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                onMouseLeave={e => (e.currentTarget.style.background = '#000')}
              >
                <svg width="17" height="17" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="#fff">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.9 268.9-317.9 72.5 0 132.9 47.9 178.3 47.9 43.2 0 111.1-50.9 190.8-50.9 30.2 0 108.2 2.6 163.4 103.3zM551.1 124.4c31.9-38.7 54.3-92.3 54.3-145.9 0-7.9-.6-15.9-1.9-22.5-51.6 2-112.8 34.5-150.2 78.5-28.9 33.8-56.2 87.4-56.2 141.6 0 8.6 1.3 17.1 1.9 19.9 3.2.6 8.5 1.3 13.8 1.3 46.2 0 103.2-30.8 138.3-72.9z"/>
                </svg>
                Continue with Apple
              </button>

              {/* Facebook */}
              <button
                onClick={signInWithFacebook}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '13px 20px', border: '1px solid rgba(255,255,255,0.15)',
                  background: '#1877F2', cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 500, color: '#fff',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#166fe5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1877F2')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#fff">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.955.93-1.955 1.883v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', letterSpacing: 2 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Email fallback */}
            {!emailMode ? (
              <button
                onClick={() => setEmailMode(true)}
                style={{
                  width: '100%', padding: '13px 20px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = '#F0EBE0'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#6B6252'; }}
              >
                Continue with Email →
              </button>
            ) : (
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '13px 16px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F0EBE0', fontFamily: 'Jost, sans-serif', fontSize: 13,
                    outline: 'none', marginBottom: 10, boxSizing: 'border-box',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && email.includes('@')) setView('pricing'); }}
                  autoFocus
                />
                <button
                  onClick={() => email.includes('@') && setView('pricing')}
                  style={{
                    width: '100%', padding: '13px', background: '#C9A84C', border: 'none',
                    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                    letterSpacing: 3, textTransform: 'uppercase', color: '#000', cursor: 'pointer',
                  }}
                >
                  Continue →
                </button>
              </div>
            )}

            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              By continuing you agree to our{' '}
              <a href="/about" style={{ color: '#C9A84C', textDecoration: 'none' }}>Terms</a>.
              {' '}First report always free.
            </div>
          </div>
        )}

        {/* ── SIGNED IN — show plan chooser or go to pricing ── */}
        {(view === 'signin' && isSignedIn) && (
          <div style={{ padding: 'clamp(36px,5vw,52px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              {avatarUrl && (
                <img src={avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)' }} />
              )}
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#F0EBE0' }}>
                  Welcome back{displayName ? `, ${displayName.split(' ')[0]}` : ''}.
                </div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>{user?.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setView('pricing')} style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase',
                color: '#000', background: '#C9A84C', border: 'none', padding: '12px 24px', cursor: 'pointer',
              }}>
                {tier === 'free' ? 'View Plans →' : 'Manage Plan →'}
              </button>
              <a href="/dashboard" style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
                color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 24px',
                textDecoration: 'none', display: 'inline-block',
              }} onClick={onClose}>
                My Dashboard
              </a>
              <button onClick={signOut} style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
                color: '#6B6252', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
              }}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* ── PRICING VIEW ── */}
        {view === 'pricing' && (
          <div style={{ padding: 'clamp(32px,4vw,48px)' }}>
            {isSignedIn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                {avatarUrl && <img src={avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />}
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>Signed in as {user?.email}</div>
              </div>
            )}

            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
              Choose Your Plan
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 28, lineHeight: 1.1 }}>
              Every plan starts with a free report.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  style={{
                    border: plan.highlighted ? '2px solid #C9A84C' : '1px solid rgba(255,255,255,0.09)',
                    padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10,
                    background: plan.highlighted ? 'linear-gradient(160deg,rgba(201,168,76,0.07),transparent)' : 'transparent',
                    position: 'relative',
                  }}
                >
                  {plan.highlighted && (
                    <div style={{
                      position: 'absolute', top: -11, left: 14,
                      fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
                      color: '#000', background: '#C9A84C', padding: '4px 10px',
                    }}>Most Popular</div>
                  )}
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: plan.highlighted ? '#C9A84C' : '#6B6252' }}>
                    {plan.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 300, color: '#F0EBE0', lineHeight: 1 }}>
                      {plan.price}
                    </span>
                    <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>{plan.period}</span>
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', lineHeight: 1.5 }}>{plan.description}</div>
                  <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                          <polyline points="2 6 5 9 10 3" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(240,235,224,0.7)', lineHeight: 1.4 }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    disabled={checkoutLoading === plan.id}
                    style={{
                      marginTop: 'auto', padding: '12px 16px', border: plan.highlighted ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      background: plan.highlighted ? (checkoutLoading === plan.id ? 'rgba(201,168,76,0.5)' : '#C9A84C') : 'transparent',
                      color: plan.highlighted ? '#000' : '#F0EBE0',
                      fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                      letterSpacing: 3, textTransform: 'uppercase',
                      cursor: checkoutLoading === plan.id ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {checkoutLoading === plan.id ? 'Loading…' : plan.cta + ' →'}
                  </button>
                </div>
              ))}
            </div>

            {!isSignedIn && (
              <button onClick={() => setView('signin')} style={{
                fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252',
                background: 'none', border: 'none', cursor: 'pointer',
              }}>
                ← Back to sign in
              </button>
            )}
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 8 }}>
              Secure payment via Stripe · Cancel anytime · No contracts
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

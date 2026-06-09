import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PricingModal from '@/components/PricingModal';
import FadeUp from '@/components/FadeUp';
import { isNative } from '@/lib/nativeFeatures';

const plans = [
  {
    tier: 'Free',
    label: 'First Report',
    price: '$0',
    period: 'one time',
    highlight: false,
    features: [
      '1 complimentary report',
      'Full DNA valuation + risk analysis',
      'Buyer & seller narrative',
      '"Would We Buy It?" verdict',
      'Email delivery in ~3 min',
    ],
    cta: 'Get Free Report',
    action: 'analyze' as const,
  },
  {
    tier: 'Per Report',
    label: 'Pay-Per-Use',
    price: '$4.99',
    period: 'per report',
    highlight: false,
    features: [
      'One report, no commitment',
      'Full DNA valuation + risk analysis',
      'Buyer & seller narrative',
      '"Would We Buy It?" verdict',
      'PDF + email delivery',
    ],
    cta: 'Run a Report',
    action: 'analyze' as const,
  },
  {
    tier: 'Realtor Pro',
    label: 'For Agents & Brokers',
    price: '$149',
    period: '/ month',
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
    action: 'subscribe' as const,
  },
  {
    tier: 'Investor',
    label: 'For Funds & Operators',
    price: '$299',
    period: '/ month',
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
    action: 'subscribe' as const,
  },
];

export default function Pricing() {
  const [pricingOpen, setPricingOpen] = useState(false);
  const navigate = useNavigate();

  // Apple Guideline 3.1.1 — no payment surfaces or paid-tier references
  // in the iOS app. This page just describes the product.
  if (isNative()) {
    return (
      <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
        <Nav />
        <section style={{ padding: '100px 24px 60px', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#B89355', marginBottom: 16 }}>
            PropertyDNA
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(32px,5vw,48px)', fontWeight: 300, color: '#F4F0E8', margin: '0 0 16px', lineHeight: 1.1 }}>
            Property intelligence on demand.
          </h1>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.6)', lineHeight: 1.8, margin: '0 0 32px' }}>
            Generate a complete property intelligence report on any U.S. address. Live valuation, comparable sales, climate context, ownership history, and a direct verdict on whether to buy. Save reports to your device for offline reading at showings.
          </p>
          <button onClick={() => navigate('/analyze')} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', border: 'none', padding: '14px 24px', cursor: 'pointer' }}>
            Analyze a Property →
          </button>
        </section>
        <Footer />
      </div>
    );
  }

  const handleCta = (action: 'analyze' | 'subscribe') => {
    if (action === 'analyze') navigate('/analyze');
    else setPricingOpen(true);
  };

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(100px, 12vw, 140px)',
        paddingBottom: 'clamp(60px, 8vw, 100px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.10), transparent 55%), #0F0E0D',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>

          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: '4px', textTransform: 'uppercase',
                color: '#B89355', marginBottom: 20,
              }}>
                Plans
              </div>
              <h1 style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 'clamp(36px, 5vw, 64px)',
                fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
                color: '#F4F0E8', marginBottom: 20,
              }}>
                Free for buyers.{' '}
                <em style={{ fontStyle: 'italic', color: '#B89355' }}>Built for pros.</em>
              </h1>
              <p style={{
                fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300,
                lineHeight: 1.85, color: 'rgba(244,240,232,0.5)',
                maxWidth: 560, margin: '0 auto',
              }}>
                Every homebuyer gets a free report — no credit card. Real estate professionals get the unlimited data edge their clients are quietly paying for.
              </p>
            </div>
          </FadeUp>

          {/* Pricing grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1px',
            background: 'rgba(255,255,255,0.06)',
          }}>
            {plans.map((plan, i) => (
              <FadeUp key={plan.tier} delay={i * 0.06}>
                <div style={{
                  padding: '40px 32px',
                  background: plan.highlight ? '#131210' : '#0A0908',
                  border: plan.highlight ? '1px solid rgba(184,147,85,0.35)' : '1px solid transparent',
                  display: 'flex', flexDirection: 'column',
                  height: '100%', boxSizing: 'border-box',
                  position: 'relative',
                }}>
                  {plan.highlight && (
                    <div style={{
                      position: 'absolute', top: 0, left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontFamily: 'Jost, sans-serif', fontSize: 8,
                      letterSpacing: '3px', textTransform: 'uppercase',
                      color: '#0F0E0D', background: '#B89355',
                      padding: '4px 12px', whiteSpace: 'nowrap',
                    }}>
                      Most Popular
                    </div>
                  )}

                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 9,
                    letterSpacing: '3px', textTransform: 'uppercase',
                    color: '#B89355', marginBottom: 4,
                  }}>
                    {plan.label}
                  </div>

                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 10,
                    letterSpacing: '2px', textTransform: 'uppercase',
                    color: 'rgba(244,240,232,0.35)', marginBottom: 20,
                  }}>
                    {plan.tier}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 32 }}>
                    <div style={{
                      fontFamily: 'Cormorant Garamond, Georgia, serif',
                      fontSize: 'clamp(36px, 4vw, 48px)',
                      fontWeight: 300, color: '#F4F0E8', lineHeight: 1,
                      letterSpacing: '-1px',
                    }}>
                      {plan.price}
                    </div>
                    <div style={{
                      fontFamily: 'Jost, sans-serif', fontSize: 11,
                      color: 'rgba(244,240,232,0.35)',
                    }}>
                      {plan.period}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40, flex: 1 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 4, height: 4, borderRadius: '50%',
                          background: '#B89355', flexShrink: 0, marginTop: 6,
                        }} />
                        <div style={{
                          fontFamily: 'Jost, sans-serif', fontSize: 13,
                          fontWeight: 300, color: 'rgba(244,240,232,0.6)',
                          lineHeight: 1.5,
                        }}>
                          {f}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCta(plan.action)}
                    style={{
                      fontFamily: 'Jost, sans-serif', fontSize: 10,
                      fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase',
                      padding: '16px', cursor: 'pointer', transition: 'background 0.2s',
                      background: plan.highlight ? '#B89355' : 'transparent',
                      color: plan.highlight ? '#0F0E0D' : 'rgba(244,240,232,0.7)',
                      border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = plan.highlight ? '#cfa366' : 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = plan.highlight ? '#B89355' : 'transparent';
                    }}
                  >
                    {plan.cta}
                  </button>
                </div>
              </FadeUp>
            ))}
          </div>

          {/* FAQ row */}
          <FadeUp delay={0.2}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '32px 48px',
              marginTop: 72,
              paddingTop: 48,
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
              {[
                ['Can I cancel anytime?', 'Yes. Realtor Pro and Investor plans are billed monthly with no contracts. Cancel from your dashboard at any time.'],
                ['Is the first report really free?', 'Yes — one full report, no credit card required. Just sign in and submit any address.'],
                ['What data sources do you use?', 'RentCast AVM, FEMA hazard data, census demographics, market comps, and 40+ enrichment signals.'],
                ['Do you cover all US markets?', 'Yes — we cover 2,800+ US markets nationwide. Submit any residential or commercial address and our engine will sequence it.'],
              ].map(([q, a]) => (
                <div key={q}>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 12,
                    fontWeight: 400, color: '#F4F0E8', marginBottom: 10,
                    letterSpacing: '0.3px',
                  }}>
                    {q}
                  </div>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 13,
                    fontWeight: 300, lineHeight: 1.75,
                    color: 'rgba(244,240,232,0.45)',
                  }}>
                    {a}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* CTA */}
          <FadeUp delay={0.25}>
            <div style={{ textAlign: 'center', marginTop: 72 }}>
              <button
                type="button"
                onClick={() => navigate('/analyze')}
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#0F0E0D', background: '#B89355',
                  border: 'none', padding: '18px 40px', cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
                onMouseLeave={e => (e.currentTarget.style.background = '#B89355')}
              >
                Get Your Free Report →
              </button>
            </div>
          </FadeUp>

        </div>
      </section>

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      <Footer />
    </div>
  );
}

import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import PremiumPreviewCard from '@/components/PremiumPreviewCard';
import MarketHeatMapPreview from '@/components/MarketHeatMapPreview';
import { Link } from 'react-router-dom';
import { isPremiumUser } from '@/lib/isPremiumUser';

export default function SampleReport() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'signin'|'signup'|'sales'>('signin');
  const premium = isPremiumUser();
  const openModal = (tab: 'signin'|'signup'|'sales' = 'signup') => { setModalTab(tab); setModalOpen(true); };
  return (
    <div className="bg-espresso text-canvas min-h-screen">
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => { setModalTab('signup'); setModalOpen(true); }}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

      <section className="pt-32 md:pt-40 px-6 md:px-12 pb-12">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              Sample Report
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-8"
              style={{ fontSize: 'clamp(36px, 5vw, 68px)', letterSpacing: '-1.2px' }}
            >
              100 W Andreas Rd
              <br />
              <em className="italic text-gold">Palm Springs, CA</em>
            </h1>
            <p className="font-sans text-[15px] font-light leading-[1.9] text-canvas/65 max-w-2xl">
              Below is a live example of a PropertyDNA intelligence report. Every real report
              follows this exact format — formatted, verified, and delivered to your inbox in under
              three minutes.
            </p>
          </FadeUp>
        </div>
      </section>

      <section className="px-6 md:px-12 pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div
              className="p-8 md:p-12 border border-gold/25"
              style={{
                background:
                  'linear-gradient(145deg, rgba(34,28,22,0.92), rgba(20,17,14,0.95))',
                boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(184,147,85,0.12)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
                <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase">
                  DNA Profile · Grade A+
                </div>
                <div className="font-sans text-[10px] tracking-[2px] text-canvas/40">
                  33.8°N · 116.5°W
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                {[
                  ['Valuation Confidence', '94'],
                  ['Risk Index', '18'],
                  ['Yield Potential', '76'],
                  ['Market Momentum', '62'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-2">
                      {label}
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <div className="font-serif text-4xl font-light text-canvas leading-none">
                        {val}
                      </div>
                      <div className="text-[10px] text-canvas/30">/100</div>
                    </div>
                    <div className="h-[2px] w-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Valuation */}
              <div className="py-6 border-t border-b border-white/10 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-2">
                    Estimated Market Value
                  </div>
                  <div className="font-serif text-3xl font-light text-gold">$995,000</div>
                </div>
                <div>
                  <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-2">
                    Range Low
                  </div>
                  <div className="font-serif text-3xl font-light text-canvas">$955,000</div>
                </div>
                <div>
                  <div className="font-sans text-[9px] tracking-[2px] text-canvas/45 uppercase mb-2">
                    Range High
                  </div>
                  <div className="font-serif text-3xl font-light text-canvas">$1,040,000</div>
                </div>
              </div>

              {/* Narratives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                <div>
                  <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-3">
                    Buyer Analysis
                  </div>
                  <p className="font-serif text-base font-light leading-[1.8] text-canvas/80 italic">
                    Strong fundamentals with a clean title chain and no active planning pressure.
                    Recent comparables within 500m support the asking range, with a modest upside
                    tied to the upcoming transit corridor expansion.
                  </p>
                </div>
                <div>
                  <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-3">
                    Seller Analysis
                  </div>
                  <p className="font-serif text-base font-light leading-[1.8] text-canvas/80 italic">
                    Market momentum favors listing within the next two quarters. Staging and
                    targeted positioning to out-of-state investors could lift the achievable price
                    into the upper range band.
                  </p>
                </div>
              </div>

              {/* Verdict */}
              <div
                className="p-6 border border-gold/40"
                style={{ background: 'linear-gradient(160deg, rgba(184,147,85,0.12), transparent)' }}
              >
                <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-2">
                  Would We Buy It?
                </div>
                <div className="font-serif text-3xl font-light text-canvas mb-2">Yes.</div>
                <div className="text-[14px] font-light leading-[1.7] text-canvas/70">
                  Clean data, strong comps, low risk — all four strands point the same direction.
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Premium gated intelligence modules */}
      <section className="px-6 md:px-12 pb-16">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4 mt-16">
              Premium Intelligence
            </div>
            <h2
              className="font-serif font-light text-canvas mb-10"
              style={{ fontSize: 'clamp(24px,3.5vw,44px)', letterSpacing: '-0.8px' }}
            >
              Go beyond the
              <br />
              <em className="italic text-gold">basic valuation.</em>
            </h2>
          </FadeUp>

          <div className="flex flex-col gap-8">
            {/* Comparable Trend Chart */}
            <FadeUp delay={0.05}>
              <PremiumPreviewCard
                tag="Pro · Comparable Analysis"
                title="Sales Trend — Last 24 Months"
                headline="See the Full Property Signal"
                body="Comparable trend charts, price-per-sqft movement, and sales velocity across the subject's micro-market. Available with Pro subscription."
                ctaLabel="Upgrade Access"
                isPremium={premium}
                revealPct={40}
                onUpgrade={() => openModal('signup')}
                preview={
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, alignItems: 'flex-end', height: 72, marginBottom: 8 }}>
                      {[72,68,74,70,78,76,80,82,77,84,88,86,90,87,92,89,94,91,96,93,98,95,100,97].map((h, i) => (
                        <div key={i} style={{ background: `rgba(184,147,85,${0.25 + h/250})`, height: `${h}%`, minHeight: 2 }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Jost, sans-serif', fontSize: 9, color: 'rgba(244,240,232,0.3)', letterSpacing: 1 }}>
                      <span>Jan 2023</span><span>Jul 2023</span><span>Jan 2024</span><span>Jul 2024</span><span>Jan 2025</span>
                    </div>
                  </div>
                }
                style={{ background: '#0A0908' }}
              />
            </FadeUp>

            {/* Neighborhood movement */}
            <FadeUp delay={0.1}>
              <PremiumPreviewCard
                tag="Pro · Neighborhood Intelligence"
                title="Micro-Market Movement Index"
                headline="Unlock Market Movement"
                body="Days-on-market trend, absorption rate, demand intensity score, and price appreciation velocity for this ZIP code and surrounding micro-markets."
                ctaLabel="Upgrade to Pro"
                isPremium={premium}
                revealPct={30}
                onUpgrade={() => openModal('signup')}
                preview={
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[['Days on Market', '18', '↓ 6 from prior mo'],['Absorption Rate', '94%', '↑ strong demand'],['Demand Score', '88/100', 'Highly competitive']].map(([l, v, s]) => (
                      <div key={l}>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, color: 'rgba(244,240,232,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: '#F4F0E8', marginBottom: 2 }}>{v}</div>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#B89355' }}>{s}</div>
                      </div>
                    ))}
                  </div>
                }
                style={{ background: '#0A0908' }}
              />
            </FadeUp>

            {/* Heat map preview */}
            <FadeUp delay={0.15}>
              <MarketHeatMapPreview isPremium={premium} onUpgrade={() => openModal('signup')} />
            </FadeUp>

            {/* Risk signals */}
            <FadeUp delay={0.2}>
              <PremiumPreviewCard
                tag="Pro · Risk Intelligence"
                title="Extended Risk Signal Report"
                headline="Premium Intelligence Locked"
                body="Micro-location risk flags: road noise index, proximity scoring, power line exposure, soil subsidence probability, and 40+ environmental risk markers."
                ctaLabel="Unlock Risk Signals"
                isPremium={premium}
                revealPct={25}
                onUpgrade={() => openModal('signup')}
                preview={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['Road Noise Index','Low — 38 dB avg'],['Proximity: Power Lines','None within 500ft'],['Soil Stability','Stable · Low subsidence'],['Air Quality Index','47 — Good'],['Wildfire Risk','Minimal · Zone W0']].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.5)' }}>{l}</span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: '#F4F0E8' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                }
                style={{ background: '#0A0908' }}
              />
            </FadeUp>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 md:py-20 text-center">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
          >
            Sequence Your Property
          </Link>
          <Link
            to="/#pricing"
            className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-8 py-4"
            style={{ textDecoration: 'none' }}
          >
            View Plans →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
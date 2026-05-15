import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import FadeUp from '@/components/FadeUp';
import MarketHeatMapPreview from '@/components/MarketHeatMapPreview';
import TeaserCard from '@/components/TeaserCard';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { useAuth } from '@/lib/auth';
import { isPremiumUser } from '@/lib/isPremiumUser';
import PropertyTicker from '@/components/PropertyTicker';
import FeaturedDossiers from '@/components/FeaturedDossiers';
import FeaturedNeighborhoods from '@/components/FeaturedNeighborhoods';
import PedigreeProofBar from '@/components/PedigreeProofBar';

type ModalView = 'signin' | 'pricing';

const metrics = [
  ['14.3M PROPERTIES INDEXED'],
  ['ACCURACY RATE 97.6%'],
  ['AVG VALUATION SPEED 1.8S'],
  ['RISK SIGNALS TRACKED 312'],
  ['DATA PARTNERS 47'],
  ['MARKETS COVERED 2,800+'],
];

const capabilities = [
  ['01', 'CORE ENGINE',       'Genetic Valuation Engine',  'Our model dissects 847 property attributes — structural, contextual, temporal — to derive a living valuation that breathes with the market.'],
  ['02', 'RISK INTELLIGENCE', 'Risk Strand Analysis',      'Identify hidden risk sequences before they manifest. Flood exposure, subsidence probability, planning pressure, and 60+ environmental markers.'],
  ['03', 'COMP ANALYSIS',     'Comparative Sequencing',    'Run deep comparables across 12 dimensions simultaneously. See not just what sold nearby — but why it sold at that price.'],
  ['04', 'FORECASTING',       'Temporal Drift Modelling',  "Track how a property's value markers shift over 5, 10, 25 year windows. Understand the trajectory, not just the snapshot."],
  ['05', 'PORTFOLIO',         'Portfolio Genome Mapping',  'Visualise your entire portfolio as an interconnected genetic map. Spot concentration risk, diversification gaps, and hidden correlations.'],
  ['06', 'DATA LAYER',        'Live Data Splicing',        'Real-time feeds from 47 verified data partners: land registry, planning portals, flood authorities, energy ratings, and census data.'],
];

const OAuthBtn = ({
  onClick, bg, hoverBg, color = '#fff', children,
}: {
  onClick: () => void;
  bg: string;
  hoverBg: string;
  color?: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '13px 20px', border: '1px solid rgba(255,255,255,0.1)',
      background: bg, cursor: 'pointer',
      fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 500,
      color, letterSpacing: '0.3px', transition: 'background 0.15s',
      width: '100%',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
    onMouseLeave={e => (e.currentTarget.style.background = bg)}
  >
    {children}
  </button>
);

export default function Landing() {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [modalView,   setModalView]   = useState<ModalView>('signin');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [address,     setAddress]     = useState('');
  const [addrResult,  setAddrResult]  = useState<AddressResult | null>(null);
  const [teaserAddr,  setTeaserAddr]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const pendingFire = useRef(false);
  const { user, signInWithGoogle, signInWithApple } = useAuth();
  const premium = isPremiumUser();
  const navigate = useNavigate();

  const openModal = (view: ModalView = 'signin') => { setModalView(view); setModalOpen(true); };

  // Core submit: check usage then route to /report-pending or open pricing
  const submitReport = async (addr: string, result?: AddressResult | null) => {
    if (!user?.email || !addr.trim()) return;
    setSubmitting(true);
    try {
      const usageRes = await fetch('/.netlify/functions/check-usage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const usage = await usageRes.json().catch(() => ({ reportCount: 0, isSubscribed: false }));
      if (!usage.isSubscribed && (usage.reportCount || 0) > 0) {
        setPricingOpen(true);
        setSubmitting(false);
        return;
      }
    } catch { /* fail open — proceed to report-pending */ }

    const params = new URLSearchParams({
      bypass:   '1',
      email:    user.email,
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || '',
      address:  result?.street || addr,
      city:     result?.city   || '',
      state:    result?.state  || '',
      zip:      result?.zip    || '',
      role:     'Buyer',
      phone:    '',
    });
    navigate(`/report-pending?${params.toString()}`);
  };

  // After sign-in fires if user had a pending address
  useEffect(() => {
    if (user && pendingFire.current && teaserAddr) {
      pendingFire.current = false;
      setModalOpen(false);
      const addr = teaserAddr;
      setTeaserAddr('');
      submitReport(addr, addrResult);
    }
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    if (!user) {
      setTeaserAddr(trimmed);
      pendingFire.current = true;
      openModal('signin');
    } else {
      submitReport(trimmed, addrResult);
    }
  };

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0];

  return (
    <div className="bg-espresso text-canvas">
      <Nav
        onSignInClick={() => openModal('signin')}
        onRequestAccessClick={() => navigate('/analyze')}
      />

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 24px 80px',
          background: 'radial-gradient(ellipse at 50% 20%, rgba(184,147,85,0.13), transparent 65%), #0F0E0D',
          position: 'relative',
        }}
      >
        {/* Wordmark */}
        <FadeUp delay={0}>
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '7px', textTransform: 'uppercase',
              color: 'rgba(184,147,85,0.7)', marginBottom: 4,
            }}>
              Property
            </div>
            <div style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(80px, 13vw, 148px)',
              fontWeight: 300, letterSpacing: '-4px',
              color: '#F4F0E8', lineHeight: 0.85,
            }}>
              DNA
            </div>
          </div>
        </FadeUp>

        {/* Tagline */}
        <FadeUp delay={0.08}>
          <p style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 'clamp(12px, 1.3vw, 14px)',
            fontWeight: 300, letterSpacing: '1.5px',
            color: 'rgba(244,240,232,0.4)',
            maxWidth: 380, lineHeight: 1.9, marginBottom: 44,
          }}>
            The complete genetic profile of any property — valuation,
            risk, and market intelligence in under 3 minutes.
          </p>
        </FadeUp>

        {/* ── Signed-in state ── */}
        {user ? (
          <FadeUp delay={0.12}>
            <div style={{ width: '100%', maxWidth: 560 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(184,147,85,0.7)', marginBottom: 20 }}>
                Welcome back{displayName ? `, ${displayName}` : ''} — enter any address to run a report
              </div>
              <form onSubmit={handleSearch}>
                <div style={{ display: 'flex', border: '1px solid rgba(184,147,85,0.4)', background: 'rgba(15,14,13,0.7)' }}>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onSelect={r => { setAddress(r.display); setAddrResult(r); }}
                    placeholder="Enter a property address…"
                    containerStyle={{ flex: 1 }}
                    inputStyle={{
                      width: '100%', padding: '17px 20px',
                      background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300,
                      color: '#F4F0E8',
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '17px 28px', flexShrink: 0,
                      background: submitting ? 'rgba(184,147,85,0.5)' : '#B89355',
                      border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500,
                      letterSpacing: '3px', textTransform: 'uppercase', color: '#0F0E0D',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#cfa366'; }}
                    onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#B89355'; }}
                  >
                    {submitting ? 'Submitting…' : 'Analyze →'}
                  </button>
                </div>
              </form>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.25)', marginTop: 12, letterSpacing: '1px' }}>
                Report delivered to your inbox + saved to your dashboard
              </div>
            </div>
          </FadeUp>
        ) : (
          /* ── Signed-out state: address bar + OAuth stack ── */
          <FadeUp delay={0.12}>
            <div style={{ width: '100%', maxWidth: 420 }}>

              {/* Address search — gated, triggers auth or teaser on submit */}
              <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex',
                  border: '1px solid rgba(184,147,85,0.3)',
                  background: 'rgba(15,14,13,0.6)',
                }}>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onSelect={r => { setAddress(r.display); setAddrResult(r); }}
                    placeholder="Enter a property address…"
                    containerStyle={{ flex: 1 }}
                    inputStyle={{
                      width: '100%', padding: '16px 18px',
                      background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300,
                      color: '#F4F0E8',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '16px 22px', flexShrink: 0,
                      background: '#B89355', border: 'none', cursor: 'pointer',
                      fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500,
                      letterSpacing: '3px', textTransform: 'uppercase', color: '#0F0E0D',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#B89355')}
                  >
                    Analyze →
                  </button>
                </div>
                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  color: 'rgba(244,240,232,0.22)', marginTop: 8, letterSpacing: '0.5px',
                }}>
                  {teaserAddr ? 'Preview loaded — sign in to unlock full report' : "Sign in required to run a report — it's free"}
                </div>
              </form>

              {/* Teaser result card */}
              {teaserAddr && (
                <TeaserCard
                  address={teaserAddr}
                  onSignIn={() => { pendingFire.current = true; openModal('signin'); }}
                />
              )}

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 9,
                  color: 'rgba(244,240,232,0.3)', letterSpacing: '2px', textTransform: 'uppercase',
                }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* OAuth buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <OAuthBtn onClick={signInWithGoogle} bg="#fff" hoverBg="#f5f5f5" color="#1a1a1a">
                  <svg width="17" height="17" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </OAuthBtn>

                <OAuthBtn onClick={signInWithApple} bg="#000" hoverBg="#1a1a1a">
                  <svg width="16" height="16" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="#fff">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.9 268.9-317.9 72.5 0 132.9 47.9 178.3 47.9 43.2 0 111.1-50.9 190.8-50.9 30.2 0 108.2 2.6 163.4 103.3zM551.1 124.4c31.9-38.7 54.3-92.3 54.3-145.9 0-7.9-.6-15.9-1.9-22.5-51.6 2-112.8 34.5-150.2 78.5-28.9 33.8-56.2 87.4-56.2 141.6 0 8.6 1.3 17.1 1.9 19.9 3.2.6 8.5 1.3 13.8 1.3 46.2 0 103.2-30.8 138.3-72.9z"/>
                  </svg>
                  Continue with Apple
                </OAuthBtn>

              </div>

              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                color: 'rgba(244,240,232,0.2)', marginTop: 20, lineHeight: 1.7, letterSpacing: '0.3px',
              }}>
                By continuing you agree to our Terms. First report always free.
              </div>
            </div>
          </FadeUp>
        )}

        {/* Scroll cue */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <svg width="1" height="24" viewBox="0 0 1 24" fill="none">
            <line x1="0.5" y1="0" x2="0.5" y2="24" stroke="rgba(184,147,85,0.25)" strokeWidth="1"/>
          </svg>
        </div>
      </section>

      {/* ── LIVE PROPERTY TICKER ───────────────────────────────────── */}
      <PropertyTicker />

      {/* ── METRICS MARQUEE ────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden', padding: '20px 0',
      }}>
        <div className="flex gap-12 whitespace-nowrap marquee">
          {[...metrics, ...metrics].map(([m], i) => (
            <div key={i} className="font-sans text-[10px] tracking-[3px] text-canvas/50 uppercase">
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* ── PEDIGREE PROOF BAR ─────────────────────────────────────── */}
      <PedigreeProofBar />

      {/* ── FEATURED VERIFIED DOSSIERS ─────────────────────────────── */}
      <FeaturedDossiers />

      {/* ── FEATURED NEIGHBORHOODS ─────────────────────────────────── */}
      <FeaturedNeighborhoods />

      {/* ── CAPABILITY STACK ───────────────────────────────────────── */}
      <section id="platform" className="px-6 md:px-12 py-24 md:py-32" style={{ background: '#0A0908' }}>
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center mb-20">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                Capability Stack
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05] mb-6"
                style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', letterSpacing: '-1px' }}
              >
                Six systems.<br />
                <em className="italic text-gold">One genome.</em>
              </h2>
              <p className="font-sans text-[15px] font-light leading-[1.85] text-canvas/60 max-w-2xl mx-auto">
                Each module of PropertyDNA is a precision instrument. Together, they form the most
                complete picture of a property that has ever existed.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {capabilities.map(([num, tag, title, desc], i) => (
              <FadeUp key={num} delay={i * 0.06}>
                <div className="relative p-10 h-full bg-[#0A0908] hover:bg-[#141210] transition-colors group">
                  <div className="flex items-baseline justify-between mb-8">
                    <div className="font-serif text-5xl font-light text-gold leading-none">{num}</div>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/40 uppercase">{tag}</div>
                  </div>
                  <div className="font-serif text-2xl font-light text-canvas leading-tight mb-4 group-hover:text-gold transition-colors">
                    {title}
                  </div>
                  <div className="text-[13px] font-light leading-[1.8] text-canvas/55">{desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET HEAT MAP PREVIEW ────────────────────────────────── */}
      <section className="bg-espresso px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="mb-16">
              <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">
                Premium Intelligence
              </div>
              <h2
                className="font-serif font-light text-canvas leading-[1.05] max-w-3xl"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)', letterSpacing: '-0.8px' }}
              >
                Go beyond the<br />
                <em className="italic text-gold">basic valuation.</em>
              </h2>
              <p className="font-sans text-[15px] font-light leading-[1.85] text-canvas/55 max-w-2xl mt-6">
                Pro subscribers unlock live market movement, comparable trend charts, micro-market
                heat maps, opportunity scoring, and saved property intelligence.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.06}>
            <MarketHeatMapPreview isPremium={premium} onUpgrade={() => openModal('pricing')} />
          </FadeUp>
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────────── */}
      <section
        style={{
          padding: 'clamp(60px,8vw,100px) clamp(24px,6vw,80px)',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(184,147,85,0.10), transparent 65%), #0A0908',
          textAlign: 'center',
        }}
      >
        <FadeUp>
          <div style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 'clamp(32px, 4vw, 56px)',
            fontWeight: 300, letterSpacing: '-0.8px',
            color: '#F4F0E8', marginBottom: 32,
          }}>
            Ready to decode your{' '}
            <em style={{ fontStyle: 'italic', color: '#B89355' }}>first property?</em>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/analyze')}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                letterSpacing: '3px', textTransform: 'uppercase',
                color: '#0F0E0D', background: '#B89355',
                border: 'none', padding: '18px 36px', cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
              onMouseLeave={e => (e.currentTarget.style.background = '#B89355')}
            >
              Get Your Free Report →
            </button>
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                letterSpacing: '3px', textTransform: 'uppercase',
                color: 'rgba(244,240,232,0.7)',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                padding: '18px 36px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#B89355'; e.currentTarget.style.color = '#B89355'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(244,240,232,0.7)'; }}
            >
              View Pricing
            </button>
          </div>
        </FadeUp>
      </section>

      <AuthModal
        isOpen={modalOpen}
        initialView={modalView}
        onClose={() => { setModalOpen(false); pendingFire.current = false; }}
      />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      <Footer />
    </div>
  );
}

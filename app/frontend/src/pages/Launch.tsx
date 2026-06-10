import { useEffect } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import ShareCTA from '@/components/ShareCTA';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079';

const COVERAGE = [
  { label: 'Coachella Valley', detail: 'Palm Springs, Palm Desert, La Quinta, Indio, Rancho Mirage, Cathedral City, Desert Hot Springs, Indian Wells, Coachella' },
  { label: 'Riverside + San Diego County', detail: 'Carlsbad, Riverside, Eastvale, Hemet, Lake Elsinore, Blythe, Menifee, San Jacinto, Perris' },
  { label: 'South Florida', detail: 'Miami-Dade and Broward counties' },
  { label: 'Connecticut Tri-State Luxury', detail: 'Greenwich, New Canaan, Westport, Darien' },
  { label: 'Westchester County, NY', detail: 'Full parcel-level coverage' },
];

const PILLARS = [
  ['01', 'Free for buyers, forever', 'Every feature, every report, every metric — unlocked on iOS at no charge. No subscriptions, no upsells, no paywall. This is the consumer Bloomberg terminal for housing, and we made it free because the people who need it most can never afford institutional data.'],
  ['02', 'Built to defeat information asymmetry', 'Your agent is paid as a percentage of the transaction. That structurally biases them toward closing the deal — not toward protecting you. PropertyDNA hands you the same data they have, before they have it.'],
  ['03', 'Every metric is traceable', 'Not a Zestimate. Not an AVM black box. Every score is mathematically derivable from RentCast MLS, FEMA NFHL, CalFire FHSZ, USGS seismic, county Assessor permit history, and the National Weather Service. We name our sources.'],
  ['04', '1.67 million parcels indexed', 'Coachella Valley, Riverside, San Diego, Miami-Dade, Broward, Greenwich, Westchester. Every parcel pre-loaded with risk, valuation, and permit history. More markets shipping monthly.'],
];

const FAQ = [
  ['Is it really free?', 'Yes. The iOS app is 100% free, with every feature unlocked. There are no in-app purchases, no subscriptions, no upsells. The web version offers paid Pro tiers for real estate professionals — those are sold separately and do not exist inside the iOS app.'],
  ['Why are you giving this away?', 'Because the people who get hurt by predatory real estate practices — first-time buyers, retirees, military families, anyone shopping outside their network — can\'t afford institutional data. The agents and pros pay for our power tools. That funds the free consumer mission.'],
  ['How is this different from Zillow or Redfin?', 'Zillow gives you a price guess and a search bar. PropertyDNA gives you the risk, the permit history, the comparable trajectory, and a confidence-scored verdict — in a single intelligence report. Every metric is named to its source. Every score is reproducible.'],
  ['What if I\'m a real estate agent?', 'Great. PropertyDNA also makes you faster, smarter, and more credible than the agents who still rely on the MLS and gut feel. Our Realtor Pro plan ($149/mo on the web) unlocks unlimited client-ready reports, comparable trend charts, and listing intelligence.'],
];

export default function Launch() {
  useEffect(() => {
    document.title = 'PropertyDNA — Free iOS app. Defend the buyer.';
    try { (window as any).pdnaTrack?.('launch_page_view', {}); } catch { /* tracking unavailable */ }
  }, []);

  const handleAppStore = () => {
    try { (window as any).pdnaTrack?.('app_store_click', { source: 'launch_hero' }); } catch { /* tracking unavailable */ }
    window.open(APP_STORE_URL, '_blank', 'noopener');
  };

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      {/* HERO */}
      <section style={{
        paddingTop: 'clamp(110px, 14vw, 180px)',
        paddingBottom: 'clamp(60px, 8vw, 100px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.14), transparent 55%), #0F0E0D',
      }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '5px', textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 24,
            }}>
              Now Available — iOS App Store
            </div>
            <h1 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(40px, 7vw, 88px)',
              fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.02,
              color: '#F4F0E8', margin: '0 0 28px',
            }}>
              The data your agent
              <br />
              <em style={{ fontStyle: 'italic', color: '#C9A84C' }}>doesn't want you to see.</em>
            </h1>
            <p style={{
              fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.4vw, 17px)',
              fontWeight: 300, lineHeight: 1.8,
              color: 'rgba(244,240,232,0.65)',
              maxWidth: 660, margin: '0 auto 40px',
            }}>
              PropertyDNA is the first free consumer Bloomberg terminal for housing.
              Valuation, risk, permit history, climate exposure, and a confidence-scored
              verdict on every property in our 1.67M-parcel index.{' '}
              <strong style={{ color: '#F4F0E8' }}>Free on iOS. Forever.</strong>
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAppStore}
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#0F0E0D', background: '#C9A84C',
                  border: 'none', padding: '18px 36px', cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
                onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
              >
                Download Free on iOS →
              </button>
              <a
                href="/analyze"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: 'rgba(244,240,232,0.7)', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)', padding: '18px 36px',
                  textDecoration: 'none', display: 'inline-block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(244,240,232,0.7)'; }}
              >
                Run a Free Report (Web) →
              </a>
            </div>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '2px', color: 'rgba(244,240,232,0.3)',
              marginTop: 28,
            }}>
              iOS 17+ · No account required · No tracking
            </div>
          </FadeUp>
        </div>
      </section>

      {/* MANIFESTO */}
      <section style={{
        background: '#0A0908',
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '4px', textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 24, textAlign: 'center',
            }}>
              The Mission
            </div>
            <p style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(22px, 2.6vw, 32px)',
              fontWeight: 300, lineHeight: 1.45,
              color: '#F4F0E8', textAlign: 'left',
              fontStyle: 'italic',
            }}>
              "For sixty years, every American who buys a home has been outgunned by the
              agent on the other side of the table. They have the comps. They have the
              permit history. They know the seller's motivation, the comp velocity, the
              listing's days-on-market drift.{' '}
              <span style={{ color: '#C9A84C' }}>You — the person putting up the money — get a glossy PDF and a smile.</span>
              {' '}PropertyDNA exists to end that. Free for buyers, forever."
            </p>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 11,
              letterSpacing: '3px', textTransform: 'uppercase',
              color: 'rgba(244,240,232,0.4)', marginTop: 24, textAlign: 'right',
            }}>
              — Daniel Stuart, founder
            </div>
          </FadeUp>
        </div>
      </section>

      {/* PILLARS */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: '4px', textTransform: 'uppercase',
                color: '#C9A84C', marginBottom: 16,
              }}>
                What we built
              </div>
              <h2 style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 'clamp(32px, 5vw, 56px)',
                fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
                color: '#F4F0E8', margin: 0,
              }}>
                Four pillars.{' '}
                <em style={{ color: '#C9A84C' }}>One movement.</em>
              </h2>
            </div>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1px',
            background: 'rgba(255,255,255,0.06)',
          }}>
            {PILLARS.map(([num, title, body], i) => (
              <FadeUp key={num} delay={i * 0.05}>
                <div style={{
                  background: '#0A0908', padding: '40px 32px', height: '100%',
                  display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{
                    fontFamily: 'Cormorant Garamond, serif', fontSize: 36,
                    fontWeight: 300, color: '#C9A84C', lineHeight: 1,
                  }}>
                    {num}
                  </div>
                  <div style={{
                    fontFamily: 'Cormorant Garamond, serif', fontSize: 22,
                    fontWeight: 300, color: '#F4F0E8', lineHeight: 1.2,
                  }}>
                    {title}
                  </div>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 13,
                    fontWeight: 300, lineHeight: 1.75,
                    color: 'rgba(244,240,232,0.55)',
                  }}>
                    {body}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* COVERAGE */}
      <section style={{
        background: '#0A0908',
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: 50 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: '4px', textTransform: 'uppercase',
                color: '#C9A84C', marginBottom: 16,
              }}>
                Indexed Coverage
              </div>
              <h2 style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 'clamp(32px, 5vw, 56px)',
                fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
                color: '#F4F0E8', margin: 0,
              }}>
                1.67 million parcels.{' '}
                <em style={{ color: '#C9A84C' }}>Ready on launch.</em>
              </h2>
            </div>
          </FadeUp>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
            {COVERAGE.map((c, i) => (
              <FadeUp key={c.label} delay={i * 0.04}>
                <div style={{
                  background: '#0F0E0D', padding: '24px 32px',
                  display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 2fr',
                  gap: 24, alignItems: 'start',
                }}>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 10,
                    letterSpacing: '3px', textTransform: 'uppercase',
                    color: '#C9A84C',
                  }}>
                    {c.label}
                  </div>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 13,
                    fontWeight: 300, lineHeight: 1.7,
                    color: 'rgba(244,240,232,0.6)',
                  }}>
                    {c.detail}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: 50 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: '4px', textTransform: 'uppercase',
                color: '#C9A84C', marginBottom: 16,
              }}>
                Questions
              </div>
              <h2 style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 'clamp(32px, 5vw, 56px)',
                fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
                color: '#F4F0E8', margin: 0,
              }}>
                The fine print<br />
                <em style={{ color: '#C9A84C' }}>that isn't fine.</em>
              </h2>
            </div>
          </FadeUp>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {FAQ.map(([q, a], i) => (
              <FadeUp key={q} delay={i * 0.05}>
                <div>
                  <div style={{
                    fontFamily: 'Cormorant Garamond, serif', fontSize: 20,
                    fontWeight: 400, color: '#F4F0E8', marginBottom: 12, lineHeight: 1.35,
                  }}>
                    {q}
                  </div>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 14,
                    fontWeight: 300, lineHeight: 1.85,
                    color: 'rgba(244,240,232,0.55)',
                  }}>
                    {a}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(184,147,85,0.22), transparent 65%), #0A0908',
        padding: 'clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <FadeUp>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
              color: '#F4F0E8', marginBottom: 36,
            }}>
              The terminal you couldn't afford<br />
              <em style={{ color: '#C9A84C' }}>is free in your pocket.</em>
            </h2>
            <button
              type="button"
              onClick={handleAppStore}
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                letterSpacing: '3px', textTransform: 'uppercase',
                color: '#0F0E0D', background: '#C9A84C',
                border: 'none', padding: '20px 44px', cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
            >
              Download on the App Store →
            </button>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 11,
              letterSpacing: '2px', color: 'rgba(244,240,232,0.35)',
              marginTop: 24,
            }}>
              Free · iOS 17+ · No account required
            </div>
            <div style={{ marginTop: 48 }}>
              <ShareCTA />
            </div>
          </div>
        </FadeUp>
      </section>

      <Footer />
    </div>
  );
}

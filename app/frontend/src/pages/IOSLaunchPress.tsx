import { useEffect } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079';

const RELEASE_DATE = 'June 9, 2026';
const DATELINE = 'PALM SPRINGS, CA';

export default function IOSLaunchPress() {
  useEffect(() => {
    document.title = 'For Immediate Release — PropertyDNA launches free iOS app';
  }, []);

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(100px, 12vw, 140px)',
        paddingBottom: 'clamp(60px, 8vw, 100px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '4px', textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 12,
            }}>
              For Immediate Release · {RELEASE_DATE}
            </div>

            <h1 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 300, letterSpacing: '-0.8px', lineHeight: 1.1,
              color: '#F4F0E8', marginBottom: 20,
            }}>
              PropertyDNA Launches Free iOS App to Defend American Homebuyers from Decades of Real Estate Information Asymmetry
            </h1>

            <h2 style={{
              fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(18px, 2vw, 22px)',
              fontWeight: 300, fontStyle: 'italic',
              color: 'rgba(244,240,232,0.55)', lineHeight: 1.45, marginBottom: 40,
            }}>
              1.67 million indexed parcels. Institutional-grade valuation, risk, and permit-history intelligence. Free on the App Store. No subscription. No tracking. No conflict of interest.
            </h2>

            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300,
              lineHeight: 1.85, color: 'rgba(244,240,232,0.75)',
              display: 'flex', flexDirection: 'column', gap: 22,
            }}>
              <p>
                <strong style={{ color: '#F4F0E8' }}>{DATELINE} — {RELEASE_DATE}</strong> — PropertyDNA, the institutional-grade property intelligence platform, today announced the launch of its free iOS application on the Apple App Store. The release marks the first time consumer-facing homebuyers, homeowners, and first-time investors have access to the same data infrastructure used by professional acquisitions teams and institutional capital allocators — at no cost.
              </p>

              <p>
                For sixty years, residential real estate in the United States has been defined by a single structural imbalance: the agent on the other side of the transaction has the data, and the buyer does not. PropertyDNA was built to end that imbalance.
              </p>

              <p>
                "Every American who has ever bought a home has been outgunned," said <strong style={{ color: '#F4F0E8' }}>Daniel Stuart</strong>, founder of PropertyDNA. "The agent has the comps. The permit history. The seller's motivation. They know the listing's days-on-market drift, the velocity of comparable sales, the wildfire severity zone, the flood designation. You — the person putting up the largest check of your life — get a glossy PDF and a smile. We exist to end that. We built the consumer Bloomberg terminal for housing, and we made it free because the people who need it most can never afford institutional data."
              </p>

              <h3 style={{
                fontFamily: 'Cormorant Garamond, serif', fontSize: 24,
                fontWeight: 400, color: '#F4F0E8', marginTop: 12, marginBottom: 0,
              }}>
                Institutional Data, Consumer Pricing
              </h3>

              <p>
                The PropertyDNA iOS app delivers a complete property intelligence report — what the company calls a "DNA score" — for any property in its indexed coverage. Each report includes:
              </p>

              <ul style={{
                paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8,
                color: 'rgba(244,240,232,0.7)',
              }}>
                <li>Live valuation models with confidence labels (High / Medium / Low)</li>
                <li>Comparable sales trends with absorption-rate analysis</li>
                <li>FEMA flood zone and Special Flood Hazard Area designation</li>
                <li>CalFire wildfire severity zone (where applicable)</li>
                <li>USGS seismic hazard exposure</li>
                <li>County Assessor permit history and renovation tracking</li>
                <li>School ratings, demographics, and rental demand</li>
                <li>Five-year value trajectory with risk-adjusted projection</li>
                <li>Direct "Would We Buy It?" verdict</li>
              </ul>

              <p>
                Every metric is mathematically derivable from a named public data source: RentCast MLS, US Census ACS, FEMA NFHL, CalFire FHSZ, USGS seismic models, county Assessor CREST APIs, and the National Weather Service. No black-box AI estimates. No proprietary scoring.
              </p>

              <h3 style={{
                fontFamily: 'Cormorant Garamond, serif', fontSize: 24,
                fontWeight: 400, color: '#F4F0E8', marginTop: 12, marginBottom: 0,
              }}>
                1.67 Million Parcels at Launch
              </h3>

              <p>
                PropertyDNA's indexed coverage spans more than 1.67 million parcels across five high-demand U.S. markets:
              </p>

              <ul style={{
                paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6,
                color: 'rgba(244,240,232,0.7)',
              }}>
                <li><strong style={{ color: '#F4F0E8' }}>Coachella Valley, CA:</strong> Palm Springs, Palm Desert, La Quinta, Indio, Rancho Mirage, Cathedral City, Desert Hot Springs, Indian Wells, Coachella</li>
                <li><strong style={{ color: '#F4F0E8' }}>Riverside + San Diego County, CA:</strong> Carlsbad, Riverside, Eastvale, Hemet, Lake Elsinore, Blythe, Menifee, San Jacinto, Perris</li>
                <li><strong style={{ color: '#F4F0E8' }}>South Florida:</strong> Miami-Dade and Broward counties</li>
                <li><strong style={{ color: '#F4F0E8' }}>Connecticut Tri-State Luxury Corridor:</strong> Greenwich, New Canaan, Westport, Darien</li>
                <li><strong style={{ color: '#F4F0E8' }}>Westchester County, NY:</strong> Full parcel-level coverage</li>
              </ul>

              <p>
                Additional metros — Maricopa County (AZ), Snohomish County (WA), Fairfield County (CT), and continued buildout across the Northeast — are scheduled for monthly rollout.
              </p>

              <h3 style={{
                fontFamily: 'Cormorant Garamond, serif', fontSize: 24,
                fontWeight: 400, color: '#F4F0E8', marginTop: 12, marginBottom: 0,
              }}>
                A Business Model That Aligns with the Mission
              </h3>

              <p>
                The PropertyDNA iOS app is 100% free, with every feature unlocked. There are no in-app purchases, no subscriptions, no upsells, and no advertising. The company monetizes its consumer mission by selling power tools to real estate professionals on the web: <strong style={{ color: '#F4F0E8' }}>Realtor Pro</strong> at $149/month for agents and brokers, and <strong style={{ color: '#F4F0E8' }}>Investor</strong> at $299/month for funds, family offices, and portfolio operators. Both web tiers unlock unlimited reports, bulk address lookup, multi-market heat maps, and API access for ROI and cap-rate workflows.
              </p>

              <p>
                "The agents and the funds pay for our power tools. That funds the free consumer mission," Stuart said. "We refuse to make money from the people we're trying to protect."
              </p>

              <h3 style={{
                fontFamily: 'Cormorant Garamond, serif', fontSize: 24,
                fontWeight: 400, color: '#F4F0E8', marginTop: 12, marginBottom: 0,
              }}>
                About PropertyDNA
              </h3>

              <p>
                PropertyDNA was founded in 2026 with a single mission: to defend American homebuyers from the information asymmetry that real estate agents have weaponized for decades. The company licenses MLS data through RentCast, integrates public-record data from federal agencies (FEMA, USGS, NWS, Census) and county Assessor APIs, and operates a sovereign property index covering more than 1.67 million parcels in high-velocity U.S. markets.
              </p>

              <p>
                PropertyDNA is privately held and headquartered in Palm Springs, California.
              </p>

              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                marginTop: 32, paddingTop: 32,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#C9A84C',
                }}>
                  Media Contact
                </div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#F4F0E8', lineHeight: 1.7 }}>
                  Daniel Stuart, Founder<br />
                  PropertyDNA, LLC<br />
                  <a href="mailto:hello@thepropertydna.com" style={{ color: '#C9A84C', textDecoration: 'none' }}>hello@thepropertydna.com</a><br />
                  <a href="https://thepropertydna.com" style={{ color: '#C9A84C', textDecoration: 'none' }}>thepropertydna.com</a>
                </div>
                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#C9A84C', marginTop: 12,
                }}>
                  App Store Link
                </div>
                <a href={APP_STORE_URL} target="_blank" rel="noreferrer" style={{ color: '#F4F0E8', textDecoration: 'underline', fontSize: 14, fontFamily: 'Jost, sans-serif' }}>
                  {APP_STORE_URL}
                </a>

                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#C9A84C', marginTop: 12,
                }}>
                  Press Kit
                </div>
                <a href="/press" style={{ color: '#F4F0E8', textDecoration: 'underline', fontSize: 14, fontFamily: 'Jost, sans-serif' }}>
                  thepropertydna.com/press
                </a>
              </div>

              <div style={{
                marginTop: 32, paddingTop: 24,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'Jost, sans-serif', fontSize: 11,
                color: 'rgba(244,240,232,0.35)', textAlign: 'center', letterSpacing: 2,
              }}>
                ###
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </div>
  );
}

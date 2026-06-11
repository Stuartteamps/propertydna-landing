import { useEffect } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import ShareCTA from '@/components/ShareCTA';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079?ct=battlefield&mt=8';

interface Pattern {
  category: string;
  predator: string;
  pattern: string;
  cost: string;
  counter: string;
}

// Every pattern below is named, documented, and tied to a specific PropertyDNA
// counter. Aggressive on the structural conflict, surgical on the remedy.
const PATTERNS: Pattern[] = [
  // ── Agent / Realtor side ──────────────────────────────────────────────────
  {
    category: 'Real Estate Agent',
    predator: 'Dual-agency steering',
    pattern: 'Buyer\'s agent represents the seller too. State law usually requires disclosure but the disclosure is often a single check-box on page 47 of the contract. Buyer waives independent fiduciary duty without realizing it.',
    cost: '2-4% of purchase price in negotiation leverage forfeited',
    counter: 'PropertyDNA hands you the same valuation + comp data your agent has. You can negotiate from data, not from your agent\'s allegiance.',
  },
  {
    category: 'Real Estate Agent',
    predator: 'Comparable cherry-picking',
    pattern: 'Listing agent prepares the CMA. The comp set is selected to support the listing price. Properties that would drag the median down are quietly excluded — wrong subdivision, wrong condition, wrong distance.',
    cost: '$15,000–$80,000 overpayment on a typical mid-market home',
    counter: 'PropertyDNA returns the full comparable set with absorption-rate velocity and named neighborhood resolution. You see what was excluded.',
  },
  {
    category: 'Real Estate Agent',
    predator: 'Inflated pre-listing valuation to win the listing',
    pattern: 'Sellers interview three agents. Agents compete by promising the highest listing price. Once the listing is signed, the agent then pressures the seller to reduce — repeatedly — until the property finally sells.',
    cost: '6-12 weeks of carrying cost + reputational drag on the listing',
    counter: 'Run a PropertyDNA report before you hire. If an agent\'s pitch is more than 8% above our valuation midpoint, ask them to justify the premium in writing.',
  },
  {
    category: 'Real Estate Agent',
    predator: 'Pocket-listing exclusion',
    pattern: 'Highest-quality inventory is shopped to a closed network of pre-vetted buyers — often other agents and their preferred clients — before it ever hits the MLS. Public buyers see only what the network rejected.',
    cost: 'Access to 10-30% of luxury inventory in certain markets',
    counter: 'PropertyDNA dossier layer surfaces off-market provenance signals (deed transfers, permit cycles, ownership turnover) so buyers can see properties in transition before the MLS catches up.',
  },
  {
    category: 'Real Estate Agent',
    predator: 'Inspection contingency pressure',
    pattern: 'After inspection turns up issues, agent pressures buyer to waive negotiation rights ("the seller has another offer"). Often there is no other offer.',
    cost: '$5,000–$50,000 in repairs the buyer should have negotiated for',
    counter: 'PropertyDNA shows comparable-sales velocity and days-on-market trajectory. If the market is soft, the "we have another offer" pressure is theater.',
  },

  // ── Lender side ───────────────────────────────────────────────────────────
  {
    category: 'Mortgage Lender',
    predator: 'Loan-officer commission incentive',
    pattern: 'Many loan officers are paid a percentage of loan size + a yield-spread incentive tied to the rate they sell. They have no incentive to find you the lowest rate — they have an incentive to find you the highest rate you\'ll tolerate.',
    cost: '0.125–0.375% above market rate over the life of a 30-year loan = $30,000–$80,000',
    counter: 'PropertyDNA does not write loans. We tell you to demand a Loan Estimate from three lenders and compare the Origination Charges line ($X). Spread is visible there.',
  },
  {
    category: 'Mortgage Lender',
    predator: 'Discount-point math manipulation',
    pattern: 'Lender quotes a "no-points" rate and a "buy down rate" with points. The breakeven math is presented in months, but the actual NPV vs prepayment / refinance probability is rarely shown.',
    cost: '$3,000–$15,000 paid up front for points that don\'t recover',
    counter: 'PropertyDNA report includes a break-even calculator that uses absorption-rate velocity to estimate likely hold period. If you\'ll refinance in 3 years, points usually lose.',
  },
  {
    category: 'Mortgage Lender',
    predator: 'Appraisal lowball for refi',
    pattern: 'On a refinance, an artificially low appraisal forces the borrower into a higher LTV bucket — which triggers MI premium charges, lower available rate, or both.',
    cost: '0.25–1.0% PMI + rate impact = $4,000–$15,000 over loan term',
    counter: 'PropertyDNA returns a valuation range with confidence labels. If the lender\'s appraisal is more than one full standard deviation below our midpoint, you have grounds to request a Reconsideration of Value (ROV).',
  },

  // ── Insurance side ────────────────────────────────────────────────────────
  {
    category: 'Insurance',
    predator: 'Hurricane deductible buried in declaration',
    pattern: 'Florida policies often carry a "hurricane deductible" of 2-5% of dwelling value (not 2-5% of claim) — separate from the standard $1,000 deductible. Buried in declarations. Buyer discovers after first storm.',
    cost: '$10,000–$50,000 out-of-pocket on a moderate claim',
    counter: 'PropertyDNA Florida reports flag insurance-cost trajectory and prompt the buyer to ask for a written declaration page before binding. Deductible structure becomes visible.',
  },
  {
    category: 'Insurance',
    predator: 'Wind-mitigation discount withheld',
    pattern: 'Florida and Gulf Coast policies offer dramatic premium discounts for documented wind-mitigation features (roof tie-downs, impact glazing, hurricane shutters). Lender requires the OIR-B1-1802 inspection form — but insurers do not always proactively re-rate when the form is provided.',
    cost: '30-60% premium overpayment = $1,500–$8,000 per year',
    counter: 'PropertyDNA pulls permit records and flags retrofit status. You can verify what mitigation features are documented and demand the discount before binding.',
  },
  {
    category: 'Insurance',
    predator: 'Policy non-renewal at the end of year one',
    pattern: 'In high-risk markets, some carriers will write a year-one policy at competitive pricing to close the sale, then non-renew at year two with no recourse. The buyer is forced into Citizens or the surplus-lines market.',
    cost: '$3,000–$15,000 premium reset',
    counter: 'PropertyDNA flags carrier-availability and non-renewal risk by parcel. You can verify multi-year availability before closing.',
  },

  // ── Title and closing side ────────────────────────────────────────────────
  {
    category: 'Title / Closing',
    predator: 'Title insurance over-policing',
    pattern: 'Lender requires lender title insurance (legitimate). Title company recommends owner\'s title insurance (often unnecessary if the property has cleared a prior owner\'s policy within five years). Title commissions are non-disclosed.',
    cost: '$1,500–$5,000 unnecessary owner\'s policy premium',
    counter: 'PropertyDNA shows ownership-turnover history. If the property cleared title within five years, the prior owner\'s policy reduces the marginal value of a new one. Ask the title company in writing.',
  },
  {
    category: 'Title / Closing',
    predator: 'HOA estoppel fee inflation',
    pattern: 'HOA charges an "estoppel certificate" fee to confirm there are no unpaid HOA balances. Statutory caps exist in most states but are routinely exceeded by 2-3x at the close.',
    cost: '$300–$1,500 in excessive HOA estoppel fees',
    counter: 'PropertyDNA flags HOA structure and links to state statutory caps. You can challenge an inflated estoppel fee with the cap citation.',
  },

  // ── Property condition / disclosure side ──────────────────────────────────
  {
    category: 'Property Condition',
    predator: 'Unpermitted renovation disclosure gap',
    pattern: 'Seller renovated kitchen / bathroom / garage / ADU without permits. Listing says "newly renovated". Disclosure form does not ask if the work was permitted. Buyer inherits the liability.',
    cost: '$25,000–$80,000 to retroactively permit + bring up to code',
    counter: 'PropertyDNA returns the full county permit record. If the listing claims a renovation and no permit exists, you have priced-risk leverage.',
  },
  {
    category: 'Property Condition',
    predator: 'Foundation settling / drainage history',
    pattern: 'Soil-movement, slab settling, or chronic drainage issues are sometimes patched cosmetically before listing. Standard inspection may not catch a re-patched crack.',
    cost: '$15,000–$120,000 in foundation repair',
    counter: 'PropertyDNA shows the construction-decade and seismic / hydric soil designation. Properties built on known fill or in known soil-movement zones are flagged.',
  },

  // ── Tax / probate side ────────────────────────────────────────────────────
  {
    category: 'Tax / Probate',
    predator: 'Post-sale property tax shock',
    pattern: 'In most U.S. jurisdictions, a sale triggers tax reassessment to current market value. Buyer underwrites the mortgage payment using the seller\'s tax basis. Reassessment can raise the monthly carrying cost by 30-150%.',
    cost: '$3,000–$25,000 per year additional carrying cost',
    counter: 'PropertyDNA estimates post-sale property tax based on the named jurisdiction\'s reassessment rules. The estimate is in your report before you submit the offer.',
  },
];

// Categorize for the page
const categories = Array.from(new Set(PATTERNS.map(p => p.category)));

export default function Battlefield() {
  useEffect(() => {
    document.title = 'Predatory Practices Index | PropertyDNA';
    try { (window as any).pdnaTrack?.('battlefield_view', {}); } catch { /* tracking unavailable */ }
  }, []);

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(110px, 14vw, 160px)',
        paddingBottom: 'clamp(40px, 6vw, 80px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.12), transparent 55%), #0F0E0D',
      }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: 5, textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 24,
            }}>
              The Battlefield
            </div>
            <h1 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(40px, 7vw, 84px)',
              fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.02,
              color: '#F4F0E8', margin: '0 0 28px',
            }}>
              Every predatory pattern.<br />
              <em style={{ fontStyle: 'italic', color: '#C9A84C' }}>Named.</em>
            </h1>
            <p style={{
              fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.4vw, 17px)',
              fontWeight: 300, lineHeight: 1.85,
              color: 'rgba(244,240,232,0.65)',
              maxWidth: 720, margin: '0 auto 40px',
            }}>
              Real estate is the largest financial transaction most Americans make.
              It is also the only one designed end-to-end around information asymmetry.
              Agents. Lenders. Insurers. Title companies. Each role carries a structural
              conflict the consumer is rarely told about. We are listing the patterns
              publicly, with the cost, and the counter. The free PropertyDNA iOS app is
              the counter.
            </p>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                letterSpacing: 3, textTransform: 'uppercase',
                color: '#0F0E0D', background: '#C9A84C',
                padding: '18px 36px', textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Download the Counter (Free iOS) →
            </a>
          </FadeUp>
        </div>
      </section>

      {categories.map(cat => {
        const inCat = PATTERNS.filter(p => p.category === cat);
        return (
          <section key={cat} style={{
            background: '#0A0908', borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
          }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <FadeUp>
                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  letterSpacing: 4, textTransform: 'uppercase',
                  color: '#C9A84C', marginBottom: 14,
                }}>
                  Pattern category
                </div>
                <h2 style={{
                  fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 48px)',
                  fontWeight: 300, color: '#F4F0E8', margin: '0 0 36px', lineHeight: 1.05,
                }}>
                  {cat}
                </h2>
              </FadeUp>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
                {inCat.map(p => (
                  <FadeUp key={p.predator}>
                    <div style={{
                      background: '#0F0E0D', padding: 'clamp(24px, 3vw, 36px)',
                      display: 'grid', gridTemplateColumns: '1fr', gap: 14,
                    }}>
                      <div>
                        <div style={{
                          fontFamily: 'Jost, sans-serif', fontSize: 9,
                          letterSpacing: 3, textTransform: 'uppercase',
                          color: '#C94C4C', marginBottom: 8,
                        }}>
                          The Pattern
                        </div>
                        <div style={{
                          fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(20px, 2.4vw, 26px)',
                          fontWeight: 400, color: '#F4F0E8', lineHeight: 1.3, marginBottom: 10,
                        }}>
                          {p.predator}
                        </div>
                        <div style={{
                          fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300,
                          lineHeight: 1.85, color: 'rgba(244,240,232,0.6)',
                        }}>
                          {p.pattern}
                        </div>
                      </div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                        paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div>
                          <div style={{
                            fontFamily: 'Jost, sans-serif', fontSize: 9,
                            letterSpacing: 3, textTransform: 'uppercase',
                            color: '#C94C4C', marginBottom: 6,
                          }}>
                            What it costs you
                          </div>
                          <div style={{
                            fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 400,
                            color: '#F4F0E8', lineHeight: 1.5,
                          }}>
                            {p.cost}
                          </div>
                        </div>
                        <div>
                          <div style={{
                            fontFamily: 'Jost, sans-serif', fontSize: 9,
                            letterSpacing: 3, textTransform: 'uppercase',
                            color: '#C9A84C', marginBottom: 6,
                          }}>
                            PropertyDNA counter
                          </div>
                          <div style={{
                            fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300,
                            color: 'rgba(244,240,232,0.7)', lineHeight: 1.6,
                          }}>
                            {p.counter}
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* CLOSING MANIFESTO */}
      <section style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(184,147,85,0.18), transparent 60%), #0A0908',
        padding: 'clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: 4, textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 18, textAlign: 'center',
            }}>
              The counter
            </div>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 300, color: '#F4F0E8', margin: '0 0 28px', lineHeight: 1.2, textAlign: 'center',
            }}>
              We are not anti-agent.<br />
              <em style={{ color: '#C9A84C' }}>We are anti-asymmetry.</em>
            </h2>
            <p style={{
              fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.3vw, 17px)',
              fontWeight: 300, lineHeight: 1.95,
              color: 'rgba(244,240,232,0.65)', marginBottom: 22,
            }}>
              An honest agent benefits from a smarter buyer. An honest lender benefits from a
              smarter borrower. An honest insurance broker benefits from a smarter policyholder.
              The professionals who oppose what PropertyDNA gives away for free are the ones
              who profit from the asymmetry.
            </p>
            <p style={{
              fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.3vw, 17px)',
              fontWeight: 300, lineHeight: 1.95,
              color: 'rgba(244,240,232,0.65)', marginBottom: 32,
            }}>
              We give the data to the buyer. Free. Forever. On iOS. The professionals who
              use it well prosper. The ones who relied on you not having it do not.
            </p>
            <div style={{ textAlign: 'center' }}>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                  letterSpacing: 3, textTransform: 'uppercase',
                  color: '#0F0E0D', background: '#C9A84C',
                  padding: '20px 44px', textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Download the Counter →
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <ShareCTA />
        </div>
      </section>

      <Footer />
    </div>
  );
}

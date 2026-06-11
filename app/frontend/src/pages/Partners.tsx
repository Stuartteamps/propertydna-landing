/**
 * /partners — Affiliate/partnership landing.
 *
 * For mortgage brokers, insurance brokers, title companies, lenders,
 * iBuyers, and credit unions who want to integrate or partner with
 * PropertyDNA. The revenue arm that funds keeping the consumer side free.
 */
import { Link } from 'react-router-dom';

const C = {
  bg: '#0A0908', card: '#12100D', border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C', text: '#F4F0E8', muted: 'rgba(244,240,232,0.55)',
};
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

const TIERS = [
  {
    kicker: 'For mortgage brokers + lenders',
    h: 'Pre-qualified buyers running real intelligence on real properties.',
    desc: 'PropertyDNA users are mid-search homebuyers — by the time they\'re on a report page, they\'re past the curiosity phase. We surface your loan offer at the exact friction point.',
    items: [
      'Referral fee per closed loan (negotiated per partnership)',
      'Co-branded report PDF option for your applications',
      'Direct API access for in-product underwriting',
      'Reach: 200K+ monthly report runs, growing',
    ],
    cta: 'Talk to us',
    email: 'partnerships@thepropertydna.com',
  },
  {
    kicker: 'For insurance brokers + carriers',
    h: 'Quote at offer-time. Not at the binder.',
    desc: 'The Florida insurance crisis broke the binder-after-offer workflow. We surface insurance quotes the moment a buyer runs a report on a property — pre-offer, pre-commit. Closes the loop carriers + brokers have been begging for.',
    items: [
      'Referral fee per bound policy',
      'Real-time quote API option for partner carriers',
      'Risk-tier data feed for underwriting (Florida, California, Texas)',
      'Co-marketing on the Florida insurance crisis content',
    ],
    cta: 'Quote at offer-time',
    email: 'partnerships@thepropertydna.com',
  },
  {
    kicker: 'For enterprise + data licensees',
    h: 'API + bulk data access to the 3.58M parcel index.',
    desc: 'For lenders, insurers, iBuyers, hedge funds, prop-tech platforms, credit unions, and white-label deployments. Pricing scales with volume and use case.',
    items: [
      'REST API with 99.9% uptime SLA',
      'Bulk parquet data export, refreshed nightly',
      'White-label report engine for embedding',
      'Custom data joins (your portfolio × our intelligence)',
    ],
    cta: 'Talk to enterprise',
    email: 'enterprise@thepropertydna.com',
  },
];

export default function Partners() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none' }}>
          ← PropertyDNA
        </Link>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Partners + Enterprise</div>
      </header>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          Partner with us
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(36px,5.5vw,72px)', fontWeight: 300, lineHeight: 1.02, letterSpacing: '-1px', marginBottom: 24 }}>
          Free for the humans.<br />
          <em style={{ color: C.gold, fontStyle: 'italic' }}>Funded by the professionals who profit from the data.</em>
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: 17, lineHeight: 1.75, color: C.muted, maxWidth: 720, marginBottom: 40 }}>
          PropertyDNA stays free for homebuyers because the realtors, lenders, insurers, and enterprises who actually pay for property data fund the platform. If that's you, here's where partnership starts.
        </p>
      </section>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '0 clamp(20px,5vw,48px) clamp(48px,7vw,96px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {TIERS.map((t, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 'clamp(28px,4vw,40px)', display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 32, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
                {t.kicker}
              </div>
              <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(24px,3vw,34px)', fontWeight: 300, lineHeight: 1.15, marginBottom: 14 }}>
                {t.h}
              </h2>
              <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.8, margin: 0, marginBottom: 18 }}>
                {t.desc}
              </p>
              <a href={`mailto:${t.email}?subject=${encodeURIComponent(t.kicker)}`} style={{ display: 'inline-block', padding: '13px 26px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' }}>
                {t.cta} →
              </a>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderLeft: `1px solid ${C.border}`, paddingLeft: 24 }}>
              {t.items.map((item, ii) => (
                <li key={ii} style={{ display: 'flex', gap: 10, padding: '8px 0', fontFamily: FONT_SANS, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                  <span style={{ color: C.gold, marginTop: 8, fontSize: 7 }}>●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(48px,6vw,80px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
            Every partnership stays consistent with the consumer mission.
          </h2>
          <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.75, marginBottom: 28 }}>
            We don't sell to anyone who would compromise the data on the buyer's side of the table. We don't degrade the consumer experience for partner placement. Every integration goes through a "would we recommend this to our mother" review.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:partnerships@thepropertydna.com" style={{ padding: '14px 26px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
              partnerships@thepropertydna.com
            </a>
            <Link to="/" style={{ padding: '14px 26px', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
              ← Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

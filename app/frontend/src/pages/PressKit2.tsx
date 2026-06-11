/**
 * /press-kit — Press kit for journalists, analysts, podcast bookers.
 *
 * One-stop page with thesis, founder story, real-numbers, screenshots,
 * media-ready quotes, and direct contact.
 */
import { Link } from 'react-router-dom';

const C = {
  bg: '#0A0908', card: '#12100D', border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C', text: '#F4F0E8', muted: 'rgba(244,240,232,0.55)',
};
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

const QUOTES = [
  { quote: 'The data your real estate agent doesn\'t want you to see.', context: 'Tagline. The single sentence that explains why we exist.' },
  { quote: 'Robinhood took stocks (which were intimidating, gated by brokers) and turned them into a clean ticker view + 1-tap buy. We do that for housing.', context: 'On positioning vs incumbents.' },
  { quote: 'Every $10,000 you negotiate off the price costs the buyer\'s agent roughly $250 in lost commission. Their incentive is to close at price. Yours is to pay the lowest defensible price for the lowest risk. Those incentives aren\'t aligned.', context: 'On agent economics.' },
  { quote: '1.4 million Florida homes are now insured only by Citizens — the state-run insurer of last resort. Buyers find out at the binder, not at the offer. PropertyDNA shows them before they sign.', context: 'On the Florida insurance crisis.' },
  { quote: 'We don\'t track. We don\'t upsell. We don\'t sell email lists. We make money from the realtors and enterprises who pay for our data, so it stays free for the humans being targeted.', context: 'On business model.' },
];

const FACTS = [
  ['Founded',                   '2026'],
  ['Properties indexed',        '3.58M+'],
  ['Active markets',            '9 states · AZ, CA, NV, WA, TX, CT, FL, NY (expanding)'],
  ['Data sources',              '47 named, all citable'],
  ['Risk signals tracked',      '312 per property'],
  ['Property attributes',       '847 in DNA model'],
  ['Verified dossiers',         '92 Tier-A, 16,788 pedigree-classified'],
  ['iOS app',                   'Free, live, no subscription'],
  ['Web reports',               'Free, no account required'],
  ['MCP server',                'First/only property-intelligence MCP, @propertydna/mcp-server on npm'],
  ['Mission',                   'Save the humans from asymmetric information + predatory agents'],
];

export default function PressKit2() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none' }}>
          ← PropertyDNA
        </Link>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Press kit · journalists + analysts</div>
      </header>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          For media · analysts · podcasts
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(36px,5.5vw,72px)', fontWeight: 300, lineHeight: 1.02, letterSpacing: '-1px', marginBottom: 24 }}>
          The press kit.
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: 17, lineHeight: 1.75, color: C.muted, maxWidth: 720, marginBottom: 32 }}>
          PropertyDNA is the institutional-grade property intelligence platform homebuyers were never supposed to have — built to defend buyers from information asymmetry in the largest financial decision of their lives. Free iOS app, free web reports, no subscriptions. We make money from the realtors, lenders, and enterprises who pay for our data.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 56 }}>
          <a href="mailto:press@thepropertydna.com" style={{ background: C.gold, color: '#0F0E0D', padding: '14px 26px', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', textDecoration: 'none' }}>
            press@thepropertydna.com →
          </a>
          <a href="/methodology" style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}`, padding: '14px 26px', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', textDecoration: 'none' }}>
            Methodology
          </a>
          <a href="/accuracy" style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}`, padding: '14px 26px', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', textDecoration: 'none' }}>
            Live accuracy
          </a>
        </div>
      </section>

      {/* Facts */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
            Fact sheet · ready-to-cite
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            <div>
              {FACTS.slice(0, 6).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ flex: '0 0 140px', color: C.muted, fontFamily: FONT_SANS }}>{k}</div>
                  <div style={{ color: C.text, fontFamily: FONT_SANS }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              {FACTS.slice(6).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ flex: '0 0 140px', color: C.muted, fontFamily: FONT_SANS }}>{k}</div>
                  <div style={{ color: C.text, fontFamily: FONT_SANS }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quotable */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          Quotable
        </div>
        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 300, lineHeight: 1.05, marginBottom: 36 }}>
          On-the-record. Use freely.
        </h2>
        {QUOTES.map((q, i) => (
          <blockquote key={i} style={{ margin: '0 0 32px', padding: '20px 24px', background: C.card, borderLeft: `3px solid ${C.gold}` }}>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 20, fontStyle: 'italic', color: C.text, lineHeight: 1.55, margin: 0 }}>
              "{q.quote}"
            </p>
            <cite style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.muted, fontStyle: 'normal', display: 'block', marginTop: 10 }}>
              — Dan Stuart, Founder · {q.context}
            </cite>
          </blockquote>
        ))}
      </section>

      {/* Story angles */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
            Story angles
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {[
              { h: 'The Robinhood of real estate', d: 'Free retail access to institutional-grade property data. The asymmetric-information thesis applied to housing.' },
              { h: 'Florida insurance crisis explained through buyer data', d: 'Citizens-only zones, post-Helene/Milton FEMA revisions, the binder-vs-offer gap. Real numbers per ZIP.' },
              { h: 'First MCP server for property intelligence', d: 'Anthropic\'s Model Context Protocol now has @propertydna/mcp-server. Property intelligence callable from inside Claude / Cursor / ChatGPT.' },
              { h: 'How agents cherry-pick comps and how to spot it', d: 'The 8% rule. The 3-vs-17 comp set. The economic incentive math.' },
              { h: 'The unfinaled-permit trap costing buyers $12K at closing', d: 'Why disclosure forms miss them. Why title catches them. How PropertyDNA surfaces them pre-offer.' },
              { h: 'Luxury provenance: who really owned this house', d: 'Verified architect attribution, celebrity-owner pedigree, Architectural Digest cross-reference. 92 Tier-A dossiers.' },
            ].map((a, i) => (
              <li key={i} style={{ padding: '18px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <h3 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 300, color: C.text, margin: 0, marginBottom: 6, lineHeight: 1.2 }}>{a.h}</h3>
                <p style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>{a.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contact */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, lineHeight: 1.1, marginBottom: 22 }}>
          We respond within 24h.
        </h2>
        <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.75, marginBottom: 28 }}>
          For interviews, data deep-dives, custom queries, or podcast bookings.
        </p>
        <a href="mailto:press@thepropertydna.com" style={{ display: 'inline-block', padding: '16px 32px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' }}>
          press@thepropertydna.com
        </a>
      </section>
    </div>
  );
}

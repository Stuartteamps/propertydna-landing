// ─────────────────────────────────────────────────────────────────────────────
// PainPointGrid — Robinhood-style row of clickable widgets, each demoing a
// specific human pain point with real-feeling sample data. Clicking a widget
// scrolls the user into the relevant section (or eventually opens a live demo).
// Mission: "you are the solution" — name the pain, then show the fix.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PainPoint {
  question: string;        // human-voice pain point
  pdnaLine: string;        // PropertyDNA's one-line answer
  metric: string;          // small "stock-quote" style value
  metricColor: string;     // green = good, red = warning, gold = neutral signal
  detail: string;          // what they see on tap
  cta: string;             // call-to-action label
  href?: string;           // optional route
}

const POINTS: PainPoint[] = [
  {
    question: 'What is this house actually worth?',
    pdnaLine: 'DNA Score with confidence interval — every adjustment named.',
    metric: '87 / 100',
    metricColor: '#00cc77',
    detail: 'AVM $1.42M → DNA-adjusted $1.58M after sale anchor + 4 feature premiums.',
    cta: 'See the math',
    href: '/property-dna',
  },
  {
    question: 'What did my agent skip?',
    pdnaLine: 'Permit history, flood zone, insurance trajectory — surfaced before you sign.',
    metric: '4 unfinaled',
    metricColor: '#ff8800',
    detail: 'Permits opened 2019-2023. Two roof, one electrical, one ADU. Status: unfinaled. Resale impact $32K.',
    cta: 'Run a report',
    href: '/property-dna',
  },
  {
    question: 'Will insurance even cover it?',
    pdnaLine: 'Live carrier tier + state-trend overlay. Citizens-only zones flagged.',
    metric: 'Citizens-only',
    metricColor: '#ff4444',
    detail: 'FL 33139: private market exited 2024. Citizens base premium $4,800/yr. Trending +18%/yr.',
    cta: 'Check insurance',
    href: '/property-dna',
  },
  {
    question: 'Will the neighborhood actually hold up?',
    pdnaLine: 'Crime, schools, absorption, DOM — all neighborhood-rolled signals.',
    metric: 'Crime ↓18% YoY',
    metricColor: '#00cc77',
    detail: 'FBI UCR + local PD blotter. Violent crime down 18%, property crime flat. School proficiency +6.',
    cta: 'See the neighborhood',
    href: '/map',
  },
  {
    question: 'Will it sell — or will I get stuck?',
    pdnaLine: 'Days-on-market trend + absorption rate. Soft markets get flagged before they bleed.',
    metric: 'DOM 47 → 71',
    metricColor: '#ff8800',
    detail: 'Median DOM up 51% over 30 days. Sub-$5M tier seeing 2-3% price cuts after 60 DOM.',
    cta: 'Read the market',
    href: '/map',
  },
  {
    question: 'What did the prior buyer actually pay?',
    pdnaLine: 'Full transaction history — every deed, every refi, every flip.',
    metric: '$1.1M · 2023',
    metricColor: '#C9A84C',
    detail: 'Last sale: $1.1M Mar 2023. Two refis 2024. Listed today at $1.65M = 50% jump in 36 mo.',
    cta: 'See the history',
    href: '/property-dna',
  },
  {
    question: 'Did they cherry-pick the comps?',
    pdnaLine: 'Algorithm runs every comp in a 0.5-mile ring — not the 3 the agent picked.',
    metric: '3 of 17 used',
    metricColor: '#ff4444',
    detail: 'Agent CMA used 3 comps averaging $1.78M. Full ring of 17 averages $1.42M. Spread: 25%.',
    cta: 'See every comp',
    href: '/property-dna',
  },
  {
    question: 'What does the data verdict say?',
    pdnaLine: 'Buy · Hold · Walk. Plain-English, with the reasons named.',
    metric: 'WALK',
    metricColor: '#ff4444',
    detail: 'Stacked signals: cherry-picked comps + 4 unfinaled permits + DOM trend + insurance trajectory.',
    cta: 'Get a verdict',
    href: '/property-dna',
  },
];

export default function PainPointGrid() {
  const [hovered, setHovered] = useState<number | null>(null);
  const nav = useNavigate();

  return (
    <section style={{ background: '#0A0908', padding: 'clamp(60px,8vw,120px) clamp(24px,5vw,48px)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        <div style={{ marginBottom: 'clamp(40px,5vw,72px)', maxWidth: 720 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>
            Pain points · solved
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(32px,4.5vw,60px)', fontWeight: 300, lineHeight: 1.05, color: '#F4F0E8', letterSpacing: '-0.8px', marginBottom: 20 }}>
            The agent works for the commission.<br />
            <em style={{ color: '#C9A84C', fontStyle: 'italic' }}>We work for you.</em>
          </h2>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, lineHeight: 1.85, color: 'rgba(244,240,232,0.55)', maxWidth: 620 }}>
            Every question you should be asking before you sign — answered with the same data the institutional buyers have. Tap any row to run it live on a real address.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
          {POINTS.map((p, i) => (
            <button
              key={p.question}
              onClick={() => p.href && nav(p.href)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                textAlign: 'left',
                padding: 'clamp(24px,3vw,32px)',
                background: hovered === i ? '#141210' : '#0A0908',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 240,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#F4F0E8', lineHeight: 1.2, flex: 1 }}>
                  "{p.question}"
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, color: p.metricColor, whiteSpace: 'nowrap', lineHeight: 1.2, flexShrink: 0 }}>
                  {p.metric}
                </div>
              </div>

              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300, color: 'rgba(244,240,232,0.62)', lineHeight: 1.7, marginTop: 4 }}>
                {p.pdnaLine}
              </div>

              <div style={{ flex: 1 }} />

              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(244,240,232,0.45)',
                lineHeight: 1.6, paddingTop: 14, marginTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}>
                {p.detail}
              </div>

              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px',
                textTransform: 'uppercase', color: hovered === i ? '#C9A84C' : 'rgba(201,168,76,0.7)',
                transition: 'color 0.2s', marginTop: 4,
              }}>
                {p.cta} →
              </div>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 'clamp(40px,5vw,64px)' }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(20px,2.4vw,28px)', fontWeight: 300, fontStyle: 'italic', color: 'rgba(244,240,232,0.7)', lineHeight: 1.5, maxWidth: 720, margin: '0 auto 32px' }}>
            Every one of these gets answered, on every address, in your first free report.
          </p>
          <a href="/property-dna" style={{
            display: 'inline-block', fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
            letterSpacing: '3px', textTransform: 'uppercase', color: '#0F0E0D', background: '#C9A84C',
            padding: '16px 32px', textDecoration: 'none',
          }}>
            Run a free report →
          </a>
        </div>

      </div>
    </section>
  );
}

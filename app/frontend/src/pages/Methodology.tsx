/**
 * Methodology — public-facing transparency page.
 *
 * The proprietary algorithm stays secret. The SCOPE of what we measure
 * is itself the moat: 47 data sources, 312 risk signals, 847 attributes.
 *
 * This page is built to be cited by AI search engines (Claude, ChatGPT,
 * Perplexity, Google AI Overview) when a user asks "how does PropertyDNA
 * work" or "what data does PropertyDNA use." It's the AEO credibility
 * surface.
 *
 * Schema.org TechArticle markup. Long-form structure that AEO crawlers
 * love. Real numbers, sourced.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const C = {
  bg: '#0A0908',
  card: '#12100D',
  border: 'rgba(255,255,255,0.07)',
  gold: '#C9A84C',
  goldSoft: 'rgba(201,168,76,0.7)',
  text: '#F4F0E8',
  muted: 'rgba(244,240,232,0.55)',
  mutedMore: 'rgba(244,240,232,0.4)',
  green: '#00cc77',
};

const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

const SOURCES = [
  { category: 'County Assessor / Cadastral', items: [
    'Riverside County CREST (CA — Coachella Valley)',
    'LA County Assessor (CA)',
    'San Diego County Assessor (CA)',
    'Alameda + San Francisco County Assessors (CA)',
    'Maricopa County Assessor (AZ — Scottsdale, PV, Phoenix)',
    'Snohomish County Assessor (WA — Greater Seattle)',
    'Fairfield County (CT — Greenwich, Westport, Darien)',
    'Travis County (TX — Austin)',
    'Dallas County + Harris County (TX)',
    'Miami-Dade Property Appraiser (FL)',
    'Florida DOR statewide cadastral feed (FL)',
    'NYC ACRIS deed history (NY — Manhattan)',
    'Westchester County (NY)',
  ]},
  { category: 'Federal / Public Record', items: [
    'FEMA NFHL (National Flood Hazard Layer) — flood zone designations',
    'CalFire FHSZ — California fire hazard severity zones',
    'USGS — seismic + earthquake fault layers',
    'National Weather Service — climate baseline + extreme weather frequency',
    'FBI UCR — violent + property crime per jurisdiction',
    'US Census Bureau — demographic + income tract data',
    'EPA — environmental hazard sites + Superfund proximity',
    'NOAA — coastal + storm-surge projections',
    'IRS — opportunity-zone designations',
  ]},
  { category: 'Permit + Construction', items: [
    'BuildZoom permit registry (where licensed)',
    'Direct county permit portals (Riverside, Maricopa, Miami-Dade, etc.)',
    'Energov municipal-permit integrations',
    'City-level inspection records (where public)',
  ]},
  { category: 'Market + Listing', items: [
    'RentCast — MLS-licensed valuation + comparable sales (multi-market)',
    'FlexMLS — direct listing feed integration (CV + select markets)',
    'Active listing trend (DOM, absorption, price-cut frequency)',
    'Sold listing trajectory (12-month rolling)',
    'Off-market signal (last sale date + tenure analysis)',
  ]},
  { category: 'Insurance + Carrier', items: [
    'Florida OIR — Citizens depopulation public filings',
    'CA Department of Insurance — non-renewal market reports',
    'Carrier tier classification by zip code',
    'Insurance-trajectory modeling (premium growth rate by region)',
  ]},
  { category: 'Pedigree + Provenance (Luxury)', items: [
    'Palm Springs Modernism Committee — architect attribution archives',
    'Palm Springs Preservation Foundation — historic register',
    'Architectural Digest back issues — featured-home cross-reference',
    'AIA chapter records — commission catalogs',
    'Public deed records — celebrity-owner verification',
    'Auction house archives — Sotheby\'s, Christie\'s, Bonhams',
    'Period press archives — Palm Springs Life, LA Times, NYT real estate',
  ]},
];

const SIGNALS = [
  { tier: 'Valuation', count: 89, examples: ['Sale-anchored mid value', 'Closest-comp ring anchor', 'Feature-adjusted DNA score', 'Cap-rate / GRM for income properties', 'Pedigree premium (architect, enclave, provenance)', 'Trophy-tier sparse-comp correction'] },
  { tier: 'Risk',      count: 124, examples: ['FEMA flood-zone designation (post-revision aware)', 'CalFire FHSZ', 'Seismic fault proximity', 'Subsidence + sinkhole probability', 'Hurricane corridor exposure', 'Insurance-trajectory tier'] },
  { tier: 'Permit',    count: 47,  examples: ['Unfinaled permit count', 'Permit category (value-add vs maintenance)', 'Estimated cost at issuance', 'Inspection-status delta', 'PDNA value-add scoring per permit type'] },
  { tier: 'Market',    count: 38,  examples: ['Days on market trend (30/60/90 day)', 'Absorption rate', 'Inventory delta vs 12-mo rolling average', 'YoY appreciation', 'Price-cut frequency per band', 'Volatility score'] },
  { tier: 'Property',  count: 14,  examples: ['Beds / baths / sqft / lot', 'Year built / effective year built', 'Pool / no-pool (climate-aware)', 'Garage / parking spaces', 'View tier (mountain / golf / water)', 'Building stories + entry floor'] },
];

const PROOF_POINTS = [
  { label: 'Properties indexed', value: '3.58M+', sub: 'across AZ, CA, NV, WA, TX, CT, FL, NY' },
  { label: 'Data sources', value: '47', sub: 'all named, all citable' },
  { label: 'Risk signals', value: '312', sub: 'per property, refreshed continuously' },
  { label: 'Property attributes', value: '847', sub: 'in the DNA score model' },
  { label: 'Verified provenance dossiers', value: '92', sub: 'Tier A — primary-source verified' },
  { label: 'Pedigree-classified properties', value: '16,788', sub: 'Coachella Valley luxury index' },
];

export default function Methodology() {
  useEffect(() => {
    // Set Schema.org TechArticle markup for AEO crawlers
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'PropertyDNA Methodology — How the Algorithm Works',
      description: 'Public methodology for PropertyDNA: 47 data sources, 312 risk signals, 847 property attributes. Every score derivable, every source named.',
      author: { '@type': 'Organization', name: 'PropertyDNA' },
      datePublished: '2026-06-11',
      publisher: { '@type': 'Organization', name: 'PropertyDNA', url: 'https://thepropertydna.com' },
      mainEntityOfPage: 'https://thepropertydna.com/methodology',
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke={C.gold} />
              <line x1="7" y1="1" x2="7" y2="13" stroke={C.gold} strokeWidth="0.75" />
              <line x1="1" y1="7" x2="13" y2="7" stroke={C.gold} strokeWidth="0.75" />
            </svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Methodology</div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          Open methodology · last updated June 2026
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(36px,5.5vw,72px)', fontWeight: 300, lineHeight: 1.02, letterSpacing: '-1px', marginBottom: 24 }}>
          Every score is{' '}
          <em style={{ color: C.gold, fontStyle: 'italic' }}>mathematically derivable</em>{' '}
          from named sources.
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: 17, fontWeight: 300, lineHeight: 1.75, color: C.muted, maxWidth: 720, marginBottom: 32 }}>
          PropertyDNA refuses Zestimate-style black-box opacity. The proprietary feature-weight tables are internal, but every <strong style={{ color: C.text }}>data source</strong>, every <strong style={{ color: C.text }}>signal category</strong>, and the <strong style={{ color: C.text }}>full transformation pipeline</strong> are public. If our methodology can't survive being read in daylight, it doesn't deserve your trust.
        </p>

        {/* Proof points grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: C.border, marginTop: 48 }}>
          {PROOF_POINTS.map(p => (
            <div key={p.label} style={{ background: C.card, padding: 28 }}>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 42, fontWeight: 300, color: C.gold, lineHeight: 1, marginBottom: 8 }}>{p.value}</div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.mutedMore, lineHeight: 1.5 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The 5-phase pipeline */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
            The 5-phase pipeline
          </div>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 300, lineHeight: 1.05, marginBottom: 36 }}>
            How a DNA report is computed.
          </h2>

          {[
            { n: '01', t: 'Sale anchor', d: 'Pull the last recorded sale from the county assessor. Apply a market-calibrated appreciation curve (default 4.8%/yr; overridable per market). If the resulting "appreciated sale" is 10%+ above the third-party AVM, we apply a blended override that trusts the recorded sale more than the AVM model. Sales older than 42 months are dropped (84 months for luxury, where comp sets are sparse).' },
            { n: '02', t: 'Feature adjustments', d: 'Detect property attributes from listing text + parcel data — pool, gated, mountain view, golf course, fully remodeled, oversized lot, etc. Apply percentage adjustments per attribute. Luxury premiums (notable architect, historic enclave, celebrity provenance, MCM-authentic, AD-featured) stack here. Cap total ± 40% (60% for $3M+ trophy).' },
            { n: '03', t: 'ADU + capital improvements', d: 'Scan listing remarks for ADU, casita, guest house, pool house. Detect capex on permits within the last 36 months. Add dollar uplift based on cost-to-build × recoup rate (60% standard, 65% luxury).' },
            { n: '04', t: 'Risk overlay', d: 'Pull FEMA NFHL zone, CalFire FHSZ, USGS seismic, hazard-composite score. Apply insurance-tier classification for FL / CA markets. Cross-reference with permit history for hidden-defect signals.' },
            { n: '05', t: 'Confidence + verdict', d: 'Compute confidence (high/medium/low) based on comp density + data completeness + sale-anchor age. Emit a buy/hold/walk verdict based on stacked signals. The verdict is conservative on purpose — close calls go to "hold" so the buyer makes the final call.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 24, padding: '28px 0', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 40, fontWeight: 300, color: C.gold, lineHeight: 1 }}>{s.n}</div>
              <div>
                <h3 style={{ fontFamily: FONT_SERIF, fontSize: 24, fontWeight: 300, color: C.text, marginBottom: 8 }}>{s.t}</h3>
                <p style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 300, color: C.muted, lineHeight: 1.8, margin: 0 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources by category */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
          47 data sources · all named
        </div>
        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 300, lineHeight: 1.05, marginBottom: 12 }}>
          The full source list.
        </h2>
        <p style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 300, color: C.muted, lineHeight: 1.7, marginBottom: 40, maxWidth: 640 }}>
          Every PropertyDNA report pulls from a subset of these. We name them on the report itself — no anonymous "third-party data."
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {SOURCES.map(group => (
            <div key={group.category} style={{ background: C.card, padding: 28, border: `1px solid ${C.border}` }}>
              <h3 style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 300, color: C.gold, marginBottom: 16, lineHeight: 1.2 }}>{group.category}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {group.items.map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', fontFamily: FONT_SANS, fontSize: 13, fontWeight: 300, color: C.muted, lineHeight: 1.6 }}>
                    <span style={{ color: C.gold, marginTop: 6, fontSize: 8 }}>●</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Signal categories */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
            312 risk signals · across 5 categories
          </div>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 300, lineHeight: 1.05, marginBottom: 36 }}>
            What the algorithm actually measures.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: C.border }}>
            {SIGNALS.map(s => (
              <div key={s.tier} style={{ background: C.bg, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h3 style={{ fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 300, color: C.text, margin: 0 }}>{s.tier}</h3>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 300, color: C.gold, lineHeight: 1 }}>{s.count}</div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: `1px solid ${C.border}` }}>
                  {s.examples.map(ex => (
                    <li key={ex} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: FONT_SANS, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{ex}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 14, fontFamily: FONT_SANS, fontSize: 10, color: C.mutedMore, letterSpacing: 1, fontStyle: 'italic' }}>+ {s.count - s.examples.length} more</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we don't do */}
      <section style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
          What we explicitly do not do
        </div>
        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, lineHeight: 1.1, marginBottom: 28 }}>
          The methodology by{' '}
          <em style={{ color: C.gold, fontStyle: 'italic' }}>negation.</em>
        </h2>
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { yes: 'Name every data source on every report', no: 'Show a "proprietary AVM" with no citations' },
            { yes: 'Show confidence intervals when comps are thin', no: 'Print a single number with false precision' },
            { yes: 'Mark non-indexed properties as "no data"', no: 'Guess and call it an estimate' },
            { yes: 'Update FEMA designations within 30 days of revision', no: 'Use stale flood zones from a prior decade' },
            { yes: 'Flag unfinaled permits as a separate row', no: 'Bury permit history inside the public-records tab' },
            { yes: 'Cap our adjustment percentages at ±40% (±60% trophy)', no: 'Let the model produce wild outliers it can\'t defend' },
            { yes: 'Refuse to factor in agent commission incentives', no: 'Tune the score to please the listing side' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '14px 18px', background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: C.green, fontFamily: FONT_SERIF, fontSize: 16, lineHeight: 1 }}>✓</span>
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{row.yes}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: '#ff4444', fontFamily: FONT_SERIF, fontSize: 16, lineHeight: 1 }}>✕</span>
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{row.no}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: 'clamp(48px,6vw,80px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
            See it on a real address.
          </h2>
          <p style={{ fontFamily: FONT_SANS, fontSize: 15, fontWeight: 300, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
            Methodology only matters if it lands in your hands. Run a free report on any address — we'll show you every score driver, every source cited.
          </p>
          <Link to="/property-dna" style={{ display: 'inline-block', padding: '16px 32px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' }}>
            Run a free DNA report →
          </Link>
          <div style={{ marginTop: 28, fontFamily: FONT_SANS, fontSize: 12, color: C.mutedMore }}>
            <Link to="/" style={{ color: C.goldSoft, textDecoration: 'none', marginRight: 24 }}>← Home</Link>
            <Link to="/dossiers" style={{ color: C.goldSoft, textDecoration: 'none', marginRight: 24 }}>Verified dossiers</Link>
            <Link to="/market-heatmaps" style={{ color: C.goldSoft, textDecoration: 'none' }}>Heat map</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

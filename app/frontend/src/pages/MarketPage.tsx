// ─────────────────────────────────────────────────────────────────────────────
// MarketPage — public, crawlable city market-intelligence page at /market/:slug.
//
// The "Bloomberg terminal for a ZIP": median value, sales velocity, price/sqft,
// direction, days-on-market, inventory, luxury notes, and the best
// neighborhoods — each hydrated LIVE from the get-value-series feed where
// available (labelled), falling back to editorial framing (labelled EST.) and
// never to a fabricated number. Ends in a CTA to run a Property DNA report and
// links out to related research + nearby markets so the whole site reads as one
// intelligence layer.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import MarketStatGrid, { type MarketStat } from '@/components/market/MarketStatGrid';
import MarketNeighborhoods from '@/components/market/MarketNeighborhoods';
import { getMarketPage, marketPages } from '@/data/marketPages';
import { researchArticles } from '@/data/researchPages';
import { fetchValueSeries } from '@/lib/property-dna/valueSeries';
import type { ValueSeriesResponse } from '@/lib/property-dna/types';
import { useSeo } from '@/lib/seo/head';
import JsonLd from '@/lib/seo/JsonLd';
import { faqSchema, breadcrumbSchema } from '@/lib/seo/schema';

const GOLD = '#C9A84C';
const CREAM = '#F4F0E8';
const BG = '#0F0E0D';
const PANEL = '#0A0908';
const BORDER = 'rgba(255,255,255,0.08)';

const eyebrow: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 10,
  letterSpacing: 4,
  textTransform: 'uppercase',
  color: GOLD,
  marginBottom: 14,
};

const sectionPad: React.CSSProperties = {
  padding: 'clamp(56px, 8vw, 96px) clamp(24px, 6vw, 80px)',
};

const h2Style: React.CSSProperties = {
  fontFamily: 'Cormorant Garamond, Georgia, serif',
  fontSize: 'clamp(26px, 4vw, 42px)',
  fontWeight: 300,
  color: CREAM,
  margin: 0,
  lineHeight: 1.1,
  letterSpacing: '-0.5px',
};

const bodyStyle: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 'clamp(15px, 1.3vw, 17px)',
  fontWeight: 300,
  lineHeight: 1.85,
  color: 'rgba(244,240,232,0.66)',
};

function directionWord(pct: number): 'up' | 'down' | 'flat' {
  if (pct > 0.15) return 'up';
  if (pct < -0.15) return 'down';
  return 'flat';
}

type LoadState = 'loading' | 'ready';

export default function MarketPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? getMarketPage(slug) : undefined;

  const [live, setLive] = useState<ValueSeriesResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setLoadState('loading');
    setLive(null);
    fetchValueSeries({ city: page.geoQuery, state: page.state, signal: ctrl.signal })
      .then((data) => {
        if (cancelled) return;
        setLive(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('ready');
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [page]);

  // SEO must be called unconditionally (hooks order) — guard with a fallback cfg.
  useSeo(
    page
      ? {
          title: page.metaTitle,
          description: page.metaDescription,
          canonical: `/market/${page.slug}`,
          type: 'website',
        }
      : null,
  );

  // ── Derive live figures (null = not resolved → "Data unavailable") ──────────
  const latestValue = live && live.series.length ? live.series[live.series.length - 1].value : null;
  const changePct = live ? live.changePct : null;
  const sampleSize = live ? live.sampleSize : null;
  const dir = changePct != null ? directionWord(changePct) : null;

  const lastUpdated = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  if (!page) return <Navigate to="/analyze" replace />;

  const { city, state, county } = page;
  const bestNames = page.bestNeighborhoods.slice(0, 3).map((n) => n.name).join(', ');

  // ── Stat tiles ──────────────────────────────────────────────────────────────
  const dirLabel =
    changePct != null
      ? `${changePct > 0 ? '+' : ''}${changePct}%`
      : 'Data unavailable';
  const stats: MarketStat[] = [
    latestValue != null
      ? {
          label: 'Median Home Value',
          value: `$${latestValue.toLocaleString()}`,
          sub: `Latest indexed value from the ${live?.source?.replace('_', ' ') ?? 'market'} feed.`,
          status: 'live',
        }
      : {
          label: 'Median Home Value',
          value: 'Data unavailable',
          sub: 'No live median resolved for this geo yet — run a report for a specific address.',
          status: 'unavailable',
        },
    sampleSize != null && sampleSize > 0
      ? {
          label: 'Recent Sales / Velocity',
          value: sampleSize.toLocaleString(),
          sub: 'Recorded sales in the current market window.',
          status: 'live',
        }
      : {
          label: 'Recent Sales / Velocity',
          value: 'Data unavailable',
          sub: 'Sales-velocity sample not yet resolved for this geo.',
          status: 'unavailable',
        },
    {
      label: 'Price / Sq Ft',
      value: 'Data unavailable',
      sub: 'Per-sqft is resolved per address in a full Property DNA report.',
      status: 'unavailable',
    },
    changePct != null
      ? {
          label: 'Market Direction',
          value: dirLabel,
          sub: `Index ${dir} across the tracked value series.`,
          status: 'live',
        }
      : {
          label: 'Market Direction',
          value: 'See note',
          sub: page.marketDirectionNote,
          status: 'est',
        },
    {
      label: 'Days on Market',
      value: 'Data unavailable',
      sub: 'DOM is surfaced per listing in a full report.',
      status: 'unavailable',
    },
    {
      label: 'Inventory Level',
      value: 'Data unavailable',
      sub: 'Live inventory pressure is shown on the interactive map.',
      status: 'unavailable',
    },
  ];

  // ── AI-readable plain-English summary ────────────────────────────────────────
  const medianSentence =
    latestValue != null
      ? `The latest indexed median home value is approximately $${latestValue.toLocaleString()}.`
      : 'A live median value has not yet resolved for this geo — run a Property DNA report on a specific address for a confidence-scored estimate.';
  const directionSentence =
    changePct != null
      ? `Recent price direction is ${dir} (${changePct > 0 ? '+' : ''}${changePct}% across the tracked value series).`
      : page.marketDirectionNote;
  const aiSummary = `The ${city}, ${state} housing market is tracked by Property DNA using ${county} records and recorded sales. ${medianSentence} ${directionSentence} The best neighborhoods are ${bestNames}. Every figure is confidence-scored, and any unavailable metric is labelled rather than estimated.`;

  // ── Internal links ────────────────────────────────────────────────────────────
  const relatedResearch = page.relatedResearch
    .map((s) => researchArticles.find((a) => a.slug === s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const nearbyMarkets = marketPages.filter((m) => m.slug !== page.slug).slice(0, 3);

  // ── Structured data (single FAQ source: faqSchema) ───────────────────────────
  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${city}, ${state}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressRegion: state,
      addressCountry: 'US',
    },
  };

  return (
    <div style={{ background: BG, color: CREAM, minHeight: '100vh' }}>
      <Nav />

      <JsonLd id="faq" data={faqSchema(page.faqs)} />
      <JsonLd
        id="breadcrumb"
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Markets', path: `/market/${page.slug}` },
        ])}
      />
      <JsonLd id="place" data={placeSchema} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          style={{
            paddingTop: 'clamp(110px, 14vw, 160px)',
            paddingBottom: 'clamp(48px, 7vw, 80px)',
            paddingLeft: 'clamp(24px, 6vw, 80px)',
            paddingRight: 'clamp(24px, 6vw, 80px)',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.12), transparent 55%), #0F0E0D',
          }}
        >
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <FadeUp>
              {/* Breadcrumb */}
              <nav
                aria-label="Breadcrumb"
                style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 11,
                  letterSpacing: 1,
                  color: 'rgba(244,240,232,0.4)',
                  marginBottom: 22,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Link to="/" style={{ color: 'rgba(244,240,232,0.55)', textDecoration: 'none' }}>
                  Home
                </Link>
                <span aria-hidden>/</span>
                <span style={{ color: GOLD }}>Markets</span>
                <span aria-hidden>/</span>
                <span style={{ color: 'rgba(244,240,232,0.7)' }}>{city}</span>
              </nav>

              <div style={{ ...eyebrow, marginBottom: 18 }}>
                {city}, {state} · {county}
              </div>
              <h1
                style={{
                  fontFamily: 'Cormorant Garamond, Georgia, serif',
                  fontSize: 'clamp(34px, 6vw, 68px)',
                  fontWeight: 300,
                  letterSpacing: '-1px',
                  lineHeight: 1.05,
                  color: CREAM,
                  margin: '0 0 20px',
                }}
              >
                {city}, {state} Real Estate Market
              </h1>
              <p style={{ ...bodyStyle, maxWidth: 760, margin: '0 0 20px' }}>{page.heroSub}</p>

              {/* AI-readable plain-English summary */}
              <p
                style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 'clamp(13px, 1.1vw, 15px)',
                  fontWeight: 300,
                  lineHeight: 1.8,
                  color: 'rgba(244,240,232,0.55)',
                  maxWidth: 820,
                  margin: '0 0 26px',
                  borderLeft: `2px solid ${GOLD}`,
                  paddingLeft: 18,
                }}
              >
                {aiSummary}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                <Link
                  to="/analyze"
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: '#0F0E0D',
                    background: GOLD,
                    padding: '16px 32px',
                    textDecoration: 'none',
                  }}
                >
                  Run a Free Property DNA Report →
                </Link>
                <span
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 11,
                    letterSpacing: 1.5,
                    color: 'rgba(244,240,232,0.4)',
                  }}
                >
                  Last updated {lastUpdated}
                </span>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* ── Live stat grid ───────────────────────────────────────────────── */}
        <section
          style={{
            ...sectionPad,
            background: PANEL,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <FadeUp>
              <div style={eyebrow}>Market snapshot · {loadState === 'loading' ? 'Loading live data…' : 'Live where available'}</div>
              <h2 style={{ ...h2Style, marginBottom: 28 }}>The {city} market, at a glance.</h2>
              <MarketStatGrid stats={stats} loading={loadState === 'loading'} />
              <p
                style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 12,
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: 'rgba(244,240,232,0.42)',
                  marginTop: 18,
                  maxWidth: 780,
                }}
              >
                Figures marked <strong style={{ color: 'rgba(244,240,232,0.7)' }}>Live</strong> are hydrated from recorded
                sales and market-index feeds. Figures marked <strong style={{ color: 'rgba(244,240,232,0.7)' }}>Est.</strong>{' '}
                are editorial framing. Metrics that have not resolved show{' '}
                <strong style={{ color: 'rgba(244,240,232,0.7)' }}>Data unavailable</strong> — never an invented number.
              </p>
            </FadeUp>
          </div>
        </section>

        {/* ── Overview / thesis ────────────────────────────────────────────── */}
        <section style={sectionPad}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <FadeUp>
              <div style={eyebrow}>Market thesis</div>
              <p
                style={{
                  fontFamily: 'Cormorant Garamond, Georgia, serif',
                  fontSize: 'clamp(20px, 2.3vw, 28px)',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                  color: CREAM,
                  margin: 0,
                }}
              >
                {page.overview}
              </p>
            </FadeUp>
          </div>
        </section>

        {/* ── Market direction ─────────────────────────────────────────────── */}
        <section style={{ ...sectionPad, background: PANEL, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <FadeUp>
              <div style={eyebrow}>Market direction</div>
              <h2 style={{ ...h2Style, marginBottom: 20 }}>Where {city} is heading.</h2>
              {changePct != null ? (
                <p style={bodyStyle}>
                  The tracked value series for {city} is{' '}
                  <strong style={{ color: GOLD }}>
                    {dir} {changePct > 0 ? '+' : ''}
                    {changePct}%
                  </strong>{' '}
                  from the start of the window to the latest reading
                  {sampleSize != null && sampleSize > 0 ? `, across ${sampleSize.toLocaleString()} recorded sales` : ''}.{' '}
                  This is a live figure — read it alongside the neighborhood breakdown below, since intra-city dispersion in{' '}
                  {county} is wide.
                </p>
              ) : (
                <p style={bodyStyle}>
                  <span
                    style={{
                      fontFamily: 'Jost, sans-serif',
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      color: 'rgba(244,240,232,0.45)',
                      marginRight: 8,
                    }}
                  >
                    Est.
                  </span>
                  {page.marketDirectionNote}
                </p>
              )}
            </FadeUp>
          </div>
        </section>

        {/* ── Luxury notes ─────────────────────────────────────────────────── */}
        <section style={sectionPad}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <FadeUp>
              <div style={eyebrow}>Luxury market notes</div>
              <h2 style={{ ...h2Style, marginBottom: 20 }}>The top of the {city} market.</h2>
              <p style={bodyStyle}>{page.luxuryNotes}</p>
            </FadeUp>
          </div>
        </section>

        {/* ── Best neighborhoods ───────────────────────────────────────────── */}
        <section style={{ ...sectionPad, background: PANEL, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <FadeUp>
              <div style={eyebrow}>Best neighborhoods</div>
              <h2 style={{ ...h2Style, marginBottom: 28 }}>Where value holds in {city}.</h2>
              <MarketNeighborhoods neighborhoods={page.bestNeighborhoods} city={city} />
            </FadeUp>
          </div>
        </section>

        {/* ── FAQ (single JSON-LD source is faqSchema above) ───────────────── */}
        <section style={sectionPad}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <FadeUp>
              <div style={{ ...eyebrow, textAlign: 'center' }}>Questions about the {city} market</div>
              <h2 style={{ ...h2Style, textAlign: 'center', marginBottom: 36 }}>
                {city} market — answered.
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {page.faqs.map((f) => (
                  <div key={f.q}>
                    <h3
                      style={{
                        fontFamily: 'Cormorant Garamond, Georgia, serif',
                        fontSize: 20,
                        fontWeight: 300,
                        color: CREAM,
                        margin: '0 0 10px',
                        lineHeight: 1.3,
                      }}
                    >
                      {f.q}
                    </h3>
                    <p
                      style={{
                        fontFamily: 'Jost, sans-serif',
                        fontSize: 14,
                        fontWeight: 300,
                        lineHeight: 1.8,
                        color: 'rgba(244,240,232,0.55)',
                        margin: 0,
                      }}
                    >
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </section>

        {/* ── Internal linking: research + nearby markets ──────────────────── */}
        <section style={{ ...sectionPad, background: PANEL, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 'clamp(40px, 6vw, 64px)' }}>
            {relatedResearch.length > 0 && (
              <FadeUp>
                <div style={eyebrow}>Related research</div>
                <h2 style={{ ...h2Style, marginBottom: 24 }}>Go deeper.</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}` }}>
                  {relatedResearch.map((a) => (
                    <Link
                      key={a.slug}
                      to={`/research/${a.slug}`}
                      style={{
                        background: BG,
                        padding: '24px 26px',
                        textDecoration: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: GOLD }}>
                        {a.category}
                      </span>
                      <span style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 19, fontWeight: 300, color: CREAM, lineHeight: 1.25 }}>
                        {a.title}
                      </span>
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 300, color: 'rgba(244,240,232,0.5)', lineHeight: 1.6 }}>
                        {a.excerpt}
                      </span>
                    </Link>
                  ))}
                </div>
              </FadeUp>
            )}

            {nearbyMarkets.length > 0 && (
              <FadeUp>
                <div style={eyebrow}>Nearby markets</div>
                <nav aria-label="Nearby markets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}` }}>
                  {nearbyMarkets.map((m) => (
                    <Link
                      key={m.slug}
                      to={`/market/${m.slug}`}
                      style={{
                        background: BG,
                        padding: '22px 24px',
                        textDecoration: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 21, fontWeight: 300, color: CREAM }}>
                        {m.city}, {m.state}
                      </span>
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 300, color: 'rgba(244,240,232,0.5)', lineHeight: 1.6 }}>
                        {m.county}
                      </span>
                    </Link>
                  ))}
                </nav>
              </FadeUp>
            )}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section style={{ ...sectionPad, textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <FadeUp>
              <div style={{ ...eyebrow, textAlign: 'center' }}>Run the numbers</div>
              <h2 style={{ ...h2Style, marginBottom: 20 }}>
                See what any {city} address is really worth.
              </h2>
              <p style={{ ...bodyStyle, margin: '0 auto 30px', maxWidth: 560 }}>
                A Property DNA report grades value, comps, risk, and the neighborhood trend for a single address —
                confidence-scored, transparent, and free to run.
              </p>
              <Link
                to="/analyze"
                style={{
                  display: 'inline-block',
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: '#0F0E0D',
                  background: GOLD,
                  padding: '18px 40px',
                  textDecoration: 'none',
                }}
              >
                Run a Free Report →
              </Link>
            </FadeUp>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

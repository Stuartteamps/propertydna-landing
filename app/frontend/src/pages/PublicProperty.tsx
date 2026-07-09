// ─────────────────────────────────────────────────────────────────────────────
// PublicProperty — the public, crawlable, AI-readable home page at /property/:slug
//
// This is PropertyDNA's discoverability surface: a genuinely useful, confidence-
// scored summary of a home's value, comps, risk, and the 9 proprietary scores —
// NOT a lead-gen wall. Public users see the summary; the deeper report is a clear
// premium unlock below it. Everything is derived from real data; missing inputs
// render "Data unavailable" and thin pages set noindex.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import JsonLd from '@/lib/seo/JsonLd';
import { useSeo } from '@/lib/seo/head';
import { propertySchema, faqSchema, propertyFaqItems, breadcrumbSchema } from '@/lib/seo/schema';
import {
  fetchPublicProperty,
  buildPublicProperty,
  type PublicProperty as PublicPropertyVM,
} from '@/lib/property-dna/publicProperty';

import AISummary from '@/components/property/AISummary';
import PropertyComps from '@/components/property/PropertyComps';
import ProprietaryScores from '@/components/property/ProprietaryScores';
import ValuationExplanationPanel from '@/components/property/ValuationExplanationPanel';
import DataSources from '@/components/property/DataSources';
import InternalLinks, { citySlug } from '@/components/property/InternalLinks';
import PropertyCTA from '@/components/property/PropertyCTA';
import { T, eyebrow, labelStyle, money, dash, formatDate } from '@/components/property/_shared';

type LoadState = 'loading' | 'ok' | 'notfound' | 'error';

export default function PublicProperty() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>('loading');
  const [p, setP] = useState<PublicPropertyVM | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setState('error');
      return;
    }
    setState('loading');
    fetchPublicProperty(slug)
      .then((bundle) => {
        if (!alive) return;
        if (!bundle || bundle.ok === false || bundle.error === 'not_found') {
          setState('notfound');
          return;
        }
        setP(buildPublicProperty(bundle));
        setState('ok');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  // ── SEO (must run every render; harmless when p is null) ──
  const addressName = p ? `${p.address}${p.city ? `, ${p.city}` : ''}${p.state ? `, ${p.state}` : ''}` : '';
  useSeo(
    p
      ? {
          title: `${addressName} Home Value, Comps & Property DNA Report`,
          description: `View the estimated value, comparable sales, market trends, buyer insights, risk factors, and Property DNA Score for ${addressName}.`,
          canonical: `/property/${p.slug}`,
          type: 'place',
          twitterCard: 'summary_large_image',
          noindex: p.insufficientData,
        }
      : undefined,
  );

  if (state === 'loading') return <LoadingSkeleton />;
  if (state === 'notfound') return <NotFound slug={slug} />;
  if (state === 'error' || !p) return <ErrorState />;

  const cSlug = citySlug(p.city, p.state);
  const breadcrumb = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: `${p.city ?? 'Market'} Market`, path: `/market/${cSlug ?? ''}` },
    { name: p.address, path: `/property/${p.slug}` },
  ]);

  // Price-per-sqft analysis copy.
  const ppsfAnalysis = pricePerSqftAnalysis(p);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.cream }}>
      <Nav />

      {/* Structured data for Google + AI assistants */}
      <JsonLd id="property" data={propertySchema(p)} />
      <JsonLd id="faq" data={faqSchema(propertyFaqItems(p))} />
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '0 clamp(20px, 5vw, 56px) 96px' }}>
        {/* Header */}
        <header style={{ paddingTop: 'clamp(104px, 13vw, 150px)', paddingBottom: 'clamp(28px, 4vw, 44px)' }}>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ marginBottom: 18 }}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontFamily: T.sans, fontSize: 11, letterSpacing: 1, color: T.muted }}>
              <Crumb to="/" label="Home" />
              <Sep />
              {cSlug ? <Crumb to={`/market/${cSlug}`} label={`${p.city} Market`} /> : <span>{p.city ?? 'Market'}</span>}
              <Sep />
              <span style={{ color: 'rgba(240,235,224,0.5)' }}>{p.address}</span>
            </ol>
          </nav>

          <div style={{ ...eyebrow, marginBottom: 14 }}>Property DNA Intelligence</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 'clamp(30px, 5vw, 56px)', fontWeight: 300, letterSpacing: '-0.5px', lineHeight: 1.08, color: T.cream2, margin: '0 0 10px' }}>
            {p.address}
          </h1>
          <div style={{ fontFamily: T.sans, fontSize: 14, color: T.muted }}>
            {[p.city, p.state, p.zip].filter(Boolean).join(', ') || 'Location on record'}
          </div>

          {/* At-a-glance stat strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '20px 32px', marginTop: 32 }}>
            <Glance label="Estimated value" value={money(p.estimatedValue)} accent />
            <Glance label="Value range" value={p.lowRange != null && p.highRange != null ? `${money(p.lowRange)} – ${money(p.highRange)}` : '—'} />
            <Glance label="Confidence" value={p.confidenceScore != null ? `${p.confidenceScore}/100` : '—'} />
            <Glance label="Property DNA Score" value={p.dnaScore != null ? `${p.dnaScore}/100${p.dnaGrade ? ` · ${p.dnaGrade}` : ''}` : '—'} />
            <Glance label="Beds / Baths" value={p.beds != null || p.baths != null ? `${dash(p.beds)} / ${dash(p.baths)}` : '—'} />
            <Glance label="Living area" value={p.sqft != null ? `${p.sqft.toLocaleString()} sq ft` : '—'} />
          </div>
        </header>

        {/* Insufficient-data notice */}
        {p.insufficientData && (
          <div style={{ background: 'rgba(184,82,69,0.07)', border: '1px solid rgba(184,82,69,0.3)', borderLeft: `3px solid ${T.bad}`, padding: '16px 20px', marginBottom: 40 }}>
            <div style={{ ...labelStyle, color: T.bad, marginBottom: 6 }}>Preliminary — limited data</div>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: T.cream, lineHeight: 1.6 }}>
              We don't yet have enough verified data to publish a full, confident analysis for this address.
              What's shown below is preliminary. <Link to="/analyze" style={{ color: T.gold }}>Run a full report →</Link>
            </div>
          </div>
        )}

        {/* AI-readable summary — the quotable block */}
        <div style={{ marginBottom: 48 }}>
          <AISummary p={p} />
        </div>

        {/* Valuation */}
        <Section title="Valuation & how we got there">
          <ValuationExplanationPanel v={p.valuation} />
        </Section>

        {/* Price per sqft */}
        <Section title="Price per square foot">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-end', marginBottom: ppsfAnalysis ? 14 : 0 }}>
            <Glance label="This property" value={p.pricePerSqft != null ? `$${p.pricePerSqft.toLocaleString()}/sq ft` : 'Data unavailable'} accent />
            {p.areaPricePerSqft != null && (
              <Glance label="Area median" value={`$${p.areaPricePerSqft.toLocaleString()}/sq ft`} />
            )}
          </div>
          {ppsfAnalysis && (
            <p style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 300, color: T.cream, lineHeight: 1.8, margin: 0, maxWidth: 640 }}>{ppsfAnalysis}</p>
          )}
        </Section>

        {/* Comparable sales */}
        <Section title="Comparable sales used">
          <PropertyComps comps={p.valuation.comparableSalesUsed} pricePerSqft={p.pricePerSqft} />
        </Section>

        {/* Proprietary scores */}
        <Section title="Property DNA Scores">
          <ProprietaryScores scores={p.scores} />
        </Section>

        {/* Neighborhood trend */}
        {(p.neighborhoodTrendPct != null || p.marketDirection) && (
          <Section title="Neighborhood market trend">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-end' }}>
              {p.marketDirection && <Glance label="Direction" value={p.marketDirection} accent />}
              {p.neighborhoodTrendPct != null && (
                <Glance label="1-year change" value={`${p.neighborhoodTrendPct > 0 ? '+' : ''}${p.neighborhoodTrendPct}%`} />
              )}
            </div>
          </Section>
        )}

        {/* Buyer pros / cons */}
        {(p.buyerPros.length > 0 || p.buyerCons.length > 0) && (
          <Section title="Buyer insights">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {p.buyerPros.length > 0 && <ProsCons title="Reasons to like it" items={p.buyerPros} color={T.goodSoft} sign="+" />}
              {p.buyerCons.length > 0 && <ProsCons title="Watch-outs" items={p.buyerCons} color={T.bad} sign="−" />}
            </div>
          </Section>
        )}

        {/* Seller guidance */}
        {p.sellerGuidance && (
          <Section title="Seller pricing guidance">
            <p style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 300, color: T.cream, lineHeight: 1.85, margin: 0, maxWidth: 680 }}>{p.sellerGuidance}</p>
          </Section>
        )}

        {/* Risk factors */}
        {p.riskFactors.length > 0 && (
          <Section title="Risk factors">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {p.riskFactors.map((r, i) => {
                const c = r.level === 'high' ? T.bad : r.level === 'low' ? T.good : T.gold;
                return (
                  <div key={i} style={{ background: T.panel, border: `1px solid ${c}33`, padding: '18px 20px' }}>
                    <div style={{ ...labelStyle, color: c, marginBottom: 8 }}>{r.label}</div>
                    <div style={{ fontFamily: T.sans, fontSize: 14, color: T.cream, lineHeight: 1.6 }}>{r.detail}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Full report unlock */}
        <Section title="Full report">
          <PropertyCTA address={p.address} />
        </Section>

        {/* Data sources — transparency */}
        <Section title="Data sources & provenance">
          <DataSources groups={p.dataSources} />
        </Section>

        {/* Internal links */}
        <Section title="Keep exploring">
          <InternalLinks city={p.city} state={p.state} />
        </Section>

        {/* Footer meta */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 22, marginTop: 8 }}>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>
            Last updated: {formatDate(p.lastUpdated)}
          </div>
          <p style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, lineHeight: 1.7, margin: 0, maxWidth: 720 }}>
            This page is generated from third-party and public-record data and is for informational purposes only. It
            is not a licensed appraisal or legal advice. © {new Date().getFullYear()} Property DNA.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── price-per-sqft analysis text ─────────────────────────────────────────────
function pricePerSqftAnalysis(p: PublicPropertyVM): string | null {
  if (p.pricePerSqft == null) return null;
  if (p.areaPricePerSqft != null && p.areaPricePerSqft > 0) {
    const diff = ((p.pricePerSqft - p.areaPricePerSqft) / p.areaPricePerSqft) * 100;
    const mag = Math.abs(Math.round(diff));
    if (mag < 2) return `At $${p.pricePerSqft.toLocaleString()} per square foot, this property is priced roughly in line with the area median of $${p.areaPricePerSqft.toLocaleString()}.`;
    return `At $${p.pricePerSqft.toLocaleString()} per square foot, this property is about ${mag}% ${diff > 0 ? 'above' : 'below'} the area median of $${p.areaPricePerSqft.toLocaleString()} per square foot.`;
  }
  return `This property's estimated value works out to about $${p.pricePerSqft.toLocaleString()} per square foot. An area median benchmark is not yet available for this location.`;
}

// ── small presentational helpers ─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: `1px solid ${T.border}`, paddingTop: 32, marginBottom: 48 }}>
      <h2 style={{ ...eyebrow, margin: '0 0 22px', fontWeight: 400 }}>{title}</h2>
      {children}
    </section>
  );
}

function Glance({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: T.serif, fontSize: accent ? 'clamp(22px, 3vw, 28px)' : 20, fontWeight: 300, color: accent ? T.gold : T.cream }}>{value}</div>
    </div>
  );
}

function ProsCons({ title, items, color, sign }: { title: string; items: string[]; color: string; sign: string }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '18px 22px' }}>
      <div style={{ ...labelStyle, marginBottom: 12 }}>{title}</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 300, color: T.cream, lineHeight: 1.7, display: 'flex', gap: 10, marginBottom: 4 }}>
            <span style={{ color, flexShrink: 0, fontWeight: 500 }}>{sign}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Crumb({ to, label }: { to: string; label: string }) {
  return (
    <li style={{ display: 'inline' }}>
      <Link to={to} style={{ color: T.muted, textDecoration: 'none' }}>{label}</Link>
    </li>
  );
}
function Sep() {
  return <li style={{ display: 'inline', color: 'rgba(255,255,255,0.2)' }} aria-hidden="true">/</li>;
}

// ── states ───────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.cream }}>
      <Nav />
      {children}
      <Footer />
    </div>
  );
}

function LoadingSkeleton() {
  const bar = (w: string | number, h: number, mt = 0) => (
    <div style={{ width: w, height: h, marginTop: mt, background: 'linear-gradient(90deg, #141312 0%, #1c1a18 50%, #141312 100%)', backgroundSize: '200% 100%', animation: 'pdna-shimmer 1.4s ease-in-out infinite', borderRadius: 2 }} />
  );
  return (
    <Shell>
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(104px, 13vw, 150px) clamp(20px, 5vw, 56px) 96px' }}>
        {bar(160, 12)}
        {bar('70%', 44, 20)}
        {bar('40%', 16, 16)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 24, marginTop: 36 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>{bar('60%', 10)}{bar('90%', 24, 8)}</div>
          ))}
        </div>
        <div style={{ marginTop: 48 }}>{bar('100%', 120)}</div>
        <div style={{ marginTop: 32 }}>{bar('100%', 200)}</div>
      </main>
      <style>{`@keyframes pdna-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </Shell>
  );
}

function NotFound({ slug }: { slug?: string }) {
  useSeo({
    title: 'Property not found | Property DNA',
    description: 'We could not find a Property DNA report for this address. Run a free report on any home.',
    canonical: slug ? `/property/${slug}` : '/property',
    noindex: true,
  });
  return (
    <Shell>
      <CenterState
        title="No report for this address yet"
        body="We don't have a published Property DNA page for this address. Run a free report and we'll generate its full value, comps, and risk analysis."
      />
    </Shell>
  );
}

function ErrorState() {
  return (
    <Shell>
      <CenterState
        title="Something went wrong"
        body="We couldn't load this property right now. Please try again, or run a fresh Property DNA report."
      />
    </Shell>
  );
}

function CenterState({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 300, color: T.cream2, margin: '0 0 14px' }}>{title}</h1>
        <p style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 300, color: 'rgba(244,240,232,0.55)', lineHeight: 1.75, margin: '0 0 28px' }}>{body}</p>
        <Link to="/analyze" style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: T.bg, background: T.gold, padding: '15px 32px', textDecoration: 'none', display: 'inline-block' }}>
          Run a Free Report →
        </Link>
      </div>
    </div>
  );
}

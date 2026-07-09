// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Prerender SEO body
//
// A SELF-CONTAINED, SSR-safe presentational tree used ONLY at build time by the
// vite-prerender plugin to emit crawlable static HTML + JSON-LD for the research
// and market routes. It deliberately does NOT import Nav / Footer / auth (those
// touch `window` during render and would crash renderToString). On the client,
// React mounts the full interactive page via createRoot and REPLACES this markup
// — so real users still get the complete page; crawlers and no-JS AI fetchers get
// semantic HTML + structured data immediately.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { researchArticles, getResearchArticle } from '@/data/researchPages';
import { getMarketPage, marketPages } from '@/data/marketPages';
import { pruneSchema } from '@/lib/seo/JsonLd';
import { articleSchema, faqSchema, breadcrumbSchema, ORGANIZATION_SCHEMA } from '@/lib/seo/schema';
import { SITE_ORIGIN } from '@/lib/seo/head';

function Ld({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(pruneSchema(data)) }}
    />
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '96px 24px 64px',
  fontFamily: 'Jost, system-ui, sans-serif',
  color: '#F0EBE0',
  background: '#0F0E0D',
  lineHeight: 1.7,
};
const h1: React.CSSProperties = {
  fontFamily: 'Cormorant Garamond, Georgia, serif',
  fontWeight: 300,
  fontSize: 'clamp(30px,5vw,52px)',
  lineHeight: 1.1,
  margin: '0 0 16px',
};
const h2: React.CSSProperties = {
  fontFamily: 'Cormorant Garamond, Georgia, serif',
  fontWeight: 300,
  fontSize: 'clamp(22px,3vw,32px)',
  margin: '36px 0 12px',
};
const link: React.CSSProperties = { color: '#C9A84C' };

function Breadcrumb({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: '#6B6252', marginBottom: 20 }}>
      {trail.map((t, i) => (
        <span key={t.path}>
          {i > 0 ? ' / ' : ''}
          <a href={t.path} style={link}>{t.name}</a>
        </span>
      ))}
    </nav>
  );
}

function ResearchArticleBody({ slug }: { slug: string }) {
  const a = getResearchArticle(slug);
  if (!a) return <main style={wrap}><h1 style={h1}>Article not found</h1></main>;
  return (
    <main style={wrap}>
      <Ld data={articleSchema({ title: a.title, description: a.metaDescription, slug: a.slug, datePublished: a.date })} />
      <Ld data={faqSchema(a.faqs)} />
      <Ld data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Research', path: '/research' }, { name: a.title, path: `/research/${a.slug}` }])} />
      <Breadcrumb trail={[{ name: 'Home', path: '/' }, { name: 'Research', path: '/research' }]} />
      <article>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
          {a.category} · {a.readTime} min read
        </div>
        <h1 style={h1}>{a.title}</h1>
        <p style={{ color: 'rgba(240,235,224,0.7)', fontSize: 18 }}>{a.excerpt}</p>
        {a.sections.map((s, i) => {
          if (s.type === 'h2') return <h2 key={i} style={h2}>{s.text}</h2>;
          if (s.type === 'h3') return <h3 key={i} style={{ ...h2, fontSize: 22 }}>{s.text}</h3>;
          if (s.type === 'ul') return <ul key={i}>{(s.items ?? []).map((it, j) => <li key={j}>{it}</li>)}</ul>;
          if (s.type === 'callout') return <blockquote key={i} style={{ borderLeft: '3px solid #C9A84C', paddingLeft: 16, margin: '20px 0', color: '#F0EBE0' }}>{s.text}</blockquote>;
          return <p key={i}>{s.text}</p>;
        })}
        <h2 style={h2}>Frequently asked questions</h2>
        {a.faqs.map((f, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <strong>{f.q}</strong>
            <p style={{ margin: '4px 0 0' }}>{f.a}</p>
          </div>
        ))}
        <h2 style={h2}>Related markets & research</h2>
        <ul>
          {a.relatedMarkets.map((m) => {
            const mp = getMarketPage(m);
            return mp ? <li key={m}><a href={`/market/${m}`} style={link}>{mp.city}, {mp.state} market</a></li> : null;
          })}
          {a.relatedResearch.map((r) => {
            const rr = getResearchArticle(r);
            return rr ? <li key={r}><a href={`/research/${r}`} style={link}>{rr.title}</a></li> : null;
          })}
        </ul>
        <p><a href="/analyze" style={link}>Run a free Property DNA report →</a></p>
        <p style={{ fontSize: 12, color: '#6B6252' }}>Last updated: {a.date}</p>
      </article>
    </main>
  );
}

function ResearchIndexBody() {
  return (
    <main style={wrap}>
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Property DNA Research',
          url: `${SITE_ORIGIN}/research`,
          publisher: ORGANIZATION_SCHEMA,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: researchArticles.map((a, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_ORIGIN}/research/${a.slug}`,
              name: a.title,
            })),
          },
        }}
      />
      <Ld data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Research', path: '/research' }])} />
      <Breadcrumb trail={[{ name: 'Home', path: '/' }]} />
      <h1 style={h1}>Property DNA Research</h1>
      <p style={{ color: 'rgba(240,235,224,0.7)', fontSize: 18 }}>
        Data-driven analysis of home values, comps, risk, and the drivers that actually move residential real estate.
      </p>
      <ul>
        {researchArticles.map((a) => (
          <li key={a.slug} style={{ marginBottom: 12 }}>
            <a href={`/research/${a.slug}`} style={link}>{a.title}</a>
            <div style={{ fontSize: 14, color: 'rgba(240,235,224,0.6)' }}>{a.excerpt}</div>
          </li>
        ))}
      </ul>
      <h2 style={h2}>Markets we cover</h2>
      <ul>
        {marketPages.map((m) => (
          <li key={m.slug}><a href={`/market/${m.slug}`} style={link}>{m.city}, {m.state} real estate market</a></li>
        ))}
      </ul>
    </main>
  );
}

function MarketBody({ slug }: { slug: string }) {
  const p = getMarketPage(slug);
  if (!p) return <main style={wrap}><h1 style={h1}>Market not found</h1></main>;
  return (
    <main style={wrap}>
      <Ld data={faqSchema(p.faqs)} />
      <Ld data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: `${p.city} Market`, path: `/market/${p.slug}` }])} />
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: `${p.city}, ${p.state}`,
          address: { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.state, addressCountry: 'US' },
        }}
      />
      <Breadcrumb trail={[{ name: 'Home', path: '/' }]} />
      <h1 style={h1}>{p.city}, {p.state} Real Estate Market</h1>
      <p style={{ color: 'rgba(240,235,224,0.7)', fontSize: 18 }}>{p.heroSub}</p>
      <p>{p.overview}</p>
      <h2 style={h2}>Luxury market notes</h2>
      <p>{p.luxuryNotes}</p>
      <h2 style={h2}>Best neighborhoods in {p.city}</h2>
      <ul>
        {p.bestNeighborhoods.map((n) => (
          <li key={n.name}><strong>{n.name}</strong> — {n.note}</li>
        ))}
      </ul>
      <h2 style={h2}>Frequently asked questions</h2>
      {p.faqs.map((f, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <strong>{f.q}</strong>
          <p style={{ margin: '4px 0 0' }}>{f.a}</p>
        </div>
      ))}
      <h2 style={h2}>Related research</h2>
      <ul>
        {p.relatedResearch.map((r) => {
          const rr = getResearchArticle(r);
          return rr ? <li key={r}><a href={`/research/${r}`} style={link}>{rr.title}</a></li> : null;
        })}
      </ul>
      <p><a href="/analyze" style={link}>Run a Property DNA report on any {p.city} home →</a></p>
    </main>
  );
}

/** Render the correct SEO body for a prerender URL, or null if unsupported. */
export function renderSeoBody(url: string): React.ReactElement | null {
  const clean = url.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/research') return <ResearchIndexBody />;
  const research = clean.match(/^\/research\/([^/]+)$/);
  if (research) return <ResearchArticleBody slug={research[1]} />;
  const market = clean.match(/^\/market\/([^/]+)$/);
  if (market) return <MarketBody slug={market[1]} />;
  return null;
}

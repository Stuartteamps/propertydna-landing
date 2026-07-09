import React from 'react';
import { Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import JsonLd from '@/lib/seo/JsonLd';
import { useSeo, SITE_ORIGIN } from '@/lib/seo/head';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { researchArticles } from '@/data/researchPages';
import { marketPages } from '@/data/marketPages';

const eyebrow: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#C9A84C',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const ResearchIndex: React.FC = () => {
  useSeo({
    title: 'Property DNA Research — Home Value, Comps & Market Intelligence',
    description:
      'Data-driven real-estate research from Property DNA: how architecture, risk, HOA structure, views, and regulation actually move home values across the Coachella Valley.',
    canonical: '/research',
    type: 'website',
  });

  const listSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_ORIGIN}/research#collection`,
    name: 'Property DNA Research',
    description:
      'Editorial, data-driven research on what actually moves residential home values — provenance, risk, HOA, views, and regulation.',
    url: `${SITE_ORIGIN}/research`,
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: researchArticles.length,
      itemListElement: researchArticles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_ORIGIN}/research/${a.slug}`,
        name: a.title,
      })),
    },
  };

  return (
    <div style={{ background: '#0A0906', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <JsonLd id="research-list" data={listSchema} />
      <JsonLd
        id="research-breadcrumb"
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Research', path: '/research' },
        ])}
      />

      {/* Header */}
      <header
        style={{
          paddingTop: 'clamp(100px, 14vw, 160px)',
          paddingBottom: 56,
          paddingLeft: 'clamp(20px, 6vw, 80px)',
          paddingRight: 'clamp(20px, 6vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ ...eyebrow, marginBottom: 16 }}>Property DNA Research</div>
        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 300,
            lineHeight: 1.12,
            color: '#F0EBE0',
            marginBottom: 20,
            maxWidth: 720,
          }}
        >
          The intelligence behind a home's value.
        </h1>
        <p
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            color: '#C4B9AA',
            lineHeight: 1.75,
            maxWidth: 640,
          }}
        >
          Editorial, data-driven research on what actually moves residential value — architectural
          provenance, wildfire and regulation risk, HOA structure, views, and the numbers behind the
          Coachella Valley market. Read the analysis, then run a report on any address.
        </p>
      </header>

      {/* Article grid */}
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '56px clamp(20px, 6vw, 80px) 40px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 24,
          }}
        >
          {researchArticles.map((a) => (
            <Link key={a.slug} to={`/research/${a.slug}`} style={{ textDecoration: 'none' }}>
              <article
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '32px 28px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                <div style={{ ...eyebrow, marginBottom: 14 }}>{a.category}</div>
                <h2
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontSize: 22,
                    fontWeight: 300,
                    color: '#F0EBE0',
                    lineHeight: 1.3,
                    marginBottom: 14,
                  }}
                >
                  {a.title}
                </h2>
                <p
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 14,
                    color: '#C4B9AA',
                    lineHeight: 1.7,
                    marginBottom: 20,
                    flexGrow: 1,
                  }}
                >
                  {a.excerpt}
                </p>
                <div
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 10,
                    letterSpacing: '1px',
                    color: '#6B6252',
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{formatDate(a.date)}</span>
                  <span>·</span>
                  <span style={{ color: '#C9A84C' }}>{a.readTime} min read</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>

      {/* Markets we cover */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '48px clamp(20px, 6vw, 80px) 96px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ ...eyebrow, marginBottom: 12 }}>Markets We Cover</div>
        <p
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 14,
            color: '#6B6252',
            lineHeight: 1.7,
            marginBottom: 28,
            maxWidth: 560,
          }}
        >
          Every article ties back to live, confidence-scored market intelligence for these cities.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {marketPages.map((m) => (
            <Link
              key={m.slug}
              to={`/market/${m.slug}`}
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 12,
                letterSpacing: '0.5px',
                color: '#C4B9AA',
                textDecoration: 'none',
                padding: '10px 18px',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)';
                e.currentTarget.style.color = '#F0EBE0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#C4B9AA';
              }}
            >
              {m.city}, {m.state}
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ResearchIndex;

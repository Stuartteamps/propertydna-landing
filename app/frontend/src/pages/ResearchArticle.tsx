import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import JsonLd from '@/lib/seo/JsonLd';
import { useSeo } from '@/lib/seo/head';
import { articleSchema, faqSchema, breadcrumbSchema } from '@/lib/seo/schema';
import { getResearchArticle, ResearchSection } from '@/data/researchPages';
import { getMarketPage } from '@/data/marketPages';

const eyebrow: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#C9A84C',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const renderSection = (section: ResearchSection, i: number) => {
  switch (section.type) {
    case 'h2':
      return (
        <h2
          key={i}
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(22px, 2.5vw, 30px)',
            fontWeight: 300,
            color: '#F0EBE0',
            marginTop: 56,
            marginBottom: 16,
            lineHeight: 1.25,
          }}
        >
          {section.text}
        </h2>
      );

    case 'h3':
      return (
        <h3
          key={i}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: '#F0EBE0',
            marginTop: 32,
            marginBottom: 12,
          }}
        >
          {section.text}
        </h3>
      );

    case 'p':
      return (
        <p
          key={i}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 16,
            color: '#C4B9AA',
            lineHeight: 1.85,
            marginBottom: 20,
          }}
        >
          {section.text}
        </p>
      );

    case 'ul':
      return (
        <ul key={i} style={{ paddingLeft: 0, listStyle: 'none', marginBottom: 24 }}>
          {section.items?.map((item, j) => (
            <li
              key={j}
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 15,
                color: '#C4B9AA',
                lineHeight: 1.7,
                paddingLeft: 20,
                marginBottom: 10,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.6em',
                  width: 4,
                  height: 1,
                  background: '#C9A84C',
                  display: 'inline-block',
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'callout':
      return (
        <blockquote
          key={i}
          style={{
            margin: '40px 0',
            padding: '28px 32px',
            borderLeft: '2px solid #C9A84C',
            background: 'rgba(201,168,76,0.05)',
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(18px, 2vw, 22px)',
            fontWeight: 300,
            color: '#F0EBE0',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          {section.text}
        </blockquote>
      );

    default:
      return null;
  }
};

const ResearchArticle: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getResearchArticle(slug) : undefined;

  // Hooks must run unconditionally, so build a safe SEO config either way.
  useSeo(
    article
      ? {
          title: article.metaTitle,
          description: article.metaDescription,
          canonical: `/research/${article.slug}`,
          type: 'article',
          extraMeta: [
            { property: 'article:published_time', content: article.date },
            { property: 'article:section', content: article.category },
          ],
        }
      : null,
  );

  if (!article) return <Navigate to="/research" replace />;

  const relatedMarkets = article.relatedMarkets
    .map((s) => getMarketPage(s))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const relatedResearch = article.relatedResearch
    .map((s) => getResearchArticle(s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div style={{ background: '#0A0906', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />

      {/* Structured data. FAQ is rendered below with our own markup, so we emit
          faqSchema here (single FAQPage block) rather than reusing <FAQ/>. */}
      <JsonLd
        id="article"
        data={articleSchema({
          title: article.title,
          description: article.metaDescription,
          slug: article.slug,
          datePublished: article.date,
        })}
      />
      {article.faqs.length > 0 && <JsonLd id="faq" data={faqSchema(article.faqs)} />}
      <JsonLd
        id="breadcrumb"
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Research', path: '/research' },
          { name: article.title, path: `/research/${article.slug}` },
        ])}
      />

      {/* Header */}
      <header
        style={{
          paddingTop: 'clamp(100px, 14vw, 160px)',
          paddingBottom: 48,
          paddingLeft: 'clamp(20px, 6vw, 80px)',
          paddingRight: 'clamp(20px, 6vw, 80px)',
          maxWidth: 760,
          margin: '0 auto',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <nav aria-label="Breadcrumb">
          <Link
            to="/research"
            style={{
              ...eyebrow,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              marginBottom: 32,
              color: '#6B6252',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#C9A84C')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B6252')}
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ transform: 'scaleX(-1)' }}>
              <line x1="0" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="0.75" />
              <polyline points="7,1 11,5 7,9" fill="none" stroke="currentColor" strokeWidth="0.75" />
            </svg>
            All Research
          </Link>
        </nav>

        <div style={{ ...eyebrow, marginBottom: 16 }}>{article.category}</div>

        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(30px, 4.5vw, 50px)',
            fontWeight: 300,
            lineHeight: 1.15,
            color: '#F0EBE0',
            marginBottom: 24,
          }}
        >
          {article.title}
        </h1>

        <div
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '1px',
            color: '#6B6252',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span>{formatDate(article.date)}</span>
          <span>·</span>
          <span>{article.readTime} min read</span>
        </div>
      </header>

      {/* Body */}
      <article
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '56px clamp(20px, 6vw, 80px) 40px',
        }}
      >
        <p
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(18px, 2vw, 22px)',
            fontWeight: 300,
            color: '#C4B9AA',
            lineHeight: 1.7,
            marginBottom: 40,
            fontStyle: 'italic',
          }}
        >
          {article.excerpt}
        </p>

        {article.sections.map((section, i) => renderSection(section, i))}

        {/* FAQ */}
        {article.faqs.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <div style={{ ...eyebrow, marginBottom: 24 }}>Frequently Asked Questions</div>
            {article.faqs.map((faq, j) => (
              <div
                key={j}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  paddingTop: 24,
                  paddingBottom: 24,
                }}
              >
                <h3
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#F0EBE0',
                    marginBottom: 10,
                    letterSpacing: '0.3px',
                  }}
                >
                  {faq.q}
                </h3>
                <p
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 14,
                    color: '#6B6252',
                    lineHeight: 1.75,
                  }}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* CTA */}
        <div
          style={{
            marginTop: 72,
            padding: 'clamp(32px, 5vw, 48px)',
            border: '1px solid rgba(201,168,76,0.2)',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.05), transparent 60%)',
            textAlign: 'center',
          }}
        >
          <div style={{ ...eyebrow, marginBottom: 16 }}>Put It To Work</div>
          <p
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(20px, 2.5vw, 28px)',
              fontWeight: 300,
              color: '#F0EBE0',
              marginBottom: 12,
            }}
          >
            Run a Property DNA report on any address
          </p>
          <p
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 13,
              color: '#6B6252',
              marginBottom: 28,
              maxWidth: 460,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.7,
            }}
          >
            See how provenance, risk, HOA structure, and comps change the number for a specific home —
            confidence-scored, not guessed.
          </p>
          <Link
            to="/analyze"
            style={{
              display: 'inline-block',
              fontFamily: 'Jost, sans-serif',
              fontSize: 10,
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              color: '#000',
              background: '#C9A84C',
              padding: '14px 30px',
              textDecoration: 'none',
            }}
          >
            Analyze a Property
          </Link>
        </div>
      </article>

      {/* Internal linking: related markets + research */}
      {(relatedMarkets.length > 0 || relatedResearch.length > 0) && (
        <section
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '56px clamp(20px, 6vw, 80px) 40px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {relatedMarkets.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ ...eyebrow, marginBottom: 20 }}>Markets In This Analysis</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {relatedMarkets.map((m) => (
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
                    {m.city}, {m.state} market
                  </Link>
                ))}
              </div>
            </div>
          )}

          {relatedResearch.length > 0 && (
            <div>
              <div style={{ ...eyebrow, marginBottom: 24 }}>Related Research</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 24,
                }}
              >
                {relatedResearch.map((r) => (
                  <Link key={r.slug} to={`/research/${r.slug}`} style={{ textDecoration: 'none' }}>
                    <article
                      style={{
                        padding: '28px',
                        height: '100%',
                        border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')
                      }
                    >
                      <div style={{ ...eyebrow, marginBottom: 10 }}>{r.category}</div>
                      <h3
                        style={{
                          fontFamily: 'Cormorant Garamond, serif',
                          fontSize: 18,
                          fontWeight: 300,
                          color: '#F0EBE0',
                          lineHeight: 1.35,
                          marginBottom: 12,
                        }}
                      >
                        {r.title}
                      </h3>
                      <span
                        style={{
                          fontFamily: 'Jost, sans-serif',
                          fontSize: 10,
                          letterSpacing: '1.5px',
                          color: '#C9A84C',
                        }}
                      >
                        {r.readTime} min read
                      </span>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Last updated */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 clamp(20px, 6vw, 80px) 96px',
          fontFamily: 'Jost, sans-serif',
          fontSize: 11,
          letterSpacing: '0.5px',
          color: '#3D3730',
        }}
      >
        Last updated: {formatDate(article.date)}
      </div>

      <Footer />
    </div>
  );
};

export default ResearchArticle;

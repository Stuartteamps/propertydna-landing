import React from 'react';
import { Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { blogPosts } from '@/data/blogPosts';

const categoryColor: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#C9A84C',
  marginBottom: 12,
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const Blog: React.FC = () => {
  const [featured, ...rest] = blogPosts;

  return (
    <div style={{ background: '#0A0906', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />

      {/* Hero */}
      <section style={{
        paddingTop: 'clamp(100px, 14vw, 160px)',
        paddingBottom: 'clamp(48px, 8vw, 96px)',
        paddingLeft: 'clamp(20px, 6vw, 80px)',
        paddingRight: 'clamp(20px, 6vw, 80px)',
        maxWidth: 1200,
        margin: '0 auto',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={categoryColor}>PropertyDNA Journal</div>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(36px, 5vw, 60px)',
          fontWeight: 300,
          lineHeight: 1.1,
          color: '#F0EBE0',
          marginBottom: 16,
          maxWidth: 700,
        }}>
          Insights for Real Estate Professionals
        </h1>
        <p style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 15,
          color: '#6B6252',
          lineHeight: 1.7,
          maxWidth: 520,
        }}>
          Strategy, tools, and market intelligence for agents who want to win more listings and serve clients at a higher level.
        </p>
      </section>

      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(48px, 8vw, 80px) clamp(20px, 6vw, 80px)',
      }}>

        {/* Featured article */}
        <Link to={`/blog/${featured.slug}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 72 }}>
          <article style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 48,
            padding: '48px',
            border: '1px solid rgba(201,168,76,0.15)',
            background: 'rgba(201,168,76,0.03)',
            transition: 'border-color 0.25s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)')}
          >
            <div>
              <div style={categoryColor}>{featured.category} — Featured</div>
              <h2 style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 300,
                lineHeight: 1.2,
                color: '#F0EBE0',
                marginBottom: 16,
              }}>{featured.title}</h2>
              <p style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 14,
                color: '#6B6252',
                lineHeight: 1.7,
              }}>{featured.excerpt}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 10,
                letterSpacing: '1.5px',
                color: '#6B6252',
                marginBottom: 16,
              }}>
                {formatDate(featured.date)} &nbsp;·&nbsp; {featured.readTime} min read
              </div>
              <div style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 10,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#C9A84C',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                Read Article
                <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                  <line x1="0" y1="5" x2="13" y2="5" stroke="#C9A84C" strokeWidth="0.75"/>
                  <polyline points="9,1 13,5 9,9" fill="none" stroke="#C9A84C" strokeWidth="0.75"/>
                </svg>
              </div>
            </div>
          </article>
        </Link>

        {/* Article grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 32,
        }}>
          {rest.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <article style={{
                padding: '32px',
                border: '1px solid rgba(255,255,255,0.06)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.25s, background 0.25s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={categoryColor}>{post.category}</div>
                <h3 style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 22,
                  fontWeight: 300,
                  lineHeight: 1.3,
                  color: '#F0EBE0',
                  marginBottom: 12,
                  flex: 1,
                }}>{post.title}</h3>
                <p style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 13,
                  color: '#6B6252',
                  lineHeight: 1.65,
                  marginBottom: 24,
                }}>
                  {post.excerpt.length > 140 ? post.excerpt.slice(0, 140) + '…' : post.excerpt}
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: 16,
                }}>
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '1px', color: '#3D3730' }}>
                    {formatDate(post.date)}
                  </span>
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '1.5px', color: '#C9A84C' }}>
                    {post.readTime} min
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 96,
          padding: '64px 48px',
          border: '1px solid rgba(201,168,76,0.2)',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06), transparent 60%)',
        }}>
          <div style={categoryColor}>Get Started</div>
          <h2 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 300,
            color: '#F0EBE0',
            marginBottom: 16,
          }}>
            See What PropertyDNA Does for Your Business
          </h2>
          <p style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 14,
            color: '#6B6252',
            marginBottom: 32,
            maxWidth: 480,
            margin: '0 auto 32px',
          }}>
            Generate your first property report in under 60 seconds. No credit card required.
          </p>
          <Link to="/analyze" style={{
            display: 'inline-block',
            fontFamily: 'Jost, sans-serif',
            fontSize: 10,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: '#000',
            background: '#C9A84C',
            padding: '14px 32px',
            textDecoration: 'none',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E8C96A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
          >
            Analyze a Property
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;

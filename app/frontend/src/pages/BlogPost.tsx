import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { getBlogPost, getRelatedPosts, BlogSection } from '@/data/blogPosts';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const eyebrow: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#C9A84C',
};

const renderSection = (section: BlogSection, i: number) => {
  switch (section.type) {
    case 'h2':
      return (
        <h2 key={i} style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(22px, 2.5vw, 30px)',
          fontWeight: 300,
          color: '#F0EBE0',
          marginTop: 56,
          marginBottom: 16,
          lineHeight: 1.25,
        }}>{section.text}</h2>
      );

    case 'h3':
      return (
        <h3 key={i} style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: '#F0EBE0',
          marginTop: 32,
          marginBottom: 12,
        }}>{section.text}</h3>
      );

    case 'p':
      return (
        <p key={i} style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 16,
          color: '#C4B9AA',
          lineHeight: 1.85,
          marginBottom: 20,
        }}>{section.text}</p>
      );

    case 'ul':
      return (
        <ul key={i} style={{ paddingLeft: 0, listStyle: 'none', marginBottom: 24 }}>
          {section.items?.map((item, j) => (
            <li key={j} style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 15,
              color: '#C4B9AA',
              lineHeight: 1.7,
              paddingLeft: 20,
              marginBottom: 10,
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: 0,
                top: '0.6em',
                width: 4,
                height: 1,
                background: '#C9A84C',
                display: 'inline-block',
              }} />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={i} style={{ paddingLeft: 0, listStyle: 'none', marginBottom: 24, counterReset: 'article-ol' }}>
          {section.items?.map((item, j) => (
            <li key={j} style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 15,
              color: '#C4B9AA',
              lineHeight: 1.7,
              paddingLeft: 32,
              marginBottom: 14,
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: 0,
                top: 0,
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: 18,
                color: '#C9A84C',
                fontWeight: 300,
                lineHeight: 1.5,
              }}>{j + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      );

    case 'callout':
      return (
        <blockquote key={i} style={{
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
        }}>{section.text}</blockquote>
      );

    case 'faq':
      return (
        <div key={i} style={{ marginTop: 56 }}>
          <div style={{ ...eyebrow, marginBottom: 24 }}>Frequently Asked Questions</div>
          {section.faqs?.map((faq, j) => (
            <div key={j} style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingTop: 24,
              paddingBottom: 24,
            }}>
              <p style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                color: '#F0EBE0',
                marginBottom: 10,
                letterSpacing: '0.3px',
              }}>{faq.q}</p>
              <p style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 14,
                color: '#6B6252',
                lineHeight: 1.75,
              }}>{faq.a}</p>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) return <Navigate to="/blog" replace />;

  const related = getRelatedPosts(post.slug);

  return (
    <div style={{ background: '#0A0906', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />

      {/* Article header */}
      <header style={{
        paddingTop: 'clamp(100px, 14vw, 160px)',
        paddingBottom: 64,
        paddingLeft: 'clamp(20px, 6vw, 80px)',
        paddingRight: 'clamp(20px, 6vw, 80px)',
        maxWidth: 860,
        margin: '0 auto',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link to="/blog" style={{
          ...eyebrow,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          marginBottom: 32,
          color: '#6B6252',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
        >
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ transform: 'scaleX(-1)' }}>
            <line x1="0" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="0.75"/>
            <polyline points="7,1 11,5 7,9" fill="none" stroke="currentColor" strokeWidth="0.75"/>
          </svg>
          All Articles
        </Link>

        <div style={{ ...eyebrow, marginBottom: 16 }}>{post.category}</div>

        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(30px, 4.5vw, 52px)',
          fontWeight: 300,
          lineHeight: 1.15,
          color: '#F0EBE0',
          marginBottom: 24,
        }}>{post.title}</h1>

        <div style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 11,
          letterSpacing: '1px',
          color: '#3D3730',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span>{post.readTime} min read</span>
        </div>
      </header>

      {/* Article body */}
      <article style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '64px clamp(20px, 6vw, 80px) 96px',
      }}>
        {/* Lead */}
        <p style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(18px, 2vw, 22px)',
          fontWeight: 300,
          color: '#C4B9AA',
          lineHeight: 1.7,
          marginBottom: 40,
          fontStyle: 'italic',
        }}>{post.excerpt}</p>

        {/* Sections */}
        {post.sections.map((section, i) => renderSection(section, i))}

        {/* Bottom CTA */}
        <div style={{
          marginTop: 80,
          padding: '48px',
          border: '1px solid rgba(201,168,76,0.2)',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.05), transparent 60%)',
          textAlign: 'center',
        }}>
          <div style={{ ...eyebrow, marginBottom: 16 }}>Try It Now</div>
          <p style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(20px, 2.5vw, 28px)',
            fontWeight: 300,
            color: '#F0EBE0',
            marginBottom: 12,
          }}>
            Generate a PropertyDNA Report in 60 Seconds
          </p>
          <p style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 13,
            color: '#6B6252',
            marginBottom: 28,
          }}>
            Enter any Coachella Valley address and get the full property intelligence report instantly.
          </p>
          <Link to="/analyze" style={{
            display: 'inline-block',
            fontFamily: 'Jost, sans-serif',
            fontSize: 10,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: '#000',
            background: '#C9A84C',
            padding: '13px 28px',
            textDecoration: 'none',
          }}>
            Analyze a Property
          </Link>
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 clamp(20px, 6vw, 80px) 96px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 64,
        }}>
          <div style={{ ...eyebrow, marginBottom: 40 }}>More Articles</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {related.map(p => (
              <Link key={p.slug} to={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
                <article style={{
                  padding: '28px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  <div style={{ ...eyebrow, marginBottom: 10 }}>{p.category}</div>
                  <h4 style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontSize: 18,
                    fontWeight: 300,
                    color: '#F0EBE0',
                    lineHeight: 1.35,
                    marginBottom: 12,
                  }}>{p.title}</h4>
                  <span style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 10,
                    letterSpacing: '1.5px',
                    color: '#C9A84C',
                  }}>{p.readTime} min read</span>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default BlogPost;

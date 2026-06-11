import { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import ShareCTA from '@/components/ShareCTA';
import { getCityLandingPage } from '@/data/cityLandingPages';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079?ct=city_landing&mt=8';

function ensureMeta(attr: 'name' | 'property', value: string, content: string) {
  let tag = document.head.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export default function CityLanding() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? getCityLandingPage(slug) : undefined;

  useEffect(() => {
    if (!page) return;
    document.title = page.metaTitle;
    ensureMeta('name', 'description', page.metaDescription);
    ensureMeta('property', 'og:title', page.metaTitle);
    ensureMeta('property', 'og:description', page.metaDescription);
    ensureMeta('property', 'og:type', 'website');
    ensureMeta('property', 'og:url', `https://thepropertydna.com/coverage/${page.slug}`);

    // FAQ JSON-LD for AEO
    const faqJson = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqSlots.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
    let scriptTag = document.head.querySelector('script[data-faq-jsonld="city"]') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.dataset.faqJsonld = 'city';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(faqJson);
    return () => { scriptTag?.remove(); };
  }, [page]);

  if (!page) return <Navigate to="/launch" replace />;

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(110px, 14vw, 160px)',
        paddingBottom: 'clamp(60px, 8vw, 100px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.12), transparent 55%), #0F0E0D',
      }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '4px', textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 18,
            }}>
              {page.city}, {page.state} · {page.county}
            </div>
            <h1 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
              color: '#F4F0E8', margin: '0 0 24px',
            }}>
              {page.heroHeadline}
            </h1>
            <p style={{
              fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.3vw, 17px)',
              fontWeight: 300, lineHeight: 1.85,
              color: 'rgba(244,240,232,0.65)', margin: '0 0 32px',
            }}>
              {page.heroSub}
            </p>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 11,
              letterSpacing: 2, color: '#C9A84C', marginBottom: 28,
            }}>
              {page.parcelCountLabel}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                  letterSpacing: 3, textTransform: 'uppercase',
                  color: '#0F0E0D', background: '#C9A84C',
                  padding: '16px 32px', textDecoration: 'none',
                }}
              >
                Download Free on iOS →
              </a>
              <Link
                to="/analyze"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500,
                  letterSpacing: 3, textTransform: 'uppercase',
                  color: 'rgba(244,240,232,0.7)', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)', padding: '16px 32px',
                  textDecoration: 'none',
                }}
              >
                Run a Free Report (Web) →
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      <section style={{ background: '#0A0908', padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: 4, textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 14,
            }}>
              Why this market is different
            </div>
            <p style={{
              fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(20px, 2.2vw, 26px)',
              fontWeight: 300, fontStyle: 'italic', lineHeight: 1.5,
              color: '#F4F0E8',
            }}>
              {page.notable}
            </p>
          </FadeUp>
        </div>
      </section>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <FadeUp>
            <div style={{ marginBottom: 36 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: 4, textTransform: 'uppercase',
                color: '#C9A84C', marginBottom: 14,
              }}>
                On every {page.city} report
              </div>
              <h2 style={{
                fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: 300, color: '#F4F0E8', margin: 0, lineHeight: 1.1,
              }}>
                Local risk, surfaced.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
              {page.riskCallouts.map(r => (
                <div
                  key={r}
                  style={{
                    background: '#0F0E0D', padding: '24px 28px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  <span style={{ color: '#C9A84C', fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>—</span>
                  <span style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300,
                    color: 'rgba(244,240,232,0.65)', lineHeight: 1.7,
                  }}>
                    {r}
                  </span>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      <section style={{ background: '#0A0908', padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <FadeUp>
            <div style={{
              fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: 4, textTransform: 'uppercase',
              color: '#C9A84C', marginBottom: 14, textAlign: 'center',
            }}>
              Questions about {page.city}
            </div>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 300, color: '#F4F0E8', margin: '0 0 36px', textAlign: 'center', lineHeight: 1.1,
            }}>
              {page.city} — fine print<br /><em style={{ color: '#C9A84C' }}>that isn't fine.</em>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {page.faqSlots.map(f => (
                <div key={f.q}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: '#F4F0E8', marginBottom: 10, lineHeight: 1.3 }}>
                    {f.q}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: 'rgba(244,240,232,0.55)' }}>
                    {f.a}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <ShareCTA subjectLabel={`a ${page.city} property`} />
        </div>
      </section>

      <Footer />
    </div>
  );
}

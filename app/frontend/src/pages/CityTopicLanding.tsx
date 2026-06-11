import { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import { getCityTopicPage, getCityLandingPage } from '@/data/cityLandingPages';

const APP_STORE_URL = 'https://apps.apple.com/app/id6768064079?ct=city_topic&mt=8';

function ensureMeta(attr: 'name' | 'property', value: string, content: string) {
  let tag = document.head.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export default function CityTopicLanding() {
  const { slug, topic } = useParams<{ slug: string; topic: string }>();
  const page = slug && topic ? getCityTopicPage(slug, topic) : undefined;
  const city = slug ? getCityLandingPage(slug) : undefined;

  useEffect(() => {
    if (!page || !city) return;
    const url = `https://www.thepropertydna.com/coverage/${page.citySlug}/${page.topicSlug}`;
    document.title = page.metaTitle;
    ensureMeta('name', 'description', page.metaDescription);
    ensureMeta('property', 'og:title', page.metaTitle);
    ensureMeta('property', 'og:description', page.metaDescription);
    ensureMeta('property', 'og:type', 'article');
    ensureMeta('property', 'og:url', url);

    const articleJson = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.metaTitle,
      description: page.metaDescription,
      datePublished: '2026-06-11',
      dateModified: '2026-06-11',
      author: { '@type': 'Organization', name: 'PropertyDNA', url: 'https://thepropertydna.com' },
      publisher: { '@type': 'Organization', name: 'PropertyDNA', url: 'https://thepropertydna.com' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    };
    const crumbJson = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PropertyDNA', item: 'https://thepropertydna.com' },
        { '@type': 'ListItem', position: 2, name: 'Coverage', item: 'https://thepropertydna.com/launch' },
        { '@type': 'ListItem', position: 3, name: `${city.city}, ${city.state}`, item: `https://thepropertydna.com/coverage/${page.citySlug}` },
        { '@type': 'ListItem', position: 4, name: page.topicLabel, item: url },
      ],
    };
    let articleTag = document.head.querySelector('script[data-jsonld="ct-article"]') as HTMLScriptElement | null;
    if (!articleTag) {
      articleTag = document.createElement('script');
      articleTag.type = 'application/ld+json';
      articleTag.dataset.jsonld = 'ct-article';
      document.head.appendChild(articleTag);
    }
    articleTag.textContent = JSON.stringify(articleJson);
    let crumbTag = document.head.querySelector('script[data-jsonld="ct-crumb"]') as HTMLScriptElement | null;
    if (!crumbTag) {
      crumbTag = document.createElement('script');
      crumbTag.type = 'application/ld+json';
      crumbTag.dataset.jsonld = 'ct-crumb';
      document.head.appendChild(crumbTag);
    }
    crumbTag.textContent = JSON.stringify(crumbJson);

    return () => {
      articleTag?.remove();
      crumbTag?.remove();
    };
  }, [page, city]);

  if (!page || !city) return <Navigate to="/launch" replace />;

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(110px, 14vw, 160px)',
        paddingBottom: 'clamp(40px, 6vw, 80px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(184,147,85,0.12), transparent 55%), #0F0E0D',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <FadeUp>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 18 }}>
              <Link to={`/coverage/${page.citySlug}`} style={{ color: '#C9A84C', textDecoration: 'none' }}>
                {city.city}, {city.state}
              </Link>
              <span style={{ color: 'rgba(244,240,232,0.3)', margin: '0 8px' }}>·</span>
              {page.topicLabel}
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(34px, 5vw, 60px)', fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.08, color: '#F4F0E8', margin: '0 0 24px' }}>
              {page.metaTitle.replace(' | Free Property Report', '').replace(' | PropertyDNA', '')}
            </h1>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 'clamp(15px, 1.3vw, 17px)', fontWeight: 300, lineHeight: 1.9, color: 'rgba(244,240,232,0.65)' }}>
              {page.intro}
            </p>
            <div style={{ marginTop: 28 }}>
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer"
                style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D', background: '#C9A84C', padding: '16px 32px', textDecoration: 'none', display: 'inline-block' }}>
                Get the report — free iOS →
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      <section style={{ padding: 'clamp(40px, 6vw, 80px) clamp(24px, 6vw, 80px)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
          {page.sections.map(s => (
            <FadeUp key={s.heading}>
              <div>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(22px, 2.6vw, 28px)', fontWeight: 400, color: '#F4F0E8', marginBottom: 14, lineHeight: 1.25 }}>
                  {s.heading}
                </h2>
                <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, lineHeight: 1.9, color: 'rgba(244,240,232,0.65)' }}>
                  {s.body}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section style={{ background: '#0A0908', padding: 'clamp(40px, 6vw, 80px) clamp(24px, 6vw, 80px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <FadeUp>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 14 }}>
              The counter
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 300, color: '#F4F0E8', margin: '0 0 24px', lineHeight: 1.15 }}>
              Every {city.city} report — free on iOS.
            </h2>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D', background: '#C9A84C', padding: '18px 36px', textDecoration: 'none', display: 'inline-block' }}>
              Download Free on iOS →
            </a>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </div>
  );
}

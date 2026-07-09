// ─────────────────────────────────────────────────────────────────────────────
// Unified prerender entry for vite-prerender-plugin.
//
// Routes:
//  - /blog/*     → delegates to the existing blog prerender (static blog pages).
//  - /research*  → self-contained SEO body + head meta (client re-mounts full page).
//  - /market/*   → self-contained SEO body + head meta (client re-mounts full page).
//
// The research/market prerenders intentionally DO NOT set the
// `prerender-static-page` meta, so main.tsx still mounts the full interactive
// React app on the client (createRoot replaces the prerendered SEO markup). This
// gives crawlers/AI fetchers real HTML + JSON-LD, and users the full page.
// ─────────────────────────────────────────────────────────────────────────────
import { renderToString } from 'react-dom/server';
import { prerender as blogPrerender } from './blog.js';
import { renderSeoBody } from '../src/prerender/SeoBody.tsx';
import { getResearchArticle, researchArticles } from '../src/data/researchPages.ts';
import { getMarketPage } from '../src/data/marketPages.ts';

const ORIGIN = 'https://thepropertydna.com';
const DEFAULT_IMAGE = `${ORIGIN}/og-image.png`;

function meta(props) {
  return { type: 'meta', props };
}
function linkEl(rel, href) {
  return { type: 'link', props: { rel, href } };
}

function headFor(title, description, canonicalPath, type) {
  const url = `${ORIGIN}${canonicalPath}`;
  return {
    title,
    lang: 'en',
    elements: new Set(
      [
        meta({ name: 'description', content: description }),
        linkEl('canonical', url),
        meta({ name: 'robots', content: 'index,follow' }),
        meta({ property: 'og:site_name', content: 'Property DNA' }),
        meta({ property: 'og:title', content: title }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:type', content: type }),
        meta({ property: 'og:url', content: url }),
        meta({ property: 'og:image', content: DEFAULT_IMAGE }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
        meta({ name: 'twitter:title', content: title }),
        meta({ name: 'twitter:description', content: description }),
        meta({ name: 'twitter:image', content: DEFAULT_IMAGE }),
      ].filter(Boolean),
    ),
  };
}

function clean(url) {
  return url.split('?')[0].replace(/\/+$/, '') || '/';
}

function headForUrl(url) {
  const c = clean(url);
  if (c === '/research') {
    return headFor(
      'Property DNA Research — Home Value, Comps & Market Intelligence',
      'Data-driven research on home values, comparable sales, risk, and the drivers that move residential real estate.',
      '/research',
      'website',
    );
  }
  const r = c.match(/^\/research\/([^/]+)$/);
  if (r) {
    const a = getResearchArticle(r[1]);
    if (a) return headFor(a.metaTitle, a.metaDescription, `/research/${a.slug}`, 'article');
  }
  const m = c.match(/^\/market\/([^/]+)$/);
  if (m) {
    const p = getMarketPage(m[1]);
    if (p) return headFor(p.metaTitle, p.metaDescription, `/market/${p.slug}`, 'website');
  }
  return undefined;
}

export async function prerender({ url }) {
  if (url.startsWith('/blog')) {
    return blogPrerender({ url });
  }

  const body = renderSeoBody(url);
  if (body) {
    const html = renderToString(body);
    const head = headForUrl(url);
    // 404 for unknown research/market slugs so we don't index empty shells.
    const c = clean(url);
    const rMatch = c.match(/^\/research\/([^/]+)$/);
    const mMatch = c.match(/^\/market\/([^/]+)$/);
    const is404 =
      (rMatch && !getResearchArticle(rMatch[1])) || (mMatch && !getMarketPage(mMatch[1]));
    return { html, head, ...(is404 ? { statusCode: 404 } : {}) };
  }

  // Unknown route — let the plugin fall back to the SPA shell.
  return { html: '' };
}

// Re-export so callers can reference the article list if needed.
export { researchArticles };

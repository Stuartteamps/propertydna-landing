/**
 * Dynamic sitemap.xml — pulls all dossiers, architects, neighborhoods, blog
 * posts, and ticker URLs straight from the DB so search engines + AI crawlers
 * always see the current index. Cached at the edge for 1h.
 *
 * Wired in netlify.toml: /sitemap.xml -> /.netlify/functions/sitemap.
 */
const https = require('https');

const SITE = 'https://www.thepropertydna.com';
const SUPA = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY  = process.env.SUPABASE_SERVICE_KEY;

function get(path) {
  return new Promise((resolve) => {
    const u = new URL(SUPA + path);
    https.get({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers:  { apikey: KEY, Authorization: `Bearer ${KEY}` },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve([]); } });
    }).on('error', () => resolve([]));
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function url(loc, opts = {}) {
  const { changefreq = 'weekly', priority = 0.7, lastmod } = opts;
  return `  <url>
    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${esc(lastmod.slice(0, 10))}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Static, evergreen pages — the spine of the site.
const STATIC_PAGES = [
  { loc: '/',                  freq: 'daily',   pri: 1.0  },
  { loc: '/dossiers',          freq: 'daily',   pri: 0.95 },
  { loc: '/pedigree-index',    freq: 'weekly',  pri: 0.95 },
  { loc: '/luxury-inventory',  freq: 'daily',   pri: 0.95 },
  { loc: '/market-heatmaps',   freq: 'daily',   pri: 0.9  },
  { loc: '/architects',        freq: 'weekly',  pri: 0.9  },
  { loc: '/analyze',           freq: 'weekly',  pri: 0.85 },
  { loc: '/sample-report',     freq: 'monthly', pri: 0.8  },
  { loc: '/how-it-works',      freq: 'monthly', pri: 0.7  },
  { loc: '/about',             freq: 'monthly', pri: 0.6  },
  { loc: '/pricing',           freq: 'monthly', pri: 0.7  },
  { loc: '/press',             freq: 'monthly', pri: 0.7  },
  { loc: '/blog',              freq: 'daily',   pri: 0.85 },
  { loc: '/contact',           freq: 'monthly', pri: 0.4  },
  { loc: '/dossier-request',   freq: 'monthly', pri: 0.75 },
];

// All dossier APNs (high SEO + AEO value — primary-source-verified pages).
async function getDossiers() {
  return (await get('/rest/v1/property_master?select=apn,address,city,last_updated&has_provenance_dossier=eq.true&order=provenance_score.desc') || []);
}

// Every property in the index gets a /ticker/:apn URL. Cap at 50K per sitemap
// best practice; total index is 3.58M, so paginate / let crawlers find via
// internal links + heat map. For now we surface the A-tier + B-tier (~1.4k) +
// every dossier as priority indexable.
async function getTickerCandidates() {
  return (await get('/rest/v1/property_master?select=apn,address,last_updated&or=(pedigree_tier.eq.A,pedigree_tier.eq.B)&order=provenance_score.desc.nullslast&limit=2000') || []);
}

async function getArchitects() {
  return (await get('/rest/v1/architects?select=name,updated_at') || []);
}

async function getBlogSlugs() {
  // Blog posts live in the bundled data file, but we can list known slugs.
  // Hard-coding the 10 known slugs to keep this Lambda-only with no FS access.
  return [
    'ai-property-reports-palm-springs-realtors',
    'future-of-real-estate-ai-property-analysis',
    'propertydna-lead-to-listing-conversion',
    'propertydna-saves-realtors-time',
    'propertydna-vs-traditional-cma',
    'real-estate-market-heat-maps-explained',
    'what-is-a-propertydna-report-home-buyers',
    'what-is-propertydna',
    'why-sellers-choose-propertydna-realtors',
    'win-listing-appointment-ai-property-data',
    'luxury-home-provenance-pedigree-classification',
    'off-market-property-leads',
    'permit-history-property-purchase',
  ];
}

const NAMED_NEIGHBORHOODS = [
  'Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas',
  'The Mesa', 'Indian Canyons', 'Smoke Tree Ranch', 'Tahquitz River Estates',
  'Racquet Club Estates', 'Twin Palms',
  'Thunderbird Heights', 'Tamarisk Country Club', 'Mission Hills',
];

function slugify(s) {
  return String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
}

exports.handler = async () => {
  const [dossiers, tickers, architects] = await Promise.all([
    getDossiers(),
    getTickerCandidates(),
    getArchitects(),
  ]);
  const blogSlugs = await getBlogSlugs();

  const urls = [];

  STATIC_PAGES.forEach(p => {
    urls.push(url(`${SITE}${p.loc}`, { changefreq: p.freq, priority: p.pri }));
  });

  // Blog posts
  blogSlugs.forEach(s => {
    urls.push(url(`${SITE}/blog/${s}`, { changefreq: 'monthly', priority: 0.75 }));
  });

  // Architect profiles (high SEO authority — they cite primary sources)
  architects.forEach(a => {
    urls.push(url(`${SITE}/architect/${slugify(a.name)}`, { changefreq: 'monthly', priority: 0.9, lastmod: a.updated_at }));
  });

  // Named neighborhoods (long-tail SEO)
  NAMED_NEIGHBORHOODS.forEach(n => {
    urls.push(url(`${SITE}/neighborhood/${slugify(n)}`, { changefreq: 'weekly', priority: 0.8 }));
  });

  // Verified dossiers — the highest-value pages on the site
  dossiers.forEach(d => {
    urls.push(url(`${SITE}/dossier/${d.apn}`, { changefreq: 'monthly', priority: 0.95, lastmod: d.last_updated }));
  });

  // Property ticker URLs (A + B tier indexable)
  tickers.forEach(t => {
    urls.push(url(`${SITE}/ticker/${t.apn}`, { changefreq: 'monthly', priority: 0.7, lastmod: t.last_updated }));
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
    body: xml,
  };
};

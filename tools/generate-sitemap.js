#!/usr/bin/env node
/**
 * Regenerates app/frontend/public/sitemap.xml with:
 *  · Core pages
 *  · Blog articles
 *  · All A-tier dossier URLs
 *  · Top B-tier dossier URLs
 *  · Neighborhood inventory views (12 named neighborhoods)
 *
 * Run: SUPABASE_SERVICE_KEY=... node tools/generate-sitemap.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SITE = 'https://www.thepropertydna.com';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

function req(p) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    r.on('error', reject); r.end();
  });
}

const NEIGHBORHOODS = [
  'Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas',
  'The Mesa', 'Indian Canyons', 'Smoke Tree Ranch', 'Tahquitz River Estates',
  'Racquet Club Estates', 'Twin Palms',
  'Thunderbird Heights', 'Tamarisk Country Club', 'Mission Hills',
];

const ARCHITECT_SLUGS = [
  'albert-frey', 'john-lautner', 'richard-neutra', 'william-krisel',
  'donald-wexler', 'e-stewart-williams', 'hugh-kaptur',
  'william-f-cody', 'howard-lapham', 'walter-s-white', 'charles-dubois',
];

const CORE_PAGES = [
  { loc: '/',                   priority: '1.0', changefreq: 'weekly' },
  { loc: '/luxury-inventory',   priority: '0.95', changefreq: 'daily' },
  { loc: '/pedigree-index',     priority: '0.95', changefreq: 'weekly' },
  { loc: '/press',              priority: '0.7' },
  { loc: '/about',              priority: '0.7' },
  { loc: '/pricing',            priority: '0.8' },
  { loc: '/how-it-works',       priority: '0.7' },
  { loc: '/professionals',      priority: '0.8' },
  { loc: '/market-heatmaps',    priority: '0.85' },
  { loc: '/intellagraph',       priority: '0.8' },
  { loc: '/sample-report',      priority: '0.75' },
  { loc: '/blog',               priority: '0.9', changefreq: 'weekly' },
  { loc: '/contact',            priority: '0.6' },
  { loc: '/privacy',            priority: '0.3' },
];

const BLOG_POSTS = [
  { slug: 'what-is-propertydna',                       date: '2025-05-01' },
  { slug: 'ai-property-reports-palm-springs-realtors', date: '2025-05-08' },
  { slug: 'propertydna-vs-traditional-cma',            date: '2025-05-15' },
  { slug: 'propertydna-saves-realtors-time',           date: '2025-05-22' },
  { slug: 'win-listing-appointment-ai-property-data',  date: '2025-05-29' },
  { slug: 'what-is-a-propertydna-report-home-buyers',  date: '2025-06-05' },
  { slug: 'real-estate-market-heat-maps-explained',    date: '2025-06-12' },
  { slug: 'propertydna-lead-to-listing-conversion',    date: '2025-06-19' },
  { slug: 'future-of-real-estate-ai-property-analysis', date: '2025-06-26' },
  { slug: 'why-sellers-choose-propertydna-realtors',   date: '2025-07-03' },
];

function urlBlock({ loc, priority = '0.5', changefreq = 'monthly', lastmod }) {
  return `  <url>
    <loc>${SITE}${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

(async () => {
  // Pull A-tier (all) and B-tier (top 200 by value)
  const [aTier, bTier] = await Promise.all([
    req('/rest/v1/property_master?pedigree_tier=eq.A&select=apn&limit=100'),
    req('/rest/v1/property_master?pedigree_tier=eq.B&select=apn,luxury_value_basis&order=luxury_value_basis.desc.nullslast&limit=200'),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const urls = [];

  // Core
  CORE_PAGES.forEach(p => urls.push(urlBlock(p)));

  // Blog
  BLOG_POSTS.forEach(b => urls.push(urlBlock({
    loc: `/blog/${b.slug}`, priority: '0.85', changefreq: 'monthly', lastmod: b.date,
  })));

  // Neighborhood filter views
  NEIGHBORHOODS.forEach(h => urls.push(urlBlock({
    loc: `/luxury-inventory?neighborhood=${encodeURIComponent(h)}`,
    priority: '0.85', changefreq: 'weekly', lastmod: today,
  })));

  // Neighborhood overview pages (dedicated SEO landing pages)
  NEIGHBORHOODS.forEach(h => {
    const slug = h.toLowerCase().replace(/\s+/g, '-');
    urls.push(urlBlock({
      loc: `/neighborhood/${slug}`,
      priority: '0.95', changefreq: 'weekly', lastmod: today,
    }));
  });

  // Architect profile pages
  ARCHITECT_SLUGS.forEach(slug => urls.push(urlBlock({
    loc: `/architect/${slug}`, priority: '0.9', changefreq: 'monthly', lastmod: today,
  })));

  // A-tier dossiers (highest priority)
  aTier.forEach(p => urls.push(urlBlock({
    loc: `/dossier/${p.apn}`, priority: '1.0', changefreq: 'monthly', lastmod: today,
  })));

  // B-tier dossiers
  bTier.forEach(p => urls.push(urlBlock({
    loc: `/dossier/${p.apn}`, priority: '0.7', changefreq: 'monthly', lastmod: today,
  })));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.join('\n\n')}

</urlset>
`;

  const outPath = path.join(__dirname, '../app/frontend/public/sitemap.xml');
  fs.writeFileSync(outPath, xml);

  console.log(`Sitemap written: ${outPath}`);
  console.log(`Total URLs: ${urls.length}`);
  console.log(`  · Core pages: ${CORE_PAGES.length}`);
  console.log(`  · Blog articles: ${BLOG_POSTS.length}`);
  console.log(`  · Neighborhood views: ${NEIGHBORHOODS.length}`);
  console.log(`  · A-tier dossiers: ${aTier.length}`);
  console.log(`  · B-tier dossiers: ${bTier.length}`);
})();

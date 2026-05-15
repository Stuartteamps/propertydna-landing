/**
 * dossier-feed — RSS 2.0 feed of newest verified luxury dossiers
 *
 * GET /.netlify/functions/dossier-feed
 * Aliased to /dossier-feed.xml via netlify.toml
 *
 * Pulls the 30 most recent A-tier dossiers ordered by provenance_score desc
 * and emits an RSS feed for subscription / aggregator ingestion.
 */
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SITE = 'https://www.thepropertydna.com';

function get(path) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    });
    r.on('error', reject);
    r.end();
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

exports.handler = async () => {
  const rows = await get('/rest/v1/property_master?has_provenance_dossier=eq.true&pedigree_tier=eq.A&select=apn,address,city,architect_attribution,provenance_score,pedigree_neighborhood&order=provenance_score.desc&limit=30');

  const now = new Date().toUTCString();

  const items = (rows || []).map(p => {
    const url = `${SITE}/dossier/${p.apn}`;
    const title = `${p.address}, ${p.city}` + (p.architect_attribution ? ` — ${p.architect_attribution}` : '');
    const desc = `Verified provenance dossier for ${p.address}` +
      (p.architect_attribution ? `, designed by ${p.architect_attribution}` : '') +
      (p.pedigree_neighborhood ? ` in ${p.pedigree_neighborhood}` : '') +
      `. Provenance score: ${p.provenance_score}/100.`;
    return `<item>
      <title>${esc(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${esc(desc)}</description>
      <category>${esc(p.pedigree_neighborhood || 'Coachella Valley')}</category>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PropertyDNA — Verified Luxury Dossiers</title>
    <link>${SITE}/pedigree-index</link>
    <description>Verified provenance dossiers for architecturally and culturally significant Palm Springs estates. Updated as new dossiers are documented.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/dossier-feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    body: xml,
  };
};

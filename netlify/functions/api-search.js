/**
 * api-search — Resolve an address query to property slugs + basic matches.
 *
 *   GET /api/v1/search?address=50220+Via+Puente
 *   → { query, count, results:[{ address, city, state, slug, apn, propertyUrl }] }
 *
 * Searches property_reports (public rows) and property_master. The slug +
 * propertyUrl let AI tools jump straight to the public page. Never fabricates.
 *
 * Wired in netlify.toml: /api/v1/search -> /.netlify/functions/api-search.
 */
const https = require('https');

const SITE = 'https://www.thepropertydna.com';
const SUPA_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
};

function sbGet(pathAndQuery) {
  return new Promise((resolve) => {
    if (!SUPA_KEY) return resolve([]);
    const u = new URL(SUPA_URL + '/rest/v1/' + pathAndQuery);
    https
      .get(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' },
          timeout: 8000,
        },
        (res) => {
          let raw = '';
          res.on('data', (d) => (raw += d));
          res.on('end', () => {
            try {
              const j = JSON.parse(raw);
              resolve(Array.isArray(j) ? j : []);
            } catch {
              resolve([]);
            }
          });
        }
      )
      .on('error', () => resolve([]))
      .on('timeout', function () {
        this.destroy();
        resolve([]);
      });
  });
}

function slugify(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const params = event.queryStringParameters || {};
  const query = decodeURIComponent(params.address || params.q || '').trim();

  if (!query || query.length < 2) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ query, count: 0, results: [] }) };
  }

  const like = `%${query.replace(/\s+/g, '%')}%`;
  const results = [];
  const seen = new Set();

  const push = (r) => {
    if (!r.address) return;
    const key = r.slug || slugify(r.address);
    if (seen.has(key)) return;
    seen.add(key);
    results.push(r);
  };

  try {
    // 1. Public reports (best — they have a real page). MIGRATION-INDEPENDENT:
    //    does NOT select public_slug (absent pre-038 → 400 → no results); the URL
    //    slug is derived from full_address, which equals 038's backfilled slug.
    const reports = await sbGet(
      `property_reports?select=address,city,state,zip,full_address,apn` +
        `&status=eq.completed&or=(full_address.ilike.${encodeURIComponent(like)},address.ilike.${encodeURIComponent(like)})` +
        `&order=created_at.desc&limit=25`
    );
    (reports || []).forEach((r) => {
      const address = r.full_address || [r.address, r.city, r.state].filter(Boolean).join(', ');
      const slug = r.public_slug || slugify(address);
      push({ address, city: r.city || null, state: r.state || null, slug, apn: r.apn || null, propertyUrl: `${SITE}/property/${slug}` });
    });

    // 2. Parcels from property_master (thin pages).
    if (results.length < 20) {
      const parcels = await sbGet(
        `property_master?select=apn,address,address_line1,formatted_address,city,state,zip` +
          `&or=(address.ilike.${encodeURIComponent(like)},formatted_address.ilike.${encodeURIComponent(like)})&limit=25`
      );
      (parcels || []).forEach((p) => {
        const address = p.formatted_address || p.address || [p.address_line1, p.city, p.state].filter(Boolean).join(', ');
        const slug = slugify(address);
        push({ address, city: p.city || null, state: p.state || null, slug, apn: p.apn || null, propertyUrl: `${SITE}/property/${slug}` });
      });
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ query, count: results.length, results: results.slice(0, 25) }) };
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ query, count: 0, results: [], error: String(err && err.message) }) };
  }
};

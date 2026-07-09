/**
 * api-market — Developer / AI-tool JSON API for a city market.
 *
 *   GET /api/v1/market/:city   → { city, state, slug, stats, source, lastUpdated }
 *
 * `:city` is a market slug, e.g. "la-quinta-ca". Stats are computed from REAL
 * transactions in the same `properties` table get-value-series uses. If no live
 * data is found we return stats:null + a note — NEVER invented numbers.
 *
 * Wired in netlify.toml: /api/v1/market/* -> /.netlify/functions/api-market.
 */
const https = require('https');

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

const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md',
  'ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc',
  'sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
]);

/** "la-quinta-ca" → { city:"La Quinta", state:"CA" }. */
function parseSlug(slug) {
  const parts = String(slug || '').toLowerCase().split('-').filter(Boolean);
  let state = null;
  if (parts.length && US_STATES.has(parts[parts.length - 1])) state = parts.pop().toUpperCase();
  const city = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { city, state };
}

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/** Most-recent vs prior-period median % change. */
function momentumPct(vals) {
  if (vals.length < 4) return 0;
  const mid = Math.floor(vals.length / 2);
  const older = median(vals.slice(0, mid));
  const recent = median(vals.slice(mid));
  return older > 0 ? Math.round(((recent - older) / older) * 1000) / 10 : 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const params = event.queryStringParameters || {};
  const m = (event.path || '').match(/\/api\/(?:v1\/)?market\/([^/?]+)/);
  const slug = decodeURIComponent((m && m[1]) || params.city || '').trim().toLowerCase();

  if (!slug) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'missing_city' }) };

  const { city, state } = parseSlug(slug);
  const base = { city: city || null, state: state || null, slug };

  try {
    if (!city) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify(Object.assign({}, base, { stats: null, source: 'empty', note: 'live market stats unavailable' })) };
    }

    // Real transactions for the city — same table/columns get-value-series reads.
    let q = `properties?select=last_sale_price,last_sale_date,sqft&city=eq.${encodeURIComponent(city)}` +
      `&last_sale_price=not.is.null&last_sale_date=not.is.null&order=last_sale_date.asc&limit=2000`;
    if (state) q += `&state=eq.${encodeURIComponent(state)}`;
    const rows = await sbGet(q);

    const clean = (rows || [])
      .map((r) => ({ price: Number(r.last_sale_price), date: r.last_sale_date, sqft: Number(r.sqft) }))
      .filter((r) => Number.isFinite(r.price) && r.price > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (clean.length < 3) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify(Object.assign({}, base, { stats: null, source: 'empty', note: 'live market stats unavailable' })),
      };
    }

    const prices = clean.map((r) => r.price);
    const ppsfVals = clean.filter((r) => r.sqft > 0).map((r) => r.price / r.sqft);
    const dates = clean.map((r) => r.date).filter(Boolean);

    const stats = {
      sampleSize: clean.length,
      medianSalePrice: Math.round(median(prices)),
      minSalePrice: Math.round(Math.min.apply(null, prices)),
      maxSalePrice: Math.round(Math.max.apply(null, prices)),
      medianPricePerSqft: ppsfVals.length ? Math.round(median(ppsfVals)) : null,
      momentumPct: momentumPct(prices),
      firstSaleDate: dates.length ? dates[0] : null,
      latestSaleDate: dates.length ? dates[dates.length - 1] : null,
    };

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(Object.assign({}, base, { stats, source: 'sales', lastUpdated: stats.latestSaleDate })),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(Object.assign({}, base, { stats: null, source: 'error', note: 'live market stats unavailable', detail: String(err && err.message) })),
    };
  }
};

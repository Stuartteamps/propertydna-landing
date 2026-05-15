/**
 * api-dossiers — Public JSON API for verified luxury dossier inventory
 *
 * GET /api/dossiers              → top 50 A-tier dossiers
 * GET /api/dossiers?tier=B       → top 50 of that tier
 * GET /api/dossiers?neighborhood=Movie+Colony
 * GET /api/dossiers?architect=Albert+Frey
 * GET /api/dossiers/:apn         → single dossier detail
 *
 * Returns JSON with property + architect + owners + events.
 */
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function get(path) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    });
    r.on('error', reject); r.end();
  });
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
};

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const apnMatch = (event.path || '').match(/\/api\/dossiers\/([^/?]+)/);

  // Single dossier detail
  if (apnMatch) {
    const apn = decodeURIComponent(apnMatch[1]);
    const [prop, owners, events, comm] = await Promise.all([
      get(`/rest/v1/property_master?apn=eq.${encodeURIComponent(apn)}&select=apn,address,city,state,year_built,sqft,luxury_tier,pedigree_tier,pedigree_neighborhood,provenance_score,architect_attribution,architect_verified&limit=1`),
      get(`/rest/v1/notable_owners?apn=eq.${encodeURIComponent(apn)}&select=*`),
      get(`/rest/v1/provenance_events?apn=eq.${encodeURIComponent(apn)}&select=*`),
      get(`/rest/v1/architect_commissions?apn=eq.${encodeURIComponent(apn)}&select=*&limit=1`),
    ]);
    if (!Array.isArray(prop) || !prop.length) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'not_found' }) };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      property: prop[0], owners, events, commission: comm?.[0] || null,
      url: `https://www.thepropertydna.com/dossier/${prop[0].apn}`,
    }) };
  }

  // List with filters
  let q = '/rest/v1/property_master?select=apn,address,city,architect_attribution,provenance_score,pedigree_tier,pedigree_neighborhood';
  q += params.tier ? `&pedigree_tier=eq.${encodeURIComponent(params.tier)}` : '&pedigree_tier=eq.A';
  q += '&has_provenance_dossier=eq.true';
  if (params.neighborhood) q += `&pedigree_neighborhood=eq.${encodeURIComponent(params.neighborhood)}`;
  if (params.architect) q += `&architect_attribution=eq.${encodeURIComponent(params.architect)}`;
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  q += `&order=provenance_score.desc.nullslast&limit=${limit}`;

  const rows = await get(q);
  const data = (rows || []).map(r => ({
    ...r,
    dossier_url: `https://www.thepropertydna.com/dossier/${r.apn}`,
    api_url: `https://www.thepropertydna.com/api/dossiers/${r.apn}`,
  }));

  return { statusCode: 200, headers: CORS, body: JSON.stringify({
    count: data.length, filters: params, data,
  }, null, 2) };
};

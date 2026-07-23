/**
 * api-property — Developer / AI-tool JSON API for a single property.
 *
 *   GET /api/v1/property/:id             → normalized summary + links
 *   GET /api/v1/property/:id/comps       → comparable sales array
 *   GET /api/v1/property/:id/valuation   → value + range + confidence + drivers
 *   GET /api/v1/property/:id/scores      → the 9 proprietary scores
 *
 * `:id` may be a report id (uuid), a public_slug, or an apn — each is tried.
 * Public, read-only. Never fabricates: missing signals become null / available:false.
 *
 * SYMMETRY: every number here comes from ./_intelligence — the SAME engine
 * public-property.js ships to the /property page and the frontend renders. There
 * is no second implementation, so the developer API and the page cannot disagree.
 *
 * Wired in netlify.toml: /api/v1/property/* -> /.netlify/functions/api-property.
 */
const https = require('https');
const { computeDnaScore, computeProprietaryScores, buildValuationExplanation } = require('./_intelligence');

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

const num = (v) => {
  if (v == null || v === '' || v === '—') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
}

function parseDna(rd) {
  let dna = rd || null;
  if (typeof dna === 'string') {
    try { dna = JSON.parse(dna); } catch { dna = null; }
  }
  return dna && typeof dna === 'object' ? dna : null;
}

// BASE_COLS = only columns guaranteed to exist pre-migration-038, so the uuid /
// apn / full_address queries (the migration-independent paths) never 400.
const BASE_COLS =
  'id,address,city,state,zip,full_address,report_data,enrichment_data,status,apn,created_at,updated_at';
// SLUG_COLS augments with the 038 columns; used only by the public_slug fast-path
// whose WHERE already references public_slug (pre-038 → 400 → [] → falls through).
const SLUG_COLS = BASE_COLS + ',public_slug,is_public';

/** Resolve :id (uuid | public_slug | apn) → a property_reports row (or null). */
async function resolveReport(id) {
  if (!id) return null;
  const NR = "&status=not.in.(pending,generating)";
  const queries = [];
  if (UUID_RE.test(id)) queries.push(`property_reports?select=${BASE_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`);
  queries.push(
    `property_reports?select=${SLUG_COLS}&public_slug=eq.${encodeURIComponent(slugify(id))}${NR}&order=created_at.desc&limit=1`
  );
  queries.push(
    `property_reports?select=${BASE_COLS}&apn=eq.${encodeURIComponent(id)}${NR}&order=created_at.desc&limit=1`
  );
  for (const q of queries) {
    const rows = await sbGet(q);
    if (rows && rows.length) return rows[0];
  }
  // Last resort (MIGRATION-INDEPENDENT): slug-match recent ready reports by
  // slugified full_address. BASE_COLS only, so it works with or without 038.
  const recent = await sbGet(
    `property_reports?select=${BASE_COLS}&status=eq.completed&full_address=not.is.null&order=created_at.desc&limit=500`
  );
  const target = slugify(id);
  return (
    (recent || []).find((r) => {
      const fa = r.full_address || [r.address, r.city, r.state].filter(Boolean).join(', ');
      return slugify(fa) === target || slugify(r.address || '') === target;
    }) || null
  );
}

/** Base summary — DNA score + headline valuation come straight from the engine. */
function buildSummary(id, row, dna) {
  const n = (dna && dna.normalized) || {};
  const sub = n.subject || {};
  const lastUpdated = row.updated_at || row.created_at || null;
  const v = buildValuationExplanation(dna, lastUpdated);
  let dnaScore = null;
  try { dnaScore = dna ? computeDnaScore(dna).total : null; } catch { dnaScore = null; }
  const fullAddress = row.full_address || [row.address, row.city, row.state].filter(Boolean).join(', ');
  return {
    id,
    address: fullAddress || row.address || null,
    city: row.city || null,
    state: row.state || null,
    zip: row.zip || null,
    apn: row.apn || sub.apn || null,
    beds: num(sub.beds),
    baths: num(sub.baths),
    sqft: num(sub.sqft),
    yearBuilt: num(sub.yearBuilt),
    estimatedValue: v.estimatedValue,
    valueRange: v.lowRange != null || v.highRange != null ? { low: v.lowRange, high: v.highRange } : null,
    confidenceScore: v.confidenceScore,
    dnaScore,
    lastUpdated,
    links: {
      page: `${SITE}/property/${row.public_slug || slugify(fullAddress)}`,
      comps: `${SITE}/api/v1/property/${id}/comps`,
      valuation: `${SITE}/api/v1/property/${id}/valuation`,
      scores: `${SITE}/api/v1/property/${id}/scores`,
    },
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const path = event.path || '';
  // /api/v1/property/:id(/sub)?  — tolerate the legacy /api/property/* mount too.
  const m = path.match(/\/api\/(?:v1\/)?property\/([^/?]+)(?:\/([^/?]+))?/);
  const params = event.queryStringParameters || {};
  const id = decodeURIComponent((m && m[1]) || params.id || '').trim();
  const sub = (m && m[2] ? m[2] : '').toLowerCase();

  if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'missing_id' }) };

  try {
    const row = await resolveReport(id);
    if (!row) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'not_found', id }) };

    const dna = parseDna(row.report_data);
    const enrichment = row.enrichment_data || null;
    const mergedDna = dna && enrichment ? Object.assign({}, dna, { enrichment }) : dna;
    const lastUpdated = row.updated_at || row.created_at || null;

    if (sub === 'comps') {
      // Same comps the page shows — from the engine's explainable valuation.
      const comps = mergedDna ? buildValuationExplanation(mergedDna, lastUpdated).comparableSalesUsed : [];
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id, count: comps.length, comps }) };
    }
    if (sub === 'valuation') {
      const v = mergedDna ? buildValuationExplanation(mergedDna, lastUpdated) : null;
      return { statusCode: 200, headers: CORS, body: JSON.stringify(Object.assign({ id }, v || { estimatedValue: null })) };
    }
    if (sub === 'scores') {
      const scores = mergedDna ? computeProprietaryScores(mergedDna) : null;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id, scores }) };
    }
    // base summary
    return { statusCode: 200, headers: CORS, body: JSON.stringify(buildSummary(id, row, mergedDna)) };
  } catch (err) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'not_found', id, detail: String(err && err.message) }) };
  }
};

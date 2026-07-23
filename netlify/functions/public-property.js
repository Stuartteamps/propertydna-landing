/**
 * public-property — Public, non-PII property bundle powering /property/:slug.
 *
 *   GET /api/property/:slug   → PublicPropertyBundle
 *   GET /api/property?slug=…   → same
 *
 * Lookup order (never fabricates — returns nulls / 404 when nothing matches):
 *   1. property_reports by public_slug (completed, newest first)
 *   2. property_reports recent completed rows, matched by JS-slugified full_address
 *   3. property_master by apn or address → THIN parcel bundle (report_data:null)
 *
 * Returns EXACTLY:
 *   { ok, slug, address, city, state, zip, apn, lat, lon, report_data,
 *     status, lastUpdated, isPublic, source, error? }
 *
 * NEVER returns email, full_name, phone or view_token.
 *
 * Wired in netlify.toml: /api/property/* -> /.netlify/functions/public-property.
 */
const https = require('https');
// Single source of truth for scores + valuation — the SAME engine api-property
// and the frontend consume, so the page and the developer API can never disagree.
const { computeProprietaryScores, buildValuationExplanation } = require('./_intelligence');

const SUPA_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
};

/** Zero-dep Supabase REST GET. Returns [] on any error (never throws). */
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

/** Match the frontend slugifyAddress() EXACTLY. */
function slugify(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
}

const num = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Parse report_data — n8n may double-encode it as a JSON string. */
function parseDna(rd) {
  let dna = rd || null;
  if (typeof dna === 'string') {
    try { dna = JSON.parse(dna); } catch { dna = null; }
  }
  return dna && typeof dna === 'object' ? dna : null;
}

function bundleFromReport(row) {
  const dna = parseDna(row.report_data);
  const sub = (dna && dna.normalized && dna.normalized.subject) || {};
  const fullAddress =
    row.full_address || [row.address, row.city, row.state].filter(Boolean).join(', ') || sub.address || '';
  const lastUpdated = row.updated_at || row.created_at || null;
  // Compute scores + valuation HERE with the canonical engine and ship them in
  // the bundle. The page renders these directly (it does not recompute), so the
  // /property page and the /api/v1 developer endpoints are byte-for-byte in sync.
  let scores = null;
  let valuation = null;
  if (dna) {
    try { scores = computeProprietaryScores(dna); } catch { scores = null; }
    try { valuation = buildValuationExplanation(dna, lastUpdated); } catch { valuation = null; }
  }
  return {
    ok: true,
    slug: row.public_slug || slugify(fullAddress),
    address: fullAddress || null,
    city: row.city || null,
    state: row.state || null,
    zip: row.zip || null,
    apn: row.apn || (sub.apn || null),
    lat: num(sub.lat) ?? num(sub.latitude),
    lon: num(sub.lon) ?? num(sub.lng) ?? num(sub.longitude),
    report_data: dna,
    scores,
    valuation,
    status: row.status || 'completed',
    lastUpdated,
    isPublic: row.is_public !== false,
    source: 'report',
  };
}

function bundleFromParcel(p, slug) {
  const address = p.formatted_address || p.address || [p.address_line1, p.city, p.state].filter(Boolean).join(', ');
  return {
    ok: true,
    slug: slug || slugify(address),
    address: address || null,
    city: p.city || null,
    state: p.state || null,
    zip: p.zip || null,
    apn: p.apn || null,
    lat: num(p.lat),
    lon: num(p.lng),
    report_data: null,
    scores: null,
    valuation: null,
    status: 'parcel',
    lastUpdated: p.last_updated || null,
    isPublic: true,
    source: 'parcel',
  };
}

// BASE_COLS lists ONLY columns guaranteed to exist pre-migration-038. The
// full_address fallback (the migration-independent path) selects exactly these,
// so it never 400s even when public_slug/is_public don't exist yet.
const BASE_COLS =
  'id,address,city,state,zip,full_address,report_data,status,apn,created_at,updated_at';
// SLUG_COLS augments with the 038 columns. Used ONLY by the public_slug fast-path,
// whose WHERE already references public_slug — so pre-038 it 400s → [] → we fall
// through to the full_address scan. Post-038 it's a fast indexed hit.
const SLUG_COLS = BASE_COLS + ',public_slug,is_public';
const NOT_READY = "&status=not.in.(pending,generating,failed)";

/** Pure slug matcher — a report matches when its public_slug equals the slug OR
 *  its slugified full_address (or address) does. Migration-independent: works on
 *  rows that have no public_slug field at all. Exported for tests. */
function findReportForSlug(rows, slug) {
  return (
    (rows || []).find((r) => {
      if (r && r.public_slug && String(r.public_slug) === slug) return true;
      const fa = (r && (r.full_address || [r.address, r.city, r.state].filter(Boolean).join(', '))) || '';
      return slugify(fa) === slug || slugify((r && r.address) || '') === slug;
    }) || null
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const params = event.queryStringParameters || {};
  const m = (event.path || '').match(/\/api\/property\/([^/?]+)\/?$/);
  const rawSlug = decodeURIComponent(params.slug || (m && m[1]) || '').trim();

  if (!rawSlug) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'missing_slug' }) };
  }
  const slug = slugify(rawSlug);

  try {
    // 1. Direct public_slug hit (newest completed first). Pre-038 this query
    //    400s (column absent) → sbGet returns [] → we fall through to step 2.
    let rows = await sbGet(
      `property_reports?select=${SLUG_COLS}&public_slug=eq.${encodeURIComponent(slug)}${NOT_READY}` +
        `&order=created_at.desc&limit=1`
    );
    if (rows && rows.length) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify(bundleFromReport(rows[0])) };
    }

    // 2. MIGRATION-INDEPENDENT fallback: scan recent completed/ready reports and
    //    match a JS-slugified full_address. Selects BASE_COLS only, so it works
    //    whether or not migration 038 has run.
    const recent = await sbGet(
      `property_reports?select=${BASE_COLS}${NOT_READY}&full_address=not.is.null` +
        `&order=created_at.desc&limit=500`
    );
    const hit = findReportForSlug(recent, slug);
    if (hit) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify(bundleFromReport(hit)) };
    }

    // 3. Thin parcel bundle from property_master (by apn, then by slugified address).
    const PM_COLS = 'apn,address,address_line1,formatted_address,city,state,zip,lat,lng,last_updated';
    let parcels = await sbGet(
      `property_master?select=${PM_COLS}&apn=eq.${encodeURIComponent(rawSlug)}&limit=1`
    );
    if (!parcels || !parcels.length) {
      // Reconstruct a probable street portion (before first token that looks like a slugged city)
      const guess = rawSlug.replace(/-/g, ' ');
      parcels = await sbGet(
        `property_master?select=${PM_COLS}&address=ilike.${encodeURIComponent('%' + guess.split(' ').slice(0, 3).join(' ') + '%')}&limit=25`
      );
      parcels = (parcels || []).filter((p) => {
        const a = p.formatted_address || p.address || [p.address_line1, p.city, p.state].filter(Boolean).join(', ');
        return slugify(a) === slug;
      });
    }
    if (parcels && parcels.length) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify(bundleFromParcel(parcels[0], slug)) };
    }

    return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'not_found', slug }) };
  } catch (err) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: 'not_found', slug, detail: String(err && err.message) }),
    };
  }
};

// ── Named exports for offline tests (handler behavior unchanged) ──────────────
exports.slugify = slugify;
exports.findReportForSlug = findReportForSlug;
exports.bundleFromReport = bundleFromReport;
exports.bundleFromParcel = bundleFromParcel;

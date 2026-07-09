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
 * Wired in netlify.toml: /api/v1/property/* -> /.netlify/functions/api-property.
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

const num = (v) => {
  if (v == null || v === '' || v === '—') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const has = (v) => v != null && v !== '' && v !== '—';
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const dedupe = (a) => Array.from(new Set(a.filter(Boolean)));

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

const REPORT_COLS =
  'id,address,city,state,zip,full_address,report_data,enrichment_data,status,public_slug,is_public,apn,created_at,updated_at';

/** Resolve :id (uuid | public_slug | apn) → a property_reports row (or null). */
async function resolveReport(id) {
  if (!id) return null;
  const NR = "&status=not.in.(pending,generating)";
  const queries = [];
  if (UUID_RE.test(id)) queries.push(`property_reports?select=${REPORT_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`);
  queries.push(
    `property_reports?select=${REPORT_COLS}&public_slug=eq.${encodeURIComponent(slugify(id))}${NR}&order=created_at.desc&limit=1`
  );
  queries.push(
    `property_reports?select=${REPORT_COLS}&apn=eq.${encodeURIComponent(id)}${NR}&order=created_at.desc&limit=1`
  );
  for (const q of queries) {
    const rows = await sbGet(q);
    if (rows && rows.length) return rows[0];
  }
  // Last resort: slug-match recent completed reports.
  const recent = await sbGet(
    `property_reports?select=${REPORT_COLS}&status=eq.completed&full_address=not.is.null&order=created_at.desc&limit=500`
  );
  const target = slugify(id);
  return (
    (recent || []).find((r) => {
      const fa = r.full_address || [r.address, r.city, r.state].filter(Boolean).join(', ');
      return slugify(fa) === target || slugify(r.address || '') === target;
    }) || null
  );
}

// ── comps ─────────────────────────────────────────────────────────────────────
function extractComps(dna) {
  const n = (dna && dna.normalized) || {};
  const comps = Array.isArray(n.comps) ? n.comps : [];
  return comps.slice(0, 24).map((c) => {
    const price = num(c.rawPrice) ?? num(c.price) ?? num(c.salePrice);
    const sqft = num(c.sqft);
    return {
      address: c.address || null,
      distanceMi: num(c.distanceMi) ?? num(c.distance),
      salePrice: price,
      pricePerSqft: num(c.pricePerSqft) ?? (price && sqft ? Math.round(price / sqft) : null),
      beds: num(c.beds),
      baths: num(c.baths),
      sqft,
      saleDate: c.saleDate || c.soldDate || c.date || null,
    };
  });
}

// ── valuation (ported from valuationExplanation.ts, light) ──────────────────────
function buildValuation(dna, lastUpdated) {
  const n = (dna && dna.normalized) || {};
  const val = n.valuation || {};
  const adj = (dna && dna.dnaAdjusted) || null;

  const estimatedValue = (adj && num(adj.adjMid)) ?? num(val.marketValue);
  const lowRange = (adj && num(adj.adjLow)) ?? num(val.low);
  const highRange = (adj && num(adj.adjHigh)) ?? num(val.high);

  let confidenceScore = null;
  if (adj && adj.confidence != null) confidenceScore = Math.round(num(adj.confidence) * 100);
  else if (val.valuationConfidence === 'high') confidenceScore = 82;
  else if (val.valuationConfidence === 'medium') confidenceScore = 62;
  else if (val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient') confidenceScore = 35;

  const method =
    adj && adj.adjMid != null
      ? 'AVM baseline + PropertyDNA adjustment'
      : val.valuationSource
        ? `AVM (${String(val.valuationSource).replace(/_/g, ' ')})`
        : val.marketValue != null
          ? 'Automated valuation model'
          : null;

  const keyDrivers = [];
  if (adj && Array.isArray(adj.drivers)) {
    for (const d of adj.drivers) {
      const label = typeof d === 'string' ? d : d && (d.label || d.name);
      if (label) keyDrivers.push(String(label));
    }
  }
  if (adj && adj.baseAdjustment && adj.baseAdjustment.label) keyDrivers.unshift(String(adj.baseAdjustment.label));
  const sub = n.subject || {};
  if (num(sub.lastSalePrice)) {
    keyDrivers.push(
      `Last recorded sale: $${Math.round(num(sub.lastSalePrice)).toLocaleString()}${sub.lastSaleDate ? ` (${sub.lastSaleDate})` : ''}`
    );
  }
  const comps = Array.isArray(n.comps) ? n.comps : [];
  if (comps.length) keyDrivers.push(`${comps.length} comparable sale${comps.length === 1 ? '' : 's'} within the local market`);

  return {
    estimatedValue,
    lowRange,
    highRange,
    confidenceScore,
    method,
    keyDrivers: dedupe(keyDrivers).slice(0, 8),
    lastUpdated: lastUpdated || null,
  };
}

// ── scores (ported light from scores.ts) ────────────────────────────────────────
function mk(score, label, explanation, factors, confidence, available = true) {
  return { score: clamp(score), label, explanation, factors: (factors || []).filter(Boolean), confidence, available };
}
function unavailable(explanation) {
  return { score: 0, label: 'Data unavailable', explanation, factors: [], confidence: 'low', available: false };
}
function band(score, bands) {
  for (const [t, label] of bands) if (score >= t) return label;
  return bands[bands.length - 1][1];
}

function computeScores(dna) {
  const n = (dna && dna.normalized) || {};
  const val = n.valuation || {};
  const comps = Array.isArray(n.comps) ? n.comps : [];
  const flood = n.flood || {};
  const sub = n.subject || {};
  const demo = n.demographics || {};
  const enr = (dna && dna.enrichment) || {};
  const cat = enr.categoryScores || {};
  const hazE = enr.hazardEnrichment || {};
  const hasV3 = !!enr.v3_enriched;

  const yearBuilt = num(sub.yearBuilt);
  const sqft = num(sub.sqft);
  const marketValue = num(val.marketValue) ?? (dna && dna.dnaAdjusted && num(dna.dnaAdjusted.adjMid));
  const compCount = comps.length;
  const lowConf = val.valuationConfidence === 'low' || val.valuationConfidence === 'insufficient';

  // 1. Property DNA Score — light composite (no full engine here).
  const dnaTotal = num((dna && dna.dnaScore) || (dna && dna.dna && dna.dna.total) || null);
  const propertyDnaScore = dnaTotal != null
    ? mk(dnaTotal, band(dnaTotal, [[80, 'Exceptional'], [65, 'Strong'], [45, 'Fair'], [0, 'Watch']]),
        'Composite asset-quality signal from valuation, comps, risk and condition.',
        [`${compCount} comparable sale${compCount === 1 ? '' : 's'} used`], hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low')
    : unavailable('Insufficient normalized data to compute the composite DNA score.');

  // 2. Buyer Confidence
  const buyerAvail = compCount > 0 || has(val.marketValue);
  const buyerBase =
    (compCount >= 5 ? 40 : compCount * 8) +
    (has(val.marketValue) && !lowConf ? 32 : has(val.marketValue) ? 14 : 0) +
    (has(sqft) && has(yearBuilt) ? 18 : has(sqft) ? 9 : 0) +
    (hasV3 ? 10 : 0);
  const buyerConfidenceScore = buyerAvail
    ? mk(buyerBase, band(clamp(buyerBase), [[75, 'High confidence'], [50, 'Solid'], [30, 'Cautious'], [0, 'Thin data']]),
        'How defensible the valuation is for a buyer, based on comparable support and record completeness.',
        [`${compCount} comparable sale${compCount === 1 ? '' : 's'} used`,
          has(val.marketValue) ? `Valuation confidence: ${val.valuationConfidence || 'standard'}` : 'No AVM value available',
          has(sqft) ? 'Core property vitals present' : 'Property vitals incomplete'],
        hasV3 ? 'high' : compCount >= 3 ? 'medium' : 'low')
    : unavailable('No comparable sales or valuation available to gauge buyer confidence.');

  // 3. Seller Timing
  const momentum = num(enr.marketData && enr.marketData.momentumScore) ?? num(dna && dna.marketMomentum && dna.marketMomentum.score);
  const domSignal = num(enr.marketData && enr.marketData.medianDaysOnMarket);
  const sellerAvail = momentum != null || domSignal != null || compCount >= 3;
  let sellerBase = 50;
  if (momentum != null) sellerBase += clamp(momentum, -100, 100) * 0.3;
  if (domSignal != null) sellerBase += domSignal <= 30 ? 12 : domSignal >= 90 ? -12 : 0;
  const sellerTimingScore = sellerAvail
    ? mk(sellerBase, band(clamp(sellerBase), [[70, "Seller's window"], [45, 'Balanced'], [0, 'Patience advised']]),
        'Whether current momentum favors listing now, from market direction and days-on-market where available.',
        [momentum != null ? `Market momentum index: ${Math.round(momentum)}` : 'Momentum index unavailable',
          domSignal != null ? `Median days on market: ${Math.round(domSignal)}` : 'Days-on-market unavailable'],
        momentum != null && domSignal != null ? 'medium' : 'low')
    : unavailable('No market-direction or absorption signal available for this area yet.');

  // 4. Hidden Risk (higher = more risk)
  const riskFactors = [];
  let riskAccum = 0, riskSignals = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    const sfha = flood.highRisk || z.startsWith('A') || z.startsWith('V');
    riskAccum += sfha ? 70 : 20; riskSignals++;
    riskFactors.push(`FEMA flood zone ${flood.zone}${sfha ? ' (Special Flood Hazard Area)' : ''}`);
  }
  const seismic = hazE.seismic && hazE.seismic.seismicRiskLevel;
  if (has(seismic)) {
    riskAccum += /high/i.test(seismic) ? 65 : /moderate/i.test(seismic) ? 40 : 15; riskSignals++;
    riskFactors.push(`USGS seismic risk: ${seismic}`);
  }
  const ej = num(hazE.environmental && hazE.environmental.ejIndexPctile);
  if (ej != null) { riskAccum += ej; riskSignals++; riskFactors.push(`EPA environmental-justice index: ${Math.round(ej)}th pctile`); }
  const hiddenRiskScore = riskSignals > 0
    ? mk(riskAccum / riskSignals, band(clamp(riskAccum / riskSignals), [[60, 'Elevated'], [35, 'Moderate'], [0, 'Low']]),
        'Composite of environmental and structural hazards a headline valuation hides. Higher means more risk.',
        riskFactors, riskSignals >= 2 ? 'medium' : 'low')
    : unavailable('No hazard signals (flood, seismic, environmental) resolved for this parcel yet.');

  // 5. Renovation ROI
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null;
  const opps = Array.isArray(dna && dna.opportunities) ? dna.opportunities : [];
  const renoAvail = age != null || opps.length > 0;
  let renoBase = 45;
  if (age != null) renoBase += age > 40 ? 25 : age > 20 ? 12 : -5;
  const renoRoi = num(cat.renovationRoi);
  if (renoRoi != null) renoBase = renoRoi;
  const renovationRoiScore = renoAvail
    ? mk(renoBase, band(clamp(renoBase), [[65, 'Strong upside'], [40, 'Moderate'], [0, 'Limited']]),
        'Estimated headroom for value-add improvements, from building age and any modeled opportunities.',
        [age != null ? `Built ${yearBuilt} (${age} yrs old)` : 'Year built unavailable',
          opps.length ? `${opps.length} modeled improvement opportunit${opps.length === 1 ? 'y' : 'ies'}` : ''],
        renoRoi != null ? 'medium' : 'low')
    : unavailable('No age or improvement data available to estimate renovation ROI.');

  // 6. Luxury Score
  const ppsf = sqft && marketValue ? marketValue / sqft : null;
  const luxAvail = ppsf != null || has(sub.apn);
  let luxBase = 40;
  if (ppsf != null) luxBase += ppsf > 800 ? 40 : ppsf > 500 ? 25 : ppsf > 350 ? 12 : 0;
  const luxuryScore = luxAvail
    ? mk(luxBase, band(clamp(luxBase), [[75, 'Luxury tier'], [50, 'Premium'], [0, 'Standard']]),
        'Where the property sits on the luxury spectrum, from price-per-square-foot and prestige signals.',
        [ppsf != null ? `$${Math.round(ppsf).toLocaleString()}/sqft` : 'Price-per-sqft unavailable'],
        ppsf != null ? 'medium' : 'low')
    : unavailable('No price-per-sqft or prestige signal available to place this on the luxury spectrum.');

  // 7. Rental Potential
  const rentalCat = num(cat.rentalYield) ?? num(cat.rentalPotential);
  const medRent = num(demo.medianRent);
  const rentalAvail = rentalCat != null || medRent != null;
  const rentalPotentialScore = rentalAvail
    ? mk(rentalCat != null ? rentalCat : 50, band(clamp(rentalCat != null ? rentalCat : 50), [[65, 'Strong yield'], [40, 'Moderate'], [0, 'Soft']]),
        'Income-property potential from modeled rental yield and area rent levels.',
        [rentalCat != null ? `Modeled rental-yield score: ${Math.round(rentalCat)}/100` : 'Yield model unavailable',
          medRent != null ? `Area median rent: $${Math.round(medRent).toLocaleString()}` : ''],
        rentalCat != null ? 'medium' : 'low')
    : unavailable('No rental-yield or area-rent data available for this property.');

  // 8. Climate Resilience (higher = more resilient)
  const climSignals = [];
  let climAccum = 0, climN = 0;
  if (has(flood.zone)) {
    const z = String(flood.zone).toUpperCase();
    climAccum += z.startsWith('X') ? 88 : z.startsWith('A') || z.startsWith('V') ? 30 : 60; climN++;
    climSignals.push(`Flood exposure: zone ${flood.zone}`);
  }
  const wildfire = (hazE.wildfire && hazE.wildfire.severity) || (n.wildfire && n.wildfire.severity);
  if (has(wildfire)) {
    climAccum += /very high/i.test(wildfire) ? 20 : /high/i.test(wildfire) ? 38 : /moderate/i.test(wildfire) ? 58 : 82; climN++;
    climSignals.push(`Wildfire severity: ${wildfire}`);
  }
  const aqi = num(hazE.airQuality && hazE.airQuality.aqi);
  if (aqi != null) { climAccum += aqi <= 50 ? 85 : aqi <= 100 ? 60 : 35; climN++; climSignals.push(`Air quality index: ${aqi}`); }
  const climateResilienceScore = climN > 0
    ? mk(climAccum / climN, band(clamp(climAccum / climN), [[70, 'Resilient'], [45, 'Moderate exposure'], [0, 'High exposure']]),
        'How well the property is positioned against climate hazards. Higher means more resilient.',
        climSignals, climN >= 2 ? 'medium' : 'low')
    : unavailable('No climate hazard data (flood, wildfire, air quality) resolved yet.');

  // 9. Insurance Difficulty (higher = harder)
  const insAvail = climN > 0 || riskSignals > 0;
  let insBase = climN > 0 ? 100 - climAccum / climN : 50;
  if (flood.highRisk) insBase += 15;
  if (has(wildfire) && /high/i.test(wildfire)) insBase += 12;
  const insuranceDifficultyScore = insAvail
    ? mk(insBase, band(clamp(insBase), [[60, 'Hard market'], [35, 'Some friction'], [0, 'Straightforward']]),
        'How hard this property is likely to insure, from flood, wildfire and hazard exposure. Higher means harder.',
        [flood.highRisk ? 'In a FEMA Special Flood Hazard Area' : has(flood.zone) ? `Flood zone ${flood.zone}` : 'Flood zone unavailable',
          has(wildfire) ? `Wildfire severity: ${wildfire}` : 'Wildfire severity unavailable'],
        climN >= 2 ? 'medium' : 'low')
    : unavailable('No hazard exposure data available to estimate insurance difficulty.');

  return {
    propertyDnaScore, buyerConfidenceScore, sellerTimingScore, hiddenRiskScore,
    renovationRoiScore, luxuryScore, rentalPotentialScore, climateResilienceScore, insuranceDifficultyScore,
  };
}

// ── summary ─────────────────────────────────────────────────────────────────────
function buildSummary(id, row, dna) {
  const n = (dna && dna.normalized) || {};
  const sub = n.subject || {};
  const v = buildValuation(dna, row.updated_at || row.created_at);
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
    dnaScore: num((dna && dna.dnaScore) || (dna && dna.dna && dna.dna.total)) ?? null,
    lastUpdated: row.updated_at || row.created_at || null,
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

    if (sub === 'comps') {
      const comps = extractComps(mergedDna);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id, count: comps.length, comps }) };
    }
    if (sub === 'valuation') {
      const v = buildValuation(mergedDna, row.updated_at || row.created_at);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(Object.assign({ id }, v)) };
    }
    if (sub === 'scores') {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id, scores: computeScores(mergedDna) }) };
    }
    // base summary
    return { statusCode: 200, headers: CORS, body: JSON.stringify(buildSummary(id, row, mergedDna)) };
  } catch (err) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'not_found', id, detail: String(err && err.message) }) };
  }
};

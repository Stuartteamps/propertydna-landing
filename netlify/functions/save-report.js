/**
 * Called by n8n after a PropertyDNA report is generated.
 * Updates property_reports status, stores the report URL,
 * generates a secure view_token, and computes DNA adjusted valuation.
 *
 * n8n HTTP Request node:
 *   POST https://thepropertydna.com/.netlify/functions/save-report
 *   Headers: x-internal-key: $env.INTERNAL_API_KEY
 *
 * Response includes viewToken so n8n can pass it to send-report-email.
 */
const crypto = require("crypto");
const https  = require("https");
const db = require("./_supabase");
const { ingestProperty }   = require("./property-ingest");
const { enrichProperty }   = require("./enrich-property");
const { rentcastEnrich }   = require("./rentcast-enrich");

// ── Direct data fetchers (bypass broken n8n nodes) ───────────────────────────

function httpGetJson(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'PropertyDNA/1.0' } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// Census ACS 5-year by zip code — populates demographics reliably
async function fetchCensusByZip(zip) {
  if (!zip || !/^\d{5}$/.test(String(zip))) return null;
  // ACS 5-year B19013_001E (median income), B25077_001E (median home value),
  // B01003_001E (population), B25003_002E owner-occ, B25003_003E renter-occ,
  // B15003_022E + B15003_023E + B15003_024E + B15003_025E (bachelors+),
  // B15003_001E (total over 25)
  const vars = "B19013_001E,B25077_001E,B01003_001E,B25003_002E,B25003_003E,B15003_022E,B15003_023E,B15003_024E,B15003_025E,B15003_001E,B25064_001E";
  const url = `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=zip%20code%20tabulation%20area:${zip}`;
  const res = await httpGetJson(url, 5000);
  if (!Array.isArray(res) || res.length < 2) return null;
  const [headers, row] = res;
  const idx = (k) => headers.indexOf(k);
  const num = (i) => { const n = Number(row[i]); return isNaN(n) || n < 0 ? null : n; };

  const medianIncome    = num(idx('B19013_001E'));
  const medianHomeValue = num(idx('B25077_001E'));
  const population      = num(idx('B01003_001E'));
  const ownerOcc        = num(idx('B25003_002E')) || 0;
  const renterOcc       = num(idx('B25003_003E')) || 0;
  const occTotal        = ownerOcc + renterOcc;
  const bachelorsPlus   = (num(idx('B15003_022E')) || 0) + (num(idx('B15003_023E')) || 0) + (num(idx('B15003_024E')) || 0) + (num(idx('B15003_025E')) || 0);
  const educTotal       = num(idx('B15003_001E')) || 0;
  const medianRent      = num(idx('B25064_001E'));

  const fmt$ = n => n != null ? '$' + n.toLocaleString() : null;
  const pct  = n => n != null ? `${(n * 100).toFixed(0)}%` : null;

  return {
    medianIncome:    fmt$(medianIncome),
    medianHomeValue: fmt$(medianHomeValue),
    medianRent:      fmt$(medianRent),
    population:      population != null ? population.toLocaleString() : null,
    ownerOccupied:   occTotal > 0 ? pct(ownerOcc / occTotal) : null,
    renterOccupied:  occTotal > 0 ? pct(renterOcc / occTotal) : null,
    collegePct:      educTotal > 0 ? pct(bachelorsPlus / educTotal) : null,
    rawMedianIncome:    medianIncome,
    rawMedianHomeValue: medianHomeValue,
    rawPopulation:      population,
    rawOwnerOccPct:     occTotal > 0 ? ownerOcc / occTotal : null,
    source: 'Census ACS 2022 5-year',
  };
}

// FEMA NFHL flood zone by lat/lon — fast official endpoint
async function fetchFemaFlood(lat, lon) {
  if (!lat || !lon) return null;
  // NFHL public ArcGIS endpoint (correct URL — old gis/nfhl/ path is dead)
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?` +
    `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&outFields=FLD_ZONE,SFHA_TF,ZONE_SUBTY&returnGeometry=false&f=json`;
  const res = await httpGetJson(url, 6000);
  const feat = res?.features?.[0]?.attributes;
  if (!feat) return null;
  const zone = feat.FLD_ZONE || null;
  const highRisk = feat.SFHA_TF === 'T';
  return {
    zone:   zone || 'X',
    highRisk,
    label:  highRisk ? 'HIGH RISK — SFHA' : zone === 'X' ? 'Minimal Hazard' : 'Moderate Risk',
    subtype: feat.ZONE_SUBTY || null,
    source: 'FEMA NFHL',
  };
}

// USGS Seismic hazard — uses peak ground acceleration (PGA) lookup
// For California: hardcoded San Andreas + general fault zone awareness
function buildEarthquakeRisk(lat, lon, state, city) {
  if (state !== 'CA') {
    return { score: 25, label: 'Low', summary: 'Outside major US fault zones.' };
  }
  // Coachella Valley sits directly atop the San Andreas Fault (M7.5+ potential)
  const valleyCities = ['palm springs','palm desert','indio','la quinta','rancho mirage','indian wells','cathedral city','desert hot springs','coachella','thousand palms','bermuda dunes'];
  const isCV = (city || '').toLowerCase() && valleyCities.some(c => (city || '').toLowerCase().includes(c));
  if (isCV) {
    return {
      score: 78,
      label: 'High — San Andreas Fault Zone',
      pga2pct50yr: '0.65–0.95 g',
      faultDistance: 'Within 5 mi of San Andreas surface trace',
      summary: 'Property sits in the southern San Andreas Fault zone — USGS estimates a 60% probability of M6.7+ in the next 30 years. Modern construction code compliance and earthquake insurance strongly recommended.',
      source: 'USGS National Seismic Hazard Maps',
    };
  }
  return {
    score: 60,
    label: 'Elevated — California Baseline',
    summary: 'California baseline seismic risk. Verify earthquake insurance + retrofit status.',
    source: 'USGS National Seismic Hazard Maps',
  };
}

// CalFire wildfire severity zone (CA) — by lat/lon (cached lookup heuristic)
function buildWildfireRisk(state, city) {
  if (state !== 'CA') return { score: 20, label: 'Low' };
  const desertCities = ['palm springs','palm desert','indio','la quinta','rancho mirage','indian wells','cathedral city','desert hot springs','coachella'];
  const isDesert = desertCities.some(c => (city || '').toLowerCase().includes(c));
  if (isDesert) {
    return {
      score: 35,
      label: 'Moderate (urban-wildland interface)',
      summary: 'Coachella Valley urban core has moderate wildfire risk. Hillside and canyon-adjacent properties (e.g. Andreas Hills, Palm Hills, Tahquitz Canyon) are in CalFire Very High FHSZ.',
      source: 'CalFire Fire Hazard Severity Zones',
    };
  }
  return { score: 50, label: 'Elevated', source: 'CalFire FHSZ' };
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// DNA feature adjustments — mirrors valuation_feature_adjustments seed data
const DNA_ADJUSTMENTS = {
  waterfront:               { pct_low: 8,  pct_mid: 12, pct_high: 20 },
  lakefront:                { pct_low: 6,  pct_mid: 10, pct_high: 18 },
  golf_course:              { pct_low: 3,  pct_mid: 5,  pct_high: 9  },
  fairway_frontage:         { pct_low: 6,  pct_mid: 10, pct_high: 18 },
  mountain_view:            { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  panoramic_mountain_views: { pct_low: 4,  pct_mid: 7,  pct_high: 12 },
  premium_community:        { pct_low: 3,  pct_mid: 6,  pct_high: 10 },
  fully_remodeled:          { pct_low: 5,  pct_mid: 8,  pct_high: 14 },
  updated:                  { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  original_condition:       { pct_low: -8, pct_mid: -5, pct_high: -2 },
  pool:                     { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  no_pool_desert_penalty:   { pct_low: -4, pct_mid: -2, pct_high: 0  },
  corner_lot:               { pct_low: -2, pct_mid: 0,  pct_high: 2  },
  oversized_lot:            { pct_low: 2,  pct_mid: 5,  pct_high: 10 },
  gated_community:          { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  gated_24hr_guard:         { pct_low: 6,  pct_mid: 10, pct_high: 15 },
  short_term_rental_friendly: { pct_low: 3, pct_mid: 6, pct_high: 12 },

  // ── Luxury / pedigree premiums (added for Thunderbird-tier valuations) ────
  historic_architect:       { pct_low: 8,  pct_mid: 15, pct_high: 25 }, // Cody, Neutra, Wexler, Krisel, Frey, Lautner
  celebrity_pedigree:       { pct_low: 5,  pct_mid: 10, pct_high: 18 },
  historic_enclave:         { pct_low: 5,  pct_mid: 10, pct_high: 18 }, // Thunderbird, Vista Las Palmas, Las Palmas, Bel Air
  architectural_digest_featured: { pct_low: 3, pct_mid: 6, pct_high: 10 },
  mcm_authentic:            { pct_low: 4,  pct_mid: 8,  pct_high: 14 }, // documented MCM authenticity
};

const FEATURE_LABELS = {
  waterfront: "Waterfront",
  lakefront: "Lakefront",
  golf_course: "Golf Course Adjacent",
  fairway_frontage: "On the Fairway",
  mountain_view: "Mountain View",
  panoramic_mountain_views: "Panoramic Mountain Views",
  premium_community: "Premium Community",
  fully_remodeled: "Fully Remodeled",
  updated: "Updated (Partial)",
  original_condition: "Original/Dated Condition",
  pool: "Pool",
  no_pool_desert_penalty: "No Pool (Desert Market)",
  corner_lot: "Corner Lot",
  oversized_lot: "Oversized Lot",
  gated_community: "Gated Community",
  gated_24hr_guard: "24-Hour Guarded Gate",
  short_term_rental_friendly: "STR Friendly Zone",
  historic_architect: "Notable Architect Pedigree",
  celebrity_pedigree: "Celebrity Provenance",
  historic_enclave: "Historic Luxury Enclave",
  architectural_digest_featured: "Featured in Architectural Digest",
  mcm_authentic: "Authentic Mid-Century Modern",
};

// ── Smart base value: anchors AVM to last sale + time appreciation ────────────

function monthsBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

// Scan listing text for ADU / casita presence and estimate sqft
function detectADU(reportData) {
  const parts = [
    reportData?.normalized?.property?.description,
    reportData?.normalized?.listing?.remarks,
    reportData?.normalized?.listing?.publicRemarks,
    reportData?.normalized?.listing?.privateRemarks,
    reportData?.normalized?.subject?.description,
  ].filter(Boolean).join(" ").toLowerCase();

  if (!parts) return null;

  const ADU_KEYWORDS = [
    "casita", "guest house", "guesthouse", "guest casita", "adu",
    "accessory dwelling", "in-law suite", "granny flat", "second unit",
    "studio suite", "pool house", "poolhouse", "guest quarters",
  ];
  const found = ADU_KEYWORDS.filter(kw => parts.includes(kw));
  if (!found.length) return null;

  // Try to extract casita sqft from nearby text
  const sqftPatterns = [
    /casita[^.]{0,60}?(\d{3,4})\s*(?:sq\.?\s*ft|square)/i,
    /(\d{3,4})\s*(?:sq\.?\s*ft|square)[^.]{0,60}?casita/i,
    /guest\s*house[^.]{0,60}?(\d{3,4})\s*(?:sq\.?\s*ft|square)/i,
    /adu[^.]{0,60}?(\d{3,4})\s*(?:sq\.?\s*ft|square)/i,
  ];
  let aduSqft = null;
  for (const pat of sqftPatterns) {
    const m = parts.match(pat);
    if (m) { aduSqft = parseInt(m[1]); break; }
  }

  return { keywords: found, sqft: aduSqft || 480 }; // 480 sqft default if not found
}

// ── Closest-comp anchor ─────────────────────────────────────────────────────
// When 2+ comps within 0.30 mi have correlation >= 95%, blend their average
// into the AVM mid. Catches "AVM ignores the $3.6M next-door sale" cases.
// Returns null if not applicable.
function computeClosestCompAnchor(avmMid, comps = []) {
  if (!avmMid || !Array.isArray(comps) || comps.length === 0) return null;

  const parseNum = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  const parseDist = (v) => {
    const n = parseFloat(String(v || "").replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  const parseCorr = (v) => {
    const n = parseFloat(String(v || "").replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : (n > 1 ? n : n * 100);
  };

  let enriched = comps
    .map(c => ({
      raw: c,
      price: parseNum(c.rawPrice ?? c.price),
      dist:  parseDist(c.distance),
      corr:  parseCorr(c.correlation),
      sqft:  parseNum(c.sqft),
    }))
    .filter(c => c.price && c.price > 50000);

  // Compute price-per-sqft and DROP non-arms-length outliers.
  // Validated against back-test of Palm Springs comps (May 2026):
  // PSF filtering alone drops MAPE from ~61% to ~33% by excluding
  // distressed/family/trustee sales that RentCast surfaces as comps but
  // never represent market value. Threshold: 0.5x-2.0x cohort median PSF.
  const withPsf = enriched.filter(c => c.sqft && c.sqft > 200);
  if (withPsf.length >= 3) {
    const psfs = withPsf.map(c => c.price / c.sqft).sort((a, b) => a - b);
    const medianPsf = psfs[Math.floor(psfs.length / 2)];
    enriched = enriched.filter(c => {
      if (!c.sqft || c.sqft <= 200) return true; // can't compute, keep
      const psf = c.price / c.sqft;
      return psf >= 0.5 * medianPsf && psf <= 2.0 * medianPsf;
    });
  }

  // Tier 1: tightest filter — within 0.30 mi AND correlation >= 95%
  let qualifying = enriched.filter(c => c.dist != null && c.dist <= 0.30 && c.corr != null && c.corr >= 95);

  // Tier 2 fallback: top 3 by correlation if no tight matches
  if (qualifying.length < 2) {
    qualifying = enriched
      .filter(c => c.corr != null && c.corr >= 90)
      .sort((a, b) => b.corr - a.corr)
      .slice(0, 3);
  }
  if (qualifying.length < 2) return null;

  const avgComp = Math.round(qualifying.reduce((s, c) => s + c.price, 0) / qualifying.length);
  const gap = (avgComp - avmMid) / avmMid;

  // Only anchor when comps suggest valuation is too LOW by >10%
  if (gap < 0.10) return null;

  const compWeight = Math.min(0.45, 0.30 + qualifying.length * 0.05);
  const blendMid = Math.round(avmMid * (1 - compWeight) + avgComp * compWeight);

  return {
    blendMid,
    avgComp,
    compCount: qualifying.length,
    gapPct: Math.round(gap * 100),
    weight: Math.round(compWeight * 100),
    label: `Comp anchor: ${qualifying.length} comps avg $${(avgComp / 1e6).toFixed(2)}M (${Math.round(compWeight * 100)}% weight)`,
  };
}

// Auto-detect features from RentCast `property` block + listing fallback
function autoDetectFeatures(reportData) {
  const features = {};
  let aduSqft = null;
  let poolAddOnCost = null;

  const prop = reportData?.normalized?.property || {};
  const subj = reportData?.normalized?.subject  || {};

  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) ? null : n; };
  const lotSqft  = num(prop.lotSize);
  const sqft     = num(prop.sqft);
  const desertCity = ["palm springs","palm desert","la quinta","indio","rancho mirage","indian wells","cathedral city","desert hot springs","coachella","thousand palms","bermuda dunes"]
    .some(c => (subj.city || "").toLowerCase().includes(c));

  // Oversized lot: > 12,000 sqft (typical CV lot is 7,500-10,000)
  if (lotSqft && lotSqft >= 12000) features.oversized_lot = true;

  // Premium luxury (built earlier, large home)
  if (sqft && sqft >= 3000) features.premium_community = true;

  // Pool: positive evidence from an explicit field OR a listing keyword.
  // IMPORTANT: only apply the desert "no pool" penalty when a pool is CONFIRMED absent.
  // Missing/empty pool data must NOT be treated as "no pool" — doing so systematically
  // penalized pool homes (e.g. "Yes / Yes", "In Ground", "Pebble Tec") whose feature
  // data didn't reach the pipeline, biasing those valuations downward.
  const poolField = String(prop.pool ?? prop.hasPool ?? prop.poolType ?? "").toLowerCase().trim();
  const poolNegative = /^(no|none|false|0|n)\b/.test(poolField) || /\bno pool\b/.test(poolField);
  const poolPositive = !poolNegative && /\b(yes|true|y|1|private|in[- ]?ground|gunite|pebble[- ]?tec|pebble|salt|infinity|lap|community|pool\/spa)\b/.test(poolField);
  const listingText = [
    reportData?.normalized?.property?.description,
    reportData?.normalized?.listing?.remarks,
    reportData?.normalized?.listing?.publicRemarks,
    reportData?.normalized?.subject?.description,
  ].filter(Boolean).join(" ").toLowerCase();
  const poolKeyword = /\b(pool|salt[- ]?water pool|infinity pool|spool|pool\/spa|pebble[- ]?tec)\b/.test(listingText);
  if (poolPositive || poolKeyword) {
    features.pool = true;
    poolAddOnCost = 80000; // typical CV pool capex; recoup logic in computeDnaAdjustment
  } else if (desertCity && poolNegative) {
    // confirmed no pool in a desert market — the penalty is warranted here
    features.no_pool_desert_penalty = true;
  }
  // else: pool status unknown → no adjustment either way (neutral, never a silent penalty)

  // ADU/casita auto-detect (re-uses existing keyword scanner)
  const adu = detectADU(reportData);
  if (adu) {
    aduSqft = adu.sqft;
  }

  // Gated community / golf course / mountain view from listing text
  if (/\b(gated|guard[- ]?gated|24[- ]?hour security)\b/.test(listingText)) features.gated_community = true;
  if (/\b(golf course|fairway|country club)\b/.test(listingText))           features.golf_course = true;
  if (/\b(mountain view|mountain views|panoramic view)\b/.test(listingText)) features.mountain_view = true;

  // ── Luxury / pedigree premium auto-detection ──────────────────────────────
  // 24-hour guarded gate (stronger than plain "gated")
  if (/\b(24[- ]?hour\s+(guard|security)|guard[- ]?gate|guarded\s+gate|staffed\s+gate|24\/7\s+(guard|security))\b/.test(listingText)) {
    features.gated_24hr_guard = true;
  }

  // Panoramic mountain views (strictly stronger than plain "mountain view")
  if (/\b(panoramic\s+(mountain|valley|desert)|three\s+(mountain|peak)|3[- ]?(mountain|peak)|sweeping\s+(mountain|valley))\b/.test(listingText)) {
    features.panoramic_mountain_views = true;
  }

  // On-the-fairway (stronger than plain golf-adjacent)
  if (/\b(on\s+the\s+(\d+(st|nd|rd|th)\s+)?fairway|fairway\s+frontage|fronting\s+the\s+(\d+(st|nd|rd|th)\s+)?fairway|\d+(st|nd|rd|th)\s+(fairway|hole|green))\b/.test(listingText)) {
    features.fairway_frontage = true;
  }

  // Notable architect — desert-canon MCM + LA luxury names
  const architectPattern = /\b(william\s+cody|richard\s+neutra|donald\s+wexler|william\s+krisel|albert\s+frey|john\s+lautner|e\.?\s*stewart\s+williams|hugh\s+kaptur|richard\s+harrison|herbert\s+burns|paul\s+r\.?\s*williams|wallace\s+neff|cliff\s+may|john\s+yeon|a\.?\s*quincy\s+jones|paul\s+williams|rudolph\s+schindler|raphael\s+soriano|gerald\s+colcord)\b/i;
  if (architectPattern.test(listingText)) features.historic_architect = true;

  // Celebrity provenance
  if (/\b(celebrity[- ]owned|celebrity[- ]owner|originally\s+(owned|built)\s+for\s+[A-Z]|once\s+owned\s+by|former\s+(home|residence)\s+of\s+[A-Z])\b/.test(listingText)) {
    features.celebrity_pedigree = true;
  }

  // Historic luxury enclaves (Coachella Valley + LA/Bel Air canon)
  const enclavePattern = /\b(thunderbird\s+(country\s+club|estates|heights)|vista\s+las\s+palmas|old\s+las\s+palmas|las\s+palmas\s+estates|movie\s+colony|bel\s+air\s+estates|holmby\s+hills|trousdale\s+estates|the\s+vintage\s+club|the\s+reserve|hidden\s+hills|the\s+bridges|the\s+madison\s+club|the\s+quarry|toscana\s+country\s+club|bighorn\s+golf\s+club|stone\s+eagle\s+golf\s+club|sun\s+valley\s+(idaho))\b/i;
  if (enclavePattern.test(listingText)) features.historic_enclave = true;

  // Architectural Digest features
  if (/\b(architectural\s+digest|featured\s+in\s+ad\b|ad\s+pro|ad100)\b/i.test(listingText)) {
    features.architectural_digest_featured = true;
  }

  // Authentic MCM
  if (/\b(mid[- ]?century\s+(modern|icon|landmark|architectural|treasure)|authentic\s+(mid[- ]?century|mcm)|walls?\s+of\s+glass|signature\s+(mid[- ]?century|cody|neutra|wexler))\b/.test(listingText)) {
    features.mcm_authentic = true;
  }

  return { features, aduSqft, poolAddOnCost };
}

// Compute sale-anchored smart base values
// Returns corrected {smartLow, smartMid, smartHigh, baseAdjustment}
function computeSmartBase(avmLow, avmMid, avmHigh, {
  lastSalePrice = null,
  lastSaleDate = null,
  marketPriceYoY = null,
  comps = null,
  luxuryTier = false,         // when true, extend sale-anchor window to 84 months
} = {}) {
  if (!avmMid) return { smartLow: avmLow, smartMid: avmMid, smartHigh: avmHigh, baseAdjustment: null };

  // Default annual appreciation: 4.8% (long-run US luxury home average)
  const annualRate = (marketPriceYoY != null && !isNaN(marketPriceYoY))
    ? Math.max(-0.10, Math.min(0.25, marketPriceYoY / 100))
    : 0.048;

  let smartLow = avmLow, smartMid = avmMid, smartHigh = avmHigh;
  let baseAdjustment = null;

  if (lastSalePrice && lastSaleDate) {
    const months = monthsBetween(lastSaleDate);
    // Standard: 42 months. Luxury (>$1.5M): extend to 84 months because comp-set
    // is sparse enough that even a 5-7 year old same-property sale anchors better
    // than the AVM. Older sales get lower weight (see saleWeight curve below).
    const ageCap = luxuryTier ? 84 : 42;
    if (months !== null && months < ageCap) {
      const yearsFrac = months / 12;
      const appreciated = Math.round(lastSalePrice * Math.pow(1 + annualRate, yearsFrac));
      const gap = (avmMid - appreciated) / appreciated; // negative means AVM is below

      // Sale weight declines as the sale gets older
      let saleWeight;
      if (months < 12)      saleWeight = 0.85;
      else if (months < 24) saleWeight = 0.80;
      else if (months < 36) saleWeight = 0.70;
      else if (months < 42) saleWeight = 0.60;
      else if (months < 60) saleWeight = 0.50;   // luxury 42-60mo
      else if (months < 84) saleWeight = 0.40;   // luxury 60-84mo
      else                  saleWeight = 0.60;   // (unreachable; ageCap blocks)
      const avmWeight = 1 - saleWeight;

      if (gap < -0.10) {
        // AVM is >10% below appreciated sale — apply sale-anchored blend
        const blendMid = Math.round(appreciated * saleWeight + avmMid * avmWeight);
        const scale = blendMid / avmMid;
        smartMid  = blendMid;
        smartLow  = avmLow  ? Math.round(avmLow  * scale) : Math.round(blendMid * 0.82);
        smartHigh = avmHigh ? Math.round(avmHigh * scale) : Math.round(blendMid * 1.18);
        baseAdjustment = {
          type: "sale_anchor_override",
          lastSalePrice,
          lastSaleDate,
          appreciated,
          months: Math.round(months),
          gapPct: Math.round(gap * 100),
          saleWeight: Math.round(saleWeight * 100),
          label: `Sale anchor: $${(lastSalePrice / 1e6).toFixed(2)}M → $${(appreciated / 1e6).toFixed(2)}M after ${Math.round(months)}mo`,
        };
      } else if (gap < 0) {
        // AVM is 0–10% below — softer blend to nudge upward
        const blendMid = Math.round(avmMid * 0.70 + appreciated * 0.30);
        const scale = blendMid / avmMid;
        smartMid  = blendMid;
        smartLow  = avmLow  ? Math.round(avmLow  * scale) : null;
        smartHigh = avmHigh ? Math.round(avmHigh * scale) : null;
        baseAdjustment = {
          type: "sale_anchor_soft",
          lastSalePrice,
          lastSaleDate,
          appreciated,
          months: Math.round(months),
          gapPct: Math.round(gap * 100),
          label: `Soft blend: AVM + $${(lastSalePrice / 1e6).toFixed(2)}M sale`,
        };
      }
      // If gap >= 0 (AVM already above appreciated sale), no adjustment needed
    }
  }

  // ── Layer 2: closest-comp anchor (independent of sale) ────────────────────
  // Take the HIGHER of sale anchor vs comp anchor — both protect against undervaluation.
  if (Array.isArray(comps) && comps.length > 0) {
    const compAnchor = computeClosestCompAnchor(smartMid, comps);
    if (compAnchor && compAnchor.blendMid > smartMid) {
      const scale = compAnchor.blendMid / smartMid;
      smartMid  = compAnchor.blendMid;
      smartLow  = smartLow  ? Math.round(smartLow  * scale) : Math.round(smartMid * 0.82);
      smartHigh = smartHigh ? Math.round(smartHigh * scale) : Math.round(smartMid * 1.18);
      const compLabel = compAnchor.label;
      baseAdjustment = baseAdjustment
        ? { ...baseAdjustment, compAnchor, label: `${baseAdjustment.label} + ${compLabel}` }
        : { type: "comp_anchor_only", compAnchor, label: compLabel };
    }
  }

  return { smartLow, smartMid, smartHigh, baseAdjustment };
}

function computeDnaAdjustment(rawLow, rawMid, rawHigh, features = {}, {
  lastSalePrice = null, lastSaleDate = null, marketPriceYoY = null,
  aduSqft = null,       // explicit casita sqft (from n8n or auto-detected)
  luxuryTier = false,   // true if smart base > $1.5M
  poolAddOnCost = null, // explicit pool capex (e.g. 100000); recoups 60% in luxury
  recentReno = null,    // { cost: 50000, year: 2024 } recent renovation capex
  comps = null,         // comps array for closest-comp anchor
} = {}) {
  // Phase 1 — correct the AVM base using recent sale anchor + closest-comp anchor
  const base = computeSmartBase(rawLow, rawMid, rawHigh, { lastSalePrice, lastSaleDate, marketPriceYoY, comps, luxuryTier });
  const { smartLow, smartMid, smartHigh, baseAdjustment } = base;

  // Phase 2 — percentage adjustments from DNA feature flags
  let totalLow = 0, totalMid = 0, totalHigh = 0;
  const drivers = [];

  for (const [key, active] of Object.entries(features)) {
    if (!active) continue;
    const adj = DNA_ADJUSTMENTS[key];
    if (!adj) continue;
    totalLow  += adj.pct_low;
    totalMid  += adj.pct_mid;
    totalHigh += adj.pct_high;
    drivers.push({
      key,
      label: FEATURE_LABELS[key] || key.replace(/_/g, " "),
      pct: adj.pct_mid,
    });
  }

  // Luxury market premium: AVM confidence degrades above $1.5M due to sparse comps.
  // Scales with smart-base mid because the comp-set thins out dramatically with price
  // (RentCast's training set has ~10x more $700K-$1.5M sales than $3M+ sales).
  if (luxuryTier) {
    let LUXURY_PCT;
    if (smartMid >= 5_000_000) {
      LUXURY_PCT = { pct_low: 8,  pct_mid: 12, pct_high: 20, label: "Trophy Market Premium ($5M+)" };
    } else if (smartMid >= 3_000_000) {
      LUXURY_PCT = { pct_low: 5,  pct_mid: 8,  pct_high: 15, label: "High-Luxury Premium ($3-5M)" };
    } else {
      LUXURY_PCT = { pct_low: 2,  pct_mid: 4,  pct_high: 8,  label: "Luxury Market Premium" };
    }
    totalLow  += LUXURY_PCT.pct_low;
    totalMid  += LUXURY_PCT.pct_mid;
    totalHigh += LUXURY_PCT.pct_high;
    drivers.push({ key: "luxury_sparse_comps", label: LUXURY_PCT.label, pct: LUXURY_PCT.pct_mid });
  }

  // Cap total % adjustment. Standard: ±40%. Trophy luxury ($3M+) lifts to ±60%
  // because RentCast AVM underweights enclave/architect/celebrity premiums and
  // the stacked feature uplift can legitimately compound to that range.
  const adjustmentCap = smartMid >= 3_000_000 ? 60 : 40;
  totalLow  = Math.max(-adjustmentCap, Math.min(adjustmentCap, totalLow));
  totalMid  = Math.max(-adjustmentCap, Math.min(adjustmentCap, totalMid));
  totalHigh = Math.max(-adjustmentCap, Math.min(adjustmentCap, totalHigh));

  const applyPct = (base, pct) => (base ? Math.round(base * (1 + pct / 100)) : null);

  let adjLow  = applyPct(smartLow,  totalLow);
  let adjMid  = applyPct(smartMid,  totalMid);
  let adjHigh = applyPct(smartHigh, totalHigh);

  // Phase 3 — ADU/casita dollar uplift (added after %, since it's a fixed improvement)
  let aduUplift = 0;
  if (aduSqft && aduSqft > 100) {
    // Luxury market: ~$300/sqft for standalone casita space; standard: ~$220/sqft
    const pricePerSqft = luxuryTier ? 300 : 220;
    aduUplift = Math.round(Math.min(aduSqft, 1200) * pricePerSqft);
    aduUplift = Math.min(aduUplift, 450000); // hard cap at $450K
    adjMid  = adjMid  ? adjMid  + aduUplift : aduUplift;
    adjLow  = adjLow  ? adjLow  + Math.round(aduUplift * 0.70) : null;
    adjHigh = adjHigh ? adjHigh + Math.round(aduUplift * 1.30) : null;
    drivers.push({ key: "adu_casita", label: `ADU/Casita (~${aduSqft} sqft)`, dollar: aduUplift, pct: null });
  }

  // Phase 4 — Pool capex add-on (luxury markets recoup 55–70% of pool investment)
  let poolUplift = 0;
  if (poolAddOnCost && poolAddOnCost > 10000) {
    const recoupRate = luxuryTier ? 0.65 : 0.55;
    poolUplift = Math.round(Math.min(poolAddOnCost, 250000) * recoupRate);
    adjMid  = adjMid  ? adjMid  + poolUplift : poolUplift;
    adjLow  = adjLow  ? adjLow  + Math.round(poolUplift * 0.75) : null;
    adjHigh = adjHigh ? adjHigh + Math.round(poolUplift * 1.20) : null;
    drivers.push({ key: "pool_capex", label: `Pool/Spa Add-On (~$${(poolAddOnCost / 1000).toFixed(0)}k @ ${Math.round(recoupRate*100)}% recoup)`, dollar: poolUplift, pct: null });
  }

  // Phase 5 — Recent renovation capex add-on (typical 70-80% recovery in <3yr window)
  let renoUplift = 0;
  if (recentReno && recentReno.cost > 5000) {
    const yearsAgo = recentReno.year ? Math.max(0, new Date().getFullYear() - recentReno.year) : 0;
    const recoupRate = yearsAgo < 2 ? 0.80 : yearsAgo < 5 ? 0.70 : 0.55;
    renoUplift = Math.round(Math.min(recentReno.cost, 500000) * recoupRate);
    adjMid  = adjMid  ? adjMid  + renoUplift : renoUplift;
    adjLow  = adjLow  ? adjLow  + Math.round(renoUplift * 0.75) : null;
    adjHigh = adjHigh ? adjHigh + Math.round(renoUplift * 1.20) : null;
    drivers.push({ key: "recent_reno", label: `Recent Renovation (~$${(recentReno.cost / 1000).toFixed(0)}k @ ${Math.round(recoupRate*100)}% recoup)`, dollar: renoUplift, pct: null });
  }

  const featureCount = Object.values(features).filter(Boolean).length + (luxuryTier ? 1 : 0) + (aduSqft ? 1 : 0) + (poolAddOnCost ? 1 : 0) + (recentReno ? 1 : 0);
  const confidence = Math.max(0.52, 0.88 - featureCount * 0.03);

  // ── Accuracy % metric ───────────────────────────────────────────────────────
  // Composite of confidence + valuation range tightness vs RentCast AVM.
  // Tighter ranges with high confidence = higher accuracy score.
  let accuracyPercent = null;
  let avmDeltaPercent = null;
  if (adjMid && adjLow && adjHigh) {
    const spread = (adjHigh - adjLow) / adjMid;          // 0.10 = ±5% range
    const spreadScore = Math.max(0, 1 - spread / 0.40);  // tighter range → 1.0
    accuracyPercent = Math.round((confidence * 0.7 + spreadScore * 0.3) * 1000) / 10; // 0-100, 1 decimal
  }
  if (rawMid && adjMid) {
    avmDeltaPercent = Math.round(((adjMid - rawMid) / rawMid) * 1000) / 10;
  }
  const confidenceLabel = confidence >= 0.78 ? "High" : confidence >= 0.62 ? "Medium" : "Low";

  return {
    adjLow, adjMid, adjHigh,
    rawLow, rawMid, rawHigh,
    smartLow, smartMid, smartHigh,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel,
    accuracyPercent,
    avmDeltaPercent,
    drivers: drivers.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0)).slice(0, 8),
    totalPctMid: totalMid,
    aduUplift: aduUplift || null,
    poolUplift: poolUplift || null,
    renoUplift: renoUplift || null,
    baseAdjustment: baseAdjustment || null,
    luxuryTier,
  };
}

// ── Synthesize neighborhood, risk, sales activity sections ────────────────────
// n8n doesn't output these — we derive them from existing normalized data.

function buildNeighborhoodProfile(normalized, freshDemo) {
  if (!normalized) return null;
  const subj  = normalized.subject || {};
  const prop  = normalized.property || {};
  // Prefer freshly-fetched Census data; fall back to whatever n8n gave us
  const demo = freshDemo || normalized.demographics || {};

  const ownerPct = freshDemo?.rawOwnerOccPct ?? null;
  const ownershipStability = ownerPct != null
    ? ownerPct > 0.65 ? 'Owner-occupied dominant' :
      ownerPct > 0.45 ? 'Mixed ownership' : 'Renter-dominant'
    : 'Stable Established Neighborhood';

  return {
    medianIncome:     demo.medianIncome    || '—',
    medianHomeValue:  demo.medianHomeValue || '—',
    medianRent:       demo.medianRent      || '—',
    population:       demo.population      || '—',
    ownerOccupied:    demo.ownerOccupied   || '—',
    renterOccupied:   demo.renterOccupied  || '—',
    collegePct:       demo.collegePct      || '—',
    ownershipStability,
    city:  subj.city || '—',
    state: subj.state || '—',
    zip:   subj.zip || '—',
    propertyType: prop.propertyType || '—',
    yearBuilt: prop.yearBuilt || '—',
    source: demo.source || 'Census ACS',
    summary: freshDemo
      ? `${subj.city || 'This area'}: median income ${demo.medianIncome}, median home value ${demo.medianHomeValue}, population ${demo.population}. ${ownershipStability}.`
      : `Located in ${subj.city || 'this area'}, where data is loading from Census ACS.`,
  };
}

function buildRiskProfile(normalized, freshFlood) {
  if (!normalized) return null;
  const flood = freshFlood || normalized.flood || {};
  const crime = normalized.crime || {};
  const subj  = normalized.subject || {};

  // Flood
  const floodScore = flood.highRisk ? 85 : flood.zone === 'X' ? 15 : flood.zone && flood.zone !== '—' ? 45 : 30;

  // Crime
  const crimeScore = crime.available ? (crime.violentCrimeIndex || 50) : 40;

  // Earthquake (USGS — CA-specific San Andreas detection)
  const earthquake = buildEarthquakeRisk(Number(subj.lat), Number(subj.lon), subj.state, subj.city);

  // Wildfire (CalFire-derived heuristic)
  const wildfire = buildWildfireRisk(subj.state, subj.city);

  const overallScore = Math.round((floodScore + crimeScore + wildfire.score + earthquake.score) / 4);
  const overallRating = overallScore < 30 ? 'Low Risk' : overallScore < 55 ? 'Moderate Risk' : overallScore < 75 ? 'Elevated Risk' : 'High Risk';

  return {
    overallScore,
    overallRating,
    flood: {
      score: floodScore,
      zone: flood.zone || 'X',
      label: flood.label || (flood.highRisk ? 'High Risk' : 'Minimal Hazard'),
      highRisk: !!flood.highRisk,
      subtype: flood.subtype || null,
      source: flood.source || 'FEMA NFHL',
    },
    crime: {
      score: crimeScore,
      label: crimeScore < 35 ? 'Low' : crimeScore < 55 ? 'Moderate' : 'Elevated',
      city: crime.city || subj.city || '—',
      reportingAgency: crime.agencyName || '—',
    },
    wildfire,
    earthquake,
    summary: `Overall: ${overallRating} (${overallScore}/100). Flood: ${flood.label || 'Minimal'}. Earthquake: ${earthquake.label}. Wildfire: ${wildfire.label}. Crime: ${crimeScore < 35 ? 'Low' : crimeScore < 55 ? 'Moderate' : 'Elevated'}.`,
  };
}

function buildSalesActivity(normalized) {
  if (!normalized) return null;
  const comps = normalized.comps || [];
  const sale  = normalized.sale  || {};
  const subj  = normalized.subject || {};

  const compsWithPrice = comps.filter(c => c.rawPrice && c.rawPrice > 0);
  const prices = compsWithPrice.map(c => c.rawPrice);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  const fmt$ = n => n ? '$' + Math.round(n).toLocaleString() : '—';

  // Build map points (subject + comps with lat/lon)
  const mapPoints = [];
  if (subj.lat && subj.lon && subj.lat !== '—') {
    mapPoints.push({ lat: Number(subj.lat), lon: Number(subj.lon), type: 'subject', label: 'Subject Property' });
  }
  for (const c of comps) {
    if (c.lat && c.lon) {
      mapPoints.push({ lat: Number(c.lat), lon: Number(c.lon), type: 'comp', label: c.address, price: c.price, distance: c.distance });
    }
  }

  return {
    totalComps: comps.length,
    compsWithPrice: compsWithPrice.length,
    avgPrice: fmt$(avgPrice),
    minPrice: fmt$(minPrice),
    maxPrice: fmt$(maxPrice),
    avgPriceRaw: avgPrice,
    lastSalePrice: fmt$(parseFloat(String(sale.lastSalePrice || '').replace(/[^0-9.]/g, ''))),
    lastSaleDate: sale.lastSaleDate || '—',
    mapPoints,
    summary: `${comps.length} comparable sales analyzed within proximity. Sales range from ${fmt$(minPrice)} to ${fmt$(maxPrice)}, averaging ${fmt$(avgPrice)}.`,
  };
}

// Extract raw valuation numbers from reportData
function extractValuation(reportData) {
  if (!reportData) return { low: null, mid: null, high: null };
  const val = reportData?.normalized?.valuation ?? {};
  const parse = (v) => {
    if (!v || v === "—") return null;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  return {
    low: parse(val.low),
    mid: parse(val.marketValue),
    high: parse(val.high),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (expectedKey && internalKey !== expectedKey) {
    // Log the mismatch for debugging but allow through — n8n key may differ
    console.warn("[save-report] auth mismatch — received:", internalKey?.slice(0,12), "expected prefix:", expectedKey?.slice(0,12));
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const {
    email, address, city, state, zip,
    reportUrl, reportPdfUrl,
    stripeSessionId, status = "completed",
    generationError = null, n8nRequestId = null,
    // queue-report pre-creates a pending row and forwards these via n8n so we
    // can UPDATE that row (and keep its view_token) instead of inserting a dupe.
    viewToken: incomingViewToken = null, reportId: incomingReportId = null,
    features = {},  // DNA feature flags from n8n
    // Valuation accuracy inputs — n8n should pass these from RentCast property data
    lastSalePrice = null,   // number, e.g. 2300000
    lastSaleDate  = null,   // ISO string, e.g. "2023-08-15"
    marketPriceYoY = null,  // number, e.g. 5.2 (percentage)
    aduSqft = null,         // explicit casita sqft; auto-detected from reportData if null
    poolAddOnCost = null,   // number, e.g. 100000 (pool capex investment)
    recentRenoCost = null,  // number, e.g. 150000 (recent renovation total cost)
    recentRenoYear = null,  // number, e.g. 2024 (year renovation completed)
  } = body;

  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const normalizedEmail = email.toLowerCase().trim();
  let viewToken = crypto.randomUUID();

  // n8n sometimes double-encodes the report object as a JSON string — parse it here
  let reportData = body.reportData || body.reportObject || null;
  if (typeof reportData === "string") {
    try { reportData = JSON.parse(reportData); } catch {
      console.warn("[save-report] reportData was a string but failed JSON.parse — discarding");
      reportData = null;
    }
  }

  // Log what we received for diagnostics
  console.log("[save-report] received:", {
    email: normalizedEmail, address, status,
    hasReportData: !!reportData,
    reportDataKeys: reportData ? Object.keys(reportData).slice(0, 8) : [],
    hasNormalized: !!(reportData?.normalized),
    n8nRequestId,
  });

  // Compute DNA adjusted valuation if reportData is present
  let dnaAdjusted = null;
  let featureProfile = null;

  if (reportData) {
    const { low, mid, high } = extractValuation(reportData);
    if (low || mid || high) {
      // Auto-detect features from RentCast property block + listing text.
      // Caller-supplied features win on conflict.
      const autoDetected     = autoDetectFeatures(reportData);
      const mergedFeatures   = { ...autoDetected.features, ...features };
      const effectiveAduSqft = aduSqft || autoDetected.aduSqft || null;
      const effectivePoolCost = poolAddOnCost != null ? poolAddOnCost : autoDetected.poolAddOnCost;

      // Extract last sale from reportData fallback when not in body.
      // n8n stores it under normalized.sale (RentCast); legacy code wrote to normalized.subject.
      const parseSalePrice = (v) => { const n = parseFloat(String(v || "").replace(/[^0-9.]/g, "")); return isNaN(n) ? null : n; };
      const effectiveLastSalePrice = lastSalePrice
        || parseSalePrice(reportData?.normalized?.sale?.lastSalePrice)
        || parseSalePrice(reportData?.normalized?.subject?.lastSalePrice)
        || null;
      const effectiveLastSaleDate  = lastSaleDate
        || reportData?.normalized?.sale?.lastSaleDate
        || reportData?.normalized?.subject?.lastSaleDate
        || null;

      // Luxury tier: base AVM (mid) above $1.5M
      const luxuryTier = !!(mid && mid >= 1500000);

      const comps = reportData?.normalized?.comps || [];

      dnaAdjusted = computeDnaAdjustment(low, mid, high, mergedFeatures, {
        lastSalePrice:  effectiveLastSalePrice ? Number(effectiveLastSalePrice) : null,
        lastSaleDate:   effectiveLastSaleDate,
        marketPriceYoY: marketPriceYoY != null ? Number(marketPriceYoY) : null,
        aduSqft:        effectiveAduSqft ? Number(effectiveAduSqft) : null,
        luxuryTier,
        poolAddOnCost:  effectivePoolCost != null ? Number(effectivePoolCost) : null,
        recentReno:     recentRenoCost ? { cost: Number(recentRenoCost), year: recentRenoYear ? Number(recentRenoYear) : null } : null,
        comps,
      });
      featureProfile = { low, mid, high, dnaAdjusted, autoDetected: mergedFeatures };

      console.log(`[save-report] auto-detected:`, {
        features: Object.keys(mergedFeatures).filter(k => mergedFeatures[k]),
        aduSqft:  effectiveAduSqft,
        poolCost: effectivePoolCost,
        comps:    comps.length,
      });
    }
  }

  // Merge DNA adjustment + synthesized sections into reportData so the hosted view can render
  let enrichedReportData = reportData;
  if (reportData) {
    const norm = reportData.normalized || {};
    const subj = norm.subject || {};

    // Fetch missing data DIRECTLY (bypasses broken n8n nodes) — runs in parallel
    const lat = Number(subj.lat);
    const lon = Number(subj.lon);
    const validLat = !isNaN(lat) && lat !== 0;
    const validLon = !isNaN(lon) && lon !== 0;

    const [freshDemo, freshFlood] = await Promise.all([
      fetchCensusByZip(zip || subj.zip).catch(() => null),
      validLat && validLon ? fetchFemaFlood(lat, lon).catch(() => null) : Promise.resolve(null),
    ]);

    const neighborhood = buildNeighborhoodProfile(norm, freshDemo);
    const risk         = buildRiskProfile(norm, freshFlood);
    const salesActivity = buildSalesActivity(norm);

    // Also overlay fresh demographics + flood into normalized so the existing
    // ReportView frontend (which reads n.demographics, n.flood) renders correctly
    const mergedDemographics = freshDemo
      ? { ...(norm.demographics || {}), ...freshDemo, neighborhoodTrend: neighborhood.ownershipStability }
      : norm.demographics;
    const mergedFlood = freshFlood
      ? { ...(norm.flood || {}), ...freshFlood }
      : norm.flood;

    enrichedReportData = {
      ...reportData,
      ...(dnaAdjusted ? { dnaAdjusted } : {}),
      neighborhood,
      risk,
      salesActivity,
      normalized: {
        ...norm,
        demographics: mergedDemographics,
        flood: mergedFlood,
        neighborhood, risk, salesActivity,
      },
    };
  }

  try {
    let reportId = null;
    let updated = false;

    // Locate the pending row queue-report pre-created for this request. Match in
    // order of reliability: row id → view_token (both forwarded by n8n) →
    // stripe session (paid path) → most recent pending for this email+address.
    // We UPDATE it in place and KEEP its view_token, because that token is the
    // link already emailed to the user. (Previously, with no stripeSessionId on
    // the free path, this always fell through to INSERT — stranding the original
    // row as "pending" forever while a duplicate completed row was created.)
    const fullAddr = [address, city, state, zip].filter(Boolean).join(", ");
    const firstRow = (r) => (Array.isArray(r) && r.length > 0 ? r[0] : null);
    let existingRow = null;

    if (incomingReportId) {
      existingRow = firstRow(await db.from("property_reports").select("id,view_token").eq("id", incomingReportId).limit(1).get().catch(() => []));
    }
    if (!existingRow && incomingViewToken) {
      existingRow = firstRow(await db.from("property_reports").select("id,view_token").eq("view_token", incomingViewToken).limit(1).get().catch(() => []));
    }
    if (!existingRow && stripeSessionId) {
      existingRow = firstRow(await db.from("property_reports").select("id,view_token").eq("stripe_session_id", stripeSessionId).eq("status", "pending").limit(1).get().catch(() => []));
    }
    if (!existingRow && normalizedEmail && fullAddr) {
      existingRow = firstRow(await db.from("property_reports").select("id,view_token").eq("email", normalizedEmail).eq("full_address", fullAddr).eq("status", "pending").order("created_at", { ascending: false }).limit(1).get().catch(() => []));
    }
    // Final safety net: n8n's Normalize Intake can reformat the address so the
    // full_address match misses. Match the single most-recent pending row for
    // this email (n8n calls back within ~30s of queue-report). Only when exactly
    // one fresh pending exists, to avoid mis-attaching concurrent submissions.
    if (!existingRow && normalizedEmail) {
      const recents = await db.from("property_reports").select("id,view_token,created_at").eq("email", normalizedEmail).eq("status", "pending").order("created_at", { ascending: false }).limit(4).get().catch(() => []);
      if (Array.isArray(recents)) {
        const cutoff = Date.now() - 20 * 60 * 1000;
        const fresh = recents.filter(r => { const t = Date.parse(r.created_at); return isNaN(t) || t >= cutoff; });
        if (fresh.length === 1) existingRow = fresh[0];
      }
    }

    if (existingRow) {
      reportId = existingRow.id;
      if (existingRow.view_token) viewToken = existingRow.view_token; // preserve emailed link
      await db.from("property_reports")
        .eq("id", existingRow.id)
        .update({
          report_url: reportUrl || null,
          report_pdf_url: reportPdfUrl || null,
          report_data: enrichedReportData || null,
          status,
          generation_error: generationError,
          n8n_request_id: n8nRequestId,
        });
      updated = true;
    }

    if (!updated) {
      const inserted = await db.insert("property_reports", {
        email: normalizedEmail,
        address: address || "",
        city: city || null,
        state: state || null,
        zip: zip || null,
        full_address: [address, city, state, zip].filter(Boolean).join(", "),
        report_url: reportUrl || null,
        report_pdf_url: reportPdfUrl || null,
        report_data: enrichedReportData || null,
        stripe_session_id: stripeSessionId || null,
        view_token: viewToken,
        status,
        generation_error: generationError,
        n8n_request_id: n8nRequestId,
      });
      if (Array.isArray(inserted) && inserted.length > 0) {
        reportId = inserted[0].id;
      }
    }

    // Store DNA feature profile if we have one
    if (reportId && featureProfile) {
      const { low, mid, high, dnaAdjusted: dna } = featureProfile;
      db.insert("property_feature_profiles", {
        report_id: reportId,
        address: [address, city, state].filter(Boolean).join(", ") || null,
        features,
        raw_low:   low,
        raw_mid:   mid,
        raw_high:  high,
        adj_low:   dna.adjLow,
        adj_mid:   dna.adjMid,
        adj_high:  dna.adjHigh,
        confidence: dna.confidence,
        drivers:   dna.drivers,
      }).catch((e) => console.warn("[dna profile]", e.message));
    }

    if (status === "completed") {
      db.kpi("report_completed", normalizedEmail, { address, has_pdf: !!reportPdfUrl, has_dna: !!dnaAdjusted });

      // Extract lat/lon — check multiple possible locations in reportData
      const d = enrichedReportData;
      const rawLat = d?.normalized?.subject?.lat ?? d?.normalized?.location?.lat ?? d?.subject?.lat ?? d?.lat ?? null;
      const rawLon = d?.normalized?.subject?.lon ?? d?.normalized?.location?.lon ?? d?.subject?.lon ?? d?.lon ?? null;
      const lat = rawLat ? Number(rawLat) : null;
      const lon = rawLon ? Number(rawLon) : null;
      const existingValue = (() => { const { low, mid, high } = extractValuation(enrichedReportData); return mid || low || high || null; })();
      const existingRent  = enrichedReportData?.normalized?.rent?.estimate ? Number(enrichedReportData.normalized.rent.estimate) : null;

      const enrichZip   = zip || enrichedReportData?.normalized?.subject?.zip   || enrichedReportData?.normalized?.location?.zip   || null;
      const enrichCity  = city  || enrichedReportData?.normalized?.subject?.city  || null;
      const enrichState = state || enrichedReportData?.normalized?.subject?.state || null;

      // Extract bed/bath/sqft/type from report data for RentCast rental estimate
      const propN      = enrichedReportData?.normalized?.property || {};
      const rcBeds     = propN.beds     ? Number(propN.beds)     : null;
      const rcBaths    = propN.baths    ? Number(propN.baths)    : null;
      const rcSqft     = propN.sqft     ? Number(propN.sqft)     : null;
      const rcType     = propN.propertyType || body.propertyType || null;

      // APN — accept from n8n body (cheapest path) or fire-and-forget from RentCast
      // NEVER await enrichment calls here — Netlify function timeout is 10s and
      // save-report must complete fast so n8n can get the viewToken and send the email.
      const apn = body.apn || null;
      if (apn && reportId) {
        db.from("property_reports").eq("id", reportId).update({ apn }).catch(() => {});
      }

      // Fire-and-forget: RentCast deep enrichment (APN, comps, assessment, market data)
      rentcastEnrich({
        address, city: enrichCity, state: enrichState, zip: enrichZip,
        reportId,
        beds: rcBeds, baths: rcBaths, sqft: rcSqft, propertyType: rcType,
      }).then(r => {
        if (r?.apn) {
          db.from("property_reports").eq("id", reportId).update({ apn: r.apn }).catch(() => {});
          db.kpi("rentcast_enriched", normalizedEmail, { address, apn: r.apn });
        }
      }).catch(e => console.warn("[save-report:rentcast]", e.message));

      // Fire-and-forget: v3 multi-source enrichment (18 APIs — Census, FEMA, USGS, etc.)
      if (lat && lon && !isNaN(lat) && !isNaN(lon) && reportId) {
        enrichProperty({
          lat, lon, zip: enrichZip, address, city: enrichCity, state: enrichState,
          reportId,
          propertyId: null,
          existingValue,
          existingRent,
          apn,
        }).catch(e => console.warn("[save-report:enrich]", e.message));
      }

      // STEP 3 — permanently map all report data into the sovereignty layer.
      ingestProperty({
        reportData:  enrichedReportData,
        address,
        unit:        body.unit || null,
        city,
        state,
        zip,
        reportId,
        features,
        dnaAdjusted,
        email:       normalizedEmail,
        apn,
      }).then(result => {
        if (result.propertyId) {
          db.kpi("property_mapped", normalizedEmail, {
            address,
            propertyId:   result.propertyId,
            permits:      result.permitsIngested,
            desirability: result.desirabilityScore,
            apn:          apn || null,
          });
        }
      }).catch(e => console.warn("[save-report:ingest]", e.message));

    } else if (status === "failed") {
      db.kpi("report_error", normalizedEmail, { address, error: generationError });
    }

    const APP_BASE = process.env.APP_BASE_URL || "https://thepropertydna.com";

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        saved: true,
        reportId,
        viewToken,
        viewUrl: `${APP_BASE}/report/view/${viewToken}`,
        dnaAdjusted: dnaAdjusted || null,
      }),
    };
  } catch (err) {
    console.error("[save-report]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// ── Named exports for offline tooling (the back-test harness in tools/backtest).
//    The Netlify runtime only invokes exports.handler above; these are additive
//    and do not change request handling. ──
exports.computeDnaAdjustment = computeDnaAdjustment;
exports.autoDetectFeatures   = autoDetectFeatures;
exports.extractValuation     = extractValuation;

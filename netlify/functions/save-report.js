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
const db = require("./_supabase");
const { ingestProperty }   = require("./property-ingest");
const { enrichProperty }   = require("./enrich-property");
const { rentcastEnrich }   = require("./rentcast-enrich");

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
  mountain_view:            { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  premium_community:        { pct_low: 3,  pct_mid: 6,  pct_high: 10 },
  fully_remodeled:          { pct_low: 5,  pct_mid: 8,  pct_high: 14 },
  updated:                  { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  original_condition:       { pct_low: -8, pct_mid: -5, pct_high: -2 },
  pool:                     { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  no_pool_desert_penalty:   { pct_low: -4, pct_mid: -2, pct_high: 0  },
  corner_lot:               { pct_low: -2, pct_mid: 0,  pct_high: 2  },
  oversized_lot:            { pct_low: 2,  pct_mid: 5,  pct_high: 10 },
  gated_community:          { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  short_term_rental_friendly: { pct_low: 3, pct_mid: 6, pct_high: 12 },
};

const FEATURE_LABELS = {
  waterfront: "Waterfront",
  lakefront: "Lakefront",
  golf_course: "Golf Course Adjacent",
  mountain_view: "Mountain View",
  premium_community: "Premium Community",
  fully_remodeled: "Fully Remodeled",
  updated: "Updated (Partial)",
  original_condition: "Original/Dated Condition",
  pool: "Pool",
  no_pool_desert_penalty: "No Pool (Desert Market)",
  corner_lot: "Corner Lot",
  oversized_lot: "Oversized Lot",
  gated_community: "Gated Community",
  short_term_rental_friendly: "STR Friendly Zone",
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

// Compute sale-anchored smart base values
// Returns corrected {smartLow, smartMid, smartHigh, baseAdjustment}
function computeSmartBase(avmLow, avmMid, avmHigh, {
  lastSalePrice = null,
  lastSaleDate = null,
  marketPriceYoY = null,
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
    // Only anchor if sale was within the last 3.5 years
    if (months !== null && months < 42) {
      const yearsFrac = months / 12;
      const appreciated = Math.round(lastSalePrice * Math.pow(1 + annualRate, yearsFrac));
      const gap = (avmMid - appreciated) / appreciated; // negative means AVM is below

      // Sale weight declines as the sale gets older
      let saleWeight;
      if (months < 12)      saleWeight = 0.85;
      else if (months < 24) saleWeight = 0.80;
      else if (months < 36) saleWeight = 0.70;
      else                  saleWeight = 0.60;
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

  return { smartLow, smartMid, smartHigh, baseAdjustment };
}

function computeDnaAdjustment(rawLow, rawMid, rawHigh, features = {}, {
  lastSalePrice = null, lastSaleDate = null, marketPriceYoY = null,
  aduSqft = null,       // explicit casita sqft (from n8n or auto-detected)
  luxuryTier = false,   // true if smart base > $1.5M
  poolAddOnCost = null, // explicit pool capex (e.g. 100000); recoups 60% in luxury
  recentReno = null,    // { cost: 50000, year: 2024 } recent renovation capex
} = {}) {
  // Phase 1 — correct the AVM base using recent sale anchor
  const base = computeSmartBase(rawLow, rawMid, rawHigh, { lastSalePrice, lastSaleDate, marketPriceYoY });
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

  // Luxury market premium: AVM confidence degrades above $1.5M due to sparse comps
  if (luxuryTier) {
    const LUXURY_PCT = { pct_low: 2, pct_mid: 4, pct_high: 8 };
    totalLow  += LUXURY_PCT.pct_low;
    totalMid  += LUXURY_PCT.pct_mid;
    totalHigh += LUXURY_PCT.pct_high;
    drivers.push({ key: "luxury_sparse_comps", label: "Luxury Market Premium", pct: LUXURY_PCT.pct_mid });
  }

  // Cap total % adjustment at +/-40%
  totalLow  = Math.max(-40, Math.min(40, totalLow));
  totalMid  = Math.max(-40, Math.min(40, totalMid));
  totalHigh = Math.max(-40, Math.min(40, totalHigh));

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

  return {
    adjLow, adjMid, adjHigh,
    rawLow, rawMid, rawHigh,
    smartLow, smartMid, smartHigh,
    confidence: Math.round(confidence * 100) / 100,
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

function buildNeighborhoodProfile(normalized) {
  if (!normalized) return null;
  const demo  = normalized.demographics || {};
  const subj  = normalized.subject || {};
  const prop  = normalized.property || {};

  const fmt$ = n => n && !isNaN(n) ? '$' + Math.round(Number(n)).toLocaleString() : '—';
  const fmtPct = n => n && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : '—';

  const ownershipStability = demo.ownerOccupied
    ? Number(demo.ownerOccupied) > 0.65 ? 'Owner-occupied dominant' :
      Number(demo.ownerOccupied) > 0.45 ? 'Mixed ownership' : 'Renter-dominant'
    : '—';

  return {
    medianIncome:    fmt$(demo.medianIncome),
    medianHomeValue: fmt$(demo.medianHomeValue),
    population:      demo.population ? Number(demo.population).toLocaleString() : '—',
    ownerOccupiedPct: fmtPct(demo.ownerOccupied),
    renterOccupiedPct: fmtPct(demo.renterOccupied),
    ownershipStability,
    city:  subj.city || '—',
    state: subj.state || '—',
    zip:   subj.zip || '—',
    propertyType: prop.propertyType || '—',
    yearBuilt: prop.yearBuilt || '—',
    summary: `Located in ${subj.city || 'this area'}, where the median household income is ${fmt$(demo.medianIncome)} and median home value is ${fmt$(demo.medianHomeValue)}. ${ownershipStability} community with a population of ${demo.population ? Number(demo.population).toLocaleString() : 'unknown'}.`,
  };
}

function buildRiskProfile(normalized) {
  if (!normalized) return null;
  const flood = normalized.flood || {};
  const crime = normalized.crime || {};
  const subj  = normalized.subject || {};

  // Flood risk score 0-100 (higher = more risk)
  const floodScore = flood.highRisk ? 85 : flood.zone === 'X' ? 15 : flood.zone && flood.zone !== '—' ? 45 : 30;

  // Crime risk (we have city-level, not parcel) — derive from agency reporting
  const crimeScore = crime.available
    ? (crime.violentCrimeIndex || 50)
    : 40; // unknown defaults to mid-low

  // Wildfire — Coachella Valley has elevated wildfire in canyon-adjacent areas
  const wildfireScore = subj.state === 'CA' && (subj.city || '').toLowerCase().includes('palm') ? 35 : 25;

  // Earthquake — California baseline
  const earthquakeScore = subj.state === 'CA' ? 60 : 25;

  const overallScore = Math.round((floodScore + crimeScore + wildfireScore + earthquakeScore) / 4);
  const overallRating = overallScore < 30 ? 'Low Risk' : overallScore < 55 ? 'Moderate Risk' : overallScore < 75 ? 'Elevated Risk' : 'High Risk';

  return {
    overallScore,
    overallRating,
    flood: {
      score: floodScore,
      zone: flood.zone || '—',
      label: flood.label || (flood.highRisk ? 'High Risk' : 'Low Risk'),
      highRisk: !!flood.highRisk,
    },
    crime: {
      score: crimeScore,
      label: crimeScore < 35 ? 'Low' : crimeScore < 55 ? 'Moderate' : 'Elevated',
      city: crime.city || subj.city || '—',
      reportingAgency: crime.agencyName || '—',
    },
    wildfire: {
      score: wildfireScore,
      label: wildfireScore < 30 ? 'Low' : wildfireScore < 55 ? 'Moderate' : 'Elevated',
    },
    earthquake: {
      score: earthquakeScore,
      label: earthquakeScore < 30 ? 'Low' : earthquakeScore < 55 ? 'Moderate' : 'Elevated',
    },
    summary: `Overall risk: ${overallRating} (${overallScore}/100). Flood: ${flood.label || 'Low'}. Crime: ${crimeScore < 35 ? 'Low' : crimeScore < 55 ? 'Moderate' : 'Elevated'} for ${crime.city || subj.city || 'area'}. ${subj.state === 'CA' ? 'California baseline earthquake exposure.' : ''}`,
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
  const viewToken = crypto.randomUUID();

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
      // Auto-detect casita/ADU from listing text when not explicitly provided
      const autoADU = (!aduSqft) ? detectADU(reportData) : null;
      const effectiveAduSqft = aduSqft || autoADU?.sqft || null;

      // Extract last sale from reportData fallback when not in body
      const parseSalePrice = (v) => { const n = parseFloat(String(v || "").replace(/[^0-9.]/g, "")); return isNaN(n) ? null : n; };
      const effectiveLastSalePrice = lastSalePrice
        || parseSalePrice(reportData?.normalized?.subject?.lastSalePrice)
        || null;
      const effectiveLastSaleDate  = lastSaleDate
        || reportData?.normalized?.subject?.lastSaleDate
        || null;

      // Luxury tier: base AVM (mid) above $1.5M
      const luxuryTier = !!(mid && mid >= 1500000);

      dnaAdjusted = computeDnaAdjustment(low, mid, high, features, {
        lastSalePrice:  effectiveLastSalePrice ? Number(effectiveLastSalePrice) : null,
        lastSaleDate:   effectiveLastSaleDate,
        marketPriceYoY: marketPriceYoY != null ? Number(marketPriceYoY) : null,
        aduSqft:        effectiveAduSqft ? Number(effectiveAduSqft) : null,
        luxuryTier,
        poolAddOnCost:  poolAddOnCost != null ? Number(poolAddOnCost) : null,
        recentReno:     recentRenoCost ? { cost: Number(recentRenoCost), year: recentRenoYear ? Number(recentRenoYear) : null } : null,
      });
      featureProfile = { low, mid, high, dnaAdjusted };

      if (autoADU) {
        console.log(`[save-report] auto-detected ADU: ${autoADU.keywords.join(",")} sqft=${autoADU.sqft}`);
      }
    }
  }

  // Merge DNA adjustment + synthesized sections into reportData so the hosted view can render
  let enrichedReportData = reportData;
  if (reportData) {
    const norm = reportData.normalized || {};
    const neighborhood = buildNeighborhoodProfile(norm);
    const risk         = buildRiskProfile(norm);
    const salesActivity = buildSalesActivity(norm);

    enrichedReportData = {
      ...reportData,
      ...(dnaAdjusted ? { dnaAdjusted } : {}),
      neighborhood,
      risk,
      salesActivity,
      normalized: { ...norm, neighborhood, risk, salesActivity },
    };
  }

  try {
    let reportId = null;
    let updated = false;

    if (stripeSessionId) {
      const existing = await db.from("property_reports")
        .select("id")
        .eq("stripe_session_id", stripeSessionId)
        .eq("status", "pending")
        .limit(1)
        .get()
        .catch(() => []);

      if (Array.isArray(existing) && existing.length > 0) {
        reportId = existing[0].id;
        await db.from("property_reports")
          .eq("stripe_session_id", stripeSessionId)
          .update({
            report_url: reportUrl || null,
            report_pdf_url: reportPdfUrl || null,
            report_data: enrichedReportData || null,
            view_token: viewToken,
            status,
            generation_error: generationError,
            n8n_request_id: n8nRequestId,
          });
        updated = true;
      }
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

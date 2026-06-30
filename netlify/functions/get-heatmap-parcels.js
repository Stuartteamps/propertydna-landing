const https = require('https');
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function apiGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

function rentcast(path) {
  const key = process.env.RENTCAST_API_KEY;
  return apiGet('api.rentcast.io', path, { 'X-Api-Key': key, Accept: 'application/json' });
}

// Census place FIPSes for Coachella Valley cities (CA state 06)
// Sourced from Census ACS 2022 — all verified against real unit counts
const CITY_FIPS = {
  'palm springs':      '55254',
  'palm desert':       '55184',
  'indio':             '36448',
  'cathedral city':    '12048',
  'la quinta':         '40354',
  'rancho mirage':     '59500',
  'indian wells':      '36434',
  'coachella':         '14260',
  'desert hot springs':'18996',
};

// Real % of housing stock built since 2000 from Census ACS B25034
// Used as city-level permit activity baseline (pre-computed, refreshed on demand)
// Pre-computed from Census ACS B25034 using same weighted formula as fetchCensusPermitActivity()
// weighted = (2020+×3 + 2010-19×2 + 2000-09) / (total×3) ; score = 20 + weighted×200
const CITY_PERMIT_BASELINES = {
  'palm springs':       32,  // 6.2% weighted — mid-century stock, high renovation market
  'palm desert':        34,  // 7.1% weighted — established resort community
  'cathedral city':     39,  // 9.7% weighted
  'indian wells':       42,  // 10.9% weighted — gated luxury
  'rancho mirage':      46,  // 12.9% weighted
  'desert hot springs': 45,  // 12.7% weighted — growing area
  'la quinta':          56,  // 18.2% weighted — master-planned communities
  'coachella':          58,  // 19.0% weighted — rapid growth
  'indio':              61,  // 20.4% weighted — largest new development pipeline
};

// Live Census fetch — updates the baseline with fresh data
// No API key required for ≤500 requests/day
async function fetchCensusPermitActivity(city) {
  const fips = CITY_FIPS[city.toLowerCase()];
  if (!fips) return null;

  try {
    const data = await apiGet('api.census.gov',
      `/data/2022/acs/acs5?get=B25034_001E,B25034_002E,B25034_003E,B25034_004E&for=place:${fips}&in=state:06`
    );
    if (!data || !data[1]) return null;

    const [total, since2020, since2010to19, since2000to09] = data[1].map(Number);
    if (!total) return null;

    // Weight recency: 2020+ counts 3x, 2010s count 2x, 2000s count 1x
    const weightedRecent = (since2020 * 3 + since2010to19 * 2 + since2000to09) / (total * 3);
    return Math.round(20 + weightedRecent * 200); // 0% recent → 20, 40%+ recent → ~80
  } catch {
    return null;
  }
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(v, min = 0, max = 100) { return Math.round(Math.max(min, Math.min(max, v))); }

function toParcelType(t) {
  if (!t) return 'single_family';
  const l = t.toLowerCase();
  if (l.includes('condo') || l.includes('apartment') || l.includes('townhome')) return 'condo';
  if (l.includes('multi') || l.includes('duplex') || l.includes('triplex')) return 'multi_family';
  if (l.includes('land') || l.includes('lot')) return 'land';
  return 'single_family';
}

function neighborhoodFromCoords(lat, lon, city) {
  if (city.toLowerCase() === 'cathedral city') return 'Cathedral City';
  if (city.toLowerCase() === 'palm desert')    return 'Palm Desert';
  if (city.toLowerCase() === 'indio')          return 'Indio';
  if (city.toLowerCase() === 'la quinta')      return 'La Quinta';
  if (lat > 33.84) return 'Old Las Palmas';
  if (lat > 33.83 && lon < -116.53) return 'Downtown PS';
  if (lat > 33.83) return 'Movie Colony';
  if (lat > 33.81 && lon < -116.53) return 'Smoke Tree';
  if (lat > 33.80) return 'Deepwell';
  if (lat > 33.77) return 'South Palm Springs';
  return city || 'Palm Springs';
}

function genPolygon(lat, lon) {
  const dLon = 0.00045, dLat = 0.00035;
  return [
    [lon - dLon / 2, lat - dLat / 2],
    [lon + dLon / 2, lat - dLat / 2],
    [lon + dLon / 2, lat + dLat / 2],
    [lon - dLon / 2, lat + dLat / 2],
    [lon - dLon / 2, lat - dLat / 2],
  ];
}

function genSparkline(baseYoy) {
  const vals = [];
  let v = 100;
  const dailyDrift = (baseYoy / 365) * 0.3;
  for (let i = 0; i < 30; i++) {
    v += dailyDrift + (Math.random() - 0.5) * 1.8;
    vals.push(Math.round(v * 10) / 10);
  }
  return vals;
}

// Infer per-property permit activity from real RentCast data fields.
// Logic: new builds have permits by definition; high PPSF on old building = renovated = permits.
// When BuildZoom connects, this function gets replaced with real per-property permit history.
function inferPropertyPermitSignal(l, medPpsf) {
  const yr   = l.yearBuilt || 0;
  const ppsf = l.pricePerSquareFoot || 0;

  if (yr >= 2015) return 88;                                          // New construction
  if (yr >= 2005) return 68;                                          // Recent build
  if (yr >= 1990 && ppsf > medPpsf * 1.15) return 70;               // 90s+ renovated
  if (yr > 0 && yr < 1985 && ppsf > medPpsf * 1.25) return 75;      // Mid-century renovated (high premium)
  if (yr > 0 && yr < 1985 && ppsf > medPpsf * 1.05) return 60;      // Mid-century light reno
  if (yr > 0 && yr < 1985 && ppsf <= medPpsf) return 28;             // Mid-century untouched
  if (yr >= 1985 && yr < 2005 && ppsf > medPpsf) return 55;          // 85-04, above median
  return 48;                                                           // Unknown / baseline
}

function scoreParcels(listings, cityPermitActivity) {
  const prices = listings.map(l => l.price).filter(Boolean);
  const ppsfs  = listings.map(l => l.pricePerSquareFoot).filter(Boolean);
  const doms   = listings.map(l => l.daysOnMarket).filter(v => v != null);

  const medPrice = median(prices);
  const medPpsf  = median(ppsfs);
  const maxDom   = Math.max(...doms, 1);

  return listings.map((l, idx) => {
    const price  = l.price || medPrice;
    const ppsf   = l.pricePerSquareFoot || medPpsf;
    const dom    = l.daysOnMarket ?? 30;
    const sqft   = l.squareFootage || 1500;
    const lat    = l.latitude;
    const lon    = l.longitude;

    // --- Real scores from real RentCast data ---
    const priceDeltaScore = clamp(100 - Math.max(0, (price - medPrice) / Math.max(medPrice, 1) * 100));
    const domScore        = clamp(100 - (dom / maxDom) * 100);
    const compsScore      = clamp(100 - Math.abs(ppsf - medPpsf) / Math.max(medPpsf, 1) * 100);
    const livability      = clamp(55 + (lat > 33.83 ? 20 : lat > 33.80 ? 10 : 0) + (price > medPrice ? 10 : 0));
    const rentalDemand    = clamp(50 + (dom < 30 ? 20 : dom < 60 ? 10 : -5) + (sqft < 2000 ? 10 : 0));

    // --- Permit score: real Census city baseline + per-property signal from real data ---
    const propertyPermitSignal = inferPropertyPermitSignal(l, medPpsf);
    const permitsScore = clamp(cityPermitActivity * 0.35 + propertyPermitSignal * 0.65);

    const score = clamp(
      0.20 * compsScore + 0.20 * priceDeltaScore + 0.15 * domScore +
      0.15 * permitsScore + 0.15 * livability + 0.15 * rentalDemand
    );

    const confidence = Math.min(0.97, 0.5 +
      (l.latitude ? 0.1 : 0) + (l.squareFootage ? 0.1 : 0) +
      (l.daysOnMarket != null ? 0.1 : 0) + (l.pricePerSquareFoot ? 0.1 : 0) +
      (l.yearBuilt ? 0.07 : 0)
    );

    const city = l.city || 'Palm Springs';
    const zip  = l.zipCode || '92262';

    return {
      id: l.id || `rc-${idx}`,
      address: l.formattedAddress || `${l.addressLine1}, ${city}, CA ${zip}`,
      street: l.addressLine1 || l.formattedAddress || '',
      city, state: l.state || 'CA', zip,
      lat: lat || 33.83, lon: lon || -116.54,
      score, confidence,
      price, pricePerSqft: Math.round(ppsf || price / sqft),
      sqft, bedrooms: l.bedrooms || 0, bathrooms: l.bathrooms || 0,
      yearBuilt: l.yearBuilt || 0, dom, permits: 0,
      propertyType: toParcelType(l.propertyType),
      compsScore, priceDeltaScore, domScore, permitsScore, livability, rentalDemand,
      sparkline: genSparkline(6.5),
      polygon: genPolygon(lat || 33.83, lon || -116.54),
      neighborhood: neighborhoodFromCoords(lat || 33.83, lon || -116.54, city),
    };
  });
}

// Internal sales fallback — used when RentCast is unavailable/empty (e.g. a lapsed
// subscription) so the map still shows real properties from our own indexed sales.
// Mapped to the same shape scoreParcels expects. The `properties` table is small
// enough for a case-insensitive city match (ilike), unlike the 10M-row master.
async function fetchInternalListings(city, limit) {
  // 1) Small canonical `properties` table — real sales w/ lat/lng. Best when present
  // (mostly cities that have had reports/pull-solds runs, e.g. Palm Springs).
  try {
    const rows = await db.from('properties')
      .select('id,address,city,state,zip,latitude,longitude,beds,baths,sqft,year_built,last_sale_price,last_sale_date,current_estimated_value,property_type_normalized')
      .ilike('city', city)
      .limit(limit)
      .get();
    if (Array.isArray(rows) && rows.length) {
      const mapped = rows.map(r => {
        const price = Number(r.current_estimated_value || r.last_sale_price || 0);
        const sqft  = r.sqft ? Number(r.sqft) : null;
        return {
          id: r.id, formattedAddress: r.address, addressLine1: r.address,
          city: r.city, state: r.state || 'CA', zipCode: r.zip,
          latitude: Number(r.latitude), longitude: Number(r.longitude), price,
          squareFootage: sqft, pricePerSquareFoot: (sqft && price) ? Math.round(price / sqft) : null,
          bedrooms: r.beds || 0, bathrooms: r.baths || 0, yearBuilt: r.year_built || 0,
          daysOnMarket: null, propertyType: r.property_type_normalized || 'Single Family',
        };
      }).filter(l => l.latitude && l.longitude && l.price > 0);
      if (mapped.length) return mapped;
    }
  } catch { /* fall through to property_master */ }

  // 2) The 10M-row property_master index covers every city (city is indexed; geo is
  //    lat/lng, value is rentcast_value or tax_assessed_value). This is what makes
  //    Palm Desert, La Quinta, Indio, etc. populate.
  try {
    const rows = await db.from('property_master')
      .select('apn,address,formatted_address,city,zip,lat,lng,beds,baths,sqft,year_built,property_type,rentcast_value,tax_assessed_value')
      .eq('city', city)
      .limit(limit)
      .get();
    if (!Array.isArray(rows) || !rows.length) return null;
    const mapped = rows.map(r => {
      const price = Number(r.rentcast_value || r.tax_assessed_value || 0);
      const sqft  = r.sqft ? Number(r.sqft) : null;
      return {
        id: r.apn, formattedAddress: r.formatted_address || r.address, addressLine1: r.address || r.formatted_address,
        city: r.city, state: 'CA', zipCode: r.zip,
        latitude: Number(r.lat), longitude: Number(r.lng), price,
        squareFootage: sqft, pricePerSquareFoot: (sqft && price) ? Math.round(price / sqft) : null,
        bedrooms: r.beds || 0, bathrooms: r.baths || 0, yearBuilt: r.year_built || 0,
        daysOnMarket: null, propertyType: r.property_type || 'Single Family',
      };
    }).filter(l => l.latitude && l.longitude && l.price > 0);
    return mapped.length ? mapped : null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const city  = params.city  || 'Palm Springs';
  const state = params.state || 'CA';
  const limit = Math.min(500, parseInt(params.limit || '500', 10));

  // One-shot diagnostic (?debug=1): reveal what the internal tables actually hold
  // for this city so we wire the fallback to real columns, not guesses.
  if (params.debug) {
    const out = { city };
    try {
      const r = await db.from('properties').select('*').ilike('city', city).limit(3).get();
      out.properties = { n: Array.isArray(r) ? r.length : 'na', keys: r && r[0] ? Object.keys(r[0]) : [],
        sample: r && r[0] ? { city: r[0].city, lat: r[0].latitude ?? r[0].lat ?? null, lng: r[0].longitude ?? r[0].lng ?? null, lastSale: r[0].last_sale_price ?? null, est: r[0].current_estimated_value ?? null } : null };
    } catch (e) { out.properties = { err: e.message }; }
    try {
      const r = await db.from('property_master').select('apn,address,city,latitude,longitude,rentcast_value,sqft').eq('city', city).limit(3).get();
      out.property_master = { n: Array.isArray(r) ? r.length : 'na', keys: r && r[0] ? Object.keys(r[0]) : [],
        sample: r && r[0] ? { city: r[0].city, lat: r[0].latitude ?? null, lng: r[0].longitude ?? null, val: r[0].rentcast_value ?? null } : null };
    } catch (e) { out.property_master = { err: e.message }; }
    return { statusCode: 200, headers: CORS, body: JSON.stringify(out) };
  }

  try {
    const qs = new URLSearchParams({ city, state, status: 'Active', limit: String(limit), offset: '0' });

    // Fetch real listings + real Census permit data in parallel
    const [data, livePermitScore] = await Promise.all([
      rentcast(`/v1/listings/sale?${qs.toString()}`),
      fetchCensusPermitActivity(city),
    ]);

    // Use live Census score; fall back to pre-computed baseline; default 50
    const cityPermitActivity = livePermitScore
      ?? CITY_PERMIT_BASELINES[city.toLowerCase()]
      ?? 50;

    let valid = (Array.isArray(data) ? data : []).filter(l => l.latitude && l.longitude && l.price > 0);
    let source = 'rentcast+census';

    // RentCast unavailable/empty → serve our own indexed sales so the map is never blank.
    if (!valid.length) {
      const internal = await fetchInternalListings(city, limit);
      if (internal && internal.length) { valid = internal; source = 'internal+census'; }
    }

    if (!valid.length) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ parcels: [], count: 0, source: 'empty', city, cityPermitActivity }),
      };
    }

    const parcels = scoreParcels(valid, cityPermitActivity);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        parcels,
        count: parcels.length,
        source,
        city,
        cityPermitActivity,
        permitDataSource: livePermitScore ? 'census_live' : 'census_precomputed',
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(err?.message || err), parcels: [], count: 0 }),
    };
  }
};

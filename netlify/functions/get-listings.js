/**
 * get-listings — Live Coachella Valley listings via RentCast
 *
 * GET ?region=west|east|sold&limit=24
 *
 * West Valley:  Palm Springs, Cathedral City, Desert Hot Springs
 * East Valley:  Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio
 * Recently Sold: all cities, status=Sold
 */
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const WEST_CITIES = ['Palm Springs', 'Cathedral City', 'Desert Hot Springs'];
const EAST_CITIES = ['Palm Desert', 'Rancho Mirage', 'Indian Wells', 'La Quinta', 'Indio'];
const ALL_CITIES  = [...WEST_CITIES, ...EAST_CITIES];

function apiGet(path) {
  const key = process.env.RENTCAST_API_KEY;
  return new Promise((resolve) => {
    https.get({
      hostname: 'api.rentcast.io',
      path,
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

function fmt(n) {
  if (!n) return null;
  return '$' + Math.round(n).toLocaleString('en-US');
}

function scoreLabel(score) {
  if (score >= 80) return { label: 'Strong Buy', color: '#4caf50' };
  if (score >= 68) return { label: 'Buy',         color: '#8bc34a' };
  if (score >= 55) return { label: 'Hold',         color: '#C9A84C' };
  return              { label: 'Watch',        color: '#ef5350' };
}

function dnaScore(l, medPrice, medPpsf) {
  const price = l.price || medPrice || 500000;
  const ppsf  = l.pricePerSquareFoot || medPpsf || 300;
  const dom   = l.daysOnMarket ?? 30;
  const clamp = v => Math.max(0, Math.min(100, v));
  const priceDelta = clamp(100 - Math.max(0, (price - medPrice) / Math.max(medPrice, 1) * 100));
  const domScore_  = clamp(100 - dom / 120 * 100);
  const comps      = clamp(100 - Math.abs(ppsf - medPpsf) / Math.max(medPpsf, 1) * 100);
  return Math.round(0.35 * priceDelta + 0.35 * domScore_ + 0.30 * comps);
}

async function fetchCity(city, status, limit) {
  const qs = new URLSearchParams({ city, state: 'CA', status, limit: String(limit), offset: '0' });
  const data = await apiGet(`/v1/listings/sale?${qs}`);
  if (!Array.isArray(data)) return [];
  return data.filter(l => l.price > 0).map(l => ({ ...l, _city: city }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const { region = 'west', limit: rawLimit = '50' } = event.queryStringParameters || {};
  const perCity = Math.ceil(Math.min(200, parseInt(rawLimit, 10)) / (region === 'sold' ? ALL_CITIES.length : region === 'east' ? EAST_CITIES.length : WEST_CITIES.length));

  const cities = region === 'east' ? EAST_CITIES : region === 'sold' ? ALL_CITIES : WEST_CITIES;
  const status = region === 'sold' ? 'Sold' : 'Active';

  // Parallel fetch all cities
  const results = await Promise.all(cities.map(c => fetchCity(c, status, Math.max(perCity, 8))));
  const all = results.flat();

  if (!all.length) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ listings: [], region, count: 0 }) };
  }

  // Compute medians for scoring
  const prices = all.map(l => l.price).filter(Boolean).sort((a,b) => a-b);
  const ppsfs  = all.map(l => l.pricePerSquareFoot).filter(Boolean).sort((a,b) => a-b);
  const medPrice = prices[Math.floor(prices.length / 2)] || 500000;
  const medPpsf  = ppsfs[Math.floor(ppsfs.length / 2)] || 300;

  // Shape output
  const listings = all
    .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)) // freshest first
    .slice(0, parseInt(rawLimit, 10))
    .map(l => {
      const score = dnaScore(l, medPrice, medPpsf);
      const { label, color } = scoreLabel(score);
      const city  = l.city || l._city || 'Palm Springs';
      const zip   = l.zipCode || '';
      return {
        id:           l.id || l.listingId || Math.random().toString(36).slice(2),
        address:      l.formattedAddress || `${l.addressLine1}, ${city}, CA ${zip}`,
        street:       l.addressLine1 || '',
        city,
        state:        l.state || 'CA',
        zip,
        price:        l.price,
        priceFormatted: fmt(l.price),
        pricePerSqft: l.pricePerSquareFoot ? Math.round(l.pricePerSquareFoot) : null,
        sqft:         l.squareFootage || null,
        beds:         l.bedrooms  || null,
        baths:        l.bathrooms || null,
        yearBuilt:    l.yearBuilt || null,
        dom:          l.daysOnMarket ?? null,
        propertyType: (l.propertyType || 'Single Family').replace(/_/g, ' '),
        status:       l.status || status,
        lat:          l.latitude  || null,
        lon:          l.longitude || null,
        score,
        scoreLabel:   label,
        scoreColor:   color,
        reportUrl:    `https://thepropertydna.com/?address=${encodeURIComponent(l.formattedAddress || l.addressLine1 || '')}`,
      };
    });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ listings, region, count: listings.length, medianPrice: medPrice }),
  };
};

const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function apiGet(hostname, path, headers) {
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
  if (city === 'Cathedral City') return 'Cathedral City';
  if (lat > 33.84) return 'Old Las Palmas';
  if (lat > 33.83 && lon < -116.53) return 'Downtown PS';
  if (lat > 33.83) return 'Movie Colony';
  if (lat > 33.81 && lon < -116.53) return 'Smoke Tree';
  if (lat > 33.80) return 'Deepwell';
  if (lat > 33.77) return 'South Palm Springs';
  return 'Palm Springs';
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

function scoreParcels(listings) {
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

    // Real score from real values
    const priceDeltaScore = clamp(100 - Math.max(0, (price - medPrice) / Math.max(medPrice, 1) * 100));
    const domScore        = clamp(100 - (dom / maxDom) * 100);
    const compsScore      = clamp(100 - Math.abs(ppsf - medPpsf) / Math.max(medPpsf, 1) * 100);
    const permitsScore    = clamp(l.yearBuilt ? Math.max(20, 100 - (2025 - l.yearBuilt) * 0.8) : 50);
    const livability      = clamp(55 + (lat > 33.83 ? 20 : lat > 33.80 ? 10 : 0) + (price > medPrice ? 10 : 0));
    const rentalDemand    = clamp(50 + (dom < 30 ? 20 : dom < 60 ? 10 : -5) + (sqft < 2000 ? 10 : 0));

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
    const neighborhood = neighborhoodFromCoords(lat || 33.83, lon || -116.54, city);

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
      neighborhood,
    };
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const city  = params.city || 'Palm Springs';
  const state = params.state || 'CA';
  const limit = Math.min(500, parseInt(params.limit || '500', 10));

  try {
    const qs = new URLSearchParams({
      city, state,
      status: 'Active',
      limit: String(limit),
      offset: '0',
    });

    const data = await rentcast(`/v1/listings/sale?${qs.toString()}`);

    if (!data || !Array.isArray(data)) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ parcels: [], count: 0, source: 'empty', city }),
      };
    }

    const valid = data.filter(l => l.latitude && l.longitude && l.price > 0);
    const parcels = scoreParcels(valid);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ parcels, count: parcels.length, source: 'rentcast', city }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(err?.message || err), parcels: [], count: 0 }),
    };
  }
};

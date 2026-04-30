import type { Parcel } from '../types';

// Deterministic PRNG (mulberry32)
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = makeRng(0xDEADBEEF);

function rand(min: number, max: number) { return min + rng() * (max - min); }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }

// Palm Springs neighborhoods with center coords and character
const NEIGHBORHOODS = [
  { name: 'Downtown PS',      lat: 33.8303, lon: -116.5453, spread: 0.008, luxFactor: 0.85, streets: ['N Palm Canyon Dr', 'S Indian Canyon Dr', 'W Tahquitz Canyon Way', 'E Amado Rd', 'W Arenas Rd', 'S Belardo Rd'] },
  { name: 'Old Las Palmas',   lat: 33.8420, lon: -116.5520, spread: 0.007, luxFactor: 0.92, streets: ['N Patencio Rd', 'N Los Alamos Rd', 'N Via Miraleste', 'N Via Monte Vista', 'W Paseo De Marcia'] },
  { name: 'Movie Colony',     lat: 33.8370, lon: -116.5260, spread: 0.009, luxFactor: 0.78, streets: ['N Avenida Caballeros', 'E Racquet Club Rd', 'N Sunrise Way', 'E Tachevah Dr', 'N Via Las Palmas'] },
  { name: 'Deepwell',         lat: 33.8060, lon: -116.5340, spread: 0.010, luxFactor: 0.70, streets: ['S Calle Encilia', 'E Palm Canyon Dr', 'S Camino Real', 'E Sunny Dunes Rd', 'S Compadre Rd'] },
  { name: 'South Palm Springs',lat:33.7750, lon:-116.5320, spread: 0.012, luxFactor: 0.55, streets: ['E Palm Canyon Dr', 'S El Cielo Rd', 'E Mesquite Ave', 'S Sunrise Way', 'E Bogert Trail'] },
  { name: 'Cathedral City',   lat: 33.7800, lon: -116.4680, spread: 0.015, luxFactor: 0.42, streets: ['E Ramon Rd', 'N Landau Blvd', 'E Vista Chino', 'N Date Palm Dr', 'E Gerald Ford Dr'] },
  { name: 'Vista Chino',      lat: 33.8520, lon: -116.5190, spread: 0.011, luxFactor: 0.60, streets: ['E Vista Chino', 'N Sunrise Way', 'E San Rafael Dr', 'N Farrell Dr', 'E Alejo Rd'] },
  { name: 'Smoke Tree',       lat: 33.8130, lon: -116.5430, spread: 0.008, luxFactor: 0.73, streets: ['S Smoke Tree Ln', 'E Andreas Rd', 'S Cahuilla Rd', 'E Camino Monte Vista', 'S Belardo Rd'] },
];

const PROPERTY_TYPES: Parcel['propertyType'][] = ['single_family', 'single_family', 'single_family', 'condo', 'multi_family', 'land'];

function genSparkline(base: number): number[] {
  const vals: number[] = [];
  let v = base;
  for (let i = 0; i < 30; i++) {
    v = v + rand(-2, 2.5);
    vals.push(Math.round(v * 10) / 10);
  }
  return vals;
}

// ~50m parcel polygon in lon/lat offsets
function genPolygon(lat: number, lon: number): [number, number][] {
  const dLon = 0.00045 + rng() * 0.0003;
  const dLat = 0.00035 + rng() * 0.0002;
  return [
    [lon - dLon / 2, lat - dLat / 2],
    [lon + dLon / 2, lat - dLat / 2],
    [lon + dLon / 2, lat + dLat / 2],
    [lon - dLon / 2, lat + dLat / 2],
    [lon - dLon / 2, lat - dLat / 2],
  ];
}

function buildParcel(idx: number, nbhd: typeof NEIGHBORHOODS[0]): Parcel {
  const lat = nbhd.lat + (rng() - 0.5) * nbhd.spread;
  const lon = nbhd.lon + (rng() - 0.5) * nbhd.spread * 1.4;
  const lux = nbhd.luxFactor;

  const sqft = randInt(1100, 4800);
  const basePPSF = 350 + lux * 350 + rand(-60, 60);
  const price = Math.round(sqft * basePPSF / 1000) * 1000;

  const dom = randInt(0, 180);
  const permits = randInt(0, 12);
  const yearBuilt = randInt(1955, 2023);
  const propertyType = pick(PROPERTY_TYPES);

  const compsScore = Math.round(45 + lux * 50 + rand(-15, 15));
  const priceDeltaScore = Math.round(50 + lux * 40 + rand(-20, 20));
  const domScore = Math.round(Math.max(0, 100 - dom * 0.55));
  const permitsScore = Math.round(Math.min(100, permits * 8 + rand(0, 20)));
  const livability = Math.round(45 + lux * 50 + rand(-10, 10));
  const rentalDemand = Math.round(40 + lux * 45 + rand(-15, 15));

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const score = clamp(
    0.20 * compsScore +
    0.20 * priceDeltaScore +
    0.15 * domScore +
    0.15 * permitsScore +
    0.15 * livability +
    0.15 * rentalDemand
  );

  const confidence = Math.round((0.4 + lux * 0.55 + rand(-0.1, 0.1)) * 100) / 100;
  const houseNum = randInt(100, 9999);
  const street = pick(nbhd.streets);
  const city = nbhd.name === 'Cathedral City' ? 'Cathedral City' : 'Palm Springs';
  const zip = city === 'Palm Springs' ? '9226' + randInt(0, 8) : '92234';

  return {
    id: `parcel-${idx}`,
    address: `${houseNum} ${street}, ${city}, CA ${zip}`,
    street: `${houseNum} ${street}`,
    city,
    state: 'CA',
    zip,
    lat,
    lon,
    score: clamp(score),
    confidence: Math.max(0.3, Math.min(0.98, confidence)),
    price,
    pricePerSqft: Math.round(price / sqft),
    sqft,
    bedrooms: propertyType === 'land' ? 0 : randInt(2, 6),
    bathrooms: propertyType === 'land' ? 0 : randInt(1, 5),
    yearBuilt,
    dom,
    permits,
    propertyType,
    compsScore: clamp(compsScore),
    priceDeltaScore: clamp(priceDeltaScore),
    domScore: clamp(domScore),
    permitsScore: clamp(permitsScore),
    livability: clamp(livability),
    rentalDemand: clamp(rentalDemand),
    sparkline: genSparkline(95 + lux * 10),
    polygon: genPolygon(lat, lon),
    neighborhood: nbhd.name,
  };
}

function generateParcels(): Parcel[] {
  const parcels: Parcel[] = [];
  const perNeighborhood = Math.ceil(500 / NEIGHBORHOODS.length);
  let idx = 0;
  for (const nbhd of NEIGHBORHOODS) {
    for (let i = 0; i < perNeighborhood && idx < 500; i++, idx++) {
      parcels.push(buildParcel(idx, nbhd));
    }
  }
  return parcels;
}

export const MOCK_PARCELS: Parcel[] = generateParcels();

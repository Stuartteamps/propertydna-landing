#!/usr/bin/env node
/**
 * Standalone mock API server (optional).
 * The Vite app imports mock data directly — this is only needed if you want
 * to test against an actual HTTP endpoint.
 *
 * Usage:  node mock-api/server.js
 * Port:   3099
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 3099;

// Generate mock data (mirrors src/data/mockParcels.ts logic)
function makeRng(seed) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = makeRng(0xDEADBEEF);
function rand(min, max) { return min + rng() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

const NEIGHBORHOODS = [
  { name: 'Downtown PS', lat: 33.8303, lon: -116.5453, spread: 0.008, luxFactor: 0.85 },
  { name: 'Old Las Palmas', lat: 33.842, lon: -116.552, spread: 0.007, luxFactor: 0.92 },
  { name: 'Movie Colony', lat: 33.837, lon: -116.526, spread: 0.009, luxFactor: 0.78 },
  { name: 'Deepwell', lat: 33.806, lon: -116.534, spread: 0.01, luxFactor: 0.70 },
  { name: 'South PS', lat: 33.775, lon: -116.532, spread: 0.012, luxFactor: 0.55 },
  { name: 'Cathedral City', lat: 33.78, lon: -116.468, spread: 0.015, luxFactor: 0.42 },
  { name: 'Vista Chino', lat: 33.852, lon: -116.519, spread: 0.011, luxFactor: 0.60 },
  { name: 'Smoke Tree', lat: 33.813, lon: -116.543, spread: 0.008, luxFactor: 0.73 },
];

function buildParcel(idx, nbhd) {
  const lat = nbhd.lat + (rng() - 0.5) * nbhd.spread;
  const lon = nbhd.lon + (rng() - 0.5) * nbhd.spread * 1.4;
  const lux = nbhd.luxFactor;
  const sqft = randInt(1100, 4800);
  const price = Math.round(sqft * (350 + lux * 350 + rand(-60, 60)) / 1000) * 1000;
  const dom = randInt(0, 180);
  const compsScore = Math.round(45 + lux * 50 + rand(-15, 15));
  const domScore = Math.round(Math.max(0, 100 - dom * 0.55));
  const livability = Math.round(45 + lux * 50 + rand(-10, 10));
  const rentalDemand = Math.round(40 + lux * 45 + rand(-15, 15));
  const score = Math.round(0.2 * compsScore + 0.2 * Math.round(50 + lux * 40) + 0.15 * domScore + 0.15 * Math.round(randInt(0,12)*8) + 0.15 * livability + 0.15 * rentalDemand);
  return { id: `parcel-${idx}`, lat, lon, score: Math.max(0, Math.min(100, score)), price, sqft, dom, neighborhood: nbhd.name };
}

const parcels = [];
let idx = 0;
for (const nbhd of NEIGHBORHOODS) {
  for (let i = 0; i < Math.ceil(500 / NEIGHBORHOODS.length) && idx < 500; i++, idx++) {
    parcels.push(buildParcel(idx, nbhd));
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/parcels') {
    res.end(JSON.stringify({ parcels, count: parcels.length }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Mock API running at http://localhost:${PORT}`);
  console.log(`  GET /api/parcels → ${parcels.length} Palm Springs parcels`);
});

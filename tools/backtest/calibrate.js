#!/usr/bin/env node
/**
 * calibrate.js — REAL production accuracy against verified sold prices.
 *
 * For each sold comp from the CMA parser (ground truth = actual SP):
 *   1. pull a live RentCast AVM for the address  (the production value base)
 *   2. apply our computeDnaAdjustment() feature layer
 *   3. score BOTH the raw RentCast AVM and the PropertyDNA-adjusted value
 *      against the actual sold price — MdAPE, within-5/10/20%, bias, head-to-head.
 *
 * This is the honest number to replace "97%" with.
 *
 * Usage:
 *   RENTCAST_API_KEY=xxx node tools/backtest/calibrate.js [solds.csv] [--limit 15]
 *
 * Spreads the sample across the price range (every Nth row) so one run isn't all
 * ultra-luxury. RentCast calls cost quota — default limit is small; scale up
 * once the mid-market CMA files arrive.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.RENTCAST_API_KEY;
if (!KEY) { console.error('\n  Set RENTCAST_API_KEY=... (see api_keys memory)\n'); process.exit(1); }

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || path.join(__dirname, 'solds-from-cma.csv');
const limit = parseInt((args.find(a => a.startsWith('--limit')) || '--limit=15').split('=')[1] || args[args.indexOf('--limit') + 1] || '15', 10);

let computeDnaAdjustment;
try { ({ computeDnaAdjustment } = require('../../netlify/functions/save-report.js')); }
catch (e) { console.error('  could not load computeDnaAdjustment:', e.message); process.exit(1); }

// ── csv ──
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i+1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i+1] === '\n') i++; if (f !== '' || row.length) { row.push(f); rows.push(row); row = []; f = ''; } }
    else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; };

function rentcastAVM(address, beds, baths, sqft) {
  const qs = new URLSearchParams({ address, propertyType: 'Single Family' });
  if (beds)  qs.set('bedrooms', beds);
  if (baths) qs.set('bathrooms', baths);
  if (sqft)  qs.set('squareFootage', sqft);
  return new Promise((resolve) => {
    const req = https.get({ hostname: 'api.rentcast.io', path: `/v1/avm/value?${qs}`,
      headers: { 'X-Api-Key': KEY, Accept: 'application/json' } }, (res) => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { const j = JSON.parse(raw); resolve(j && j.price ? j : null); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
function score(pairs) {
  const apes = [], sg = [];
  for (const { p, a } of pairs) { if (!p || !a) continue; const s = (p - a) / a; apes.push(Math.abs(s)); sg.push(s); }
  if (!apes.length) return { n: 0 };
  const w = t => apes.filter(x => x <= t).length / apes.length;
  return { n: apes.length, mdape: median(apes), within5: w(.05), within10: w(.10), within20: w(.20), bias: median(sg) };
}
const pct = x => `${(x*100).toFixed(1)}%`;

(async () => {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const hdr = rows[0].map(h => h.trim());
  const col = n => hdr.indexOf(n);
  const data = rows.slice(1).filter(r => num(r[col('actual_price')]) > 50000);
  // spread the sample across the price range
  const step = Math.max(1, Math.floor(data.length / limit));
  const sample = data.filter((_, i) => i % step === 0).slice(0, limit);

  console.log(`\n  Calibrating ${sample.length} solds (of ${data.length}) via live RentCast AVM…\n`);
  const dnaPairs = [], rcPairs = [], detail = [];
  for (const r of sample) {
    const address = [r[col('address')], r[col('city')], r[col('state')]].filter(Boolean).join(', ');
    const actual = num(r[col('actual_price')]);
    const beds = num(r[col('beds')]), baths = num(r[col('baths')]), sqft = num(r[col('sqft')]);
    const psg = (r[col('pool_spa_gated')] || '');
    const avm = await rentcastAVM(address, beds, baths, sqft);
    if (!avm || !avm.price) { detail.push({ address, actual, miss: true }); continue; }
    const rawMid = avm.price;
    const features = {};
    if (/^yes/i.test(psg)) features.pool = true;          // 1st P/S/G segment = pool
    if (/yes\/.*yes\/.*yes/i.test(psg)) features.gated_community = true;
    const adj = computeDnaAdjustment(Math.round(rawMid*0.9), rawMid, Math.round(rawMid*1.1), features, {});
    const dnaMid = adj.adjMid || rawMid;
    dnaPairs.push({ p: dnaMid, a: actual });
    rcPairs.push({ p: rawMid, a: actual });
    detail.push({ address, actual, rawMid, dnaMid });
    await new Promise(r => setTimeout(r, 250)); // be gentle on the API
  }

  console.log('  ' + 'Address'.padEnd(34) + 'Actual'.padStart(13) + 'RentCast'.padStart(13) + 'PropertyDNA'.padStart(13) + '  err(DNA)');
  console.log('  ' + '-'.repeat(86));
  for (const d of detail) {
    if (d.miss) { console.log('  ' + d.address.slice(0,33).padEnd(34) + ('$'+Math.round(d.actual).toLocaleString()).padStart(13) + '   (no RentCast match)'); continue; }
    const e = (d.dnaMid - d.actual) / d.actual;
    console.log('  ' + d.address.slice(0,33).padEnd(34)
      + ('$'+Math.round(d.actual).toLocaleString()).padStart(13)
      + ('$'+Math.round(d.rawMid).toLocaleString()).padStart(13)
      + ('$'+Math.round(d.dnaMid).toLocaleString()).padStart(13)
      + '  ' + ((e>0?'+':'')+(e*100).toFixed(1)+'%').padStart(7));
  }

  const dna = score(dnaPairs), rc = score(rcPairs);
  console.log('\n  ' + '='.repeat(86));
  if (dna.n) {
    console.log(`  PropertyDNA  → MdAPE ${pct(dna.mdape)} | within5 ${pct(dna.within5)} | within10 ${pct(dna.within10)} | bias ${dna.bias>0?'+':''}${pct(dna.bias)}`);
    console.log(`  RentCast AVM → MdAPE ${pct(rc.mdape)} | within5 ${pct(rc.within5)} | within10 ${pct(rc.within10)} | bias ${rc.bias>0?'+':''}${pct(rc.bias)}`);
    const edge = (rc.mdape - dna.mdape) * 100;
    console.log(`\n  PropertyDNA is ${edge>=0?edge.toFixed(1)+' pts TIGHTER':Math.abs(edge).toFixed(1)+' pts wider'} than raw RentCast (matched n=${dna.n}).`);
    console.log(`  DEFENSIBLE ACCURACY (PropertyDNA) = ${Math.max(0, Math.round((1-dna.mdape)*100))}%  ·  median estimate within ${pct(dna.mdape)} of sold price.`);
  } else {
    console.log('  No RentCast matches — check address formatting / key quota.');
  }
  if (sample.length < 50) console.log(`\n  ⚠ ${sample.length} samples — directional. This file is luxury ($4M+); RentCast is weakest there. Mid-market files will read better.`);
  console.log('');
})();

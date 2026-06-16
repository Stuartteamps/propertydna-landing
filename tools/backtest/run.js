#!/usr/bin/env node
/**
 * PropertyDNA valuation back-test harness.
 *
 * Replaces the unvalidated "97% accurate" marketing figure with a measured,
 * defensible accuracy number computed from real sold properties.
 *
 * METHODOLOGY (honest):
 *   - Ground truth = the ACTUAL sold price of a property.
 *   - Prediction   = PropertyDNA's value for that property, ideally produced
 *                    from data available BEFORE the sale (point-in-time), so we
 *                    are not grading the model on data it couldn't have had.
 *   - We report median absolute % error (the headline), mean error, the share
 *     of homes within 5/10/20%, and signed bias (are we systematically high or
 *     low — e.g. the pool false-negative used to bias us LOW).
 *
 * USAGE:
 *   node tools/backtest/run.js [path/to/samples.csv] [--compute]
 *
 *   Default file: tools/backtest/samples.csv
 *
 *   CSV columns (header row required):
 *     address          – label only
 *     actual_price     – REQUIRED, the real sold price (ground truth)
 *     predicted_price  – the PropertyDNA value you captured for that home
 *                        (use this when you already have the model output)
 *
 *   --compute mode (optional) recomputes the prediction from raw inputs using
 *   the SAME computeDnaAdjustment() the production pipeline uses, so you can
 *   test changes to the valuation logic. Extra columns it reads:
 *     raw_mid, last_sale_price, last_sale_date, market_yoy,
 *     pool, casita, gated, golf, mountain_view   (1/0 or yes/no flags)
 *
 * Zero dependencies. The valuation module is only loaded in --compute mode.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const compute = args.includes('--compute');
const file = args.find(a => !a.startsWith('--')) || path.join(__dirname, 'samples.csv');

// ── tiny CSV parser (handles quoted fields with commas) ──────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; };
const truthy = (v) => /^(1|y|yes|true)$/i.test(String(v ?? '').trim());
const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (x) => `${(x * 100).toFixed(1)}%`;

if (!fs.existsSync(file)) {
  console.error(`\n  Sample file not found: ${file}`);
  console.error(`  Create it from the template: tools/backtest/samples.example.csv\n`);
  process.exit(1);
}

let computeDnaAdjustment = null;
if (compute) {
  try {
    ({ computeDnaAdjustment } = require('../../netlify/functions/save-report.js'));
  } catch (e) {
    console.error(`\n  --compute mode could not load the valuation module:\n  ${e.message}`);
    console.error(`  Falling back: rows must then carry a predicted_price column.\n`);
  }
}

const raw = fs.readFileSync(file, 'utf8');
const rows = parseCSV(raw).filter(r => r.some(c => c.trim() !== ''));
if (rows.length < 2) { console.error('  No data rows found.'); process.exit(1); }

const header = rows[0].map(h => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const idx = {
  address: col('address'), actual: col('actual_price'), predicted: col('predicted_price'),
  rawMid: col('raw_mid'), lastSale: col('last_sale_price'), lastSaleDate: col('last_sale_date'),
  yoy: col('market_yoy'), pool: col('pool'), casita: col('casita'), gated: col('gated'),
  golf: col('golf'), mtn: col('mountain_view'),
};

const results = [];
const skipped = [];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const address = idx.address >= 0 ? row[idx.address] : `row ${r}`;
  const actual = num(row[idx.actual]);
  if (!actual) { skipped.push({ address, why: 'no actual_price' }); continue; }

  let predicted = idx.predicted >= 0 ? num(row[idx.predicted]) : null;

  if (predicted == null && compute && computeDnaAdjustment && idx.rawMid >= 0) {
    const rawMid = num(row[idx.rawMid]);
    if (rawMid) {
      const features = {};
      if (idx.pool >= 0 && truthy(row[idx.pool])) features.pool = true;
      if (idx.gated >= 0 && truthy(row[idx.gated])) features.gated_community = true;
      if (idx.golf >= 0 && truthy(row[idx.golf])) features.golf_course = true;
      if (idx.mtn >= 0 && truthy(row[idx.mtn])) features.mountain_view = true;
      const out = computeDnaAdjustment(
        Math.round(rawMid * 0.9), rawMid, Math.round(rawMid * 1.1),
        features,
        {
          lastSalePrice: idx.lastSale >= 0 ? num(row[idx.lastSale]) : null,
          lastSaleDate: idx.lastSaleDate >= 0 ? (row[idx.lastSaleDate] || null) : null,
          marketPriceYoY: idx.yoy >= 0 ? num(row[idx.yoy]) : null,
          aduSqft: idx.casita >= 0 && truthy(row[idx.casita]) ? 600 : null,
        }
      );
      predicted = out.adjMid;
    }
  }

  if (predicted == null) { skipped.push({ address, why: 'no predicted_price (and not computable)' }); continue; }

  const signed = (predicted - actual) / actual;
  results.push({ address, actual, predicted, ape: Math.abs(signed), signed });
}

if (!results.length) {
  console.error('\n  No usable rows (need actual_price and predicted_price).\n');
  if (skipped.length) skipped.slice(0, 5).forEach(s => console.error(`   skipped ${s.address}: ${s.why}`));
  process.exit(1);
}

const apes = results.map(r => r.ape);
const signeds = results.map(r => r.signed);
const mdape = median(apes);
const mape = apes.reduce((a, b) => a + b, 0) / apes.length;
const within = (t) => results.filter(r => r.ape <= t).length / results.length;
const medianBias = median(signeds);
const headlineAccuracy = Math.max(0, Math.round((1 - mdape) * 100));

// ── report ───────────────────────────────────────────────────────────────────
const W = 44;
console.log('\n' + '═'.repeat(W + 28));
console.log('  PropertyDNA Valuation Back-Test');
console.log('  ' + new Date().toISOString().slice(0, 10) + '  ·  ' + path.basename(file));
console.log('═'.repeat(W + 28));

console.log('\n  Per-property error:\n');
console.log('  ' + 'Address'.padEnd(W) + 'Actual'.padStart(12) + 'Predicted'.padStart(12) + 'Error'.padStart(9));
console.log('  ' + '-'.repeat(W + 33));
for (const x of results) {
  const addr = (x.address.length > W - 2 ? x.address.slice(0, W - 3) + '…' : x.address).padEnd(W);
  const a = ('$' + Math.round(x.actual).toLocaleString()).padStart(12);
  const p = ('$' + Math.round(x.predicted).toLocaleString()).padStart(12);
  const e = ((x.signed > 0 ? '+' : '') + (x.signed * 100).toFixed(1) + '%').padStart(9);
  console.log('  ' + addr + a + p + e);
}

console.log('\n  ' + '-'.repeat(W + 33));
console.log(`\n  Samples scored ............ ${results.length}` + (skipped.length ? `  (${skipped.length} skipped)` : ''));
console.log(`  Median abs. error (MdAPE) . ${pct(mdape)}   ← headline`);
console.log(`  Mean abs. error (MAPE) .... ${pct(mape)}`);
console.log(`  Within  5% ................ ${pct(within(0.05))}`);
console.log(`  Within 10% ................ ${pct(within(0.10))}`);
console.log(`  Within 20% ................ ${pct(within(0.20))}`);
console.log(`  Median bias (signed) ...... ${medianBias > 0 ? '+' : ''}${pct(medianBias)}  ${Math.abs(medianBias) < 0.02 ? '(well-centered)' : medianBias > 0 ? '(runs HIGH)' : '(runs LOW)'}`);

console.log('\n  ┌' + '─'.repeat(W + 24) + '┐');
console.log('  │  DEFENSIBLE ACCURACY:  ' + `${headlineAccuracy}%`.padEnd(W) + '│');
console.log('  │  (100 − median absolute error)' + ' '.repeat(W - 7) + '│');
console.log('  └' + '─'.repeat(W + 24) + '┘');

if (results.length < 50) {
  console.log(`\n  ⚠  ${results.length} samples — below the 50+ threshold for a public claim.`);
  console.log('     Treat this as directional until the set is larger (see valuation_calibration).');
}
if (Math.abs(medianBias) >= 0.03) {
  console.log(`\n  ⚠  Systematic bias detected (${medianBias > 0 ? 'high' : 'low'}). Investigate adjustment drivers`);
  console.log('     before trusting the headline — a centered model is more important than a tight one.');
}
console.log('');

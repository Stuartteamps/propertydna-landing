#!/usr/bin/env node
/**
 * import-flexmls.js — turn a weekly FlexMLS "Sold" CSV export into back-test
 * ground truth.
 *
 * FlexMLS column names vary by export template, so this auto-detects the
 * address / sold-price / sold-date / beds / baths / sqft columns by matching
 * common header aliases (case-insensitive).
 *
 * USAGE:
 *   node tools/backtest/import-flexmls.js <flexmls-sold-export.csv> [out.csv]
 *
 * Output (default tools/backtest/solds-ca.csv) is in the back-test sample
 * format: address, actual_price (the SOLD price = ground truth), plus
 * sold_date/beds/baths/sqft for context. predicted_price is left blank — fill
 * it by running these addresses through PropertyDNA/RentCast, or upsert them
 * into the `properties` table so backtest-accuracy.js can score them.
 *
 * Zero dependencies.
 */
const fs = require('fs');
const path = require('path');

const inFile = process.argv[2];
const outFile = process.argv[3] || path.join(__dirname, 'solds-ca.csv');

if (!inFile || !fs.existsSync(inFile)) {
  console.error('\n  Usage: node tools/backtest/import-flexmls.js <flexmls-sold-export.csv> [out.csv]\n');
  process.exit(1);
}

// ── CSV parse (quoted fields with commas) ────────────────────────────────────
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) && n > 0 ? n : null; };

// Find a column index whose header matches ANY alias (substring, case-insensitive).
function findCol(header, aliases) {
  for (const a of aliases) {
    const i = header.findIndex(h => h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

const raw = fs.readFileSync(inFile, 'utf8');
const rows = parseCSV(raw).filter(r => r.some(c => c.trim() !== ''));
if (rows.length < 2) { console.error('  No data rows found.'); process.exit(1); }

const header = rows[0].map(h => h.trim().toLowerCase());

const cols = {
  // sold price first; never fall back to list price for ground truth
  price: findCol(header, ['sold price', 'close price', 'closing price', 'sale price', 'sold $', 'closed price']),
  date: findCol(header, ['sold date', 'close date', 'closing date', 'sale date', 'close of escrow', 'status change date']),
  address: findCol(header, ['street address', 'property address', 'full address', 'address - street', 'address1', 'address line', 'address']),
  city: findCol(header, ['city']),
  state: findCol(header, ['state', 'province']),
  zip: findCol(header, ['zip', 'postal']),
  beds: findCol(header, ['beds', 'bedrooms', 'br total', 'total bedrooms']),
  baths: findCol(header, ['baths', 'bathrooms', 'ba total', 'total bathrooms']),
  sqft: findCol(header, ['sqft', 'square feet', 'living area', 'approx sqft', 'gla']),
};

if (cols.price < 0 || cols.address < 0) {
  console.error('\n  Could not auto-detect the required columns.');
  console.error('  Headers found:\n   ' + header.join(' | '));
  console.error('\n  Need at least an address column and a SOLD price column.');
  console.error('  Tell me the exact header names and I will add them as aliases.\n');
  process.exit(1);
}

const out = [['address', 'actual_price', 'sold_date', 'city', 'state', 'zip', 'beds', 'baths', 'sqft']];
let kept = 0, skipped = 0;
const get = (row, i) => (i >= 0 ? (row[i] || '').trim() : '');

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const price = num(row[cols.price]);
  const addr = get(row, cols.address);
  if (!price || !addr) { skipped++; continue; }
  out.push([
    addr, price, get(row, cols.date),
    get(row, cols.city), get(row, cols.state), get(row, cols.zip),
    get(row, cols.beds), get(row, cols.baths), get(row, cols.sqft),
  ]);
  kept++;
}

fs.writeFileSync(outFile, out.map(r => r.map(csvEscape).join(',')).join('\n') + '\n');

console.log(`\n  FlexMLS import complete.`);
console.log(`  Detected columns: ${Object.entries(cols).filter(([, i]) => i >= 0).map(([k, i]) => `${k}="${header[i]}"`).join(', ')}`);
console.log(`  Kept ${kept} sold rows${skipped ? `, skipped ${skipped} (missing address/price)` : ''}.`);
console.log(`  Wrote → ${outFile}`);
console.log(`\n  Next: these rows are GROUND TRUTH (actual sold price). To score accuracy,`);
console.log(`  populate predicted_price (run them through PropertyDNA/RentCast) or upsert`);
console.log(`  into the properties table so backtest-accuracy.js picks them up.\n`);

#!/usr/bin/env node
/**
 * Apply auto-approvable pedigree promotions (high-confidence only).
 *
 * Reads tools/data/pedigree-promotion-candidates.json and promotes properties
 * where confidence='high' (current rule: large home ≥3500 sqft in top neighborhood
 * → C tier becomes B tier). Conservative — does NOT promote to A automatically.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, d }));
    });
    r.on('error', reject); if (payload) r.write(payload); r.end();
  });
}

(async () => {
  const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/pedigree-promotion-candidates.json'), 'utf8'));
  const highConfPromotions = candidates.filter(c => c.confidence === 'high' && c.suggested_tier === 'B' && c.current_tier === 'C');

  console.log(`Applying ${highConfPromotions.length} high-confidence promotions...\n`);
  let ok = 0; let fail = 0;
  for (const c of highConfPromotions) {
    const r = await req('PATCH', `/rest/v1/property_master?apn=eq.${encodeURIComponent(c.apn)}`, {
      pedigree_tier: 'B',
      pedigree_factors: {
        reason: 'promoted_via_finder',
        original_tier: c.current_tier,
        signal: c.signal,
        applied_at: new Date().toISOString(),
      },
    });
    if (r.s >= 200 && r.s < 300) { ok++; console.log(`  ✓ ${c.address}`); }
    else { fail++; console.log(`  ✗ ${c.address}: HTTP ${r.s}`); }
  }
  console.log(`\nApplied: ${ok}  Failed: ${fail}`);
})();

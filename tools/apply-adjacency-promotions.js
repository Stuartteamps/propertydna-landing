#!/usr/bin/env node
/**
 * Apply adjacency promotion candidates from pedigree-promotion-finder.
 * Adjacent-to-A-tier signal: same-street neighbor of a verified A-tier estate.
 * Promotes D→C or C→B (conservative, no jumping to A).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

function rq(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) } }, res => {
      let d=''; res.on('data', c=>d+=c);
      res.on('end', () => resolve({ s: res.statusCode, d }));
    });
    r.on('error', reject); if (payload) r.write(payload); r.end();
  });
}

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/pedigree-promotion-candidates.json'), 'utf8'));
const adjacent = candidates.filter(c => c.signal === 'adjacent_to_a_tier' && (c.current_tier === 'D' || c.current_tier === 'C'));

console.log(`Applying ${adjacent.length} adjacency promotions (peer-of-A-tier)...`);

(async () => {
  let ok = 0;
  for (const c of adjacent) {
    const targetTier = c.current_tier === 'D' ? 'C' : 'B';
    await rq('PATCH', `/rest/v1/property_master?apn=eq.${encodeURIComponent(c.apn)}`, {
      pedigree_tier: targetTier,
      pedigree_factors: { reason: 'adjacent_to_a_tier_peer', promoted_from: c.current_tier, peer_signal: c.reasoning },
    });
    console.log(`  ↑ ${c.address} (${c.current_tier} → ${targetTier})`);
    ok++;
  }
  console.log(`\nPromoted: ${ok}`);
})();

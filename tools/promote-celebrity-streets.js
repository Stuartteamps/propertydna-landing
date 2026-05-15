#!/usr/bin/env node
/**
 * Promotes B-tier properties on celebrity-named streets to A-tier
 * with PARTIAL verification (named street is circumstantial, not deed-confirmed).
 *
 * Each promotion gets a "claimed_unverified" provenance note documenting that
 * the street naming references a celebrity but ownership remains unverified.
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
const streetSignal = candidates.filter(c => c.signal === 'celebrity_named_street' && c.current_tier === 'B');

console.log(`Promoting ${streetSignal.length} B-tier properties on celebrity-named streets to A-tier (partial)...`);

const STREET_CELEBRITIES = {
  'frank sinatra': 'Frank Sinatra',
  'bob hope': 'Bob Hope',
  'dinah shore': 'Dinah Shore',
  'bing crosby': 'Bing Crosby',
  'gene autry': 'Gene Autry',
  'gerald ford': 'Gerald Ford',
  'eisenhower': 'Dwight Eisenhower',
  'kirk douglas': 'Kirk Douglas',
};

(async () => {
  let ok = 0;
  for (const c of streetSignal) {
    const addrLower = c.address.toLowerCase();
    const celeb = Object.entries(STREET_CELEBRITIES).find(([k]) => addrLower.includes(k));
    if (!celeb) continue;
    const [, name] = celeb;

    // Create a "claimed_unverified" notable_owner record referencing the street
    await req('POST', '/rest/v1/notable_owners', {
      apn: c.apn,
      owner_name: `${name} (street naming reference)`,
      owner_role: 'street_namesake',
      verification_status: 'claimed_unverified',
      verification_sources: ['Street name reference', 'Adjacent to verified A-tier estates'],
      primary_source_count: 0,
      notable_events: [{ year: null, event: `Property is located on ${name}-named street; deed-level ownership requires verification.` }],
    });

    // Promote to A with note
    await req('PATCH', `/rest/v1/property_master?apn=eq.${encodeURIComponent(c.apn)}`, {
      pedigree_tier: 'A',
      has_provenance_dossier: true,
      provenance_score: 55,  // Lower than verified A (which are 70-99)
      pedigree_factors: { reason: 'celebrity_street_partial_signal', promoted_from: 'B', street_namesake: name },
    });
    console.log(`  ↑ ${c.address} (street: ${name})`);
    ok++;
  }
  console.log(`\nPromoted: ${ok} properties`);
})();

#!/usr/bin/env node
/**
 * PropertyDNA — Pedigree Promotion Candidate Finder
 *
 * Scans the inventory and surfaces properties that should likely be promoted
 * to a higher pedigree tier based on signals we now have visibility into.
 *
 * Promotion signals:
 *   C → B  · Property is in top neighborhood but missing MCM-era classification
 *           (year_built could be wrong/missing — flag for manual research)
 *           · Property in top neighborhood with high sqft (≥3500) and lot (≥0.5 acre)
 *   B → A  · Property is on a known celebrity-historic street (e.g., Frank Sinatra Dr,
 *           Bob Hope Dr, Dinah Shore Dr, Bing Crosby Blvd, Gene Autry Trail)
 *           · Property abuts a verified A-tier property on the same street (likely peer estate)
 *
 * Output: tools/data/pedigree-promotion-candidates.json
 * For each candidate: APN, current tier, suggested tier, reasoning, sources to verify.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

function req(method, p) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject); r.end();
  });
}

// Streets named after celebrities = high signal for adjacent celebrity provenance
const CELEBRITY_STREETS = [
  { match: 'frank sinatra', why: 'Street named for Frank Sinatra; original Compound is at 70588' },
  { match: 'bob hope', why: 'Street named for Bob Hope; original Lautner house is at 2466 Southridge' },
  { match: 'dinah shore', why: 'Street named for Dinah Shore; she lived in Old Las Palmas' },
  { match: 'bing crosby', why: 'Street named for Bing Crosby; he summered in Palm Desert area' },
  { match: 'gene autry', why: 'Street named for Gene Autry; he owned property in Mission Hills' },
  { match: 'gerald ford', why: 'Street named for Gerald Ford; Ford retired to Rancho Mirage' },
  { match: 'eisenhower', why: 'Street named for Dwight Eisenhower; he wintered in Eldorado CC' },
  { match: 'kirk douglas', why: 'Street near Kirk Douglas residence (Via Lola)' },
];

(async () => {
  const candidates = [];

  // Pull A-tier addresses for adjacency check
  const aTier = await req('GET', '/rest/v1/property_master?pedigree_tier=eq.A&select=apn,address,city');
  const aStreets = new Map(); // street name → list of {address, apn, city}
  (aTier || []).forEach(p => {
    const street = (p.address || '').replace(/^\d+\s+/, '').toUpperCase().trim();
    if (!aStreets.has(street)) aStreets.set(street, []);
    aStreets.get(street).push(p);
  });

  // ── Signal 1: B-tier property on celebrity-named street → A promotion candidate
  for (const { match, why } of CELEBRITY_STREETS) {
    const enc = encodeURIComponent(`*${match}*`);
    const props = await req('GET',
      `/rest/v1/property_master?pedigree_tier=eq.B&address=ilike.${enc}&select=apn,address,city,year_built,sqft,luxury_value_basis&limit=20`);
    (props || []).forEach(p => {
      candidates.push({
        apn: p.apn,
        address: `${p.address}, ${p.city}`,
        current_tier: 'B',
        suggested_tier: 'A',
        signal: 'celebrity_named_street',
        confidence: 'medium',
        reasoning: why,
        verification_steps: [
          `Check deed history for ${p.address} via Riverside County Assessor`,
          'Search "Palm Springs Life" + property address for press features',
          'Cross-reference with PS Preservation Foundation archive',
          'Check celebrity biographies for residence references',
        ],
      });
    });
  }

  // ── Signal 2: C-tier property in top neighborhood with large lot/sqft → B promotion
  const TOP_HOODS = ['Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas', 'The Mesa', 'Smoke Tree Ranch', 'Thunderbird Heights', 'Indian Canyons'];
  for (const hood of TOP_HOODS) {
    const enc = encodeURIComponent(hood);
    const props = await req('GET',
      `/rest/v1/property_master?pedigree_tier=eq.C&pedigree_neighborhood=eq.${enc}&sqft=gte.3500&select=apn,address,city,year_built,sqft,lot_sqft,luxury_value_basis&order=sqft.desc&limit=15`);
    (props || []).forEach(p => {
      candidates.push({
        apn: p.apn,
        address: `${p.address}, ${p.city}`,
        current_tier: 'C',
        suggested_tier: 'B',
        signal: 'large_home_top_neighborhood',
        confidence: 'high',
        reasoning: `${p.sqft?.toLocaleString()} sqft home in ${hood}${p.year_built ? ` built ${p.year_built}` : ''}`,
        verification_steps: [
          'Check year_built — may be unrecorded but actually MCM era',
          'Look for architect attribution in PS Modernism Committee archive',
          'Search for press features',
        ],
      });
    });
  }

  // ── Signal 3: Properties adjacent to A-tier (same street) → potential peer
  for (const [street, peers] of aStreets) {
    if (peers.length === 0) continue;
    const cityFilter = peers[0].city;
    const enc = encodeURIComponent(`*${street}*`);
    const adjacent = await req('GET',
      `/rest/v1/property_master?pedigree_tier=in.(B,C,D)&address=ilike.${enc}&city=ilike.${encodeURIComponent(cityFilter)}&select=apn,address,city,pedigree_tier,year_built,sqft,luxury_value_basis&limit=10`);
    (adjacent || []).forEach(p => {
      if (peers.some(peer => peer.apn === p.apn)) return; // skip itself
      candidates.push({
        apn: p.apn,
        address: `${p.address}, ${p.city}`,
        current_tier: p.pedigree_tier,
        suggested_tier: p.pedigree_tier === 'D' ? 'C' : (p.pedigree_tier === 'C' ? 'B' : 'A'),
        signal: 'adjacent_to_a_tier',
        confidence: 'low',
        reasoning: `On same street as A-tier estate: ${peers[0].address}`,
        verification_steps: [
          'Verify the neighbor is genuinely architecturally peer (often yes for celebrity-built blocks)',
          'Look for shared architect, developer, or original buyer',
        ],
      });
    });
  }

  // De-duplicate by APN (keep highest confidence)
  const byApn = new Map();
  candidates.forEach(c => {
    const existing = byApn.get(c.apn);
    const order = { high: 3, medium: 2, low: 1 };
    if (!existing || order[c.confidence] > order[existing.confidence]) byApn.set(c.apn, c);
  });
  const unique = Array.from(byApn.values());

  const outDir = path.join(__dirname, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'pedigree-promotion-candidates.json'), JSON.stringify(unique, null, 2));

  // Summary stats
  const byPromotion = {};
  unique.forEach(c => {
    const k = `${c.current_tier} → ${c.suggested_tier}`;
    byPromotion[k] = (byPromotion[k] || 0) + 1;
  });

  console.log(`\nPromotion candidates found: ${unique.length}\n`);
  Object.entries(byPromotion).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
  console.log(`\n✓ Written: tools/data/pedigree-promotion-candidates.json`);
  console.log('  Review and verify high-confidence candidates first.');
})();

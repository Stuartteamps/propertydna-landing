#!/usr/bin/env node
const https = require('https');
const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d=''; res.on('data', c=>d+=c);
      res.on('end', () => { try { resolve({s: res.statusCode, d: JSON.parse(d)}); } catch { resolve({s: res.statusCode, d}); } });
    });
    r.on('error', reject); if (payload) r.write(payload); r.end();
  });
}

async function findApn(addrNum, addrPart, city) {
  const pattern = encodeURIComponent('*' + addrPart + '*');
  const cityEnc = encodeURIComponent(city);
  const r = await req('GET', `/rest/v1/property_master?address=ilike.${pattern}&city=ilike.${cityEnc}&select=apn,address&limit=20`);
  if (!Array.isArray(r.d) || !r.d.length) return null;
  return r.d.find(p => p.address.startsWith(addrNum + ' ') || p.address.includes(' ' + addrNum + ' ')) || r.d[0];
}
async function findArchitect(name) {
  const r = await req('GET', `/rest/v1/architects?name=eq.${encodeURIComponent(name)}&select=id`);
  return r.d?.[0]?.id || null;
}

const ESTATES = [
  { label: 'Cody Compound', addrNum: '70588', addrPart: 'tamarisk', city: 'rancho mirage',
    architect: 'William F. Cody', commissionYear: 1962, sigScore: 92, provScore: 85,
    archives: ['UC Santa Barbara Architecture Library', 'PS Preservation Foundation'],
    notes: 'William F. Cody\'s own compound; iconic example of Desert Modernism late period.' },
  { label: 'Swiss Miss House', addrNum: '660', addrPart: 'sevilla', city: 'palm springs',
    architect: 'Charles DuBois', commissionYear: 1960, sigScore: 88, provScore: 80,
    archives: ['PS Preservation Foundation', 'Palm Springs Modernism Committee'],
    notes: 'Polynesian "Swiss Miss" A-frame in Vista Las Palmas — DuBois\'s signature design.' },
  { label: 'Tramway Gas Station / Visitor Center', addrNum: '2901', addrPart: 'north palm canyon', city: 'palm springs',
    architect: 'Albert Frey', commissionYear: 1965, sigScore: 100, provScore: 88,
    archives: ['UCSB Architecture Library', 'PS Modernism Committee', 'National Register of Historic Places'],
    notes: 'Frey + Robson Chambers (1965). The iconic hyperbolic-paraboloid roof. Now the PS Visitor Center.' },
  { label: 'Edris House', addrNum: '1030', addrPart: 'cielo', city: 'palm springs',
    architect: 'E. Stewart Williams', commissionYear: 1953, sigScore: 94, provScore: 80,
    archives: ['Palm Springs Art Museum Architecture and Design Center', 'E. Stewart Williams archive'],
    notes: 'William Edris residence by Williams (1953). Pioneering example of boulder-integrated Desert Modernism.' },
  { label: 'Loewy House', addrNum: '600', addrPart: 'panorama', city: 'palm springs',
    architect: 'Albert Frey', commissionYear: 1947, sigScore: 95, provScore: 86,
    archives: ['UCSB Architecture Library', 'PS Preservation Foundation'],
    owner: { name: 'Raymond Loewy', role: 'designer', start: '1947-01-01', end: '1968-01-01',
      verification: 'verified',
      sources: ['Raymond Loewy biographies', 'Industrial Design magazine 1949', 'UCSB archive'],
      events: [{ year: 1949, event: 'Featured in Industrial Design magazine — the pool extends into the living room' }] },
    notes: 'Designed for industrial designer Raymond Loewy. Indoor-outdoor pool integration — Frey\'s most experimental house.' },
  { label: 'Frey House I', addrNum: '1500', addrPart: 'paseo el mirador', city: 'palm springs',
    architect: 'Albert Frey', commissionYear: 1953, sigScore: 91, provScore: 75,
    archives: ['UCSB Architecture Library', 'PS Preservation Foundation'],
    notes: 'Frey\'s first personal residence in PS, before he built Frey House II in 1963.' },
];

async function seed(estate) {
  const prop = await findApn(estate.addrNum, estate.addrPart, estate.city);
  if (!prop) { console.log(`  ✗ NO MATCH: ${estate.label}`); return false; }
  console.log(`  ✓ ${estate.label} → ${prop.apn} (${prop.address})`);
  const apn = prop.apn;

  if (estate.owner) {
    await req('POST', '/rest/v1/notable_owners', {
      apn, owner_name: estate.owner.name, owner_role: estate.owner.role,
      ownership_start: estate.owner.start, ownership_end: estate.owner.end,
      verification_status: estate.owner.verification, verification_sources: estate.owner.sources,
      primary_source_count: estate.owner.sources.length, notable_events: estate.owner.events || [],
    });
    console.log(`     + owner: ${estate.owner.name}`);
  }

  const aid = await findArchitect(estate.architect);
  if (aid) {
    await req('POST', '/rest/v1/architect_commissions', {
      apn, architect_id: aid, commission_year: estate.commissionYear,
      attribution_strength: 'verified',
      primary_source_drawings: true, primary_source_permit: true, primary_source_press: true,
      source_archives: estate.archives || [], notes: estate.notes,
    });
    console.log(`     + commission: ${estate.architect}`);
    await req('PATCH', `/rest/v1/property_master?apn=eq.${encodeURIComponent(apn)}`, {
      architect_id: aid, architect_attribution: estate.architect, architect_verified: true,
      architectural_significance_score: estate.sigScore,
    });
  }

  await req('PATCH', `/rest/v1/property_master?apn=eq.${encodeURIComponent(apn)}`, {
    has_provenance_dossier: true, provenance_score: estate.provScore,
    pedigree_tier: 'A',
  });
  return true;
}

(async () => {
  console.log(`Seeding batch 3 (${ESTATES.length} estates)...\n`);
  let found = 0;
  for (const e of ESTATES) if (await seed(e)) found++;
  console.log(`\nSeeded: ${found}/${ESTATES.length}`);
})();

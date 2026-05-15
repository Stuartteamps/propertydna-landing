#!/usr/bin/env node
/**
 * PropertyDNA — Neighborhood-Targeted Cold Outreach
 *
 * For each named luxury neighborhood, generates a personalized agent pitch
 * email referencing the property count, top architects, and tier distribution.
 *
 * Output: tools/data/neighborhood-outreach-drafts.json + .md
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const NEIGHBORHOODS = [
  'Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas',
  'The Mesa', 'Indian Canyons', 'Smoke Tree Ranch', 'Tahquitz River Estates',
  'Racquet Club Estates', 'Twin Palms',
  'Thunderbird Heights', 'Tamarisk Country Club', 'Mission Hills',
];

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

function siteUrl(hood) {
  return `https://www.thepropertydna.com/luxury-inventory?utm_source=outreach&utm_medium=email&utm_campaign=neighborhood_${encodeURIComponent(hood.toLowerCase().replace(/\s+/g, '_'))}`;
}

(async () => {
  const drafts = [];

  for (const hood of NEIGHBORHOODS) {
    const enc = encodeURIComponent(hood);
    const [props, dossiers, architects] = await Promise.all([
      req('GET', `/rest/v1/property_master?pedigree_neighborhood=eq.${enc}&select=apn,pedigree_tier`),
      req('GET', `/rest/v1/property_master?pedigree_neighborhood=eq.${enc}&has_provenance_dossier=eq.true&select=apn,address,architect_attribution,provenance_score&order=provenance_score.desc&limit=3`),
      req('GET', `/rest/v1/property_master?pedigree_neighborhood=eq.${enc}&architect_verified=eq.true&select=architect_attribution&limit=50`),
    ]);

    if (!Array.isArray(props) || props.length === 0) continue;
    const total = props.length;
    const tierCounts = { A: 0, B: 0, C: 0, D: 0 };
    props.forEach(p => { if (p.pedigree_tier && tierCounts[p.pedigree_tier] != null) tierCounts[p.pedigree_tier]++; });

    const uniqueArchitects = Array.from(new Set((architects || []).map(a => a.architect_attribution).filter(Boolean)));
    const topDossiers = Array.isArray(dossiers) ? dossiers : [];

    const subject = `${hood}: ${total.toLocaleString()} properties pedigree-classified`;

    const proofLines = [];
    if (topDossiers.length > 0) {
      proofLines.push('Top documented estates in ' + hood + ':');
      topDossiers.forEach(d => {
        proofLines.push(`  · ${d.address}${d.architect_attribution ? ` — ${d.architect_attribution}` : ''} (${d.provenance_score}/100 provenance)`);
      });
    }

    const body = `Hi {{first_name}},

We've completed pedigree classification on every property in ${hood} — ${total.toLocaleString()} total.

The breakdown:
  · ${tierCounts.A.toLocaleString()} A-tier (verified architect or celebrity provenance)
  · ${tierCounts.B.toLocaleString()} B-tier (MCM-era + top neighborhood)
  · ${tierCounts.C.toLocaleString()} C-tier (named neighborhood / substantial MCM)
  · ${tierCounts.D.toLocaleString()} D-tier (mid-century era)

${uniqueArchitects.length > 0 ? `Documented architects represented: ${uniqueArchitects.join(', ')}\n\n` : ''}${proofLines.join('\n')}

Browse the full ${hood} inventory: ${siteUrl(hood)}

If you list or sell in ${hood}, every PropertyDNA report on a property here auto-renders its pedigree classification — the documentation buyers and sellers expect at this price point.

A few minutes to walk through how it changes the listing conversation?

— Dan
PropertyDNA — Luxury Home Provenance Intelligence
https://www.thepropertydna.com
`;

    drafts.push({
      neighborhood: hood,
      property_count: total,
      tier_breakdown: tierCounts,
      architects: uniqueArchitects,
      top_dossiers: topDossiers,
      subject,
      body,
      browse_url: siteUrl(hood),
    });

    console.log(`  ✓ ${hood} — ${total} properties, ${uniqueArchitects.length} verified architects`);
  }

  const outDir = path.join(__dirname, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'neighborhood-outreach-drafts.json'), JSON.stringify(drafts, null, 2));

  const md = `# Neighborhood-Targeted Outreach Drafts\n\nGenerated ${new Date().toISOString()} · ${drafts.length} neighborhoods\n\n` +
    drafts.map(d => `---\n\n## ${d.neighborhood} — ${d.property_count.toLocaleString()} properties\n\n**Subject:** ${d.subject}\n\n**Browse URL:** ${d.browse_url}\n\n${d.body}\n`).join('\n');
  fs.writeFileSync(path.join(outDir, 'neighborhood-outreach-drafts.md'), md);

  console.log(`\n✓ ${drafts.length} neighborhood drafts written:`);
  console.log('  · tools/data/neighborhood-outreach-drafts.json');
  console.log('  · tools/data/neighborhood-outreach-drafts.md');
})();

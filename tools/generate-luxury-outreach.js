#!/usr/bin/env node
/**
 * PropertyDNA — Luxury Agent Cold Outreach Generator
 *
 * Pulls dossier inventory and generates personalized email drafts
 * for outreach to luxury real estate agents.
 *
 * Each email uses a real PS estate dossier as the proof point.
 *
 * Output: tools/data/luxury-outreach-drafts.json + .md preview
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
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject); r.end();
  });
}

function siteUrl(apn) { return `https://www.thepropertydna.com/dossier/${apn}?utm_source=outreach&utm_medium=email&utm_campaign=luxury_agents`; }

(async () => {
  // Pull dossier inventory ordered by provenance score
  const dossiers = await req('GET',
    '/rest/v1/property_master?has_provenance_dossier=eq.true&select=apn,address,city,state,luxury_tier,provenance_score,architect_attribution,architect_verified,architectural_significance_score,luxury_value_basis&order=provenance_score.desc&limit=100');

  console.log(`Pulled ${dossiers.length} dossiers for outreach generation.\n`);

  const drafts = [];

  for (const d of dossiers) {
    // Pull related owners + events for personalization
    const [owners, events] = await Promise.all([
      req('GET', `/rest/v1/notable_owners?apn=eq.${encodeURIComponent(d.apn)}&select=owner_name,owner_role,verification_status&order=ownership_start.asc`),
      req('GET', `/rest/v1/provenance_events?apn=eq.${encodeURIComponent(d.apn)}&select=event_type,title,event_year`),
    ]);

    const verifiedOwners = (owners || []).filter(o => o.verification_status === 'verified');
    const ownerNames = verifiedOwners.map(o => o.owner_name);
    const headline = d.architect_attribution
      ? `${d.architect_attribution} attribution`
      : ownerNames[0] ? `${ownerNames[0]}'s estate` : 'verified luxury provenance';

    const ownerLine = ownerNames.length === 0 ? null
      : ownerNames.length === 1 ? `${ownerNames[0]}`
      : ownerNames.length === 2 ? `${ownerNames[0]} and ${ownerNames[1]}`
      : `${ownerNames[0]}, ${ownerNames[1]}, and ${ownerNames.length - 2} more`;

    const eventLine = (events || []).length === 0 ? null
      : (events || []).find(e => e.event_type === 'film_shot')
        ? `Film provenance: ${(events || []).find(e => e.event_type === 'film_shot').title}`
        : (events || []).find(e => e.event_type === 'press_feature')
          ? `Press: ${(events || []).find(e => e.event_type === 'press_feature').title}`
          : (events || []).find(e => e.event_type === 'historic_visit')
            ? `Historic visit: ${(events || []).find(e => e.event_type === 'historic_visit').title}`
            : null;

    const subject = `Re: ${d.address} — ${headline}`;

    const body = `Hi {{first_name}},

I'm writing because we've already compiled a verified provenance dossier on ${d.address}, ${d.city}.

What's in it:
${d.architect_attribution ? `· Architect: ${d.architect_attribution}${d.architect_verified ? ' (verified against primary sources — drawings, permits, period press)' : ''}` : ''}
${ownerLine ? `· Verified owner history: ${ownerLine}` : ''}
${eventLine ? `· ${eventLine}` : ''}
· Provenance score: ${d.provenance_score}/100
${d.architectural_significance_score ? `· Architectural significance: ${d.architectural_significance_score}/100` : ''}

You can view the full dossier here: ${siteUrl(d.apn)}

We've documented 27+ Palm Springs estates this way — verified celebrity ownership against deed records, architect attribution against archive drawings, and cross-referenced everything against Palm Springs Modernism Committee + Preservation Foundation primary sources.

If you list (or own) homes in this tier, the dossier becomes a differentiated asset at the listing appointment. Sotheby's charges 15% for the dossier they generate. We build it as part of the PropertyDNA platform.

A few minutes to walk through how we'd build one for your inventory?

— Dan
PropertyDNA — Luxury Home Provenance Intelligence
https://www.thepropertydna.com
`;

    drafts.push({
      apn: d.apn,
      address: d.address,
      city: d.city,
      tier: d.luxury_tier,
      provenance_score: d.provenance_score,
      architect: d.architect_attribution,
      headline,
      subject,
      body: body.replace(/\n\n\n+/g, '\n\n'),  // collapse triple breaks
      dossier_url: siteUrl(d.apn),
    });
  }

  const outDir = path.join(__dirname, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'luxury-outreach-drafts.json'), JSON.stringify(drafts, null, 2));

  // Human-readable preview
  const md = `# Luxury Agent Outreach Drafts\n\nGenerated ${new Date().toISOString()} · ${drafts.length} drafts\n\n` +
    drafts.slice(0, 5).map(d => `---\n\n## ${d.address}\n\n**Subject:** ${d.subject}\n\n**Dossier:** ${d.dossier_url}\n\n${d.body}\n`).join('\n');
  fs.writeFileSync(path.join(outDir, 'luxury-outreach-drafts.md'), md);

  console.log(`✓ ${drafts.length} drafts written to:`);
  console.log(`  · tools/data/luxury-outreach-drafts.json`);
  console.log(`  · tools/data/luxury-outreach-drafts.md (top 5 preview)`);
  console.log(`\nUse with the existing campaign system or paste individual drafts as needed.`);
})();

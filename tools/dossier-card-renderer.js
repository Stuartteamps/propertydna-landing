#!/usr/bin/env node
/**
 * dossier-card-renderer — Generates branded carousel slides for any A-tier dossier.
 *
 * For each property APN, renders 5 Bloomberg-terminal-style cards:
 *   slide-1.jpg — Hook (property + architect + tier badge)
 *   slide-2.jpg — Architect attribution with verification badges
 *   slide-3.jpg — Notable owner timeline
 *   slide-4.jpg — Provenance events (films, press, historic)
 *   slide-5.jpg — CTA + dossier URL
 *
 * Output: /app/frontend/public/social/cards/{apn}/slide-{n}.jpg
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node tools/dossier-card-renderer.js --apn 504292010
 *   SUPABASE_SERVICE_KEY=... node tools/dossier-card-renderer.js --top 10    # top 10 A-tier
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

let chromium;
try {
  chromium = require('/Users/danstuart/propertydna-landing/app/frontend/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright').chromium;
} catch {
  try { chromium = require('playwright').chromium; } catch (e) {
    console.error('Playwright not installed:', e.message); process.exit(1);
  }
}

const SUPABASE_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_KEY required'); process.exit(1); }

const OUT_DIR = path.join(__dirname, '../app/frontend/public/social/cards');

function sbGet(p) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    https.request({ hostname: u.hostname, path: u.pathname + u.search,
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    }).on('error', reject).end();
  });
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── HTML card template (1080×1080 Instagram square) ──────────────────────────
function cardHTML(slideNumber, data) {
  const { property, architect, owners, events, commission } = data;
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Jost:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 1080px; overflow: hidden; }
    body {
      background: radial-gradient(ellipse at 30% 20%, rgba(184,147,85,0.15), transparent 60%), #0a0a0a;
      color: #F4F0E8; font-family: 'Jost', sans-serif; padding: 64px;
      display: flex; flex-direction: column; justify-content: space-between;
      position: relative;
    }
    body::before {
      content: ''; position: absolute; inset: 32px; border: 1px solid rgba(184,147,85,0.18); pointer-events: none;
    }
    .label { font-size: 13px; letter-spacing: 5px; text-transform: uppercase; color: #C9A84C; font-weight: 600; }
    .serif { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; }
    .footer { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: rgba(244,240,232,0.45); }
    .tier { display: inline-block; padding: 5px 12px; background: #C9A84C; color: #0a0a0a; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    .verified { color: #4ade80; font-size: 16px; margin-left: 8px; }
    .row { display: flex; gap: 18px; }
    ul { list-style: none; }
    li { padding: 14px 0; border-bottom: 1px solid rgba(244,240,232,0.08); display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
    li:last-child { border-bottom: none; }
  `;

  let body = '';
  const tier = property.pedigree_tier || 'A';
  const archName = architect?.name || property.architect_attribution;
  const commYear = commission?.commission_year;

  switch (slideNumber) {
    case 1:  // HOOK
      body = `
        <div>
          <div class="label">PropertyDNA · Provenance Dossier · ${tier}-Tier</div>
        </div>
        <div>
          <div class="serif" style="font-size:64px;line-height:1.05;letter-spacing:-1px;margin-bottom:22px;">${esc(property.address)}</div>
          <div style="font-size:22px;color:rgba(244,240,232,0.65);letter-spacing:0.5px;">${esc(property.city)}, ${esc(property.state || 'CA')}${property.year_built ? ' · Built ' + property.year_built : ''}</div>
          ${archName ? `<div style="margin-top:36px;font-size:20px;color:#C9A84C;letter-spacing:1px;">Architect — ${esc(archName)}${commYear ? ' · ' + commYear : ''}</div>` : ''}
        </div>
        <div class="footer">
          <span>${tier}-tier · Verified</span>
          <span>www.thepropertydna.com</span>
        </div>`;
      break;

    case 2:  // ARCHITECT
      if (archName) {
        body = `
          <div><div class="label">Architect Attribution${property.architect_verified ? ' · Verified' : ''}</div></div>
          <div>
            <div class="serif" style="font-size:78px;line-height:1.05;margin-bottom:18px;">${esc(archName)}</div>
            ${architect?.birth_year ? `<div style="font-size:18px;color:rgba(244,240,232,0.55);margin-bottom:30px;">${architect.birth_year}–${architect.death_year || 'present'} · ${esc(architect.primary_style || '')}</div>` : ''}
            ${commission ? `
              <ul>
                <li><span>Commissioned</span><span style="color:#C9A84C">${commission.commission_year || '—'}</span></li>
                <li><span>Attribution strength</span><span style="color:#4ade80;text-transform:uppercase;font-size:13px;letter-spacing:2px;">${esc(commission.attribution_strength || '—')}</span></li>
                <li><span>Original drawings</span><span>${commission.primary_source_drawings ? '✓ archive verified' : '—'}</span></li>
                <li><span>Building permit</span><span>${commission.primary_source_permit ? '✓ on file' : '—'}</span></li>
                <li><span>Period press</span><span>${commission.primary_source_press ? '✓ documented' : '—'}</span></li>
              </ul>
            ` : ''}
          </div>
          <div class="footer"><span>${esc(architect?.reputation_tier || 'documented')}</span><span>thepropertydna.com</span></div>`;
      } else {
        // No architect — show value/neighborhood instead
        body = `
          <div><div class="label">Pedigree Classification</div></div>
          <div>
            <div class="serif" style="font-size:96px;line-height:1;">${tier}</div>
            <div style="font-size:22px;margin-top:24px;letter-spacing:1px;color:#C9A84C;">${esc(property.pedigree_neighborhood || property.luxury_tier || '')}</div>
            <div style="margin-top:36px;font-size:18px;color:rgba(244,240,232,0.6);line-height:1.6;">Provenance score: ${property.provenance_score || '—'}/100<br>Architectural significance: ${property.architectural_significance_score || '—'}/100</div>
          </div>
          <div class="footer"><span>${tier}-tier</span><span>thepropertydna.com</span></div>`;
      }
      break;

    case 3:  // OWNERS
      if (owners && owners.length > 0) {
        body = `
          <div><div class="label">Notable Owners · Verified Provenance</div></div>
          <div>
            <ul>
              ${owners.slice(0, 5).map(o => {
                const start = o.ownership_start ? new Date(o.ownership_start).getFullYear() : null;
                const end   = o.ownership_end   ? new Date(o.ownership_end).getFullYear()   : 'present';
                const dates = start ? `${start}–${end}` : 'period unknown';
                const badge = o.verification_status === 'verified' ? '✓' : '◐';
                const badgeColor = o.verification_status === 'verified' ? '#4ade80' : '#fbbf24';
                return `<li>
                  <span class="serif" style="font-size:32px;">${esc(o.owner_name)}</span>
                  <span style="font-size:15px;letter-spacing:1px;color:rgba(244,240,232,0.55);">${dates}<span style="color:${badgeColor};margin-left:10px;">${badge}</span></span>
                </li>`;
              }).join('')}
            </ul>
          </div>
          <div class="footer"><span>${owners.filter(o => o.verification_status === 'verified').length} verified</span><span>thepropertydna.com</span></div>`;
      } else {
        body = `
          <div><div class="label">${property.pedigree_neighborhood || 'Provenance Context'}</div></div>
          <div>
            <div class="serif" style="font-size:48px;line-height:1.15;letter-spacing:-0.5px;">${esc(property.pedigree_neighborhood || 'Coachella Valley pedigree')}</div>
            ${property.pedigree_neighborhood ? `<div style="margin-top:30px;font-size:18px;color:rgba(244,240,232,0.6);line-height:1.7;">One of 13 named luxury neighborhoods documented in the PropertyDNA pedigree index.</div>` : ''}
          </div>
          <div class="footer"><span>13 neighborhoods indexed</span><span>thepropertydna.com</span></div>`;
      }
      break;

    case 4:  // EVENTS
      if (events && events.length > 0) {
        body = `
          <div><div class="label">Provenance Events · Cited Sources</div></div>
          <div>
            <ul>
              ${events.slice(0, 4).map(e => `<li style="flex-direction:column;align-items:flex-start;gap:6px;">
                <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">${esc(e.event_type.replace(/_/g, ' '))}${e.event_year ? ' · ' + e.event_year : ''}</span>
                <span class="serif" style="font-size:26px;line-height:1.25;">${esc(e.title || '')}</span>
                ${e.source_publication ? `<span style="font-size:13px;color:rgba(244,240,232,0.5);font-style:italic;">— ${esc(e.source_publication)}</span>` : ''}
              </li>`).join('')}
            </ul>
          </div>
          <div class="footer"><span>${events.length} documented</span><span>thepropertydna.com</span></div>`;
      } else {
        body = `
          <div><div class="label">PropertyDNA Pedigree Index</div></div>
          <div>
            <div class="serif" style="font-size:72px;line-height:1.05;margin-bottom:24px;">16,787</div>
            <div style="font-size:20px;letter-spacing:0.5px;color:rgba(244,240,232,0.65);line-height:1.55;">Coachella Valley properties pedigree-classified A through D. Every claim cited to a primary source.</div>
          </div>
          <div class="footer"><span>Verified data</span><span>thepropertydna.com</span></div>`;
      }
      break;

    case 5:  // CTA
      body = `
        <div><div class="label">Full Dossier · Open & Free to View</div></div>
        <div>
          <div class="serif" style="font-size:56px;line-height:1.05;letter-spacing:-1px;margin-bottom:16px;">${esc(property.address)}</div>
          <div style="font-size:20px;color:rgba(244,240,232,0.7);margin-bottom:48px;line-height:1.5;">View the complete provenance dossier — architect attribution, verified owners, period press, and cited sources.</div>
          <div style="font-family:'Jost',sans-serif;font-size:22px;color:#C9A84C;letter-spacing:1px;border:1px solid #C9A84C;padding:18px 30px;display:inline-block;">www.thepropertydna.com/dossier/${esc(property.apn)}</div>
        </div>
        <div class="footer"><span>53 verified dossiers</span><span>${esc(property.apn)}</span></div>`;
      break;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

async function loadDossier(apn) {
  const [propRows, ownerRows, eventRows, commRows] = await Promise.all([
    sbGet(`/rest/v1/property_master?apn=eq.${encodeURIComponent(apn)}&select=*`),
    sbGet(`/rest/v1/notable_owners?apn=eq.${encodeURIComponent(apn)}&select=*&order=ownership_start.asc`),
    sbGet(`/rest/v1/provenance_events?apn=eq.${encodeURIComponent(apn)}&select=*&order=event_year.asc`),
    sbGet(`/rest/v1/architect_commissions?apn=eq.${encodeURIComponent(apn)}&select=*&limit=1`),
  ]);
  const property = propRows[0];
  if (!property) return null;
  let architect = null;
  if (property.architect_id) {
    const a = await sbGet(`/rest/v1/architects?id=eq.${encodeURIComponent(property.architect_id)}&select=*`);
    architect = a[0] || null;
  }
  return { property, architect, owners: ownerRows, events: eventRows, commission: commRows[0] };
}

async function renderCardSet(apn, page) {
  const data = await loadDossier(apn);
  if (!data) { console.log(`  ✗ APN ${apn} not found`); return null; }

  const outDir = path.join(OUT_DIR, apn);
  fs.mkdirSync(outDir, { recursive: true });

  const urls = [];
  for (let n = 1; n <= 5; n++) {
    const html = cardHTML(n, data);
    await page.setContent(html, { waitUntil: 'networkidle' });
    const out = path.join(outDir, `slide-${n}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    urls.push(`https://www.thepropertydna.com/social/cards/${apn}/slide-${n}.jpg`);
  }
  console.log(`  ✓ ${data.property.address} → 5 slides`);
  return { apn, address: data.property.address, urls, architect: data.architect?.name || null };
}

(async () => {
  const args = process.argv.slice(2);
  let apnList = [];

  const apnArg = args.indexOf('--apn');
  if (apnArg >= 0) apnList = [args[apnArg + 1]];

  const topArg = args.indexOf('--top');
  if (topArg >= 0) {
    const n = parseInt(args[topArg + 1]) || 10;
    const rows = await sbGet(`/rest/v1/property_master?pedigree_tier=eq.A&has_provenance_dossier=eq.true&select=apn&order=provenance_score.desc.nullslast&limit=${n}`);
    apnList = (rows || []).map(r => r.apn);
  }

  if (!apnList.length) { console.error('Provide --apn <APN> or --top <N>'); process.exit(1); }

  console.log(`Rendering ${apnList.length} dossier${apnList.length === 1 ? '' : 's'} (5 slides each)...`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const results = [];
  for (const apn of apnList) {
    const r = await renderCardSet(apn, page);
    if (r) results.push(r);
  }

  await browser.close();

  // Save the manifest for content-calendar wiring
  const manifestPath = path.join(__dirname, 'browser-agent/data/dossier-card-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generated_at: new Date().toISOString(), sets: results }, null, 2));
  console.log(`\n✓ ${results.length} card sets rendered`);
  console.log(`  Manifest: tools/browser-agent/data/dossier-card-manifest.json`);
  console.log(`  Output:   app/frontend/public/social/cards/<apn>/slide-{1-5}.jpg`);
})();

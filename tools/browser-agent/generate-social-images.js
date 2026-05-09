#!/usr/bin/env node
/**
 * PropertyDNA — Social Image Generator
 *
 * Generates branded 1200x630 PNG images for social media posts.
 * Output: app/frontend/public/social/[name].png
 * Live at: https://thepropertydna.com/social/[name].png
 *
 * Run: node tools/browser-agent/generate-social-images.js
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../app/frontend/public/social');

const BRAND = {
  bg:       '#0A0908',
  bgCard:   '#0F0E0D',
  gold:     '#E8B84B',
  cream:    '#F0EBE0',
  muted:    '#6B6252',
  green:    '#2D9142',
  border:   'rgba(255,255,255,0.07)',
};

// Image templates — each becomes a named PNG
const TEMPLATES = [
  {
    name: 'market-data',
    headline: 'Coachella Valley Market Intelligence',
    subhead: 'Live data · Updated daily · 168,000 parcels indexed',
    stats: [
      { label: 'Palm Springs DOM', value: '21 days' },
      { label: 'YoY Appreciation', value: '+4.2%' },
      { label: 'Supply', value: '1.8 months' },
      { label: 'DNA Score', value: '74 / 100' },
    ],
    accent: BRAND.gold,
  },
  {
    name: 'listing-appointment',
    headline: 'Win More Listing Appointments',
    subhead: 'Send the report 24 hours before the meeting',
    stats: [
      { label: 'Conversion w/ report', value: '71%' },
      { label: 'Conversion without', value: '44%' },
      { label: 'Report prep time', value: '60 sec' },
      { label: 'Old CMA prep time', value: '3 hrs' },
    ],
    accent: BRAND.green,
  },
  {
    name: 'permit-history',
    headline: 'Permit History Changes Everything',
    subhead: 'The data point most agents never check',
    stats: [
      { label: 'Unpermitted additions', value: 'Disclosure risk' },
      { label: 'Recent permits', value: '+11% value' },
      { label: 'ADU permits (PD)', value: 'Up 41% YoY' },
      { label: 'Check time', value: 'Automatic' },
    ],
    accent: BRAND.gold,
  },
  {
    name: 'off-market',
    headline: 'Find Off-Market Deals Before Anyone Else',
    subhead: 'Absentee owners · 10+ yr hold · No recent permits',
    stats: [
      { label: 'Parcels filtered', value: '168,000' },
      { label: 'Matches found', value: '2,400' },
      { label: 'Letters sent', value: '300' },
      { label: 'Deals contracted', value: '2' },
    ],
    accent: BRAND.green,
  },
  {
    name: 'str-demand',
    headline: 'Short-Term Rental Intelligence',
    subhead: 'Coachella Valley STR performance by neighborhood',
    stats: [
      { label: 'Old Las Palmas ADR', value: '$420 / night' },
      { label: 'PS Central Occupancy', value: '71%' },
      { label: 'STR demand YoY', value: '+19%' },
      { label: 'Cap rate (PS)', value: '5.1%' },
    ],
    accent: BRAND.gold,
  },
  {
    name: 'hazard-data',
    headline: 'Know the Risk Before You Buy',
    subhead: 'FEMA NRI 18-hazard composite · Insurance tier signals',
    stats: [
      { label: 'Wildfire exposure', value: 'Scored per parcel' },
      { label: 'Flood zone', value: 'FEMA verified' },
      { label: 'Insurance delta', value: 'Up to $3,200/yr' },
      { label: 'PS avg hazard score', value: '58 / 100' },
    ],
    accent: '#C9A84C',
  },
  {
    name: 'zestimate-vs-dna',
    headline: 'Zestimate vs PropertyDNA',
    subhead: 'Why the error rate matters at $900,000',
    stats: [
      { label: 'Zestimate error (listed)', value: '2.4%' },
      { label: 'Zestimate error (off-mkt)', value: '6.9%' },
      { label: 'Error on $900K home', value: '$62,100' },
      { label: 'Permit-adjusted model', value: 'Included' },
    ],
    accent: BRAND.gold,
  },
  {
    name: 'heatmap',
    headline: 'Live Market Heat Map',
    subhead: 'Price-per-sqft velocity · Every zip · Updated daily',
    stats: [
      { label: 'Movie Colony ppsf', value: '+8.3% YoY' },
      { label: 'Rancho Mirage supply', value: '1.4 months' },
      { label: 'Indio DOM', value: '31 days' },
      { label: 'Indian Wells score', value: '78 / 100' },
    ],
    accent: BRAND.green,
  },
];

function buildHtml(t) {
  const statsHtml = t.stats.map(s => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:${BRAND.muted};letter-spacing:0.5px;">${s.label}</span>
      <span style="font-size:15px;font-weight:600;color:${t.accent};font-family:Georgia,serif;">${s.value}</span>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;600&display=swap');
  body {
    width:1200px;height:630px;overflow:hidden;
    background:${BRAND.bg};
    font-family:'Jost',Helvetica,Arial,sans-serif;
  }
</style></head>
<body>
<div style="width:1200px;height:630px;background:${BRAND.bg};display:flex;flex-direction:column;position:relative;overflow:hidden;">

  <!-- Gold accent bar top -->
  <div style="width:100%;height:4px;background:linear-gradient(90deg,${t.accent},transparent);"></div>

  <!-- Main content -->
  <div style="flex:1;display:flex;gap:0;">

    <!-- Left panel -->
    <div style="width:540px;padding:52px 48px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid ${BRAND.border};">
      <!-- Brand -->
      <div>
        <div style="font-size:10px;color:${BRAND.muted};letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;">PropertyDNA</div>
        <div style="width:32px;height:2px;background:${t.accent};margin-bottom:32px;"></div>
        <div style="font-size:32px;font-weight:400;color:${BRAND.cream};line-height:1.2;font-family:Georgia,serif;margin-bottom:16px;">${t.headline}</div>
        <div style="font-size:14px;color:${BRAND.muted};line-height:1.6;">${t.subhead}</div>
      </div>
      <!-- URL -->
      <div style="font-size:11px;color:${BRAND.muted};letter-spacing:2px;text-transform:uppercase;">thepropertydna.com</div>
    </div>

    <!-- Right panel — stats -->
    <div style="flex:1;padding:48px 44px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:9px;color:${BRAND.muted};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Live Data</div>
      ${statsHtml}
    </div>
  </div>

  <!-- Bottom bar -->
  <div style="padding:14px 48px;border-top:1px solid ${BRAND.border};display:flex;align-items:center;justify-content:space-between;">
    <div style="font-size:10px;color:${BRAND.muted};letter-spacing:2px;text-transform:uppercase;">Market Intelligence · Coachella Valley · California</div>
    <div style="font-size:10px;color:${BRAND.muted};">thepropertydna.com</div>
  </div>

</div>
</body></html>`;
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });

  for (const tmpl of TEMPLATES) {
    const outPath = path.join(OUT_DIR, `${tmpl.name}.png`);
    await page.setContent(buildHtml(tmpl), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`✓  /social/${tmpl.name}.png`);
  }

  await browser.close();
  console.log(`\nDone — ${TEMPLATES.length} images saved to app/frontend/public/social/`);
  console.log('Live at: https://thepropertydna.com/social/[name].png after deploy');
}

run().catch(e => { console.error(e.message); process.exit(1); });

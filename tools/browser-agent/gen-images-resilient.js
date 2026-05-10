#!/usr/bin/env node
// Resilient sequential image generator — long delays + exponential backoff for 429s
const https = require('https'); const fs = require('fs'); const path = require('path');

const OUT = path.join(__dirname, '../../app/frontend/public/social/photo');
const STYLE = 'ultra realistic photograph, professional real estate magazine photography, golden hour lighting, 8k, high detail, no text, no watermark';

const P = {
  '2026-05-09': 'Aerial drone view of Coachella Valley housing developments at sunset, palm trees, desert mountains, hundreds of mid-century modern homes, ' + STYLE,
  '2026-05-10': 'Confident female real estate agent in tailored suit standing in front of luxury Palm Springs mid-century modern home, holding tablet, smiling, golden light, ' + STYLE,
  '2026-05-11': 'Sold sign placed in front of stunning Palm Springs mid-century modern home with palm trees and pool, sunset, ' + STYLE,
  '2026-05-12': 'Construction permit document on desk next to architectural blueprints of modern home, soft natural window light, ' + STYLE,
  '2026-05-13': 'Aerial view of Palm Springs neighborhood at dusk with mountains, luxury homes with pools, palm trees, blue hour, ' + STYLE,
  '2026-05-14': 'Real estate agent and seller couple at sleek modern dining table reviewing property report on tablet, designer Palm Springs home interior, ' + STYLE,
  '2026-05-15': 'Quiet residential street in Palm Springs lined with mid-century modern homes, vintage Cadillac in driveway, palm trees long shadows, ' + STYLE,
  '2026-05-16': 'Stunning Palm Springs vacation rental at twilight, glowing windows, infinity pool reflecting purple sky, palm trees, ' + STYLE,
  '2026-05-17': 'Close-up of someone holding smartphone showing property valuation app, blurred Palm Springs home in background, ' + STYLE,
  '2026-05-18': 'Workers on construction site of residential ADU expansion in desert backyard, palm trees, mountains, ' + STYLE,
  '2026-05-19': 'Real estate agent in chic outfit handing keys to happy young couple in front of beautiful Palm Springs home, sunset, ' + STYLE,
  '2026-05-20': 'Elegant entryway of Palm Springs HOA community, gated entrance with mature landscaping, palm trees, wrought iron details, ' + STYLE,
  '2026-05-21': 'Coffee table with iPad showing analytics dashboard, modern Palm Springs home living room background, morning natural light, ' + STYLE,
  '2026-05-22': 'Wide aerial sunrise shot of entire Coachella Valley with Mount San Jacinto in background, neighborhoods spread across desert, ' + STYLE,
  '2026-05-23': 'Smiling young couple touring Palm Springs home with real estate agent pointing out architectural features, modern home interior, ' + STYLE,
  '2026-05-24': 'Iconic Palm Springs mid-century modern home with butterfly roof, vintage Eames chair through floor-to-ceiling windows, golden hour, ' + STYLE,
  '2026-05-25': 'For Sale sign in front yard of Rancho Mirage luxury estate, manicured lawn, palm trees, mountains, ' + STYLE,
  '2026-05-26': 'Holiday weekend gathering at Palm Springs home pool deck, casual luxury, palm trees, mountain backdrop, ' + STYLE,
  '2026-05-27': 'Detailed close-up of printed PropertyDNA report on modern desk with architectural model, designer pen, soft window light, ' + STYLE,
  '2026-05-28': 'Wildfire smoke visible over Palm Springs hills in distance, modern home in foreground with insurance documents on patio table, ' + STYLE,
  '2026-05-29': 'Topographic aerial view of Coachella Valley at twilight showing distinct neighborhood boundaries, illuminated streets, ' + STYLE,
  '2026-05-30': 'Real estate team meeting in modern conference room with large screen showing property analytics, Palm Springs view through windows, ' + STYLE,
  '2026-05-31': 'Empty desert highway leading toward Palm Springs at sunrise, mountains, summer haze, distant city, ' + STYLE,
  '2026-06-01': 'Professional female real estate agent reviewing market data on laptop in chic Palm Springs office with mountain view, summer morning, ' + STYLE,
  '2026-06-02': 'Riverside County Assessor office building exterior, palm trees, California state flag, cinematic editorial photography, ' + STYLE,
  '2026-06-03': 'Diverse family touring quiet residential street in Palm Springs neighborhood, looking at homes for sale, golden afternoon light, ' + STYLE,
  '2026-06-04': 'Real estate agent placing Just Listed sign on lawn of perfectly staged Palm Springs home, palm trees, ' + STYLE,
  '2026-06-05': 'Stunning panoramic view of Indian Wells luxury estates at sunrise, mountain backdrop, palm trees, infinity pools, ' + STYLE,
  '2026-06-06': 'Quiet summer afternoon in Palm Springs neighborhood, sprinklers running on lawns, palm trees, vintage home, heat shimmer, ' + STYLE,
  '2026-06-07': 'Real estate agent shaking hands with happy clients in front of stunning Palm Springs home, sold sign in background, golden hour, ' + STYLE,
};

function fetchOnce(url, outPath) {
  return new Promise((resolve, reject) => {
    function go(redirectUrl, hops) {
      const u = new URL(redirectUrl);
      https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'PropertyDNA Bot 1.0', 'Accept': 'image/*' }, timeout: 180000 }, r => {
        if ([301,302,307,308].includes(r.statusCode) && hops > 0) return go(r.headers.location, hops - 1);
        if (r.statusCode === 429) return reject(new Error('429'));
        if (r.statusCode !== 200) return reject(new Error('HTTP ' + r.statusCode));
        const f = fs.createWriteStream(outPath); let b = 0;
        r.on('data', c => b += c.length); r.pipe(f);
        f.on('finish', () => { f.close(() => resolve(b)); });
        f.on('error', reject);
      }).on('error', reject);
    }
    go(url, 5);
  });
}

async function fetchWithBackoff(url, outPath) {
  const delays = [0, 30000, 60000, 120000, 240000]; // 0, 30s, 1m, 2m, 4m
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      console.log(`   backoff ${delays[i]/1000}s for 429...`);
      await new Promise(r => setTimeout(r, delays[i]));
    }
    try {
      return await fetchOnce(url, outPath);
    } catch (e) {
      try { fs.unlinkSync(outPath); } catch {}
      if (e.message !== '429' || i === delays.length - 1) throw e;
    }
  }
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const dates = Object.keys(P).sort();
  const SPACING = 15000; // 15s between successful requests
  let ok = 0, fail = 0;
  const failed = [];
  for (const d of dates) {
    const out = path.join(OUT, d + '.jpg');
    if (fs.existsSync(out) && fs.statSync(out).size > 50000) { console.log('· ' + d + ' cached'); ok++; continue; }
    const seed = parseInt(d.replace(/-/g, ''), 10) % 999999;
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(P[d]) + '?width=1200&height=630&model=flux&seed=' + seed + '&nologo=true&private=true';
    try {
      const b = await fetchWithBackoff(url, out);
      console.log('✓ ' + d + ' ' + (b/1024).toFixed(0) + 'KB');
      ok++;
      await new Promise(r => setTimeout(r, SPACING));
    } catch (e) {
      console.log('✗ ' + d + ' ' + e.message);
      fail++;
      failed.push(d);
    }
  }
  console.log('\nDone: ' + ok + ' ok, ' + fail + ' failed');
  if (failed.length) console.log('Failed dates: ' + failed.join(', '));
})();

#!/usr/bin/env node
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR  = path.join(__dirname, '../../app/frontend/public/social/photo');
const STYLE = 'ultra realistic photograph, professional real estate magazine photography, golden hour lighting, 8k, high detail, no text, no watermark';

const PHOTO_PROMPTS = {
  '2026-05-09': `Aerial drone view of Coachella Valley housing developments at sunset, palm trees, desert mountains in background, hundreds of mid-century modern homes, ${STYLE}`,
  '2026-05-10': `A confident female real estate agent in tailored suit standing in front of a luxury Palm Springs mid-century modern home, holding a tablet, smiling, late afternoon golden light, ${STYLE}`,
  '2026-05-11': `A "Sold" sign being placed in front of a stunning Palm Springs mid-century modern home with palm trees and pool visible, sunset, ${STYLE}`,
  '2026-05-12': `Construction permit document on a desk next to architectural blueprints of a modern home, soft natural window light, professional editorial photo, ${STYLE}`,
  '2026-05-13': `Beautiful aerial view of Palm Springs neighborhood at dusk with mountains in background, luxury homes with pools, palm trees, blue hour, ${STYLE}`,
  '2026-05-14': `Real estate agent and seller couple sitting at a sleek modern dining table reviewing a property report on a tablet, designer Palm Springs home interior, ${STYLE}`,
  '2026-05-15': `Quiet residential street in Palm Springs lined with mid-century modern homes, vintage Cadillac in driveway, palm trees casting long shadows, late afternoon, ${STYLE}`,
  '2026-05-16': `Stunning Palm Springs vacation rental at twilight, glowing windows, infinity pool reflecting purple sky, palm trees, ${STYLE}`,
  '2026-05-17': `Close-up of someone holding a smartphone showing a property valuation app, blurred Palm Springs home in background, professional editorial style, ${STYLE}`,
  '2026-05-18': `Workers on a construction site of a residential ADU expansion in a desert backyard, palm trees, mountains in background, ${STYLE}`,
  '2026-05-19': `Smiling real estate agent in chic outfit handing keys to happy young couple in front of beautiful Palm Springs home, sunset, ${STYLE}`,
  '2026-05-20': `Elegant entryway of a Palm Springs HOA community, gated entrance with mature landscaping, palm trees, wrought iron details, ${STYLE}`,
  '2026-05-21': `Coffee table with iPad showing analytics dashboard, modern living room of a Palm Springs home in background, early morning natural light, ${STYLE}`,
  '2026-05-22': `Wide aerial sunrise shot of the entire Coachella Valley with Mount San Jacinto in background, neighborhoods spread across desert floor, ${STYLE}`,
  '2026-05-23': `Smiling young couple touring a Palm Springs home with their real estate agent pointing out architectural features, modern home interior, ${STYLE}`,
  '2026-05-24': `Iconic Palm Springs mid-century modern home with butterfly roof, vintage Eames lounge chair visible through floor-to-ceiling windows, golden hour, ${STYLE}`,
  '2026-05-25': `For Sale sign in front yard of Rancho Mirage luxury estate, perfectly manicured lawn, palm trees, mountains, ${STYLE}`,
  '2026-05-26': `Holiday weekend gathering at a Palm Springs home pool deck, casual luxury, palm trees, mountain backdrop, ${STYLE}`,
  '2026-05-27': `Detailed close-up of a printed PropertyDNA report on a modern desk with architectural model, designer pen, soft window light, ${STYLE}`,
  '2026-05-28': `Wildfire smoke visible over Palm Springs hills in distance, modern home in foreground with insurance documents on patio table, ${STYLE}`,
  '2026-05-29': `Topographic-style aerial view of Coachella Valley at twilight showing distinct neighborhood boundaries, illuminated streets, ${STYLE}`,
  '2026-05-30': `Real estate team meeting in modern conference room with large screen showing property analytics, Palm Springs view through windows, ${STYLE}`,
  '2026-05-31': `Empty desert highway leading toward Palm Springs at sunrise, mountains, summer haze, distant city, ${STYLE}`,
  '2026-06-01': `Professional female real estate agent reviewing market data on laptop in chic Palm Springs office with mountain view, summer morning, ${STYLE}`,
  '2026-06-02': `Riverside County Assessor's office building exterior, palm trees, California state flag, cinematic editorial photography, ${STYLE}`,
  '2026-06-03': `A diverse family touring a quiet residential street in a Palm Springs neighborhood, looking at homes for sale, golden afternoon light, ${STYLE}`,
  '2026-06-04': `Real estate agent placing a "Just Listed" sign on the lawn of a perfectly staged Palm Springs home, palm trees, ${STYLE}`,
  '2026-06-05': `Stunning panoramic view of Indian Wells luxury estates at sunrise, mountain backdrop, palm trees, infinity pools, ${STYLE}`,
  '2026-06-06': `Quiet summer afternoon in a Palm Springs neighborhood, sprinklers running on lawns, palm trees, vintage home in background, heat shimmer, ${STYLE}`,
  '2026-06-07': `Real estate agent shaking hands with happy clients in front of a stunning Palm Springs home, sold sign in background, golden hour, ${STYLE}`,
};

function downloadImage(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    let bytes = 0;
    function fetch(redirectUrl, attemptsLeft) {
      const u = new URL(redirectUrl);
      https.get({
        hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'User-Agent': 'PropertyDNA Image Bot 1.0', 'Accept': 'image/jpeg,image/png,*/*' },
        timeout: 120000,
      }, res => {
        if ([301,302,307,308].includes(res.statusCode) && attemptsLeft > 0) return fetch(res.headers.location, attemptsLeft - 1);
        if (res.statusCode !== 200) { file.destroy(); try { fs.unlinkSync(outPath); } catch{} return reject(new Error(`HTTP ${res.statusCode}`)); }
        res.on('data', c => bytes += c.length);
        res.pipe(file);
        file.on('finish', () => { file.close(() => resolve(bytes)); });
      }).on('error', err => { file.destroy(); reject(err); });
    }
    fetch(url, 5);
  });
}

async function generateOne(date) {
  const outPath = path.join(OUT_DIR, `${date}.jpg`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50000) return { date, status: 'cached' };
  const prompt = PHOTO_PROMPTS[date];
  const seed = parseInt(date.replace(/-/g, ''), 10) % 999999;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=630&model=flux&seed=${seed}&nologo=true&private=true`;
  try {
    const bytes = await downloadImage(url, outPath);
    return { date, status: 'ok', bytes };
  } catch (e) {
    return { date, status: 'fail', error: e.message };
  }
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const dates = Object.keys(PHOTO_PROMPTS).sort();
  const BATCH = 6;
  console.log(`Generating ${dates.length} images, ${BATCH} parallel...\n`);

  const results = [];
  for (let i = 0; i < dates.length; i += BATCH) {
    const batch = dates.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(generateOne));
    batchResults.forEach(r => {
      const symbol = r.status === 'ok' ? '✓' : r.status === 'cached' ? '·' : '✗';
      console.log(`${symbol} ${r.date} ${r.bytes ? (r.bytes/1024).toFixed(0)+'KB' : (r.error || 'cached')}`);
    });
    results.push(...batchResults);
  }
  const ok = results.filter(r => r.status === 'ok' || r.status === 'cached').length;
  console.log(`\nDone — ${ok}/${dates.length}`);
}

run().catch(e => { console.error(e.message); process.exit(1); });

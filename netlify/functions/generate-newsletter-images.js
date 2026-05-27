/**
 * generate-newsletter-images — Wednesday 7 AM PT.
 * 1. Pulls this week's weather forecast + events
 * 2. Generates 2 contextual AI images via OpenAI DALL-E 3
 * 3. Uploads to Supabase Storage (bucket: newsletter-images)
 * 4. Writes the URLs back into newsletter_links so Thursday's cron uses them
 *
 * Requires: OPENAI_API_KEY in Netlify env.
 * If missing, returns 200 with skipped=true so the newsletter still ships
 * with the prior/fallback images.
 */
const https = require('https');
const db    = require('./_supabase');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = 'newsletter-images';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function get(hostname, path, headers = {}) {
  return new Promise((resolve) => {
    https.get({ hostname, path, headers: { 'User-Agent': 'PropertyDNA/1.0', ...headers } }, (res) => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function postJson(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject);
    req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function getBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getBinary(res.headers.location));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ── Prompt builders ───────────────────────────────────────────────────────────

async function getWeatherForecast() {
  const point = await get('api.weather.gov', '/points/33.8303,-116.5453');
  if (!point?.properties?.forecast) return null;
  const url = new URL(point.properties.forecast);
  const f   = await get('api.weather.gov', url.pathname);
  return (f?.properties?.periods || []).slice(0, 4);
}

function buildWeatherPrompt(periods) {
  const day = periods?.find(p => p.isDaytime) || periods?.[0];
  const hi  = day?.temperature ? `${day.temperature}°F` : 'mid-90s';
  const sky = (day?.shortForecast || 'sunny').toLowerCase();
  const conditions = sky.includes('sun') || sky.includes('clear')
    ? 'bright sun, crystal-clear deep blue desert sky, sharp shadows'
    : sky.includes('cloud') ? 'dramatic high cirrus clouds, dappled sunlight on palm fronds'
    : sky.includes('wind')  ? 'wind-swept palm trees, slight haze, golden afternoon light'
    : 'clear desert sky, palm shadows on sand';
  return `Ultra-realistic editorial photograph, Palm Springs desert landscape this week at ${hi}: ${conditions}, San Jacinto mountains in background, mid-century modern home silhouette, no people, magazine-quality, Architectural Digest style, 16:9 wide, golden hour lighting, photo-realistic detail`;
}

function buildEventsPrompt(weekDate) {
  const month = new Date(weekDate).getMonth();
  let theme;
  if (month >= 4 && month <= 8) {
    theme = 'summer desert lifestyle, poolside white linens at golden hour, mid-century modern patio, citrus cocktails, no people visible, dappled palm shadows';
  } else if (month >= 9 && month <= 10) {
    theme = 'autumn desert evening, outdoor dinner table on travertine patio, lanterns, blooming bougainvillea, no people visible';
  } else if (month === 11 || month === 0 || month === 1) {
    theme = 'winter desert season, farmers market table with citrus crates and flowers, soft morning light, no people visible';
  } else {
    theme = 'spring desert, art gallery courtyard with sculptures, blooming desert flowers, soft afternoon light, no people visible';
  }
  return `Ultra-realistic editorial photograph for luxury real estate newsletter: ${theme}, Palm Springs setting, magazine-quality, Architectural Digest aesthetic, 16:9 wide, photo-realistic, no text, no logos`;
}

// West Valley listings imagery — Palm Springs / Cathedral City mid-century modernism
function buildWestValleyPrompt() {
  return `Ultra-realistic editorial photograph for luxury real estate newsletter: iconic Palm Springs mid-century modern luxury home exterior, butterfly roof or post-and-beam, expansive glass walls, agave and barrel cactus landscape, blue pool reflecting San Jacinto Mountains in background, golden hour, no people, Architectural Digest cover quality, 16:9 wide, photo-realistic, no text, no logos`;
}

// East Valley listings imagery — La Quinta / Palm Desert / Rancho Mirage estate aesthetic
function buildEastValleyPrompt() {
  return `Ultra-realistic editorial photograph for luxury real estate newsletter: Mediterranean-Spanish revival estate in La Quinta or Rancho Mirage, stone facade, terracotta tile roof, mature date palms framing entry, soft afternoon sun, Santa Rosa mountains in background, manicured grounds, no people, Bloomberg Wealth magazine quality, 16:9 wide, photo-realistic, no text, no logos`;
}

// ── DALL-E 3 generation ───────────────────────────────────────────────────────

async function generateImage(prompt, openaiKey) {
  const res = await postJson('api.openai.com', '/v1/images/generations', {
    Authorization:  `Bearer ${openaiKey}`,
    'Content-Type': 'application/json',
  }, {
    model:   'dall-e-3',
    prompt,
    n:       1,
    size:    '1792x1024',
    quality: 'hd',
    style:   'natural',
  });
  if (res.status !== 200) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data[0].url;
}

// ── Supabase Storage upload ───────────────────────────────────────────────────

async function uploadToSupabase(buffer, filename) {
  const url = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        Authorization:    `Bearer ${SUPABASE_KEY}`,
        apikey:           SUPABASE_KEY,
        'Content-Type':   'image/jpeg',
        'Content-Length': buffer.length,
        'x-upsert':       'true',
        'Cache-Control':  'public, max-age=604800',
      },
    }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode, data: raw }));
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function publicUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async () => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log('[gen-images] OPENAI_API_KEY not set — skipping');
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'OPENAI_API_KEY not configured' }) };
  }

  const today  = new Date().toISOString().slice(0, 10);
  const periods = await getWeatherForecast();
  const weatherPrompt    = buildWeatherPrompt(periods);
  const eventsPrompt     = buildEventsPrompt(today);
  const westValleyPrompt = buildWestValleyPrompt();
  const eastValleyPrompt = buildEastValleyPrompt();

  console.log('[gen-images] weather prompt:',     weatherPrompt);
  console.log('[gen-images] events prompt:',      eventsPrompt);
  console.log('[gen-images] west-valley prompt:', westValleyPrompt);
  console.log('[gen-images] east-valley prompt:', eastValleyPrompt);

  try {
    const [weatherDalleUrl, eventsDalleUrl, westDalleUrl, eastDalleUrl] = await Promise.all([
      generateImage(weatherPrompt,    openaiKey),
      generateImage(eventsPrompt,     openaiKey),
      generateImage(westValleyPrompt, openaiKey),
      generateImage(eastValleyPrompt, openaiKey),
    ]);

    const [weatherBuf, eventsBuf, westBuf, eastBuf] = await Promise.all([
      getBinary(weatherDalleUrl),
      getBinary(eventsDalleUrl),
      getBinary(westDalleUrl),
      getBinary(eastDalleUrl),
    ]);

    // Write BOTH a dated archive file AND a stable "latest" pointer per slot.
    // send-cc-newsletter.js reads from latest-*.jpg so no DB write is needed.
    const stamps = [
      [`${today}-weather.jpg`,      `latest-weather.jpg`,      weatherBuf],
      [`${today}-events.jpg`,       `latest-events.jpg`,       eventsBuf],
      [`${today}-west-valley.jpg`,  `latest-west-valley.jpg`,  westBuf],
      [`${today}-east-valley.jpg`,  `latest-east-valley.jpg`,  eastBuf],
    ];
    const results = await Promise.all(
      stamps.flatMap(([archive, latest, buf]) => [
        uploadToSupabase(buf, archive),
        uploadToSupabase(buf, latest),
      ])
    );
    if (results.some(r => r.status >= 300)) {
      throw new Error(`Supabase upload failed: statuses=${results.map(r => r.status).join(',')}`);
    }

    const urls = {
      weather:      publicUrl('latest-weather.jpg'),
      events:       publicUrl('latest-events.jpg'),
      west_valley:  publicUrl('latest-west-valley.jpg'),
      east_valley:  publicUrl('latest-east-valley.jpg'),
    };

    db.kpi('newsletter_images_generated', null, { ...urls, date: today });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ...urls, date: today }),
    };
  } catch (err) {
    console.error('[gen-images] FAILED:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

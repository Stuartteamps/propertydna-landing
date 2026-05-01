/**
 * generate-newsletter — Builds the weekly Stuart Team email HTML
 *
 * GET ?preview=1   → returns HTML directly (viewable in browser)
 * POST             → returns { html, subject } for Constant Contact API send
 *
 * Data sources:
 *   - Weather:  National Weather Service (free, no key)
 *   - Market:   Supabase market_snapshots
 *   - Events:   Static link (VisitPalmSprings) + AI-generated blurb
 *   - Listings: PropertyDNA listing pages (permanent links)
 */
const https = require('https');
const db    = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-internal-key',
  'Content-Type': 'application/json',
};

const SITE = 'https://thepropertydna.com';

// ── NWS weather for Palm Springs ─────────────────────────────────────────────
function apiGet(hostname, path, headers = {}) {
  return new Promise((resolve) => {
    https.get({ hostname, path, headers: { 'User-Agent': 'PropertyDNA/1.0 (stuartteamps@gmail.com)', ...headers } }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

async function getWeather() {
  try {
    // NWS point for Palm Springs, CA (33.83, -116.54)
    const point = await apiGet('api.weather.gov', '/points/33.8303,-116.5453');
    if (!point?.properties?.forecast) return null;
    const fcastUrl = new URL(point.properties.forecast);
    const forecast = await apiGet('api.weather.gov', fcastUrl.pathname);
    const periods  = forecast?.properties?.periods || [];
    // Get next 3–4 periods for a weekly picture
    return periods.slice(0, 4).map(p => ({
      name:        p.name,
      temp:        p.temperature,
      unit:        p.temperatureUnit,
      short:       p.shortForecast,
      detail:      p.detailedForecast,
      isDaytime:   p.isDaytime,
    }));
  } catch { return null; }
}

// ── Market snapshot for narrative ─────────────────────────────────────────────
async function getMarketData() {
  try {
    const snaps = await db.from('market_snapshots')
      .select('geo_key,median_price,avg_price_per_sqft,median_dom,active_listings,absorption_rate,appreciation_rate_yoy,demand_score')
      .eq('geo_type', 'city')
      .order('snapshot_date', { ascending: false })
      .limit(20)
      .get();
    // Dedupe to latest per city
    const seen = {};
    (snaps || []).forEach(s => { if (!seen[s.geo_key]) seen[s.geo_key] = s; });
    return Object.values(seen);
  } catch { return []; }
}

// ── Build weather text block ──────────────────────────────────────────────────
function buildWeatherText(periods) {
  if (!periods || !periods.length) {
    return 'Highs pushing into the upper 90s with clear skies and strong desert sun. Mornings remain ideal for outdoor activity while afternoons shift toward poolside and indoor living. Warm evenings with light breezes throughout the valley.';
  }
  const day   = periods.find(p => p.isDaytime)  || periods[0];
  const night = periods.find(p => !p.isDaytime) || periods[1];
  const hi    = day?.temp   ? `${day.temp}°${day.unit}`   : 'the mid-90s';
  const lo    = night?.temp ? `${night.temp}°${night.unit}` : 'the low 70s';
  const sky   = (day?.short || '').toLowerCase();
  const skyTxt = sky.includes('sunny') || sky.includes('clear') ? 'clear skies and strong desert sun' :
                 sky.includes('cloud') ? 'partly cloudy skies' : 'typical desert conditions';
  return `Highs reaching ${hi} with ${skyTxt}. Overnight lows near ${lo}. ${day?.detail ? day.detail.split('.')[0] + '.' : 'Classic desert week ahead.'}`;
}

// ── Build market narrative ────────────────────────────────────────────────────
function buildMarketNarrative(markets) {
  if (!markets || !markets.length) {
    return 'The desert is heating up and the energy across the valley is building. From packed weekends to shifting buyer activity, this is the window where positioning matters most. Well-presented homes continue to find buyers quickly while overpriced listings are sitting longer.';
  }
  const ps   = markets.find(m => m.geo_key === 'palm-springs');
  const pd   = markets.find(m => m.geo_key === 'palm-desert');
  const lq   = markets.find(m => m.geo_key === 'la-quinta');
  const top  = ps || pd || markets[0];

  const medFmt = n => n ? '$' + Math.round(n / 1000) + 'k' : null;
  const pct    = n => n ? (n > 0 ? '+' : '') + n.toFixed(1) + '%' : null;

  const supplyLine = top?.absorption_rate
    ? top.absorption_rate < 3
      ? `Inventory remains tight at ${top.absorption_rate.toFixed(1)} months of supply — a seller's market across most price points.`
      : top.absorption_rate > 6
        ? `Supply has loosened to ${top.absorption_rate.toFixed(1)} months — buyers have more options, making presentation and pricing critical.`
        : `The market is balanced at ${top.absorption_rate.toFixed(1)} months of supply.`
    : 'The market continues to show steady buyer demand.';

  const priceLine = ps?.median_price
    ? `Palm Springs median is holding at ${medFmt(ps.median_price)}${ps?.appreciation_rate_yoy ? ` (${pct(ps.appreciation_rate_yoy)} year-over-year)` : ''}.`
    : '';

  const domLine = top?.median_dom
    ? `Homes are averaging ${top.median_dom} days on market — ${top.median_dom < 30 ? 'move fast when the right opportunity appears' : 'buyers have time to do their homework'}.`
    : '';

  return [
    supplyLine, priceLine, domLine,
    'Well-positioned homes continue to find buyers. Overpriced listings are sitting longer as the market becomes more selective.',
  ].filter(Boolean).join(' ');
}

// ── Week label ────────────────────────────────────────────────────────────────
function getWeekLabel() {
  const now  = new Date();
  const opts = { month: 'long', day: 'numeric', year: 'numeric' };
  return `Week of ${now.toLocaleDateString('en-US', opts)}`;
}

// ── Build HTML ────────────────────────────────────────────────────────────────
function buildHtml({ weatherText, marketNarrative, weekLabel }) {
  const weatherUrl = 'https://weather.com/weather/weekend/l/Palm+Springs+California+92264?canonicalCityId=687a20d28ab0947fa17b65cfdd26e2e9';
  const eventsUrl  = 'https://visitpalmsprings.com/events/this-weekend/';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#efe7dc;font-family:Arial,Helvetica,sans-serif;color:#2c241d;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#efe7dc;padding:30px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fcfaf7;max-width:640px;">

<!-- HEADER -->
<tr>
<td style="padding:18px 34px;border-bottom:1px solid #e4d8c9;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8d7b67;">
<table width="100%"><tr>
  <td>The Stuart Team</td>
  <td align="right">${weekLabel}</td>
</tr></table>
</td>
</tr>

<!-- HERO -->
<tr>
<td>
<img src="https://files.constantcontact.com/5cd96ebd701/1071b613-147b-4079-89fa-195924b75343.png" width="100%" style="display:block;">
</td>
</tr>

<tr>
<td align="center" style="padding:40px;">
<div style="font-family:Georgia,serif;font-size:38px;">The Stuart Team Weekly</div>
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9a8671;padding-top:10px;">
Luxury Real Estate &bull; Market Insight &bull; Desert Lifestyle
</div>
</td>
</tr>

<!-- MARKET INTRO -->
<tr>
<td align="center" style="padding:0 60px 30px;font-size:16px;line-height:1.8;">
${marketNarrative}
</td>
</tr>

<!-- WEATHER HEADER -->
<tr>
<td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">This Week's Weather</td>
</tr>

<tr>
<td style="padding:20px 40px;font-size:15px;line-height:1.8;">
${weatherText}
<br><br>
<a href="${weatherUrl}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;">View Full Forecast</a>
</td>
</tr>

<!-- EVENTS IMAGE -->
<tr>
<td style="padding:0 40px 20px;">
<img src="https://files.constantcontact.com/5cd96ebd701/8e0a1559-bca4-4956-9f12-51e8208523a1.png" width="100%">
</td>
</tr>

<!-- EVENTS -->
<tr>
<td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">Things To Do This Week</td>
</tr>

<tr>
<td style="padding:20px 40px;font-size:15px;line-height:1.8;">
The Coachella Valley is alive this week with food, music, and desert lifestyle events. From gallery openings in Palm Springs to festival season in the east valley, there's something drawing people out every evening.
<br><br>
This is one of those weeks where the lifestyle sells itself.
<br><br>
<a href="${eventsUrl}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;">Explore This Week's Events</a>
</td>
</tr>

<!-- WEST VALLEY LISTINGS -->
<tr>
<td style="padding:0 40px;">
<img src="https://files.constantcontact.com/5cd96ebd701/2a371c70-06d5-468c-baa6-940469a499c5.png" width="100%">
</td>
</tr>

<tr>
<td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">West Valley New Listings</td>
</tr>

<tr>
<td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">
Palm Springs and Cathedral City continue to lead attention. Updated homes with strong design and lifestyle appeal are moving quickly. Browse all active West Valley listings with DNA scores and market intelligence.
<br><br>
<a href="${SITE}/listings/west-valley" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;">View West Valley Listings</a>
</td>
</tr>

<!-- EAST VALLEY LISTINGS -->
<tr>
<td style="padding:0 40px;">
<img src="https://files.constantcontact.com/5cd96ebd701/f61407b8-ee7f-459d-b22c-f284bc6999d2.png" width="100%">
</td>
</tr>

<tr>
<td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">East Valley New Listings</td>
</tr>

<tr>
<td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">
La Quinta, Palm Desert, and Rancho Mirage continue offering strong value and lifestyle. Buyers are active when homes feel turnkey and priced with the current market.
<br><br>
<a href="${SITE}/listings/east-valley" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;">View East Valley Listings</a>
</td>
</tr>

<!-- SOLD LISTINGS -->
<tr>
<td style="padding:0 40px;">
<img src="https://files.constantcontact.com/5cd96ebd701/1288b08d-b5bc-4d8f-865b-45159e4d6f8d.png" width="100%">
</td>
</tr>

<tr>
<td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">Recently Sold</td>
</tr>

<tr>
<td style="padding:0 40px 40px;font-size:15px;line-height:1.8;">
Closed sales across the valley confirm that well-presented homes are winning. See what actually sold and at what price — the most accurate read on where the market stands right now.
<br><br>
<a href="${SITE}/listings/recently-sold" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px;">View Recent Sales</a>
</td>
</tr>

<!-- PROPERTY DNA CTA -->
<tr>
<td style="padding:40px;background:#f4ede4;text-align:center;">
<div style="font-family:Georgia,serif;font-size:28px;">Property DNA</div>
<p style="font-size:15px;line-height:1.8;">
Before you buy or sell, understand the real story behind the property. Property DNA gives you the data-driven intelligence most buyers never see — valuation, hazard exposure, comparable sales, and a direct verdict.
</p>
<a href="${SITE}" target="_blank" style="background:#1f1a15;color:#fff;padding:14px 26px;text-decoration:none;font-size:14px;">
Request Your Free Report
</a>
<br><br>
<a href="${SITE}/listings/west-valley" target="_blank" style="text-decoration:none;color:#1f1a15;font-size:14px;">Browse Listings</a>
&nbsp;&nbsp;|&nbsp;&nbsp;
<a href="${SITE}/seller-valuation" target="_blank" style="text-decoration:none;color:#1f1a15;font-size:14px;">Get a Valuation</a>
</td>
</tr>

<!-- SOCIAL -->
<tr>
<td align="center" style="padding:30px;">
<a href="https://instagram.com/danielstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;font-size:13px;">Instagram</a>
<a href="https://facebook.com/danstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;font-size:13px;">Facebook</a>
<a href="https://youtube.com/@stuartteamrealestate3059" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;font-size:13px;">YouTube</a>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center" style="padding:30px;font-size:13px;color:#7c6c5c;">
Daniel Stuart<br>
Coldwell Banker Realty<br>
Palm Springs, CA<br><br>
<a href="https://www.dsteamps.com" style="color:#7c6c5c;">www.dsteamps.com</a><br>
<a href="https://www.thepropertydna.com" style="color:#7c6c5c;">www.thepropertydna.com</a>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const isPreview = event.queryStringParameters?.preview === '1';

  // Fetch weather + market data in parallel
  const [weatherPeriods, markets] = await Promise.all([
    getWeather(),
    getMarketData(),
  ]);

  const weatherText      = buildWeatherText(weatherPeriods);
  const marketNarrative  = buildMarketNarrative(markets);
  const weekLabel        = getWeekLabel();

  const html    = buildHtml({ weatherText, marketNarrative, weekLabel });
  const subject = `The Stuart Team Weekly — ${weekLabel}`;

  // Browser preview
  if (isPreview) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
  }

  // API response for CC send
  const key = event.headers['x-internal-key'] || event.headers['X-Internal-Key'];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ html, subject, weekLabel }),
  };
};

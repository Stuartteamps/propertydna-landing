/**
 * send-weekly-newsletter — Automated Thursday 4:20 PM PT newsletter
 *
 * Scheduled via netlify.toml: "20 23 * * 4" (Thu 23:20 UTC = 4:20 PM PDT)
 *
 * Flow:
 *   1. Generate newsletter HTML (weather + market data)
 *   2. Load all active contacts from CC import campaign
 *   3. Send via Resend in batches of 50
 *   4. Log results to kpi_events
 */
const https = require('https');
const db    = require('./_supabase');

const CC_CAMPAIGN_NAME = 'Constant Contact Database';
const SENDER      = process.env.SENDER_EMAIL  || 'reports@thepropertydna.com';
const SENDER_NAME = 'Daniel Stuart | Stuart Team'; // Stuart Team newsletter — separate from PropertyDNA
const REPLY_TO    = process.env.REPLY_TO_EMAIL || 'stuartteamps@gmail.com';
const SITE        = 'https://thepropertydna.com';

// ── Inline newsletter generator (same logic as generate-newsletter.js) ────────
function apiGet(hostname, path) {
  return new Promise((resolve) => {
    https.get({ hostname, path, headers: { 'User-Agent': 'PropertyDNA/1.0 (stuartteamps@gmail.com)' } }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

async function getWeather() {
  try {
    const point    = await apiGet('api.weather.gov', '/points/33.8303,-116.5453');
    if (!point?.properties?.forecast) return null;
    const fcastUrl = new URL(point.properties.forecast);
    const forecast = await apiGet('api.weather.gov', fcastUrl.pathname);
    return forecast?.properties?.periods?.slice(0, 4) || null;
  } catch { return null; }
}

async function getMarketData() {
  try {
    const snaps = await db.from('market_snapshots')
      .select('geo_key,median_price,avg_price_per_sqft,median_dom,active_listings,absorption_rate,appreciation_rate_yoy,demand_score')
      .eq('geo_type', 'city').order('snapshot_date', { ascending: false }).limit(20).get();
    const seen = {};
    (snaps || []).forEach(s => { if (!seen[s.geo_key]) seen[s.geo_key] = s; });
    return Object.values(seen);
  } catch { return []; }
}

function buildWeatherText(periods) {
  if (!periods?.length) return 'Highs pushing into the upper 90s with clear skies and strong desert sun. Mornings remain ideal while afternoons shift toward poolside living. Warm evenings with light breezes throughout the valley.';
  const day   = periods.find(p => p.isDaytime) || periods[0];
  const night = periods.find(p => !p.isDaytime) || periods[1];
  const hi    = day?.temperature   ? `${day.temperature}°${day.temperatureUnit}`   : 'the mid-90s';
  const lo    = night?.temperature ? `${night.temperature}°${night.temperatureUnit}` : 'the low 70s';
  const sky   = (day?.shortForecast || '').toLowerCase();
  const skyTxt = sky.includes('sunny') || sky.includes('clear') ? 'clear skies and strong desert sun' : sky.includes('cloud') ? 'partly cloudy skies' : 'typical desert conditions';
  return `Highs reaching ${hi} with ${skyTxt}. Overnight lows near ${lo}. ${day?.detailedForecast ? day.detailedForecast.split('.')[0] + '.' : 'A classic desert week ahead.'}`;
}

function buildMarketNarrative(markets) {
  if (!markets?.length) return 'The desert market continues to show steady buyer demand. Well-positioned homes are finding buyers quickly while overpriced listings are taking longer to move.';
  const ps  = markets.find(m => m.geo_key === 'palm-springs');
  const top = ps || markets[0];
  const fmt = n => n ? '$' + Math.round(n / 1000) + 'k' : null;
  const pct = n => n ? (n > 0 ? '+' : '') + n.toFixed(1) + '%' : null;
  const supplyLine = top?.absorption_rate
    ? top.absorption_rate < 3 ? `Inventory is tight at ${top.absorption_rate.toFixed(1)} months of supply — a seller's market.`
    : top.absorption_rate > 6 ? `Supply has loosened to ${top.absorption_rate.toFixed(1)} months, giving buyers more options.`
    : `The market is balanced at ${top.absorption_rate.toFixed(1)} months of supply.`
    : 'Buyer demand remains steady across the valley.';
  const priceLine = ps?.median_price ? `Palm Springs median is ${fmt(ps.median_price)}${ps?.appreciation_rate_yoy ? ` (${pct(ps.appreciation_rate_yoy)} YOY)` : ''}.` : '';
  return [supplyLine, priceLine, 'Well-presented homes continue to win. Overpriced listings are sitting longer.'].filter(Boolean).join(' ');
}

function getWeekLabel() {
  return `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function buildHtml(to, firstName, weatherText, marketNarrative, weekLabel) {
  const unsubUrl = `${SITE}/.netlify/functions/unsubscribe?e=${Buffer.from(to).toString('base64')}`;
  const name     = firstName || 'there';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#efe7dc;font-family:Arial,Helvetica,sans-serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#efe7dc;padding:30px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fcfaf7;max-width:640px;">
<tr><td style="padding:18px 34px;border-bottom:1px solid #e4d8c9;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8d7b67;">
<table width="100%"><tr><td>The Stuart Team</td><td align="right">${weekLabel}</td></tr></table>
</td></tr>
<tr><td><img src="https://files.constantcontact.com/5cd96ebd701/1071b613-147b-4079-89fa-195924b75343.png" width="100%" style="display:block;"></td></tr>
<tr><td align="center" style="padding:40px;">
<div style="font-family:Georgia,serif;font-size:38px;">The Stuart Team Weekly</div>
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9a8671;padding-top:10px;">Luxury Real Estate &bull; Market Insight &bull; Desert Lifestyle</div>
</td></tr>
<tr><td align="center" style="padding:0 60px 30px;font-size:16px;line-height:1.8;">${marketNarrative}</td></tr>
<tr><td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">This Week's Weather</td></tr>
<tr><td style="padding:20px 40px;font-size:15px;line-height:1.8;">${weatherText}<br><br>
<a href="https://weather.com/weather/weekend/l/Palm+Springs+California+92264" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View Full Forecast</a></td></tr>
<tr><td style="padding:0 40px 20px;"><img src="https://files.constantcontact.com/5cd96ebd701/8e0a1559-bca4-4956-9f12-51e8208523a1.png" width="100%"></td></tr>
<tr><td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">Things To Do This Week</td></tr>
<tr><td style="padding:20px 40px;font-size:15px;line-height:1.8;">The Coachella Valley is alive this week with food, music, and desert lifestyle events — from gallery openings in Palm Springs to festival season in the east valley.<br><br>
<a href="https://visitpalmsprings.com/events/this-weekend/" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">Explore This Week's Events</a></td></tr>
<tr><td style="padding:0 40px;"><img src="https://files.constantcontact.com/5cd96ebd701/2a371c70-06d5-468c-baa6-940469a499c5.png" width="100%"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">West Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">Palm Springs and Cathedral City continue to lead activity. Updated homes with strong design and lifestyle appeal are moving quickly.<br><br>
<a href="${SITE}/listings/west-valley" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View West Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="https://files.constantcontact.com/5cd96ebd701/f61407b8-ee7f-459d-b22c-f284bc6999d2.png" width="100%"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">East Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">La Quinta, Palm Desert, and Rancho Mirage continue offering strong value and lifestyle. Buyers are active when homes feel turnkey and priced right.<br><br>
<a href="${SITE}/listings/east-valley" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View East Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="https://files.constantcontact.com/5cd96ebd701/1288b08d-b5bc-4d8f-865b-45159e4d6f8d.png" width="100%"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">Recently Sold</td></tr>
<tr><td style="padding:0 40px 40px;font-size:15px;line-height:1.8;">Closed sales confirm that well-presented homes are winning. See what actually sold this week across the valley.<br><br>
<a href="${SITE}/listings/recently-sold" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View Recent Sales</a></td></tr>
<tr><td style="padding:40px;background:#f4ede4;text-align:center;">
<div style="font-family:Georgia,serif;font-size:28px;">Property DNA</div>
<p style="font-size:15px;line-height:1.8;">Before you buy or sell, understand the real story behind the property. Property DNA gives you data-driven intelligence most buyers never see.</p>
<a href="${SITE}" target="_blank" style="background:#1f1a15;color:#fff;padding:14px 26px;text-decoration:none;">Request Your Free Report</a>
</td></tr>
<tr><td align="center" style="padding:30px;">
<a href="https://instagram.com/danielstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">Instagram</a>
<a href="https://facebook.com/danstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">Facebook</a>
<a href="https://youtube.com/@stuartteamrealestate3059" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">YouTube</a>
</td></tr>
<tr><td align="center" style="padding:30px;font-size:13px;color:#7c6c5c;">
Daniel Stuart · Coldwell Banker Realty · Palm Springs, CA<br>
<a href="https://www.dsteamps.com" style="color:#7c6c5c;">dsteamps.com</a> &nbsp;·&nbsp; <a href="${SITE}" style="color:#7c6c5c;">thepropertydna.com</a><br><br>
<a href="${unsubUrl}" style="color:#9a8671;font-size:11px;">Unsubscribe</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Resend sender ─────────────────────────────────────────────────────────────
function sendEmail(to, subject, html) {
  const key     = process.env.RESEND_API_KEY;
  const payload = JSON.stringify({ from: `${SENDER_NAME} <${SENDER}>`, reply_to: REPLY_TO, to, subject, html });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve({ ok: res.statusCode < 300, status: res.statusCode }); } catch { resolve({ ok: false }); } });
    });
    req.on('error', () => resolve({ ok: false }));
    req.write(payload); req.end();
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async () => {
  console.log('[send-weekly-newsletter] Starting...');

  // 1. Generate content
  const [weatherPeriods, markets] = await Promise.all([getWeather(), getMarketData()]);
  const weatherText     = buildWeatherText(weatherPeriods);
  const marketNarrative = buildMarketNarrative(markets);
  const weekLabel       = getWeekLabel();
  const subject         = `PropertyDNA Weekly — ${weekLabel}`;

  // 2. Load CC import campaign ID
  const campaigns = await db.from('campaigns')
    .select('id,name,total_contacts')
    .order('created_at', { ascending: false })
    .limit(10).get().catch(() => []);

  const campaign = (campaigns || []).find(c => (c.name || '').includes('Constant Contact Database'));
  if (!campaign) {
    console.error('[send-weekly-newsletter] CC import campaign not found');
    return { statusCode: 404, body: 'Campaign not found' };
  }
  console.log(`[send-weekly-newsletter] Campaign: ${campaign.name} (${campaign.total_contacts} contacts)`);

  // 3. Load unsubscribes
  const unsubs = await db.from('campaign_unsubscribes').select('email').get().catch(() => []);
  const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));

  // 4. Send in batches of 50
  let offset = 0, sent = 0, skipped = 0, failed = 0;
  const BATCH = 50;

  while (true) {
    const contacts = await db.from('campaign_contacts')
      .select('email,first_name,status')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true })
      .limit(BATCH).get().catch(() => []);

    // Use raw offset query
    const batch = await db.from('campaign_contacts')
      .select('id,email,first_name')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true })
      .limit(BATCH).get().catch(() => null);

    // Break when out of contacts (pagination handled via sent count)
    if (!Array.isArray(batch) || batch.length === 0) break;
    if (offset >= (campaign.total_contacts || 0)) break;

    for (const c of batch) {
      if (unsubSet.has((c.email || '').toLowerCase())) { skipped++; continue; }
      const html   = buildHtml(c.email, c.first_name, weatherText, marketNarrative, weekLabel);
      const result = await sendEmail(c.email, subject, html);
      if (result.ok) { sent++; } else { failed++; }
      await new Promise(r => setTimeout(r, 100)); // pace sends
    }

    offset += batch.length;
    if (batch.length < BATCH) break;
  }

  console.log(`[send-weekly-newsletter] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`);
  db.kpi('newsletter_sent', null, { sent, skipped, failed, week: weekLabel });

  return { statusCode: 200, body: JSON.stringify({ sent, skipped, failed, subject }) };
};

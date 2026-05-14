/**
 * send-cc-newsletter — Weekly Stuart Team newsletter via Constant Contact API
 *
 * Scheduled: Thursday 4:20 PM PT (netlify.toml "20 23 * * 4")
 * Primary:   Constant Contact API (uses CC_ACCESS_TOKEN)
 * Fallback:  Resend (if CC token expired or invalid)
 *
 * CC list: PropertyDNA — All Contacts (662ac8de-4599-11f1-8c5f-02420a320003)
 */

const https = require('https');
const db    = require('./_supabase');

const CC_API     = 'api.cc.email';
const CC_LIST_ID = '662ac8de-4599-11f1-8c5f-02420a320003';
const SITE       = 'https://thepropertydna.com';
// Newsletter sends from marketing subdomain to protect reports@ deliverability.
const SENDER     = process.env.NEWSLETTER_SENDER_EMAIL || process.env.CAMPAIGN_SENDER_EMAIL || 'hello@mail.thepropertydna.com';
const SENDER_NAME = 'Daniel Stuart | Stuart Team';
const REPLY_TO   = process.env.REPLY_TO_EMAIL || 'stuartteamps@gmail.com';
const UNSUB_MAILTO = process.env.UNSUB_MAILTO || 'unsubscribe@mail.thepropertydna.com';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function apiGet(hostname, path, headers = {}) {
  return new Promise((resolve) => {
    https.get({ hostname, path, headers: { 'User-Agent': 'PropertyDNA/1.0 (stuartteamps@gmail.com)', ...headers } }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function apiPost(hostname, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname, path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Content generators (inline from generate-newsletter.js) ──────────────────

async function getWeather() {
  try {
    const point = await apiGet('api.weather.gov', '/points/33.8303,-116.5453');
    if (!point?.properties?.forecast) return null;
    const url  = new URL(point.properties.forecast);
    const fore = await apiGet('api.weather.gov', url.pathname);
    return (fore?.properties?.periods || []).slice(0, 4);
  } catch { return null; }
}

async function getMarketData() {
  try {
    const snaps = await db.from('market_snapshots')
      .select('geo_key,median_price,avg_price_per_sqft,median_dom,active_listings,absorption_rate,appreciation_rate_yoy')
      .eq('geo_type', 'city').order('snapshot_date', { ascending: false }).limit(20).get();
    const seen = {};
    (snaps || []).forEach(s => { if (!seen[s.geo_key]) seen[s.geo_key] = s; });
    return Object.values(seen);
  } catch { return []; }
}

function buildWeatherText(periods) {
  if (!periods?.length) return 'Highs pushing into the upper 90s with clear skies and strong desert sun. Warm evenings with light breezes throughout the valley.';
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
    ? top.absorption_rate < 3 ? `Inventory is tight at ${top.absorption_rate.toFixed(1)} months of supply.`
    : top.absorption_rate > 6 ? `Supply has loosened to ${top.absorption_rate.toFixed(1)} months — buyers have options.`
    : `The market is balanced at ${top.absorption_rate.toFixed(1)} months of supply.`
    : 'Buyer demand remains steady across the valley.';
  const priceLine = ps?.median_price ? `Palm Springs median is ${fmt(ps.median_price)}${ps?.appreciation_rate_yoy ? ` (${pct(ps.appreciation_rate_yoy)} YOY)` : ''}.` : '';
  return [supplyLine, priceLine, 'Well-presented homes continue to win. Overpriced listings are sitting longer.'].filter(Boolean).join(' ');
}

function getWeekLabel() {
  return `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function buildHtml(weatherText, marketNarrative, weekLabel, links) {
  const unsubUrl = `${SITE}/.netlify/functions/campaign-unsubscribe?email={{contact.email}}`;
  // Date-dynamic photo URLs. /social/photo/YYYY-MM-DD.jpg is pre-generated by
  // the daily-runner agent. Pick two different dates so the weather-section
  // image and events-section image don't look identical.
  const today           = new Date();
  const weatherImageDate = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10); // +2 days
  const eventImageDate   = today.toISOString().slice(0, 10);                                     // today
  // Weekly listing links pulled from newsletter_links table — Dan updates each
  // Wednesday before the Thursday cron. Fall back to our own listing pages.
  const wvLink   = links?.west_valley_new || `${SITE}/listings/west-valley`;
  const evLink   = links?.east_valley_new || `${SITE}/listings/east-valley`;
  const soldLink = links?.recently_sold   || `${SITE}/listings/recently-sold`;
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
<tr><td style="padding:0 40px 20px;"><img src="${SITE}/social/photo/${weatherImageDate}.jpg" width="100%" alt="Coachella Valley desert this week" style="display:block;"></td></tr>
<tr><td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">Things To Do This Week</td></tr>
<tr><td style="padding:20px 40px;font-size:15px;line-height:1.8;">Post-festival calm has settled across the valley — golden-hour patios, weekly farmers markets, and gallery openings before summer heat takes over.<br><br>
<a href="https://visitpalmsprings.com/events/this-weekend/" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">Explore This Week's Events</a></td></tr>
<tr><td style="padding:0 40px;"><img src="${SITE}/social/photo/${eventImageDate}.jpg" width="100%" alt="Coachella Valley this week" style="display:block;"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">West Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">Palm Springs and Cathedral City continue to lead activity. Updated homes with strong design and lifestyle appeal are moving quickly.<br><br>
<a href="${wvLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View West Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="https://files.constantcontact.com/5cd96ebd701/f61407b8-ee7f-459d-b22c-f284bc6999d2.png" width="100%"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">East Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">La Quinta, Palm Desert, and Rancho Mirage continue offering strong value. Buyers are active when homes are priced right.<br><br>
<a href="${evLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View East Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="https://files.constantcontact.com/5cd96ebd701/1288b08d-b5bc-4d8f-865b-45159e4d6f8d.png" width="100%"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">Recently Sold</td></tr>
<tr><td style="padding:0 40px 40px;font-size:15px;line-height:1.8;">See what actually sold this week across the valley — the most accurate read on where the market stands.<br><br>
<a href="${soldLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View Recent Sales</a></td></tr>
<tr><td style="padding:40px;background:#f4ede4;text-align:center;">
<div style="font-family:Georgia,serif;font-size:28px;">Property DNA</div>
<p style="font-size:15px;line-height:1.8;">Before you buy or sell, understand the real story behind the property. Property DNA gives you the data-driven intelligence most buyers never see.</p>
<a href="${SITE}" target="_blank" style="background:#1f1a15;color:#fff;padding:14px 26px;text-decoration:none;">Request Your Free Report</a>
</td></tr>
<tr><td align="center" style="padding:30px;">
<a href="https://instagram.com/danielstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">Instagram</a>
<a href="https://facebook.com/danstuartps" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">Facebook</a>
<a href="https://youtube.com/@stuartteamrealestate3059" style="margin:5px;background:#1f1a15;color:#fff;padding:10px 18px;text-decoration:none;">YouTube</a>
</td></tr>
<tr><td align="center" style="padding:30px;font-size:13px;color:#7c6c5c;">
Daniel Stuart &middot; Coldwell Banker Realty &middot; Palm Springs, CA<br>
<a href="https://www.dsteamps.com" style="color:#7c6c5c;">dsteamps.com</a> &nbsp;&middot;&nbsp; <a href="${SITE}" style="color:#7c6c5c;">thepropertydna.com</a><br><br>
<a href="${unsubUrl}" style="color:#9a8671;font-size:11px;">Unsubscribe</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Resend fallback ───────────────────────────────────────────────────────────

async function sendViaResend(subject, html, weatherText, marketNarrative, weekLabel) {
  const key     = process.env.RESEND_API_KEY;
  const unsubUrl = `${SITE}/.netlify/functions/campaign-unsubscribe`;

  const unsubs = await db.from('campaign_unsubscribes').select('email').get().catch(() => []);
  const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));

  const campaigns = await db.from('campaigns').select('id,name,total_contacts')
    .order('created_at', { ascending: false }).limit(20).get().catch(() => []);
  const campaign  = (campaigns || []).find(c => (c.name || '').includes('Constant Contact Database'));
  if (!campaign) return { sent: 0, method: 'resend_fallback', error: 'CC campaign not found' };

  let offset = 0, sent = 0, failed = 0;
  const BATCH = 50;

  while (offset < (campaign.total_contacts || 9999)) {
    const batch = await db.from('campaign_contacts')
      .select('id,email,first_name').eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true }).range(offset, offset + BATCH - 1).get().catch(() => null);
    if (!Array.isArray(batch) || !batch.length) break;

    for (const c of batch) {
      if (unsubSet.has((c.email || '').toLowerCase())) continue;
      const perEmailHtml = html.replace(
        `/.netlify/functions/campaign-unsubscribe?email={{contact.email}}`,
        `${unsubUrl}?email=${Buffer.from(c.email).toString('base64')}`
      );
      const oneClickUnsub = `${unsubUrl}?email=${Buffer.from(c.email).toString('base64')}`;
      const payload = JSON.stringify({
        from: `${SENDER_NAME} <${SENDER}>`, reply_to: REPLY_TO,
        to: c.email, subject, html: perEmailHtml,
        headers: {
          'List-Unsubscribe':      `<mailto:${UNSUB_MAILTO}?subject=unsubscribe>, <${oneClickUnsub}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.resend.com', path: '/emails', method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (res) => { res.resume(); res.on('end', () => { sent++; resolve(); }); });
        req.on('error', () => { failed++; resolve(); });
        req.write(payload); req.end();
      });
      await new Promise(r => setTimeout(r, 80));
    }
    offset += batch.length;
    if (batch.length < BATCH) break;
  }

  return { sent, failed, method: 'resend_fallback' };
}

// ── CC API send ───────────────────────────────────────────────────────────────

async function sendViaCC(token, subject, html, weekLabel) {
  // 1. Create campaign
  const createRes = await apiPost(CC_API, '/v3/emails', token, {
    name: `Stuart Team Weekly - ${weekLabel}`,
    email_campaign_activities: [{
      format_type: 5,
      from_name:    SENDER_NAME,
      from_email:   SENDER,
      reply_to_email: REPLY_TO,
      subject,
      html_content: html,
      permalink_name: '',
    }],
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`CC create campaign failed: ${createRes.status} ${JSON.stringify(createRes.data).slice(0, 200)}`);
  }

  const activityId = createRes.data?.campaign_activity_id;
  if (!activityId) throw new Error('CC response missing campaign_activity_id');

  // 2. Schedule send (ASAP)
  const schedRes = await apiPost(CC_API, '/v3/activities/email_schedule', token, {
    scheduled_date: '0',
    campaign_activities: [{
      campaign_activity_id: activityId,
      contact_list_ids: [CC_LIST_ID],
    }],
  });

  if (schedRes.status !== 201 && schedRes.status !== 200) {
    throw new Error(`CC schedule failed: ${schedRes.status} ${JSON.stringify(schedRes.data).slice(0, 200)}`);
  }

  return { activityId, campaignId: createRes.data?.campaign_id };
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('[send-cc-newsletter] Starting...');

  const testEmail = (event?.queryStringParameters?.testEmail || '').toLowerCase().trim();
  const isTest    = testEmail && testEmail.includes('@');

  // Fetch weather + market with bounded budget so the 26s gateway deadline
  // never kills us. If a fetch hangs, we degrade to defaults — the layout +
  // sender + unsubscribe headers are what we're previewing in test mode anyway.
  const withTimeout = (p, ms, fallback) => Promise.race([
    p.catch(() => fallback),
    new Promise((res) => setTimeout(() => res(fallback), ms)),
  ]);
  const loadLinks = async () => {
    try {
      const rows = await db.from('newsletter_links').select('west_valley_new,east_valley_new,recently_sold').eq('id', 1).limit(1).get();
      return rows?.[0] || null;
    } catch { return null; }
  };

  const [weatherPeriods, markets, links] = await Promise.all([
    withTimeout(getWeather(), isTest ? 6000 : 12000, null),
    withTimeout(getMarketData(), isTest ? 6000 : 12000, []),
    withTimeout(loadLinks(), isTest ? 4000 : 8000, null),
  ]);
  console.log('[send-cc-newsletter] links:', links ? 'loaded' : 'using fallback');
  const weatherText    = buildWeatherText(weatherPeriods);
  const marketNarrative = buildMarketNarrative(markets);
  const weekLabel      = getWeekLabel();
  const subject        = `The Stuart Team Weekly - ${weekLabel}`;
  const html           = buildHtml(weatherText, marketNarrative, weekLabel, links);

  // CC API test mode: ?ccTest=1&testEmail=foo@bar.com → uses CC's native
  // /tests endpoint to send a preview from CC's warmed IPs. Best inbox-
  // placement signal because it's the SAME pipe the Thursday cron uses.
  const ccTestMode = isTest && event?.queryStringParameters?.ccTest === '1';
  if (ccTestMode) {
    console.log('[send-cc-newsletter] CC TEST MODE — sending preview via CC API to', testEmail);
    // Resolve CC token from Supabase first, env fallback
    let ccTokenLocal = null;
    try {
      const rows = await db.from('oauth_tokens').select('access_token').eq('provider', 'constant_contact').limit(1).get();
      if (rows?.[0]?.access_token) ccTokenLocal = rows[0].access_token;
    } catch { /* ignore */ }
    if (!ccTokenLocal) ccTokenLocal = process.env.CC_ACCESS_TOKEN || null;
    if (!ccTokenLocal) {
      return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No CC token — visit cc-oauth-start to authorize' }) };
    }
    try {
      // 1. Create draft campaign in CC
      const createRes = await apiPost(CC_API, '/v3/emails', ccTokenLocal, {
        name: `Stuart Team Weekly TEST - ${weekLabel} - ${Date.now()}`,
        email_campaign_activities: [{
          format_type: 5,
          from_name:    SENDER_NAME,
          from_email:   SENDER,
          reply_to_email: REPLY_TO,
          subject:      `[CC TEST] ${subject}`,
          html_content: html,
          permalink_name: '',
        }],
      });
      if (createRes.status !== 201 && createRes.status !== 200) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'create_campaign', status: createRes.status, data: createRes.data }) };
      }
      const activityId = createRes.data?.campaign_activity_id;
      if (!activityId) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No campaign_activity_id', data: createRes.data }) };
      }
      // 2. Fire CC's test-send endpoint
      const testRes = await apiPost(CC_API, `/v3/emails/activities/${activityId}/tests`, ccTokenLocal, {
        email_addresses:  [testEmail],
        personal_message: `Pre-flight test of the ${weekLabel} send. If you see this in inbox, the 4:20pm cron will too.`,
      });
      db.kpi('cc_newsletter_cctest', testEmail, { status: testRes.status, activityId, week: weekLabel });
      return {
        statusCode: testRes.status < 300 ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ccTest: true, recipient: testEmail, activityId, testStatus: testRes.status, testResponse: testRes.data }),
      };
    } catch (err) {
      console.error('[send-cc-newsletter] CC test failed:', err.message);
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Test mode: ?testEmail=foo@bar.com → send ONE email via Resend, skipping
  // CC API + the full contact loop. Used to preview before the cron fires.
  if (isTest) {
    console.log('[send-cc-newsletter] TEST MODE — sending only to', testEmail);
    const oneClickUnsub = `${SITE}/.netlify/functions/unsubscribe?e=${Buffer.from(testEmail).toString('base64')}`;
    const perEmailHtml  = html.replace(
      '/.netlify/functions/campaign-unsubscribe?email={{contact.email}}',
      oneClickUnsub
    );
    const key = process.env.RESEND_API_KEY;
    const unsubMailto = process.env.UNSUB_MAILTO || 'unsubscribe@mail.thepropertydna.com';
    const payload = JSON.stringify({
      from: `${SENDER_NAME} <${SENDER}>`,
      reply_to: REPLY_TO,
      to: testEmail,
      subject: `[TEST] ${subject}`,
      html: perEmailHtml,
      headers: {
        'List-Unsubscribe':      `<mailto:${unsubMailto}?subject=unsubscribe>, <${oneClickUnsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    const sendResult = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.resend.com', path: '/emails', method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        let raw = ''; res.on('data', c => raw += c);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
      });
      req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, data: { error: 'resend timeout' } }); });
      req.write(payload); req.end();
    });
    db.kpi('cc_newsletter_test', testEmail, { subject, week: weekLabel, status: sendResult.status });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, recipient: testEmail, subject, status: sendResult.status, resend_id: sendResult.data?.id || null }),
    };
  }

  // Token storage was moved out of Netlify env (4KB Lambda ceiling) into
  // Supabase. Prefer the DB; fall back to env for legacy compatibility.
  let ccToken = null;
  try {
    const rows = await db.from('oauth_tokens').select('access_token,expires_at').eq('provider', 'constant_contact').limit(1).get();
    if (rows?.[0]?.access_token) ccToken = rows[0].access_token;
  } catch { /* table may not exist yet — fall back to env */ }
  if (!ccToken) ccToken = process.env.CC_ACCESS_TOKEN || null;
  let result;

  if (ccToken) {
    try {
      console.log('[send-cc-newsletter] Attempting CC API send...');
      const cc = await sendViaCC(ccToken, subject, html, weekLabel);
      result = { method: 'constant_contact', ...cc, subject };
      console.log('[send-cc-newsletter] CC send scheduled:', cc.activityId);
    } catch (err) {
      console.warn('[send-cc-newsletter] CC failed, falling back to Resend:', err.message);
      result = await sendViaResend(subject, html, weatherText, marketNarrative, weekLabel);
      result.cc_error = err.message;
    }
  } else {
    console.log('[send-cc-newsletter] No CC token — sending via Resend...');
    result = await sendViaResend(subject, html, weatherText, marketNarrative, weekLabel);
  }

  db.kpi('cc_newsletter_sent', null, { ...result, week: weekLabel });
  console.log('[send-cc-newsletter] Done:', result);

  return { statusCode: 200, body: JSON.stringify({ ...result, subject, weekLabel }) };
};

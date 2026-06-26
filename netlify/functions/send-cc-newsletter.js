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
// Two senders by path:
//  - CC API path → reports@thepropertydna.com (verified in CC's account UI;
//    test sends and campaigns to verified lists require this)
//  - Resend fallback → hello@mail.thepropertydna.com (marketing subdomain
//    isolated from transactional reports@ reputation)
const SENDER_CC      = process.env.CC_SENDER_EMAIL || 'reports@thepropertydna.com';
const SENDER_RESEND  = process.env.NEWSLETTER_SENDER_EMAIL || process.env.CAMPAIGN_SENDER_EMAIL || 'hello@mail.thepropertydna.com';
// Back-compat alias — old code referenced `SENDER`; CC path uses it directly.
const SENDER       = SENDER_CC;
const SENDER_NAME  = 'Daniel Stuart | Stuart Team';
const REPLY_TO     = process.env.REPLY_TO_EMAIL || 'stuartteamps@gmail.com';
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

function apiCall(method, hostname, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname, path, method,
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
function apiPost(h, p, t, b) { return apiCall('POST', h, p, t, b); }
function apiPut(h, p, t, b)  { return apiCall('PUT',  h, p, t, b); }

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

// Live Palm Springs (92264) sale-market snapshot from RentCast, computed fresh
// on every send so the newsletter never ships stale numbers. YoY is derived by
// comparing this month's median to the same month last year in the history.
// Returns null on any failure → buildMarketNarrative falls back to evergreen copy.
function getMarketSnapshot() {
  return new Promise((resolve) => {
    const key = process.env.RENTCAST_API_KEY;
    if (!key) return resolve(null);
    const req = https.get({
      hostname: 'api.rentcast.io',
      path: '/v1/markets?zipCode=92264&dataType=Sale&historyRange=13',
      headers: { 'X-Api-Key': key, 'Accept': 'application/json' },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const d    = JSON.parse(raw);
          const sd   = d.saleData || {};
          const hist = sd.history || {};
          const now  = new Date();
          const yKey = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const prior = hist[yKey] || {};
          const med      = sd.medianPrice || null;
          const priorMed = prior.medianPrice || null;
          const yoy = (med && priorMed) ? ((med - priorMed) / priorMed) * 100 : null;
          resolve({
            median_price:    med,
            median_dom:      sd.medianDaysOnMarket || null,
            active_listings: sd.totalListings || null,
            prior_active:    prior.totalListings || null,
            prior_dom:       prior.medianDaysOnMarket || null,
            yoy,
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(9000, () => { req.destroy(); resolve(null); });
  });
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

function buildMarketNarrative(snap) {
  if (!snap || !snap.median_price) {
    return 'The desert market continues to show steady buyer demand. Well-positioned homes are finding buyers quickly while overpriced listings are taking longer to move.';
  }
  const fmtK  = n => '$' + Math.round(n / 1000) + 'k';
  const parts = [];

  // Lead with momentum (pace of sale + inventory) — the seller-relevant signal.
  const momentum = [];
  if (snap.median_dom && snap.prior_dom && snap.median_dom < snap.prior_dom) {
    momentum.push(`homes are selling faster — ${snap.median_dom} days on market versus ${snap.prior_dom} a year ago`);
  } else if (snap.median_dom && snap.prior_dom && snap.median_dom > snap.prior_dom) {
    momentum.push(`homes are averaging ${snap.median_dom} days on market`);
  } else if (snap.median_dom) {
    momentum.push(`homes are averaging ${snap.median_dom} days on market`);
  }
  if (snap.active_listings && snap.prior_active && snap.active_listings < snap.prior_active) {
    momentum.push(`inventory has tightened to ${snap.active_listings} active listings, down from ${snap.prior_active} last spring`);
  } else if (snap.active_listings && snap.prior_active && snap.active_listings > snap.prior_active) {
    momentum.push(`inventory has grown to ${snap.active_listings} active listings, giving buyers more to choose from`);
  } else if (snap.active_listings) {
    momentum.push(`${snap.active_listings} homes are active right now`);
  }
  if (momentum.length) parts.push(`Palm Springs ${momentum.join(', and ')}.`);

  // Price as context — framed as opportunity, not headline.
  if (snap.yoy != null && snap.yoy <= -1) {
    parts.push(`The median sale price has eased to ${fmtK(snap.median_price)}, about ${Math.round(Math.abs(snap.yoy))}% below last year — a genuine window for buyers, even as well-positioned sellers keep moving quickly.`);
  } else if (snap.yoy != null && snap.yoy >= 1) {
    parts.push(`The median sale price is ${fmtK(snap.median_price)}, up about ${Math.round(snap.yoy)}% from a year ago.`);
  } else {
    parts.push(`The median sale price is holding near ${fmtK(snap.median_price)}.`);
  }

  parts.push('Well-presented, correctly-priced homes are winning. Overpriced listings sit.');
  return parts.join(' ');
}

function getWeekLabel() {
  return `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

// Derive a readable plaintext part from the HTML. A multipart/alternative email
// (text + HTML) scores materially better with spam filters than HTML-only —
// pure-HTML is a classic spam signal. Resend builds multipart when we pass both.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => `${txt.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|div|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;|&#8217;/g, "'").replace(/&rdquo;|&ldquo;/g, '"').replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·').replace(/&bull;/g, '•').replace(/&rarr;/g, '->').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// CC processes [[FIRSTNAME]] / [[LASTNAME]] / [[EMAILADDRESS]] natively. Resend
// does NOT, so on any Resend path (preview + full-list fallback) we substitute
// the tags ourselves to avoid shipping a literal "Hi [[FIRSTNAME]],".
function fillMergeTags(html, { first, last, email } = {}) {
  return html
    .replace(/\[\[FIRSTNAME\]\]/g, (first && first.trim()) || 'there')
    .replace(/\[\[LASTNAME\]\]/g, (last && last.trim()) || '')
    .replace(/\[\[EMAILADDRESS\]\]/g, email || '');
}

function buildHtml(weatherText, marketNarrative, weekLabel, links) {
  // CC merge-tag syntax (verified 2026-05-15 via probe sent to stuartteamps@gmail.com):
  //   [[FIRSTNAME]]     → first_name
  //   [[LASTNAME]]      → last_name
  //   [[EMAILADDRESS]]  → email address
  //   {{contact.x}}     → DOES NOT WORK (renders literal)
  //   Custom field syntax still unknown — defer score block to next iteration.
  const unsubUrl = `${SITE}/.netlify/functions/campaign-unsubscribe?email=[[EMAILADDRESS]]`;
  // Luxury newsletter imagery — gpt-image-1 (Architectural Digest / Condé Nast
  // style), content-matched to each section's copy. Committed to the repo and
  // served from Netlify's CDN at /social/newsletter/latest-*.jpg, regenerated
  // weekly by tools/image-gen/gen-newsletter.ts. Hosting on the CDN — NOT
  // Supabase Storage — keeps imagery up even during a DB/storage incident
  // (Supabase Storage was returning 544/522 during the 2026-05-27/28 outage).
  const cdnImageBase       = `${SITE}/social/newsletter`;
  const heroImageUrl       = `${cdnImageBase}/latest-hero.jpg`;
  const weatherImageUrl    = `${cdnImageBase}/latest-weather.jpg`;
  const eventImageUrl      = `${cdnImageBase}/latest-events.jpg`;
  const westValleyImageUrl = `${cdnImageBase}/latest-west-valley.jpg`;
  const eastValleyImageUrl = `${cdnImageBase}/latest-east-valley.jpg`;
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
<tr><td style="background:#1f1a15;padding:34px 40px 30px;text-align:center;">
<div style="display:inline-block;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a86a;border:1px solid #c9a86a;padding:5px 11px;margin-bottom:18px;">PropertyDNA is LIVE &bull; Web + iOS</div>
<div style="font-family:Georgia,serif;font-size:30px;line-height:1.25;color:#fcfaf7;">We&rsquo;re live. The data is finally on your side.</div>
<div style="font-size:15px;line-height:1.6;color:#e4d8c9;padding:14px 0 22px;max-width:500px;margin:0 auto;">5M+ properties indexed nationwide. Free DNA reports on any address. Real comps, permit history, valuation, flood and fire risk. The intel agents hoped you&rsquo;d never see.</div>
<a href="${SITE}/?utm_source=cc&amp;utm_medium=newsletter&amp;utm_campaign=live_hero&amp;email=[[EMAILADDRESS]]&amp;firstName=[[FIRSTNAME]]&amp;lastName=[[LASTNAME]]" target="_blank" style="display:inline-block;background:#c9a86a;color:#1f1a15;padding:14px 28px;text-decoration:none;font-size:15px;font-weight:bold;letter-spacing:1px;margin:0 4px 10px;">Run a Free Report &rarr;</a>
<a href="https://apps.apple.com/app/id6768064079?ct=newsletter_live&amp;mt=8" target="_blank" style="display:inline-block;background:transparent;color:#fcfaf7;border:1px solid #c9a86a;padding:13px 26px;text-decoration:none;font-size:15px;letter-spacing:1px;margin:0 4px 10px;">Get the iOS App &rarr;</a>
<div style="padding-top:18px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a8671;">Follow along for daily market intel</div>
<div style="padding-top:10px;">
<a href="https://instagram.com/danielstuartps" target="_blank" style="display:inline-block;margin:4px;background:#2c241d;color:#fcfaf7;padding:9px 17px;text-decoration:none;font-size:13px;">Instagram &rarr;</a>
<a href="https://youtube.com/@stuartteamrealestate3059" target="_blank" style="display:inline-block;margin:4px;background:#2c241d;color:#fcfaf7;padding:9px 17px;text-decoration:none;font-size:13px;">YouTube &rarr;</a>
<a href="https://facebook.com/danstuartps" target="_blank" style="display:inline-block;margin:4px;background:#2c241d;color:#fcfaf7;padding:9px 17px;text-decoration:none;font-size:13px;">Facebook &rarr;</a>
</div>
</td></tr>
<tr><td><img src="${heroImageUrl}" width="100%" alt="Coachella Valley this week" style="display:block;"></td></tr>
<tr><td align="center" style="padding:40px 40px 24px;">
<div style="font-family:Georgia,serif;font-size:38px;">Summer Has Arrived in the Valley</div>
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9a8671;padding-top:10px;">Luxury Real Estate &bull; Market Insight &bull; Desert Lifestyle</div>
</td></tr>
<tr><td style="padding:0 60px 16px;font-size:17px;line-height:1.7;color:#2c241d;">Hi [[FIRSTNAME]],</td></tr>
<tr><td style="padding:0 60px 24px;font-size:16px;line-height:1.8;color:#2c241d;">Late June, and the desert&rsquo;s off-season buying window is wide open. Inventory is fuller, sellers are more flexible, and the data backs it up. Below you&rsquo;ll find this week&rsquo;s verified MLS activity, the real market read pulled fresh from the numbers, and one thing you can do <em>today</em> to never get out-negotiated by an agent again. PropertyDNA is now live, so run a free report on any address before you make a move.</td></tr>
<tr><td style="padding:0 60px 6px;font-family:Georgia,serif;font-size:24px;color:#1f1a15;">Coachella Valley Market Snapshot: ${weekLabel}</td></tr>
<tr><td style="padding:0 60px 30px;font-size:16px;line-height:1.8;color:#2c241d;">${marketNarrative}</td></tr>
<tr><td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">This Week's Weather</td></tr>
<tr><td style="padding:20px 40px;font-size:15px;line-height:1.8;">${weatherText}<br><br>
<a href="https://weather.com/weather/weekend/l/Palm+Springs+California+92264" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View Full Forecast</a></td></tr>
<tr><td style="padding:0 40px 20px;"><img src="${weatherImageUrl}" width="100%" alt="Coachella Valley desert this week" style="display:block;"></td></tr>
<tr><td style="padding:0 40px;font-family:Georgia,serif;font-size:26px;">Things To Do This Week</td></tr>
<tr><td style="padding:20px 40px;font-size:15px;line-height:1.8;">Even at 110 degrees, downtown has life this week. The Palm Springs International ShortFest is running through June 29th at the Festival Theaters on Baristo. It&rsquo;s the Oscar-qualifying short-film festival and honestly one of my favorite weeks of the summer to be in town. VillageFest is on summer hours now too: Thursday nights, 7 to 10 along Palm Canyon, close to 200 booths once the sun drops and it&rsquo;s cool enough to walk it. My real move this time of year? Out the door for a sunrise hike in the Indian Canyons before it hits triple digits, then let the resort pool decks carry the rest of the day. The Parker, the Saguaro, Kimpton Rowan. Here&rsquo;s the full calendar so you can build your week.<br><br>
<a href="https://visitgreaterpalmsprings.com/events/" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">See This Week&rsquo;s Events</a></td></tr>
<tr><td style="padding:0 40px;"><img src="${eventImageUrl}" width="100%" alt="Coachella Valley this week" style="display:block;"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">West Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">Palm Springs and Cathedral City continue to lead activity. Updated homes with strong design and lifestyle appeal are moving quickly.<br><br>
<a href="${wvLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View West Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="${westValleyImageUrl}" width="100%" alt="West Valley luxury homes" style="display:block;"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">East Valley New Listings</td></tr>
<tr><td style="padding:0 40px 30px;font-size:15px;line-height:1.8;">La Quinta, Palm Desert, and Rancho Mirage continue offering strong value. Buyers are active when homes are priced right.<br><br>
<a href="${evLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View East Valley Listings</a></td></tr>
<tr><td style="padding:0 40px;"><img src="${eastValleyImageUrl}" width="100%" alt="East Valley luxury estates" style="display:block;"></td></tr>
<tr><td style="padding:20px 40px;font-family:Georgia,serif;font-size:26px;">Recently Sold</td></tr>
<tr><td style="padding:0 40px 40px;font-size:15px;line-height:1.8;">See what actually sold this week across the valley. The most accurate read on where the market stands.<br><br>
<a href="${soldLink}" target="_blank" style="background:#1f1a15;color:#fff;padding:12px 20px;text-decoration:none;">View Recent Sales</a></td></tr>
<tr><td style="padding:48px 40px 12px;border-top:1px solid #e4d8c9;font-family:Georgia,serif;font-size:28px;color:#1f1a15;text-align:center;">The PropertyDNA App Is Live</td></tr>
<tr><td style="padding:0 40px 8px;text-align:center;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a8671;">The data on YOUR side of the table</td></tr>
<tr><td style="padding:18px 40px 8px;font-size:16px;line-height:1.8;color:#2c241d;">
[[FIRSTNAME]], comps cherry-picked to justify the price. Permits never pulled. Flood and fire exposure quietly omitted. We built PropertyDNA to flip that.<br><br>
Now in your pocket: pull a full DNA report on any address in seconds. Real comps. Permit history. Valuation. Risk. The same intel a $1M family-office buyer pays for. Free, on iOS, no agent gatekeeping it.
</td></tr>
<tr><td align="center" style="padding:14px 40px 28px;">
<a href="https://apps.apple.com/app/id6768064079?ct=newsletter_launch_body&mt=8" target="_blank" style="background:#1f1a15;color:#fff;padding:16px 32px;text-decoration:none;font-size:16px;">Download PropertyDNA on iOS &rarr;</a>
</td></tr>
<tr><td style="padding:24px 40px 8px;background:#1f1a15;color:#f4ede4;font-family:Georgia,serif;font-size:22px;">Join the movement. Defend the next buyer.</td></tr>
<tr><td style="padding:8px 40px 28px;background:#1f1a15;color:#e4d8c9;font-size:15px;line-height:1.8;">
This newsletter exists for one reason: to end the information asymmetry that lets predatory agents win at the buyer's expense.
<ol style="padding-left:22px;margin:14px 0 4px;color:#e4d8c9;">
  <li style="margin-bottom:10px;"><strong style="color:#fff;">Download the app</strong> so you have the data before you sign a buyer-rep agreement.</li>
  <li style="margin-bottom:10px;"><strong style="color:#fff;">Run a free DNA report</strong> on the address you're watching, and see what your agent isn't telling you.</li>
  <li style="margin-bottom:0;"><strong style="color:#fff;">Forward this email to one person</strong> who's buying or selling in the next year. That's how the movement scales. One human at a time.</li>
</ol>
</td></tr>
<tr><td style="padding:36px 40px 8px;border-top:1px solid #e4d8c9;font-family:Georgia,serif;font-size:22px;color:#1f1a15;">Why this newsletter stays in your inbox</td></tr>
<tr><td style="padding:8px 40px 28px;font-size:15px;line-height:1.8;color:#2c241d;">
Our weekly snapshot pairs verified MLS activity with provenance intelligence you won&rsquo;t find on Zillow or Redfin: architect attribution, the quiet sales above $5M, permit history, and the homes celebrities and family offices are actually buying. No drip funnels. No spam. One curated email each Thursday from a desert agent who reads the data before he writes the copy.<br><br>
<em style="color:#5a4e3f;">If a friend would benefit, forward this. If it&rsquo;s not useful, the unsubscribe link below works in one click.</em>
</td></tr>
<tr><td style="padding:40px;background:#f4ede4;text-align:center;">
<div style="font-family:Georgia,serif;font-size:28px;">Your Free Property DNA Report</div>
<p style="font-size:15px;line-height:1.8;color:#2c241d;">[[FIRSTNAME]], before you buy or sell, see the real story your property tells. Property DNA shows comps, valuation, permits, flood risk, and a 5&#8209;year trajectory most buyers never get to see.</p>
<p style="font-size:14px;line-height:1.7;color:#5a4e3f;margin:6px 0 18px;"><strong>No card. 60 seconds. Delivered to your inbox.</strong></p>
<a href="${SITE}/?utm_source=cc&utm_medium=newsletter&utm_campaign=weekly_snapshot&email=[[EMAILADDRESS]]&firstName=[[FIRSTNAME]]&lastName=[[LASTNAME]]" target="_blank" style="background:#1f1a15;color:#fff;padding:14px 26px;text-decoration:none;">Get a Free PropertyDNA Report &rarr;</a>
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

  // DOMAIN WARMUP: never cold-blast the full list from an unwarmed domain — that
  // is the #1 reason a new Resend domain spam-folders. NEWSLETTER_MAX_PER_RUN
  // caps how many we send per run; ramp it up over ~2-3 weeks (e.g. 2000 ->
  // 5000 -> 12000 -> unlimited) as the domain earns reputation. 0/unset = no cap
  // (only safe once warmed). We send FRESHEST contacts first (most recently
  // added = most likely valid + engaged) to maximize positive open signals.
  const MAX_PER_RUN = Number(process.env.NEWSLETTER_MAX_PER_RUN || 0) || Infinity;

  let offset = 0, sent = 0, failed = 0;
  const BATCH = 50;

  while (offset < (campaign.total_contacts || 9999) && sent < MAX_PER_RUN) {
    const batch = await db.from('campaign_contacts')
      .select('id,email,first_name,last_name').eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false }).range(offset, offset + BATCH - 1).get().catch(() => null);
    if (!Array.isArray(batch) || !batch.length) break;

    for (const c of batch) {
      if (sent >= MAX_PER_RUN) break;
      if (unsubSet.has((c.email || '').toLowerCase())) continue;
      const perEmailHtml = fillMergeTags(
        html.replace(
          `/.netlify/functions/campaign-unsubscribe?email=[[EMAILADDRESS]]`,
          `${unsubUrl}?email=${Buffer.from(c.email).toString('base64')}`
        ),
        { first: c.first_name, last: c.last_name, email: c.email }
      );
      const oneClickUnsub = `${unsubUrl.replace('[[EMAILADDRESS]]', encodeURIComponent(c.email))}`;
      const payload = JSON.stringify({
        from: `${SENDER_NAME} <${SENDER_RESEND}>`, reply_to: REPLY_TO,
        to: c.email, subject, html: perEmailHtml, text: htmlToText(perEmailHtml),
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
    name: `Stuart Team Weekly - ${weekLabel} - ${Date.now()}`,
    email_campaign_activities: [{
      format_type: 5,
      from_name:    SENDER_NAME,
      from_email:   SENDER,
      reply_to_email: REPLY_TO,
      subject,
      html_content: html,
      physical_address_in_footer: {
        address_line1: '777 E Tahquitz Canyon Way',
        city:          'Palm Springs',
        state_code:    'CA',
        postal_code:   '92262',
        country_code:  'US',
      },
    }],
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`CC create campaign failed: ${createRes.status} ${JSON.stringify(createRes.data).slice(0, 200)}`);
  }

  const activities = createRes.data?.campaign_activities || [];
  const primary    = activities.find(a => a.role === 'primary_email') || activities[0];
  const activityId = primary?.campaign_activity_id;
  if (!activityId) throw new Error(`CC response missing campaign_activity_id: ${JSON.stringify(createRes.data).slice(0, 400)}`);

  // 2. Attach the contact list. PUT the full activity payload (CC v3 requires
  // the complete activity body, not a partial update).
  const listRes = await apiPut(CC_API, `/v3/emails/activities/${activityId}`, token, {
    format_type:    5,
    from_name:      SENDER_NAME,
    from_email:     SENDER,
    reply_to_email: REPLY_TO,
    subject,
    html_content:   html,
    contact_list_ids: [CC_LIST_ID],
    physical_address_in_footer: {
      address_line1: '777 E Tahquitz Canyon Way',
      city:          'Palm Springs',
      state_code:    'CA',
      postal_code:   '92262',
      country_code:  'US',
    },
  });
  if (listRes.status >= 300) {
    throw new Error(`CC attach list failed: ${listRes.status} ${JSON.stringify(listRes.data).slice(0, 300)}`);
  }

  // 3. Schedule send (immediate)
  const schedRes = await apiPost(CC_API, `/v3/emails/activities/${activityId}/schedules`, token, {
    scheduled_date: '0',
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

  const [weatherPeriods, marketSnap, links] = await Promise.all([
    withTimeout(getWeather(), isTest ? 6000 : 12000, null),
    withTimeout(getMarketSnapshot(), isTest ? 7000 : 12000, null),
    withTimeout(loadLinks(), isTest ? 4000 : 8000, null),
  ]);
  console.log('[send-cc-newsletter] links:', links ? 'loaded' : 'using fallback', '| market:', marketSnap?.median_price ? 'live' : 'fallback');
  const weatherText    = buildWeatherText(weatherPeriods);
  const marketNarrative = buildMarketNarrative(marketSnap);
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
      // CC nests activity ids in campaign_activities[] keyed by role. Old code
      // expected top-level campaign_activity_id and threw on every send.
      const activities = createRes.data?.campaign_activities || [];
      const primary    = activities.find(a => a.role === 'primary_email') || activities[0];
      const activityId = primary?.campaign_activity_id || createRes.data?.campaign_activity_id;
      if (!activityId) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No campaign_activity_id in any role', data: createRes.data }) };
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
    const perEmailHtml  = fillMergeTags(
      html.replace('/.netlify/functions/campaign-unsubscribe?email=[[EMAILADDRESS]]', oneClickUnsub),
      { first: 'there', email: testEmail }
    );
    const key = process.env.RESEND_API_KEY;
    const unsubMailto = process.env.UNSUB_MAILTO || 'unsubscribe@mail.thepropertydna.com';
    const payload = JSON.stringify({
      // Resend can only send from a verified domain. SENDER (CC_SENDER_EMAIL)
      // is a gmail address that's valid for the Constant Contact API path but
      // 403s on Resend ("gmail.com is not verified"). Use the verified Resend
      // sender for the preview/test path.
      from: `${SENDER_NAME} <${SENDER_RESEND}>`,
      reply_to: REPLY_TO,
      to: testEmail,
      subject: `[TEST] ${subject}`,
      html: perEmailHtml,
      text: htmlToText(perEmailHtml),
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
  // NEWSLETTER_FORCE_RESEND=1 retires Constant Contact entirely: send via Resend
  // from our OWN domain (hello@mail.thepropertydna.com), building OUR reputation
  // instead of CC's shared ccsend.com pool. Reversible — unset it to fall back to
  // CC while a token exists. (Set this once the warmup ramp has proven inbox.)
  const forceResend = process.env.NEWSLETTER_FORCE_RESEND === '1';
  let ccToken = null;
  if (!forceResend) {
    try {
      const rows = await db.from('oauth_tokens').select('access_token,expires_at').eq('provider', 'constant_contact').limit(1).get();
      if (rows?.[0]?.access_token) ccToken = rows[0].access_token;
    } catch { /* table may not exist yet — fall back to env */ }
    if (!ccToken) ccToken = process.env.CC_ACCESS_TOKEN || null;
  }
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

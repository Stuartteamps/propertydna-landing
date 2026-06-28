/**
 * _email.js — shared deliverability + warmup-ramp toolkit for all Resend blasts.
 *
 * One dial to rule the ramp: set Netlify env EMAIL_RAMP_WEEK = 1..4 (default 1).
 * Every blast sender reads its volume from rampCap(channel) so you turn the
 * whole operation up week-by-week WITHOUT editing code — just bump the number
 * as the domain earns reputation. Per-function env vars still override the ramp
 * when you need to hand-tune a single channel.
 *
 * Why a ramp at all: a cold full-list blast from an unwarmed domain is the #1
 * cause of spam-foldering (we lived it — 1 open / 6,720 sent on 2026-05-12).
 * Send to the freshest/most-engaged first at low volume, climb as Gmail/Yahoo
 * start trusting the domain, then lift the cap to reach the long tail.
 *
 *   Week 1  warmup, engaged-only, tiny volume
 *   Week 2  ~2x — reputation forming
 *   Week 3  ~2.5x — most of the list
 *   Week 4+ unlimited — fully warmed
 *
 * No npm — Node built-ins only (functions must stay dependency-free).
 */

// Per-channel volume by ramp week. Index 0 unused; weeks are 1-based.
// newsletter = max recipients per run; warmupDaily = warm-batch daily quota;
// campaignBatch = bulk campaign recipients per invocation. Infinity = no cap.
const RAMP = {
  1: { newsletter: 2500,  warmupDaily: 50,  campaignBatch: 25  },
  2: { newsletter: 5000,  warmupDaily: 100, campaignBatch: 50  },
  3: { newsletter: 12000, warmupDaily: 250, campaignBatch: 100 },
  4: { newsletter: Infinity, warmupDaily: 500, campaignBatch: 200 },
};

function rampWeek() {
  const w = parseInt(process.env.EMAIL_RAMP_WEEK || '1', 10);
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 4); // week 4 = fully warmed / unlimited newsletter
}

// rampCap('newsletter'|'warmupDaily'|'campaignBatch') -> number (Infinity = uncapped).
// A matching per-function env override wins: NEWSLETTER_MAX_PER_RUN,
// WARMUP_DAILY_LIMIT, CAMPAIGN_BATCH_SIZE. Override value 0 = "use ramp".
function rampCap(channel) {
  const envName = {
    newsletter:    'NEWSLETTER_MAX_PER_RUN',
    warmupDaily:   'WARMUP_DAILY_LIMIT',
    campaignBatch: 'CAMPAIGN_BATCH_SIZE',
  }[channel];
  const override = envName ? Number(process.env[envName] || 0) : 0;
  if (override > 0) return override;
  const stage = RAMP[rampWeek()] || RAMP[1];
  return stage[channel];
}

// Derive a readable plaintext part from HTML. multipart/alternative (text+HTML)
// scores materially better with spam filters than HTML-only (a classic signal).
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => `${txt.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|div|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;|&#8217;/g, "'").replace(/&rdquo;|&ldquo;|&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·').replace(/&bull;/g, '•').replace(/&rarr;/g, '->').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Standard Gmail/Yahoo-compliant unsubscribe headers (one-click, RFC 8058).
function unsubHeaders(email) {
  const site   = (process.env.APP_BASE_URL || 'https://thepropertydna.com').replace(/\/$/, '');
  const mailto = process.env.UNSUB_MAILTO || 'unsubscribe@mail.thepropertydna.com';
  const url    = `${site}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(email)}`;
  return {
    'List-Unsubscribe':      `<mailto:${mailto}?subject=unsubscribe>, <${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

module.exports = { rampCap, rampWeek, htmlToText, unsubHeaders, RAMP };

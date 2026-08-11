#!/usr/bin/env node
/**
 * PropertyDNA — Buffer Social Posting Agent (GraphQL API)
 *
 * Posts daily content to all connected Buffer channels via the GraphQL API.
 *
 * Setup:
 *   1. Go to buffer.com → log in → click your avatar → API Access (or developers.buffer.com)
 *   2. Copy your Access Token
 *   3. Add to .daily-creds.json: { "buffer": { "token": "YOUR_TOKEN" } }
 *
 * Manual run: node tools/browser-agent/agents/buffer.js
 */

const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const opsLog     = require('../lib/ops-log');

const CREDS_FILE      = path.join(__dirname, '../.daily-creds.json');
const TRACKER_FILE    = path.join(__dirname, '../data/buffer-tracker.json');
const CALENDAR_FILE   = path.join(__dirname, '../data/content-calendar.json');

function log(msg) { console.log(`[Buffer] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.buffer || null;
}

function todayText() {
  const today = new Date().toISOString().slice(0, 10);
  const calendar = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf8'));
  const entry = calendar.posts.find(p => p.date === today);
  if (entry) return { text: entry.text, date: today, image: entry.image, images: entry.images, found: true };
  const past = calendar.posts.filter(p => p.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length) return { text: past[0].text, date: past[0].date, image: past[0].image, images: past[0].images, found: false };
  return null;
}

function loadTracker() {
  if (fs.existsSync(TRACKER_FILE)) return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  return { lastIndex: -1, posts: [] };
}

function saveTracker(t) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2));
}

function graphql(token, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'api.buffer.com',
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getChannels(token) {
  // First get the organization ID
  const accountRes = await graphql(token, `
    query { account { organizations { id name } } }
  `);
  const orgs = accountRes.data?.data?.account?.organizations;
  if (!orgs?.length) throw new Error('No organizations found: ' + JSON.stringify(accountRes.data));
  const orgId = orgs[0].id;
  log(`Organization: ${orgs[0].name} (${orgId})`);

  // Then get channels for that org
  const channelsRes = await graphql(token, `
    query GetChannels($input: ChannelsInput!) {
      channels(input: $input) { id name service type isDisconnected isLocked }
    }
  `, { input: { organizationId: orgId } });

  const channels = channelsRes.data?.data?.channels || [];
  return channels.filter(c => !c.isDisconnected && !c.isLocked);
}

function buildMetadata(service) {
  switch (service) {
    case 'facebook':
      return { facebook: { type: 'post' } };
    case 'instagram':
      return { instagram: { type: 'post', shouldShareToFeed: true } };
    case 'googlebusiness':
      return { google: { type: 'whats_new', detailsWhatsNew: { button: 'learn_more', link: 'https://www.thepropertydna.com' } } };
    default:
      return undefined;
  }
}

// Services that require media — skip for text-only posts
// Services that work with text + image
const MEDIA_SUPPORTED = ['linkedin', 'facebook', 'googlebusiness', 'instagram', 'tiktok'];
// Services that require media — skip if no image provided
const MEDIA_REQUIRED  = ['instagram', 'tiktok', 'youtube'];

function addUTM(text, service) {
  return text.replace(/https?:\/\/(www\.)?thepropertydna\.com(\/[^\s)]*)?/g, match => {
    if (match.includes('utm_source')) return match;
    const sep = match.includes('?') ? '&' : '?';
    return `${match}${sep}utm_source=${service}&utm_medium=social&utm_campaign=buffer`;
  });
}

async function postToChannel(token, channelId, service, text, imageUrl, images) {
  // Buffer GraphQL: assets is [AssetInput!]! — list of {image:{url}} | {video:{url}} | {document:{url}}
  // (introspected schema 2026-05-26; previously docs showed assets.images[] which is no longer valid)
  const urls = Array.isArray(images) && images.length > 0
    ? images.slice(0, 10)
    : imageUrl ? [imageUrl] : [];
  const mediaAssets = urls.map(url => ({ image: { url } }));
  const hasMedia = mediaAssets.length > 0;

  if (MEDIA_REQUIRED.includes(service) && !hasMedia) {
    throw new Error(`SKIP — ${service} requires media (image/video)`);
  }

  const taggedText = addUTM(text, service);

  const input = {
    channelId,
    text: taggedText,
    schedulingType: 'automatic',
    mode: 'shareNow',
  };

  if (hasMedia && MEDIA_SUPPORTED.includes(service)) {
    input.assets = mediaAssets;
  }

  const metadata = buildMetadata(service);
  if (metadata) input.metadata = metadata;

  const res = await graphql(token, `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id externalLink } }
        ... on InvalidInputError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on LimitReachedError { message }
        ... on RestProxyError { message }
      }
    }
  `, { input });

  const result = res.data?.data?.createPost;
  if (result?.post) return result.post;
  throw new Error(result?.message || JSON.stringify(res.data));
}

async function run() {
  const creds = loadCreds();
  if (!creds || !creds.token) {
    log('SKIP — no Buffer token.');
    log('  1. buffer.com → avatar → API Access → copy Access Token');
    log('  2. Add to .daily-creds.json: { "buffer": { "token": "YOUR_TOKEN" } }');
    return { status: 'skipped', reason: 'no_credentials' };
  }

  const tracker = loadTracker();

  // Try calendar first, fall back to rotation
  let text, dateLabel, image, images;
  if (fs.existsSync(CALENDAR_FILE)) {
    const entry = todayText();
    if (entry) {
      text = entry.text;
      dateLabel = entry.date;
      image = entry.image;
      images = entry.images;  // optional carousel array
      if (!entry.found) log(`No entry for today — using closest past entry (${entry.date})`);
    }
  }
  if (!text) {
    // Luxury home provenance + investment intelligence positioning
    const FALLBACK = [
      "When Patek Philippe discontinued the Reference 5711 stainless steel in 2021, it was trading at 3× retail within months. Supply fixed at roughly 8,000 produced over the run. Donald Wexler's Alcoa steel prototype series: 6 homes, 1961 — a demonstration project for the Aluminum Company of America, never replicated. Average hold cycle on documented examples: 8+ years. The difference between these two assets isn't appreciation potential — it's that the watch comes with a complete, standardized provenance record and the house doesn't. PropertyDNA is closing that gap for $5M+ architecturally significant residential. https://www.thepropertydna.com",
      "When a family office underwrites a $15M allocation, they expect benchmarking: comparable deal IRRs, concentration risk, exit liquidity data. For a $15M architecturally-significant Palm Springs estate — one of eight surviving John Lautner residential commissions in the Coachella Valley — none of that data exists in any accessible form. PropertyDNA is building the comparable-sales database, attribution-verified peer set, and liquidity-cycle analytics the trophy residential market is missing. Institutional-grade due diligence for an asset class that has never had it. https://www.thepropertydna.com",
      "Barrett-Jackson runs 250-point inspections, chassis histories, and consecutive ownership records for six-figure cars. The $15M architectural estate next door gets a general inspection and unverified agent notes. PropertyDNA builds the dossier the top of the market deserves. https://www.thepropertydna.com",
      "When a Warhol attribution is questioned, Sotheby's suspends the lot until the Andy Warhol Art Authentication Board renders a decision. Standards exist; they have teeth. When a $9M Palm Springs estate is marketed as 'Albert Frey design' based on listing copy that traces back to an assessor note from the 1980s, there is no verification protocol. PropertyDNA builds what fine art markets figured out 40 years ago: a documented chain from architect to permit to commission record to finished structure, verified against the Frey Papers at the Palm Springs Art Museum and the Neutra Collection at the Getty. When we say attributed, it survives that chain. https://www.thepropertydna.com",
      "The Kaufmann Desert House dossier — Richard Neutra 1946, Julius Shulman 'Poolside Gossip' (Getty Museum collection), Barry Manilow ownership 1992–2016. Live provenance file: https://www.thepropertydna.com/dossier/504292010",
      "Christie's requires a certificate of authenticity, conservation report, and full auction trail for a $15,000 painting. A $15M John Lautner original in Palm Springs gets assessor records and listing notes. PropertyDNA builds what should have existed from the start — archive-verified architect attribution, permit sequence, ownership chronology, period press citations. The documentation gap is closing. https://www.thepropertydna.com",
      "Albert Frey built 47 residential commissions in Palm Springs. Donald Wexler's Alcoa steel prototype series: 6 homes, 1961 — none can be replicated. At this tier, supply is fixed and declining. Average trade cycle on architect-attributed examples: 6–9 years. That's not an inventory problem — it's a collectible market operating with real estate documentation standards. PropertyDNA is building the infrastructure to close that gap. https://www.thepropertydna.com",
    ];
    const idx = ((tracker.lastIndex ?? -1) + 1) % FALLBACK.length;
    text = FALLBACK[idx];
    dateLabel = `rotation-${idx}`;
    tracker.lastIndex = idx;
  }

  log(`Today's post (${dateLabel}): "${text.slice(0, 70)}..."`);

  try {
    const channels = await getChannels(creds.token);
    if (!channels.length) throw new Error('No active channels connected to Buffer');
    log(`Found ${channels.length} channel(s): ${channels.map(c => `${c.service}/${c.name}`).join(', ')}`);

    const results = [];
    for (const channel of channels) {
      try {
        const post = await postToChannel(creds.token, channel.id, channel.service, text, image, images);
        log(`  ✓ ${channel.service}/${channel.name}: ${post.externalLink || post.id}`);
        results.push({ channel: channel.service, status: 'posted' });
      } catch (e) {
        log(`  ✗ ${channel.service}/${channel.name}: ${e.message}`);
        results.push({ channel: channel.service, status: 'error', error: e.message });
      }
    }

    tracker.posts.push({ text: text.slice(0, 80), date: dateLabel, postedAt: new Date().toISOString(), results });
    saveTracker(tracker);

    const posted = results.filter(r => r.status === 'posted').length;
    log(`Done: ${posted}/${channels.length} channels posted`);
    await opsLog.write({
      agent: 'buffer', event_type: 'social_blast', status: posted > 0 ? 'ok' : 'warning',
      summary: `Posted to ${posted}/${channels.length} channels`,
      metadata: { results, text: text.slice(0, 120), date: dateLabel },
      affected_rows: posted,
    });
    return { status: 'posted', channels: posted, text: text.slice(0, 80) };

  } catch (e) {
    log(`ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));

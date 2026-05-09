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
  if (entry) return { text: entry.text, date: today, found: true };
  // Fallback: use the most recent past entry if today has no entry
  const past = calendar.posts.filter(p => p.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length) return { text: past[0].text, date: past[0].date, found: false };
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

async function postToChannel(token, channelId, service, text, imageUrl) {
  const hasImage = !!imageUrl;

  if (MEDIA_REQUIRED.includes(service) && !hasImage) {
    throw new Error(`SKIP — ${service} requires media (image/video)`);
  }

  const taggedText = addUTM(text, service);

  const input = {
    channelId,
    text: taggedText,
    schedulingType: 'automatic',
    mode: 'shareNow',
  };

  // Attach image for all supported services
  if (hasImage && MEDIA_SUPPORTED.includes(service)) {
    input.media = [{ url: imageUrl, type: 'image' }];
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
  let text, dateLabel, image;
  if (fs.existsSync(CALENDAR_FILE)) {
    const entry = todayText();
    if (entry) {
      text = entry.text;
      dateLabel = entry.date;
      image = entry.image;
      if (!entry.found) log(`No entry for today — using closest past entry (${entry.date})`);
    }
  }
  if (!text) {
    // Luxury home provenance + investment intelligence positioning
    const FALLBACK = [
      "PropertyDNA: institutional-grade dossiers for $5M+ luxury homes. Verified celebrity provenance, architect authentication, scarcity indexing. https://www.thepropertydna.com",
      "70% of 'celebrity-owned' real estate claims aren't documentable. We verify provenance against deed history + primary source press. https://www.thepropertydna.com",
      "Verified Albert Frey, John Lautner, and Richard Neutra commissions in Palm Springs trade once every 4-7 years. The scarcity premium is real, but only on authenticated attribution. https://www.thepropertydna.com",
      "For $30M architectural estates, the dossier matters as much as it does for a Patek 1518 or a 1962 Ferrari. We build the documentation layer the auction houses don't. https://www.thepropertydna.com",
      "Insurance replacement cost on irreplaceable estates often exceeds market value by 20%+. The data tells the asset story most appraisals miss. https://www.thepropertydna.com",
      "Cross-asset luxury benchmarking: how does Coachella Valley architectural real estate perform vs Patek Philippe, Domaine Romanée-Conti, and the S&P 500? https://www.thepropertydna.com",
      "We've documented 47 verified Albert Frey residential commissions in Palm Springs. Estate documentation that prevents value loss at sale or inheritance. https://www.thepropertydna.com",
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
        const post = await postToChannel(creds.token, channel.id, channel.service, text, image);
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
    return { status: 'posted', channels: posted, text: text.slice(0, 80) };

  } catch (e) {
    log(`ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));

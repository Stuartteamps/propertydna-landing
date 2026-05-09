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

const CREDS_FILE   = path.join(__dirname, '../.daily-creds.json');
const TRACKER_FILE = path.join(__dirname, '../data/buffer-tracker.json');

function log(msg) { console.log(`[Buffer] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.buffer || null;
}

// Daily social content rotation
const SOCIAL_CONTENT = [
  "168,000 parcels indexed across the Coachella Valley. Every permit, every owner change, every valuation update — in one place. www.thepropertydna.com",
  "The listing appointment is won before you walk in the door. Sellers who receive a property report 24 hours early arrive curious, not skeptical. www.thepropertydna.com/blog/win-listing-appointment-ai-property-data",
  "Permit history is the most under-used data point in real estate due diligence. We check it automatically on every PropertyDNA report. www.thepropertydna.com",
  "AI property reports vs. traditional CMA — we ran both for a year. The AI report takes 4 minutes. The CMA takes 4 hours. The accuracy is comparable. www.thepropertydna.com/blog/ai-property-report-vs-cma",
  "Off-market leads: filter for absentee owners with 10+ years of ownership and no recent permits. That's your motivated seller list. www.thepropertydna.com",
  "Zillow's Zestimate error rate on off-market homes is 6.9%. Our model incorporates permit data and micro-neighborhood variation. www.thepropertydna.com/blog/zillow-zestimate-accuracy",
  "The PropertyDNA heat map shows price-per-sqft movement across the Coachella Valley in real time. See which neighborhoods are actually moving. www.thepropertydna.com/market-heatmaps",
  "Real estate teams using AI property reports win listing appointments at higher rates. The research is done before the conversation starts. www.thepropertydna.com",
  "Neighborhood data signals most buyers miss: permit pull rate, owner-occupancy ratio changes, ppsf velocity. All in one report. www.thepropertydna.com/blog/neighborhood-data-signals",
  "STR performance in the Coachella Valley: Palm Springs central avg 71% occupancy, $285 ADR. Old Las Palmas: 64% occupancy, $420 ADR. www.thepropertydna.com",
];

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
const MEDIA_REQUIRED = ['instagram', 'tiktok', 'youtube'];

async function postToChannel(token, channelId, service, text) {
  if (MEDIA_REQUIRED.includes(service)) {
    throw new Error(`SKIP — ${service} requires media (image/video)`);
  }

  const input = {
    channelId,
    text,
    schedulingType: 'automatic',
    mode: 'shareNow',
  };

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
  const nextIndex = (tracker.lastIndex + 1) % SOCIAL_CONTENT.length;
  const text = SOCIAL_CONTENT[nextIndex];

  log(`Post ${nextIndex + 1}/${SOCIAL_CONTENT.length}: "${text.slice(0, 70)}..."`);

  try {
    const channels = await getChannels(creds.token);
    if (!channels.length) throw new Error('No active channels connected to Buffer');
    log(`Found ${channels.length} channel(s): ${channels.map(c => `${c.service}/${c.name}`).join(', ')}`);

    const results = [];
    for (const channel of channels) {
      try {
        const post = await postToChannel(creds.token, channel.id, channel.service, text);
        log(`  ✓ ${channel.service}/${channel.name}: ${post.externalLink || post.id}`);
        results.push({ channel: channel.service, status: 'posted' });
      } catch (e) {
        log(`  ✗ ${channel.service}/${channel.name}: ${e.message}`);
        results.push({ channel: channel.service, status: 'error', error: e.message });
      }
    }

    tracker.lastIndex = nextIndex;
    tracker.posts.push({ text: text.slice(0, 80), postedAt: new Date().toISOString(), results });
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

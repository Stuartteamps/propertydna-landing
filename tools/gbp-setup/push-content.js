/**
 * PropertyDNA — Google Business Profile content pusher
 * Prerequisites: run auth.js first to generate tokens.json
 * Usage: node push-content.js
 */

const axios = require('axios');
const fs = require('fs');

const TOKEN_PATH = './tokens.json';
const CREDENTIALS_PATH = './credentials.json';

// ─── ALL CONTENT ─────────────────────────────────────────────────────────────

const BUSINESS_INFO = {
  title: 'PropertyDNA',
  websiteUri: 'https://thepropertydna.com',
  profile: {
    description:
      'PropertyDNA is the Coachella Valley\'s AI-powered property intelligence platform — built for buyers, investors, agents, and developers who need a competitive edge. Instantly access comprehensive property reports, investment scorecards, permit history, market trend analysis, and neighborhood DNA for every parcel across the valley. Our platform combines public records, AI-driven scoring, and real-time market data to deliver insights in seconds. Serving Palm Springs, Palm Desert, Cathedral City, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Desert Hot Springs, and all Coachella Valley communities. First report free at thepropertydna.com.',
  },
  categories: {
    primaryCategory: { name: 'categories/gcid:real_estate_agency' },
    additionalCategories: [
      { name: 'categories/gcid:real_estate_consultant' },
      { name: 'categories/gcid:real_estate_service' },
      { name: 'categories/gcid:property_management_company' },
      { name: 'categories/gcid:information_technology_company' },
    ],
  },
  serviceArea: {
    businessType: 'CUSTOMER_LOCATION_ONLY',
    places: {
      placeInfos: [
        { placeName: 'Palm Springs, CA, USA' },
        { placeName: 'Palm Desert, CA, USA' },
        { placeName: 'Cathedral City, CA, USA' },
        { placeName: 'Rancho Mirage, CA, USA' },
        { placeName: 'Indian Wells, CA, USA' },
        { placeName: 'La Quinta, CA, USA' },
        { placeName: 'Indio, CA, USA' },
        { placeName: 'Coachella, CA, USA' },
        { placeName: 'Desert Hot Springs, CA, USA' },
        { placeName: 'Thousand Palms, CA, USA' },
        { placeName: 'Bermuda Dunes, CA, USA' },
        { placeName: 'Thermal, CA, USA' },
        { placeName: 'Mecca, CA, USA' },
        { placeName: 'North Palm Springs, CA, USA' },
      ],
    },
  },
  regularHours: {
    periods: [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
    ].map((day, i) => {
      const days = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
      return {
        openDay: day,
        openTime: { hours: 0, minutes: 0 },
        closeDay: days[(i + 1) % 7],
        closeTime: { hours: 0, minutes: 0 },
      };
    }),
  },
};

const QAS = [
  {
    question: 'What is PropertyDNA?',
    answer: 'PropertyDNA is an AI-powered property intelligence platform serving the Coachella Valley. We deliver instant property reports, investment scorecards, permit history, and market analysis for buyers, investors, agents, and developers.',
  },
  {
    question: 'How much does a property report cost?',
    answer: 'Your first property report is completely free. Additional reports are available with no subscription required — you pay only for what you need.',
  },
  {
    question: 'What areas do you cover?',
    answer: 'We cover all cities in the Coachella Valley including Palm Springs, Palm Desert, Cathedral City, Rancho Mirage, Indian Wells, La Quinta, Indio, Coachella, Desert Hot Springs, Thousand Palms, and surrounding communities.',
  },
  {
    question: 'How do I get a property report?',
    answer: 'Visit thepropertydna.com, enter any Coachella Valley property address, and get your instant report. No account required for your first free report.',
  },
  {
    question: 'What data is included in a property report?',
    answer: 'Each report includes ownership history, permit records, building details, AI investment score, market trend data, comparable sales, neighborhood analytics, flood zone, and more.',
  },
  {
    question: 'Are you a real estate agent or brokerage?',
    answer: 'No — PropertyDNA is a data and analytics platform, not a brokerage. We provide intelligence tools that help buyers, investors, and agents make better decisions.',
  },
  {
    question: 'How current is your data?',
    answer: 'Our data is updated regularly from Riverside County Assessor records, permit databases, and market data sources. Most data reflects current or near-current status.',
  },
  {
    question: 'Can real estate agents use PropertyDNA for clients?',
    answer: 'Yes — agents use PropertyDNA to provide clients with deeper property intelligence, strengthen listing presentations, and identify investment opportunities faster.',
  },
  {
    question: 'Is there a mobile app?',
    answer: 'Yes — PropertyDNA is available as a mobile app on iOS. Visit thepropertydna.com to get started on any device.',
  },
  {
    question: 'How do I contact PropertyDNA?',
    answer: 'Reach us via the contact form at thepropertydna.com. We respond promptly to all inquiries.',
  },
];

const POSTS = [
  {
    topicType: 'OFFER',
    summary:
      'Get your first Coachella Valley property report FREE. Enter any address and instantly access permit history, investment scoring, market trends, and more. Buyers, investors, and agents — this is the edge you\'ve been looking for.',
    callToAction: { actionType: 'LEARN_MORE', url: 'https://thepropertydna.com' },
  },
  {
    topicType: 'STANDARD',
    summary:
      'PropertyDNA now covers 168,000+ parcels across the Coachella Valley. From Palm Springs to Coachella, get instant intelligence on any property — ownership, permits, market data, and AI-powered investment scoring. Start your free report today.',
    callToAction: { actionType: 'LEARN_MORE', url: 'https://thepropertydna.com' },
  },
  {
    topicType: 'STANDARD',
    summary:
      'Permit history changes everything. Before you buy, know what\'s been built, modified, or flagged on any Coachella Valley property. PropertyDNA surfaces permit records, code violations, and building activity in seconds. First report free.',
    callToAction: { actionType: 'SIGN_UP', url: 'https://thepropertydna.com' },
  },
  {
    topicType: 'STANDARD',
    summary:
      'Coachella Valley real estate moves fast. PropertyDNA gives buyers, investors, and agents AI-powered property intelligence — investment scoring, market trends, and permit history for any of 168k+ valley parcels. Don\'t bid blind.',
    callToAction: { actionType: 'LEARN_MORE', url: 'https://thepropertydna.com' },
  },
];

// ─── AUTH ────────────────────────────────────────────────────────────────────

function loadTokens() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('\nERROR: tokens.json not found. Run "node auth.js" first.\n');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH));
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\nERROR: credentials.json not found.\n');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  return raw.installed || raw.web;
}

async function getAccessToken() {
  let tokens = loadTokens();

  // Refresh if expired (or within 60s of expiry)
  const expiresAt = tokens.expiry_date || 0;
  if (Date.now() >= expiresAt - 60000) {
    console.log('Refreshing access token...');
    const creds = loadCredentials();
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    tokens = { ...tokens, ...res.data, expiry_date: Date.now() + res.data.expires_in * 1000 };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }

  return tokens.access_token;
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────

async function api(method, endpoint, token, data = null) {
  const config = {
    method,
    url: endpoint,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) config.data = data;

  try {
    const res = await axios(config);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    const status = err.response?.status;
    throw new Error(`${status} ${msg} [${method} ${endpoint}]`);
  }
}

// ─── GBP OPERATIONS ───────────────────────────────────────────────────────────

async function getAccount(token) {
  const res = await api('GET', 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token);
  if (!res.accounts || res.accounts.length === 0) {
    throw new Error('No GBP accounts found. Make sure you are signed in with the right Google account.');
  }
  const account = res.accounts[0];
  console.log(`  Account: ${account.name} (${account.accountName})`);
  return account.name;
}

async function getOrCreateLocation(token, accountName) {
  const listUrl =
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
    `?readMask=name,title,storeCode`;
  const res = await api('GET', listUrl, token);

  if (res.locations && res.locations.length > 0) {
    const loc = res.locations[0];
    console.log(`  Existing location found: ${loc.name} (${loc.title})`);
    return loc.name;
  }

  console.log('  No location found — creating new PropertyDNA location...');
  const createUrl =
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
    `?validateOnly=false&requestId=propertydna-init-001`;
  const payload = {
    title: BUSINESS_INFO.title,
    websiteUri: BUSINESS_INFO.websiteUri,
    categories: BUSINESS_INFO.categories,
    serviceArea: BUSINESS_INFO.serviceArea,
  };
  const created = await api('POST', createUrl, token, payload);
  console.log(`  Location created: ${created.name}`);
  return created.name;
}

async function pushBusinessInfo(token, locationName) {
  const mask = [
    'title',
    'websiteUri',
    'profile.description',
    'categories',
    'serviceArea',
    'regularHours',
  ].join(',');
  const patchUrl =
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}` +
    `?updateMask=${encodeURIComponent(mask)}`;
  await api('PATCH', patchUrl, token, {
    title: BUSINESS_INFO.title,
    websiteUri: BUSINESS_INFO.websiteUri,
    profile: BUSINESS_INFO.profile,
    categories: BUSINESS_INFO.categories,
    serviceArea: BUSINESS_INFO.serviceArea,
    regularHours: BUSINESS_INFO.regularHours,
  });
  console.log('  Business info updated.');
}

async function pushQAs(token, locationName) {
  const qaUrl = `https://mybusinessqanda.googleapis.com/v1/${locationName}/questions`;
  let pushed = 0;

  for (const qa of QAS) {
    try {
      const question = await api('POST', qaUrl, token, { text: qa.question });
      const answerUrl = `https://mybusinessqanda.googleapis.com/v1/${question.name}/answers:upsert`;
      await api('POST', answerUrl, token, { text: qa.answer });
      pushed++;
      process.stdout.write(`  Q&A ${pushed}/${QAS.length} pushed\r`);
    } catch (err) {
      console.warn(`\n  Skipped Q&A "${qa.question.substring(0, 40)}...": ${err.message}`);
    }
  }
  console.log(`\n  ${pushed}/${QAS.length} Q&As pushed.`);
}

async function pushPosts(token, locationName) {
  // Posts use the older mybusiness v4 API path
  const accountAndLocation = locationName.replace('locations/', 'accounts/').includes('accounts/')
    ? locationName
    : locationName;
  const postsUrl = `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`;
  let pushed = 0;

  for (const post of POSTS) {
    try {
      await api('POST', postsUrl, token, post);
      pushed++;
      console.log(`  Post ${pushed}/${POSTS.length} created.`);
    } catch (err) {
      console.warn(`  Skipped post "${post.summary.substring(0, 40)}...": ${err.message}`);
    }
  }
  console.log(`  ${pushed}/${POSTS.length} posts created.`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== PropertyDNA GBP Content Push ===\n');

  const token = await getAccessToken();
  console.log('Access token ready.\n');

  console.log('[1/5] Getting GBP account...');
  const accountName = await getAccount(token);

  console.log('\n[2/5] Getting or creating location...');
  const locationName = await getOrCreateLocation(token, accountName);

  console.log('\n[3/5] Pushing business info (name, description, categories, hours, service areas)...');
  await pushBusinessInfo(token, locationName);

  console.log('\n[4/5] Pushing Q&As...');
  await pushQAs(token, locationName);

  console.log('\n[5/5] Creating Google Posts...');
  await pushPosts(token, locationName);

  console.log('\n=== Done! ===');
  console.log(`\nLocation: ${locationName}`);
  console.log('Check your GBP at: https://business.google.com\n');

  if (locationName.includes('unverified') || locationName === '') {
    console.log('NOTE: If this is a new listing, you still need to VERIFY the business.');
    console.log('Go to business.google.com → choose "Verify now" → postcard or video call.\n');
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});

// Creates a campaign + bulk-inserts contacts from parsed CSV data.
// Called from the CampaignManager UI after column mapping + preview.
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type': 'application/json',
};

// City-level DNA score lookup (from market data + Census ACS)
const CITY_SCORES = {
  'palm springs': { score: 74, label: 'Strong Buy' },
  'palm desert':  { score: 71, label: 'Buy' },
  'rancho mirage':{ score: 76, label: 'Strong Buy' },
  'indian wells': { score: 78, label: 'Strong Buy' },
  'la quinta':    { score: 73, label: 'Buy' },
  'indio':        { score: 65, label: 'Buy' },
  'cathedral city':{ score: 62, label: 'Hold' },
  'desert hot springs':{ score: 58, label: 'Hold' },
  'coachella':    { score: 60, label: 'Hold' },
  // Major CA markets
  'los angeles':  { score: 69, label: 'Buy' },
  'san diego':    { score: 72, label: 'Buy' },
  'san francisco':{ score: 67, label: 'Hold' },
  'sacramento':   { score: 70, label: 'Buy' },
  'irvine':       { score: 75, label: 'Strong Buy' },
  'santa barbara':{ score: 73, label: 'Buy' },
  'pasadena':     { score: 71, label: 'Buy' },
  'long beach':   { score: 68, label: 'Buy' },
  'anaheim':      { score: 66, label: 'Hold' },
  'riverside':    { score: 64, label: 'Hold' },
  'fresno':       { score: 58, label: 'Hold' },
  'bakersfield':  { score: 55, label: 'Watch' },
};

// ZIP → city for common CA codes
const ZIP_CITY = {
  '92262':'palm springs','92263':'palm springs','92264':'palm springs',
  '92234':'cathedral city','92260':'palm desert','92261':'palm desert',
  '92270':'rancho mirage','92210':'indian wells','92253':'la quinta',
  '92201':'indio','92202':'indio','92203':'indio','92236':'coachella',
  '92240':'desert hot springs','92241':'desert hot springs',
  '90001':'los angeles','90210':'beverly hills','92101':'san diego',
  '94102':'san francisco','95814':'sacramento','92612':'irvine',
};

function enrichContact(c) {
  const city = (c.city || ZIP_CITY[c.zip] || '').toLowerCase().trim();
  const lookup = CITY_SCORES[city];
  if (lookup) return { neighborhood_score: lookup.score, score_label: lookup.label };
  // Default by state
  return { neighborhood_score: 63, score_label: 'Hold' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"method not allowed"}' };

  const key = event.headers['x-internal-key'] || event.headers['x-admin-key'];
  if (key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"invalid json"}' }; }

  const { name, type, subject, template, contacts } = body;
  if (!name || !contacts?.length) return { statusCode: 400, headers: CORS, body: '{"error":"name and contacts required"}' };

  try {
    // Create campaign record
    const campaign = await db.insert('campaigns', {
      name, type: type || 'agent',
      subject: subject || `PropertyDNA — Your Market Intelligence Report`,
      template: template || 'agent',
      total_contacts: contacts.length,
      status: 'draft',
      created_by: 'admin',
    });
    const campaignId = campaign?.[0]?.id;
    if (!campaignId) throw new Error('Failed to create campaign');

    // Enrich + bulk insert contacts in batches of 500
    const enriched = contacts.map(c => ({
      campaign_id: campaignId,
      first_name:  c.first_name || c.firstName || '',
      last_name:   c.last_name  || c.lastName  || '',
      email:       (c.email || '').toLowerCase().trim(),
      phone:       c.phone || '',
      address:     c.address || '',
      city:        c.city || ZIP_CITY[c.zip] || '',
      state:       c.state || 'CA',
      zip:         c.zip || '',
      brokerage:   c.brokerage || c.company || '',
      license:     c.license || c.dre || '',
      property_type: c.property_type || c.propertyType || '',
      status: 'pending',
      ...enrichContact(c),
    })).filter(c => c.email && c.email.includes('@'));

    const BATCH = 500;
    for (let i = 0; i < enriched.length; i += BATCH) {
      await db.insert('campaign_contacts', enriched.slice(i, i + BATCH));
    }

    // Update actual valid count
    await db.upsert('campaigns', { id: campaignId, total_contacts: enriched.length }, 'id');

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ campaignId, total: enriched.length, skipped: contacts.length - enriched.length }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

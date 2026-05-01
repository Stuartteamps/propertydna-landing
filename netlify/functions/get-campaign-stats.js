// Returns campaign list or per-campaign contact status counts.
// GET ?id=campaignId → { campaign, counts: { pending, sent, opened, clicked, bounced, ... } }
// GET (no id)        → { campaigns: [...] }
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const key = event.headers['x-internal-key'] || event.headers['x-admin-key'];
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };

  const id = event.queryStringParameters?.id;

  try {
    if (id) {
      // Single campaign + contact status breakdown
      const campaigns = await db.from('campaigns').select('*').eq('id', id).get();
      const campaign  = campaigns?.[0];
      if (!campaign) return { statusCode: 404, headers: CORS, body: '{"error":"not found"}' };

      const contacts = await db.from('campaign_contacts').select('status').eq('campaign_id', id).get();
      const counts = (contacts || []).reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ campaign, counts }) };
    }

    // List all campaigns
    const campaigns = await db.from('campaigns')
      .select('id,name,type,status,subject,total_contacts,sent_count,opened_count,clicked_count,bounced_count,unsubscribed_count,launched_at,completed_at,created_at')
      .order('created_at', { ascending: false }).limit(50).get();

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ campaigns: campaigns || [] }) };
  } catch (err) {
    console.error('[get-campaign-stats]', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

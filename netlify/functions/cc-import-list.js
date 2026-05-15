/**
 * cc-import-list — Create a CC list + bulk-import contacts in one call.
 *
 * POST body: {
 *   listName:   "...",          required (creates new list with this name)
 *   listId?:    "uuid",         optional (use this existing list instead of creating)
 *   contacts:   [{ email, first_name, last_name, phone, street, city, state, zip }]
 *   description?: "..."
 * }
 *
 * Auth: x-internal-key header
 */
const https = require('https');
const db    = require('./_supabase');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-internal-key',
};

function api(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.cc.email', path: `/v3${path}`, method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const rows = await db.from('oauth_tokens')
    .select('access_token,expires_at')
    .eq('provider', 'constant_contact')
    .limit(1).get();
  return rows?.[0]?.access_token || process.env.CC_ACCESS_TOKEN || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"POST only"}' };

  const key = event.headers['x-internal-key'];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: '{"error":"bad json"}' }; }

  const { listName, listId, contacts, description } = body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { statusCode: 400, headers: CORS, body: '{"error":"contacts array required"}' };
  }

  const token = await getToken();
  if (!token) return { statusCode: 502, headers: CORS, body: '{"error":"no CC token available"}' };

  // 1. Create or use list
  let finalListId = listId;
  if (!finalListId) {
    if (!listName) return { statusCode: 400, headers: CORS, body: '{"error":"listName or listId required"}' };
    const r = await api('POST', '/contact_lists', token, {
      name: listName,
      description: description || `PropertyDNA segment: ${listName}`,
      favorite: false,
    });
    if (r.status !== 200 && r.status !== 201) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'list create failed', cc: r }) };
    }
    finalListId = r.data?.list_id;
  }

  // 2. Bulk import contacts
  const cleanContacts = contacts
    .filter(c => c.email && c.email.includes('@'))
    .map(c => ({
      email: c.email.toLowerCase().trim(),
      first_name: c.first_name || '',
      last_name:  c.last_name  || '',
      phone:      c.phone || '',
      street:     c.street || c.address || '',
      city:       c.city  || '',
      state:      c.state || '',
      zip:        c.zip   || '',
    }));

  const r = await api('POST', '/activities/contacts_json_import', token, {
    import_data: cleanContacts,
    list_ids: [finalListId],
  });

  return {
    statusCode: r.status < 300 ? 200 : 502,
    headers: CORS,
    body: JSON.stringify({
      listId: finalListId,
      listName: listName || '(existing)',
      contactsSent: cleanContacts.length,
      ccStatus: r.status,
      ccResponse: r.data,
    }),
  };
};

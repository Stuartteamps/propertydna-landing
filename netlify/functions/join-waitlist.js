// join-waitlist — international waitlist signup
// Accepts POST { email, full_name?, country_code?, country_name?, city?, state?, address?, source? }
// Best-effort insert; idempotent on (email, country_code).
const db = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: '{"error":"Invalid JSON"}' }; }

  const email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: CORS, body: '{"error":"Valid email required"}' };
  }

  const row = {
    email,
    full_name:    body.full_name    || null,
    country_code: (body.country_code || '').toUpperCase().slice(0, 2) || null,
    country_name: body.country_name || null,
    city:         body.city         || null,
    state:        body.state        || null,
    address:      body.address      || null,
    source:       body.source       || 'manual',
    ip:           event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || null,
    user_agent:   event.headers['user-agent'] || null,
  };

  try {
    await db.insert('waitlist', row);
    db.kpi('waitlist_signup', email, { country: row.country_code, source: row.source });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    // Duplicate is fine — treat as success
    const msg = String(err?.message || '');
    if (msg.includes('duplicate') || msg.includes('23505')) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, duplicate: true }) };
    }
    console.error('[join-waitlist]', msg);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: msg }) };
  }
};

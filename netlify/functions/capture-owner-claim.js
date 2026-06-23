/**
 * Owner Portal — claim capture.
 * POST a claim of ownership for a property. Writes to property_owner_claims
 * (status 'pending') and any volunteered facts to property_owner_updates
 * (status 'pending_review', feeds_valuation false).
 *
 * Phase 1: claim never grants verification. Verification flow ships in Phase 2
 * (Persona / Stripe Identity / deed-document upload + review).
 *
 * Optionally emails the claimer a confirmation if Resend is configured.
 *
 * NOTE: Tables `property_owner_claims` and `property_owner_updates` are defined
 * in supabase/migrations/proposed_phase1_owner_governance.sql — that migration
 * has NOT been applied yet. Calls to this function will return 500 until the
 * migration runs in production. This is intentional: ships behind unapplied
 * schema so the UI/route is reviewable on the branch without changing prod data.
 */
const SUPA_URL  = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM       = process.env.RESEND_FROM_TRANSACTIONAL || 'reports@thepropertydna.com';
const NOTIFY_TO  = process.env.OWNER_CLAIM_NOTIFY_TO || 'stuartteamps@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });

const RELATIONSHIPS = new Set(['owner', 'co_owner', 'trustee', 'agent_of_record', 'family_member', 'other']);

async function supaReq(path, init = {}) {
  return fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return reply(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'invalid json' }); }

  const apn = String(body.apn || '').trim();
  const email = String(body.claimed_email || '').trim().toLowerCase();
  const relationship = String(body.relationship || 'owner');

  if (!apn) return reply(400, { error: 'apn required' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'valid email required' });
  if (!RELATIONSHIPS.has(relationship)) return reply(400, { error: 'invalid relationship' });

  const headers = event.headers || {};
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim() || headers['client-ip'] || null;
  const ua = headers['user-agent'] || null;

  // 1. Insert the claim
  let claimId = null;
  try {
    const r = await supaReq('/rest/v1/property_owner_claims', {
      method: 'POST',
      body: JSON.stringify({
        apn,
        county_fips:   body.county_fips || null,
        state:         body.state || null,
        claimed_email: email,
        claimed_name:  body.claimed_name || null,
        claimed_phone: body.claimed_phone || null,
        relationship,
        status:        'pending',
        source:        body.source || 'web_owner_portal',
        ip_address:    ip,
        user_agent:    ua,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('[owner-claim insert]', r.status, txt.slice(0, 200));
      return reply(500, { error: 'claim insert failed', detail: txt.slice(0, 200) });
    }
    const rows = await r.json();
    claimId = rows?.[0]?.id || null;
  } catch (e) {
    return reply(500, { error: 'claim insert error', detail: String(e?.message || e).slice(0, 160) });
  }

  // 2. Insert volunteered updates if present (each as a separate row)
  const updates = body.updates || {};
  const updateRows = [];
  if (updates.insurance_annual != null)     updateRows.push({ update_type: 'insurance_cost', payload: { annual_usd: Number(updates.insurance_annual) } });
  if (updates.property_tax_annual != null)  updateRows.push({ update_type: 'tax_info',       payload: { annual_usd: Number(updates.property_tax_annual) } });
  if (updates.open_to_offers === true)      updateRows.push({ update_type: 'note',           payload: { kind: 'open_to_offers', value: true } });
  if (updates.improvements)                 updateRows.push({ update_type: 'remodel',        payload: { description: updates.improvements } });
  if (updates.permits)                      updateRows.push({ update_type: 'permit',         payload: { description: updates.permits } });
  if (updates.private_notes)                updateRows.push({ update_type: 'note',           payload: { kind: 'private', text: updates.private_notes } });

  if (updateRows.length && claimId) {
    try {
      await supaReq('/rest/v1/property_owner_updates', {
        method: 'POST',
        body: JSON.stringify(updateRows.map(u => ({
          ...u, claim_id: claimId, apn, status: 'pending_review', feeds_valuation: false,
        }))),
      });
    } catch (e) {
      console.warn('[owner-claim updates]', e?.message);
    }
  }

  // 3. Confirmation + internal notify (best-effort)
  if (RESEND_KEY) {
    const ack = `Hi${body.claimed_name ? ' ' + body.claimed_name : ''},

Your claim on property ${apn} has been received and entered the Data Integrity Office queue.

Status: Pending verification
Reference: ${claimId}

Any improvements or facts you submitted are tagged "pending review" and do not currently influence the public valuation displayed on the property's page. When identity verification ships, we'll email you to complete it and unlock the Owner-verified badge.

You may withdraw your claim at any time by replying to this email.

— PropertyDNA Data Integrity Office`;

    Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: email, subject: `Claim received — ${apn}`, text: ack }),
      }).catch(() => {}),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: NOTIFY_TO,
          subject: `[Owner claim] ${apn} — ${email}`,
          text: `New owner claim received.

APN: ${apn}
State: ${body.state || '?'}
Email: ${email}
Name: ${body.claimed_name || '(none)'}
Phone: ${body.claimed_phone || '(none)'}
Relationship: ${relationship}
Source: ${body.source || 'web_owner_portal'}
Claim ID: ${claimId}

Updates submitted:
${JSON.stringify(updates, null, 2)}
`,
        }),
      }).catch(() => {}),
    ]);
  }

  return reply(200, { ok: true, claim_id: claimId, status: 'pending' });
};

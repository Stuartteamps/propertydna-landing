/**
 * Data Integrity Office — error report capture.
 * POST a data error / dispute. Writes to data_disputes (status 'open').
 *
 * Table `data_disputes` is defined in
 * supabase/migrations/proposed_phase1_owner_governance.sql — not applied to
 * prod yet. This function ships behind the unapplied schema so the
 * /data-integrity/report-error UI is reviewable on the branch without
 * changing prod data.
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

const VALID_ROLES = new Set(['owner', 'buyer', 'agent', 'researcher', 'other']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return reply(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'invalid json' }); }

  const email = String(body.reporter_email || '').trim().toLowerCase();
  const role  = String(body.reporter_role || 'other');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'valid email required' });
  if (!VALID_ROLES.has(role)) return reply(400, { error: 'invalid role' });
  if (!body.apn && !body.view_token) return reply(400, { error: 'apn or view_token required' });

  // Insert dispute
  let disputeId = null;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/data_disputes`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        apn:             body.apn || null,
        view_token:      body.view_token || null,
        reporter_email:  email,
        reporter_role:   role,
        field_in_error:  body.field_in_error || null,
        current_value:   body.current_value || null,
        proposed_value:  body.proposed_value || null,
        evidence_text:   body.evidence_text || null,
        evidence_url:    body.evidence_url || null,
        status:          'open',
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('[dispute insert]', r.status, txt.slice(0, 200));
      return reply(500, { error: 'insert failed', detail: txt.slice(0, 200) });
    }
    const rows = await r.json();
    disputeId = rows?.[0]?.id || null;
  } catch (e) {
    return reply(500, { error: 'insert error', detail: String(e?.message || e).slice(0, 160) });
  }

  // Best-effort emails
  if (RESEND_KEY) {
    const ack = `Thank you for the data correction.

Reference: ${disputeId}
Property: ${body.apn ? `APN ${body.apn}` : `report ${body.view_token}`}
Field: ${body.field_in_error || '(not specified)'}

A reviewer will look at this within ~5 business days. We'll email you with the outcome.

— PropertyDNA Data Integrity Office`;

    Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: email, subject: 'Data correction received', text: ack }),
      }).catch(() => {}),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: NOTIFY_TO,
          subject: `[Data dispute] ${body.apn || body.view_token} — ${body.field_in_error || 'unspecified'}`,
          text: `Dispute ${disputeId}
From: ${email} (${role})
APN: ${body.apn || '-'}
View token: ${body.view_token || '-'}
Field: ${body.field_in_error || '-'}
Current: ${body.current_value || '-'}
Proposed: ${body.proposed_value || '-'}

Evidence:
${body.evidence_text || '(none provided)'}
`,
        }),
      }).catch(() => {}),
    ]);
  }

  return reply(200, { ok: true, dispute_id: disputeId, status: 'open' });
};

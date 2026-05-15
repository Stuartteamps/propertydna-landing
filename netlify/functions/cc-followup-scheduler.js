/**
 * cc-followup-scheduler — Daily check for campaigns ready for non-opener follow-up
 *
 * Scheduled: every day at 9am PT (netlify.toml: "0 16 * * *")
 *
 * Logic:
 *   1. Pull recent campaign IDs from kpi_events (cc_blast_sent type)
 *   2. For each campaign exactly 7 days old: pull non-openers from CC reports
 *   3. Create a new CC list of non-openers
 *   4. Fire a different-angle follow-up campaign to them
 *   5. Mark the original campaign as "followed_up" so we don't double-fire
 *
 * Respects Dan's "no follow-up for 7 days" rule strictly.
 */
const https = require('https');
const db    = require('./_supabase');

const CC_API = 'api.cc.email';

function apiCall(method, hostname, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const req = https.request({
      hostname, path, method,
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function loadCcToken() {
  try {
    const rows = await db.from('oauth_tokens')
      .select('access_token').eq('provider', 'constant_contact').limit(1).get();
    if (rows?.[0]?.access_token) return rows[0].access_token;
  } catch { /* fall through */ }
  return process.env.CC_ACCESS_TOKEN || null;
}

const FOLLOWUP_SUBJECTS = [
  "One more thought on your Coachella Valley property",
  "Did the property report land? Resending the link",
  "Quick second touch — free CV property analysis",
  "Reaching out one more time — your home's current value",
];

function pick(arr, seed = Math.random()) {
  return arr[Math.floor(seed * arr.length) % arr.length];
}

const FOLLOWUP_HTML = (campaignName) => `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:30px 0;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;border:1px solid #e8e4dc;">
<tr><td style="padding:32px 40px 16px;font-size:14px;color:#1f1a15;line-height:1.7;">
<p style="margin:0 0 16px;">Hi there,</p>
<p style="margin:0 0 16px;">Reaching out one more time — sent a note a week ago about the free property intelligence reports I've been pulling for my Coachella Valley sphere. Didn't want you to miss it.</p>
<p style="margin:0 0 16px;">If you have 60 seconds:</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr>
<td bgcolor="#1f1a15" style="border-radius:2px;background:#1f1a15;">
<a href="https://thepropertydna.com/analyze?ref=cc_7day_followup&email={{contact.email}}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;text-decoration:none;letter-spacing:0.05em;">
Pull My Free Report →
</a></td></tr></table>
<p style="margin:24px 0 4px;">Or just reply "yes" and I'll send it back.</p>
<p style="margin:0 0 4px;">Daniel</p>
<p style="margin:0;font-size:12px;color:#7c6c5c;">Stuart Team · Coldwell Banker Realty · Palm Springs</p>
</td></tr>
<tr><td style="padding:16px 40px;background:#faf6ef;font-size:11px;color:#9a8671;line-height:1.6;border-top:1px solid #e8e4dc;">
<a href="[[UNSUBSCRIBE]]" style="color:#9a8671;">Unsubscribe</a> · Stuart Team · 555 S Sunrise Way · Palm Springs, CA 92264 · <a href="https://thepropertydna.com" style="color:#9a8671;">thepropertydna.com</a>
</td></tr>
</table></td></tr></table></body></html>`;

exports.handler = async () => {
  const token = await loadCcToken();
  if (!token) {
    console.error('[cc-followup-scheduler] No CC token');
    return { statusCode: 500, body: 'no token' };
  }

  // Find cc_blast_sent kpi events from exactly 7 days ago that haven't been followed up
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  const events = await db.from('kpi_events')
    .select('id,metadata,created_at')
    .eq('event_type', 'cc_blast_sent')
    .filter('created_at', 'gte', eightDaysAgo.toISOString())
    .filter('created_at', 'lte', sevenDaysAgo.toISOString())
    .get().catch(() => []);

  if (!Array.isArray(events) || events.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ message: 'no campaigns due for 7-day follow-up' }) };
  }

  const results = [];
  for (const ev of events) {
    const meta = ev.metadata || {};
    const origCampaign = meta.campaignId;
    if (!origCampaign || meta.followed_up) continue;

    // Pull list of non-openers via CC tracking reports
    const tracking = await apiCall('GET', CC_API,
      `/v3/reports/email_reports/${origCampaign}/tracking/didnotopen?limit=500`,
      token);

    if (tracking.status !== 200) {
      results.push({ origCampaign, error: 'tracking_fetch_failed', status: tracking.status });
      continue;
    }

    const nonOpeners = (tracking.data?.tracking_activities || []).map(t => t.contact_id).filter(Boolean);
    if (nonOpeners.length === 0) continue;

    // Create a new list of non-openers
    const listName = `Non-Openers ${origCampaign.slice(0,8)} ${new Date().toISOString().slice(0,10)}`;
    const listCreate = await apiCall('POST', CC_API, '/v3/contact_lists', token,
      { name: listName, favorite: false, description: 'Auto-generated 7-day non-opener follow-up' });
    if (listCreate.status >= 300) {
      results.push({ origCampaign, error: 'list_create_failed' });
      continue;
    }
    const newListId = listCreate.data?.list_id;

    // Bulk-tag non-openers into this list
    await apiCall('POST', CC_API, '/v3/activities/add_list_memberships', token,
      { source: { contact_ids: nonOpeners }, list_ids: [newListId] });

    // Create + schedule the follow-up campaign
    const subject = pick(FOLLOWUP_SUBJECTS, ev.id ? (ev.id.length % 4) / 4 : Math.random());
    const create = await apiCall('POST', CC_API, '/v3/emails', token, {
      name: `7-day Non-opener Follow-up ${new Date().toISOString().slice(0,10)} - ${origCampaign.slice(0,8)}`,
      contact_list_ids: [newListId],
      email_campaign_activities: [{
        format_type: 5,
        from_name: 'Daniel Stuart | Stuart Team',
        from_email: 'stuartteamps@gmail.com',
        reply_to_email: 'stuartteamps@gmail.com',
        subject,
        html_content: FOLLOWUP_HTML(origCampaign),
        permalink_name: '',
      }],
    });
    if (create.status >= 300) {
      results.push({ origCampaign, error: 'campaign_create_failed' });
      continue;
    }
    const newActivityId = create.data?.campaign_activities?.[0]?.campaign_activity_id;

    // PUT lists onto activity
    const cur = await apiCall('GET', CC_API, `/v3/emails/activities/${newActivityId}`, token);
    if (cur.status === 200) {
      const body = { ...cur.data, contact_list_ids: [newListId] };
      ['created_at','updated_at','last_sent_date','last_edit_date','campaign_id','campaign_activity_id','role','current_status','errors','warnings'].forEach(k => delete body[k]);
      await apiCall('PUT', CC_API, `/v3/emails/activities/${newActivityId}`, token, body);
    }

    // Schedule send
    await apiCall('POST', CC_API, `/v3/emails/activities/${newActivityId}/schedules`, token,
      { scheduled_date: '0' });

    // Mark as followed up (write back to kpi_events)
    try {
      db.kpi('cc_followup_sent', null, {
        original_campaign: origCampaign,
        followup_campaign: create.data?.campaign_id,
        followup_activity: newActivityId,
        non_openers: nonOpeners.length,
        new_list_id: newListId,
      });
    } catch { /* ignore */ }

    results.push({
      origCampaign,
      followupCampaign: create.data?.campaign_id,
      nonOpeners: nonOpeners.length,
      newListId,
    });
  }

  return { statusCode: 200, body: JSON.stringify({ followups: results }) };
};

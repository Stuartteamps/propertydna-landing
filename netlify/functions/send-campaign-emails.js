// Sends a batch of 50 campaign emails via Resend.
// Called repeatedly by CampaignManager until done=true.
const https = require('https');
const db    = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type': 'application/json',
};

const BATCH_SIZE  = 50;
const SENDER      = process.env.SENDER_EMAIL || 'reports@thepropertydna.com';
const SENDER_NAME = process.env.SENDER_NAME || 'PropertyDNA powered by IntellaGraphAI';
const SITE_URL    = 'https://thepropertydna.com';

function resendPost(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: {} }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function agentHtml(c, campaign) {
  const firstName = c.first_name || 'there';
  const city      = c.city || 'Coachella Valley';
  const score     = c.neighborhood_score || 71;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(c.email)}&amp;cid=${c.campaign_id}`;
  const ctaUrl    = `${SITE_URL}/?ref=agent_campaign&amp;city=${encodeURIComponent(city)}`;
  const mapUrl    = `${SITE_URL}/market-heatmaps?ref=agent_campaign`;

  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PropertyDNA</title></head>
<body style="margin:0;padding:0;background:#F4F0E8;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F0E8"><tr><td align="center" style="padding:20px 10px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#ffffff;border:1px solid #e8e4dc">
  <tr><td style="background:#0F0E0D;padding:32px 40px">
    <p style="font-family:Georgia,serif;color:#F4F0E8;font-size:22px;font-weight:400;margin:0;letter-spacing:0.5px">PropertyDNA</p>
    <p style="color:#6B6252;font-size:11px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase">Market Intelligence &bull; ${city}</p>
  </td></tr>
  <tr><td style="background:#0A0908;padding:20px 40px">
    <p style="color:#F4F0E8;font-size:15px;font-weight:600;margin:0">${city} Ranked ${score}/100 &mdash; ${label}</p>
    <p style="color:#6B6252;font-size:11px;margin:4px 0 0">Live composite &bull; comps &bull; DOM &bull; permits &bull; livability &bull; rental demand</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">Hi ${firstName},</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">PropertyDNA just ranked the <strong>${city}</strong> market <strong>${score} out of 100</strong> &mdash; a <strong>${label}</strong> signal based on live comparable sales, days on market velocity, permit activity, and rental demand.</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">Every property has a unique DNA score. PropertyDNA shows you exactly where the value is, what&rsquo;s driving price movement, and which properties are outperforming their neighbors.</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 24px"><strong>Your first full property report is free.</strong></p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0"><tr>
      <td align="center" bgcolor="#B89355" style="border-radius:3px;background:#B89355">
        <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#0F0E0D;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;border-radius:3px;background:#B89355;mso-padding-alt:14px 28px">&rarr; See the ${city} Live Ranking</a>
      </td>
    </tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" style="border:1px solid #B89355;border-radius:3px">
        <a href="${mapUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:500;color:#B89355;text-decoration:none;border-radius:3px">View the Live Heat Map</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px;border-top:1px solid #e8e4dc">
    <p style="font-size:11px;color:#999999;line-height:1.6;margin:0">PropertyDNA &bull; <a href="https://thepropertydna.com" style="color:#999999;text-decoration:underline">thepropertydna.com</a> &bull; reports@thepropertydna.com<br>
    <a href="${unsub}" style="color:#999999;text-decoration:underline">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buyerHtml(c, campaign) {
  const firstName = c.first_name || 'there';
  const city      = c.city || 'Coachella Valley';
  const score     = c.neighborhood_score || 71;
  const label     = c.score_label || 'Buy';
  const unsub     = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(c.email)}&amp;cid=${c.campaign_id}`;
  const ctaUrl    = `${SITE_URL}/?ref=homeowner_campaign`;
  const mapUrl    = `${SITE_URL}/market-heatmaps?ref=homeowner_campaign`;

  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PropertyDNA</title></head>
<body style="margin:0;padding:0;background:#F4F0E8;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F0E8"><tr><td align="center" style="padding:20px 10px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#ffffff;border:1px solid #e8e4dc">
  <tr><td style="background:#0F0E0D;padding:32px 40px">
    <p style="font-family:Georgia,serif;color:#F4F0E8;font-size:22px;font-weight:400;margin:0;letter-spacing:0.5px">PropertyDNA</p>
    <p style="color:#6B6252;font-size:11px;margin:6px 0 0;letter-spacing:2px;text-transform:uppercase">Property Intelligence &bull; ${city}</p>
  </td></tr>
  <tr><td style="background:#0A0908;padding:20px 40px">
    <p style="color:#6B6252;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px">Your ${city} Property Ranked</p>
    <p style="font-family:Georgia,serif;color:#B89355;font-size:32px;font-weight:400;margin:0">${score} / 100</p>
    <p style="color:#6B6252;font-size:11px;margin:6px 0 0">${label} &bull; Live market composite &bull; Updated daily</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">Hi ${firstName},</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">PropertyDNA ranked your area in <strong>${city}</strong> at <strong>${score}/100</strong> &mdash; a <strong>${label}</strong> signal based on live comparable sales, days on market trends, permit activity, and rental demand.</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 16px">Your full PropertyDNA report goes further: property-level comps, flood and hazard exposure, renovation ROI estimate, and a 5-year value trajectory specific to your address.</p>
    <p style="color:#333333;font-size:15px;line-height:1.7;margin:0 0 24px"><strong>Your first full report is free &mdash; no card required.</strong></p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0"><tr>
      <td align="center" bgcolor="#B89355" style="border-radius:3px;background:#B89355">
        <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#0F0E0D;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;border-radius:3px;background:#B89355;mso-padding-alt:14px 28px">&rarr; Get Your Free PropertyDNA Report</a>
      </td>
    </tr></table>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0"><tr>
      <td align="center" style="border:1px solid #B89355;border-radius:3px">
        <a href="${mapUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:500;color:#B89355;text-decoration:none;border-radius:3px">View the ${city} Live Heat Map</a>
      </td>
    </tr></table>
    <p style="font-size:12px;color:#888888;margin:0">Takes 60 seconds &bull; AI-generated &bull; Delivered to your inbox</p>
  </td></tr>
  <tr><td style="padding:16px 40px;border-top:1px solid #e8e4dc">
    <p style="font-size:11px;color:#999999;line-height:1.6;margin:0">PropertyDNA &bull; <a href="https://thepropertydna.com" style="color:#999999;text-decoration:underline">thepropertydna.com</a> &bull; reports@thepropertydna.com<br>
    <a href="${unsub}" style="color:#999999;text-decoration:underline">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function getHtml(c, campaign) {
  const tmpl = campaign?.template || campaign?.type || 'agent';
  return (tmpl === 'buyer' || tmpl === 'homeowner') ? buyerHtml(c, campaign) : agentHtml(c, campaign);
}

function getSubject(c, campaign) {
  const city  = c.city || 'Coachella Valley';
  const score = c.neighborhood_score || 71;
  const tmpl  = campaign?.template || campaign?.type || 'agent';
  if (tmpl === 'buyer' || tmpl === 'homeowner') {
    return `Your ${city} Property Ranked ${score}/100 by PropertyDNA`;
  }
  return campaign?.subject || `Your ${city} Property Ranked ${score}/100 by PropertyDNA`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{}' };

  const key = event.headers['x-internal-key'] || event.headers['x-admin-key'];
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };

  const { campaignId } = JSON.parse(event.body || '{}');
  if (!campaignId) return { statusCode: 400, headers: CORS, body: '{"error":"campaignId required"}' };

  // Load campaign
  const campaigns = await db.from('campaigns').select('*').eq('id', campaignId).get();
  const campaign  = campaigns?.[0];
  if (!campaign) return { statusCode: 404, headers: CORS, body: '{"error":"campaign not found"}' };

  if (campaign.status === 'draft') {
    await db.update('campaigns', { id: campaignId }, { status: 'sending', launched_at: new Date().toISOString() }).catch(() => {});
  }

  // Global unsubscribes
  let unsubSet = new Set();
  try {
    const unsubs = await db.from('campaign_unsubscribes').select('email').get();
    if (Array.isArray(unsubs)) unsubs.forEach(u => unsubSet.add(u.email.toLowerCase()));
  } catch { /* non-critical */ }

  // Next pending batch
  const contacts = await db.from('campaign_contacts')
    .select('*').eq('campaign_id', campaignId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(BATCH_SIZE).get();

  if (!Array.isArray(contacts) || contacts.length === 0) {
    await db.update('campaigns', { id: campaignId }, { status: 'complete', completed_at: new Date().toISOString() }).catch(() => {});
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ done: true, sent: 0 }) };
  }

  let sent = 0, skipped = 0;
  for (const contact of contacts) {
    if (unsubSet.has((contact.email || '').toLowerCase())) {
      await db.from('campaign_contacts').eq('id', contact.id).update({ status: 'unsubscribed' }).catch(() => {});
      skipped++;
      continue;
    }
    try {
      const result = await resendPost({
        from: `${SENDER_NAME} <${SENDER}>`,
        to: [contact.email],
        subject: getSubject(contact, campaign),
        html: getHtml(contact, campaign),
        tags: [{ name: 'campaign_id', value: campaignId }],
      });
      const ok = result.status < 300;
      const sentAt = new Date().toISOString();
      await db.from('campaign_contacts').eq('id', contact.id).update({
        status: ok ? 'sent' : 'bounced',
        sent_at: sentAt,
        resend_id: ok ? (result.data?.id || null) : null,
      }).catch(() => {});
      db.insert('email_delivery_events', {
        recipient_email: contact.email,
        sender_email:    SENDER,
        subject:         getSubject(contact, campaign),
        status:          ok ? 'sent' : 'failed',
        provider:        'resend',
        metadata:        { source: 'propertydna_campaign', campaign_id: campaignId, resend_id: result.data?.id || null },
      }).catch(() => {});
      if (ok) { sent++; } else { skipped++; }
    } catch {
      await db.from('campaign_contacts').eq('id', contact.id).update({ status: 'skipped' }).catch(() => {});
      skipped++;
    }
    // Pace to avoid Resend rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Update sent_count
  const fresh = await db.from('campaigns').select('sent_count').eq('id', campaignId).get();
  const prevSent = fresh?.[0]?.sent_count || 0;
  const newSent  = prevSent + sent;
  const remaining = Math.max(0, (campaign.total_contacts || 0) - newSent);
  await db.update('campaigns', { id: campaignId }, {
    sent_count: newSent,
    ...(remaining <= 0 ? { status: 'complete', completed_at: new Date().toISOString() } : {}),
  }).catch(() => {});

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({ done: remaining <= 0, sent, skipped, remaining }),
  };
};

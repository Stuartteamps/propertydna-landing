const db = require('./_supabase');

const CORS = { 'Content-Type': 'text/html' };

exports.handler = async (event) => {
  const { email, cid } = event.queryStringParameters || {};
  if (!email) return { statusCode: 400, headers: CORS, body: 'Missing email.' };

  const normalized = decodeURIComponent(email).toLowerCase().trim();

  let upsertErr = null;
  let updateErr = null;
  try {
    await db.upsert('campaign_unsubscribes', { email: normalized }, 'email');
  } catch (e) { upsertErr = e.message; }

  // Suppress across ALL campaigns the recipient is on, not just the cid in the link.
  // Otherwise duplicated contacts keep getting drips from other campaigns (GDPR violation).
  try {
    await db.from('campaign_contacts')
      .eq('email', normalized)
      .neq('status', 'unsubscribed')
      .update({ status: 'unsubscribed', last_event: 'unsubscribed' });
  } catch (e) { updateErr = e.message; }

  if (upsertErr || updateErr) {
    console.error('[campaign-unsubscribe]', { email: normalized, cid, upsertErr, updateErr });
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:sans-serif;background:#F4F0E8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;padding:40px 48px;text-align:center;border:1px solid #e8e4dc;max-width:400px}
h2{font-family:Georgia,serif;font-weight:400;color:#0F0E0D;margin-bottom:12px}
p{color:#6B6252;font-size:13px;line-height:1.6}
a{color:#E8B84B;font-size:12px}</style></head>
<body><div class="box">
<h2>You've been unsubscribed.</h2>
<p>You won't receive any more campaign emails from PropertyDNA.</p>
<p style="margin-top:20px"><a href="https://thepropertydna.com">← Back to PropertyDNA</a></p>
</div></body></html>`,
  };
};

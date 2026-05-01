const db = require('./_supabase');

const CORS = { 'Content-Type': 'text/html' };

exports.handler = async (event) => {
  const { email, cid } = event.queryStringParameters || {};
  if (!email) return { statusCode: 400, headers: CORS, body: 'Missing email.' };

  const normalized = decodeURIComponent(email).toLowerCase().trim();

  await db.upsert('campaign_unsubscribes', { email: normalized }, 'email').catch(() => {});
  if (cid) {
    await db.supabase.from('campaign_contacts')
      .update({ status: 'unsubscribed' })
      .eq('campaign_id', cid)
      .eq('email', normalized)
      .catch(() => {});
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:sans-serif;background:#F4F0E8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;padding:40px 48px;text-align:center;border:1px solid #e8e4dc;max-width:400px}
h2{font-family:Georgia,serif;font-weight:400;color:#0F0E0D;margin-bottom:12px}
p{color:#6B6252;font-size:13px;line-height:1.6}
a{color:#B89355;font-size:12px}</style></head>
<body><div class="box">
<h2>You've been unsubscribed.</h2>
<p>You won't receive any more campaign emails from PropertyDNA.</p>
<p style="margin-top:20px"><a href="https://thepropertydna.com">← Back to PropertyDNA</a></p>
</div></body></html>`,
  };
};

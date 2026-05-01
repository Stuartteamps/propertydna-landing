// Runs every hour via cron. Finds contacts ready for their next drip step and sends.
// Schedule defined in netlify.toml: [functions."drip-sequence"] schedule = "0 * * * *"
//
// Rules:
//   Step 2 (opener follow-up)  → contact opened ≥24h ago, follow_up_step = 0, never clicked
//   Step 3 (7-day re-engage)   → sent ≥7 days ago, follow_up_step < 3, never opened
const db = require('./_supabase');
const { sendFollowUp } = require('./resend-webhook');

exports.handler = async () => {
  const now = new Date();

  try {
    // ── Step 2: opened ≥ 24h ago, didn't click, no follow-up yet ──────────
    const h24ago = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const openers = await db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,opened_at,clicked_at,follow_up_step,status')
      .eq('follow_up_step', 0)
      .eq('status', 'sent')
      .get();

    if (Array.isArray(openers)) {
      for (const c of openers) {
        if (!c.opened_at) continue;
        if (c.clicked_at) continue;
        if (new Date(c.opened_at) > new Date(h24ago)) continue;

        const ok = await sendFollowUp(c, 2);
        if (ok) {
          await db.from('campaign_contacts').eq('id', c.id).update({
            follow_up_step: 2,
            follow_up_sent_at: now.toISOString(),
            last_event: 'drip_step2',
          }).catch(() => {});
        }
        await pause(200);
      }
    }

    // ── Step 3: sent ≥ 7 days ago, never opened, no follow-up yet ──────────
    const d7ago = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cold = await db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,opened_at,follow_up_step,status')
      .eq('follow_up_step', 0)
      .eq('status', 'sent')
      .get();

    if (Array.isArray(cold)) {
      for (const c of cold) {
        if (c.opened_at) continue;
        if (!c.sent_at) continue;
        if (new Date(c.sent_at) > new Date(d7ago)) continue;

        const ok = await sendFollowUp(c, 3);
        if (ok) {
          await db.from('campaign_contacts').eq('id', c.id).update({
            follow_up_step: 3,
            follow_up_sent_at: now.toISOString(),
            last_event: 'drip_step3',
          }).catch(() => {});
        }
        await pause(200);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, ran_at: now.toISOString() }) };
  } catch (err) {
    console.error('[drip-sequence]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

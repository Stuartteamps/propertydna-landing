// Runs every hour via cron. Sends drip steps 2–8 based on engagement + time since send.
// Schedule defined in netlify.toml: [functions."drip-sequence"] schedule = "0 * * * *"
//
// 10-Touch Timeline:
//   Step 0 (Day 1):  Initial blast — "Your [City] Property Ranked X/100"
//   Step 1 (Day 1):  Instant on click — report ready  [fired by resend-webhook]
//   Step 2 (Day 2):  Opener 24h follow-up — market context
//   Step 3 (Day 7):  7-day cold — final notice
//   Step 4 (Day 10): Market insight — what's moving values
//   Step 5 (Day 14): Social proof — homeowner story
//   Step 6 (Day 17): Value unlock — 3 levers
//   Step 7 (Day 21): Personal note from Dan
//   Step 8 (Day 28): Last message + referral ask
const db = require('./_supabase');
const { sendFollowUp } = require('./resend-webhook');

const DRIP_RULES = [
  // { step, minDelayHours, targetStep, filter }
  // Step 2: opened ≥24h ago, didn't click, no follow-up yet
  {
    step: 2,
    desc: 'opener 24h',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,opened_at,clicked_at,follow_up_step,status')
      .eq('follow_up_step', 0)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.opened_at && !c.clicked_at &&
      new Date(c.opened_at) <= new Date(now - 24 * 3600 * 1000),
  },
  // Step 3: sent ≥7 days ago, never opened
  {
    step: 3,
    desc: '7-day cold',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,opened_at,follow_up_step,status')
      .eq('follow_up_step', 0)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      !c.opened_at && c.sent_at &&
      new Date(c.sent_at) <= new Date(now - 7 * 24 * 3600 * 1000),
  },
  // Step 4: Day 10 — anyone at step 3, sent ≥10 days ago
  {
    step: 4,
    desc: 'day-10 insight',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,follow_up_step,status')
      .eq('follow_up_step', 3)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.sent_at && new Date(c.sent_at) <= new Date(now - 10 * 24 * 3600 * 1000),
  },
  // Step 5: Day 14 — anyone at step 2 (opened but didn't click), sent ≥14 days ago
  {
    step: 5,
    desc: 'day-14 social proof',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,follow_up_step,status')
      .eq('follow_up_step', 2)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.sent_at && new Date(c.sent_at) <= new Date(now - 14 * 24 * 3600 * 1000),
  },
  // Step 6: Day 17 — step 4 (cold had insight), sent ≥17 days ago
  {
    step: 6,
    desc: 'day-17 value unlock',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,follow_up_step,status')
      .eq('follow_up_step', 4)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.sent_at && new Date(c.sent_at) <= new Date(now - 17 * 24 * 3600 * 1000),
  },
  // Step 7: Day 21 — step 5 or 6, sent ≥21 days ago
  {
    step: 7,
    desc: 'day-21 personal',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,follow_up_step,status')
      .in('follow_up_step', [5, 6])
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.sent_at && new Date(c.sent_at) <= new Date(now - 21 * 24 * 3600 * 1000),
  },
  // Step 8: Day 28 — anyone at step 7, sent ≥28 days ago
  {
    step: 8,
    desc: 'day-28 final',
    query: () => db.from('campaign_contacts')
      .select('id,campaign_id,email,first_name,city,neighborhood_score,score_label,sent_at,follow_up_step,status')
      .eq('follow_up_step', 7)
      .eq('status', 'sent')
      .get(),
    eligible: (c, now) =>
      c.sent_at && new Date(c.sent_at) <= new Date(now - 28 * 24 * 3600 * 1000),
  },
];

exports.handler = async () => {
  const now = Date.now();
  const stats = {};

  try {
    for (const rule of DRIP_RULES) {
      const contacts = await rule.query().catch(() => []);
      if (!Array.isArray(contacts)) continue;
      let sent = 0;

      for (const c of contacts) {
        if (!rule.eligible(c, now)) continue;
        const ok = await sendFollowUp(c, rule.step);
        if (ok) {
          await db.from('campaign_contacts').eq('id', c.id).update({
            follow_up_step: rule.step,
            follow_up_sent_at: new Date(now).toISOString(),
            last_event: `drip_step${rule.step}`,
          }).catch(() => {});
          sent++;
        }
        await pause(200);
      }

      if (sent > 0) stats[rule.desc] = sent;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, stats, ran_at: new Date(now).toISOString() }) };
  } catch (err) {
    console.error('[drip-sequence]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

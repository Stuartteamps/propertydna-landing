// newsletter-postflight — runs every Friday morning. Verifies Thursday's
// newsletter actually sent and via which path (CC API or Resend fallback).
// Alerts Dan only when there's a problem; healthy weeks are silent.
//
// Cron: "0 16 * * 5" (Fri 16:00 UTC = 9 AM PDT)

const db    = require('./_supabase');
const alert = require('./_alert');

exports.handler = async () => {
  const startedAt = new Date().toISOString();
  console.log('[newsletter-postflight] starting', startedAt);

  // KPI events from the last 36 hours (Thursday's send window)
  const sinceIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  let events = [];
  try {
    events = await db.from('kpi_events')
      .select('event,payload,created_at')
      .in('event', ['cc_newsletter_sent', 'newsletter_sent', 'cc_newsletter_test'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20)
      .get();
  } catch (err) {
    console.error('[newsletter-postflight] kpi query failed:', err.message);
    await alert.send({
      level:   'warn',
      subject: 'Newsletter postflight could not read kpi_events',
      body:    'Supabase query failed; can\'t confirm Thursday\'s send. Check the dashboard and Resend logs manually.',
      context: { error: err.message },
    });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const ccSent     = events.find(e => e.event === 'cc_newsletter_sent');
  const resendSent = events.find(e => e.event === 'newsletter_sent');
  const winner     = ccSent || resendSent;

  // CASE 1: nothing fired
  if (!winner) {
    await alert.send({
      level:   'critical',
      subject: 'THURSDAY NEWSLETTER DID NOT FIRE',
      body:    `No <code>cc_newsletter_sent</code> or <code>newsletter_sent</code> kpi event in the last 36 hours.<br>
                The cron either failed silently or didn\'t run. Investigate function logs immediately.`,
      context: { sinceIso, events: events.slice(0, 5) },
    });
    db.kpi('newsletter_postflight', null, { status: 'critical', reason: 'no_send_event' });
    return { statusCode: 200, body: JSON.stringify({ status: 'critical', reason: 'no_send_event' }) };
  }

  // CASE 2: fell back to Resend (junk-risk path)
  if (!ccSent && resendSent) {
    await alert.send({
      level:   'warn',
      subject: 'Newsletter sent via RESEND fallback (CC API path failed)',
      body:    `Thursday's newsletter went out via Resend from <code>hello@mail.*</code> instead of CC.<br>
                That subdomain is still warming — high junk-folder risk on this 734-contact list.<br><br>
                Run preflight again or re-auth CC before next Thursday.`,
      context: { winner, allEvents: events.slice(0, 3) },
    });
    db.kpi('newsletter_postflight', null, { status: 'warn', reason: 'resend_fallback', payload: winner.payload });
    return { statusCode: 200, body: JSON.stringify({ status: 'warn', via: 'resend' }) };
  }

  // CASE 3: CC path worked (silent success)
  db.kpi('newsletter_postflight', null, { status: 'healthy', via: 'constant_contact', payload: winner.payload });
  console.log('[newsletter-postflight] healthy — sent via CC');
  return { statusCode: 200, body: JSON.stringify({ status: 'healthy', via: 'constant_contact', payload: winner.payload }) };
};

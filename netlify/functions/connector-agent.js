/**
 * connector-agent — Audience Engagement OS · Connector (connected)
 *
 * Real-world, NOT a feed. Detects geographic density of PropertyDNA users by
 * ZIP and proposes an offline meetup / appeal-clinic to people in that area.
 * Source: property_reports (existing, has zip). Dedup: kpi_events 'connector_invite'.
 * NO new tables (RSVP tracking = local_events/event_rsvps is a Phase 2 migration).
 * Safe: ENGAGEMENT_MODE=dryrun default. Weekly.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, MODE, APP_BASE, db } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MIN_DENSITY = 3;     // min distinct users in a ZIP to propose a meetup
const MAX = 30;

const SYSTEM = `You are the Connector — PropertyDNA's bridge to the real world. Movement: "Take Ownership of Housing." Connection happens OFFLINE, never in an app feed. You make people feel part of a local group of informed homeowners.

Write a SHORT invitation email (70-110 words):
- Tell them there are {N} PropertyDNA neighbors near them ({area}) and propose an informal meetup / property-data + tax-appeal clinic.
- Make belonging feel real and low-pressure. One soft ask to reply if interested. One emoji max.
Return ONLY the email body as clean HTML (<p>). No subject, no <html>, no links unless natural.`;

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) { const k = event?.headers?.["x-internal-key"]; if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) }; }
  const mode = body.mode || MODE();

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const rows = await db.from("property_reports")
    .select("email,zip,city,state,created_at").gte("created_at", since).limit(1000).get().catch(() => []);

  // Group distinct emails by ZIP.
  const byZip = {};
  for (const r of (rows || [])) {
    const email = (r.email || "").toLowerCase().trim(); const zip = (r.zip || "").trim();
    if (!email || !zip || email.includes("healthcheck+")) continue;
    (byZip[zip] = byZip[zip] || { city: r.city, state: r.state, emails: new Set() }).emails.add(email);
  }

  const items = [];
  for (const [zip, g] of Object.entries(byZip)) {
    if (g.emails.size < MIN_DENSITY) continue;
    const area = [g.city, g.state].filter(Boolean).join(", ") || `ZIP ${zip}`;
    let bodyHtml;
    try { bodyHtml = await callClaude(SYSTEM, `N: ${g.emails.size}\narea: ${area}\n\nWrite the meetup invitation body.`); }
    catch { bodyHtml = `<p>There are ${g.emails.size} PropertyDNA owners near ${area}. Want to meet up — compare notes, run a tax-appeal clinic together? Reply if you're in. 🏠</p>`; }
    for (const email of g.emails) {
      if (await alreadySent("connector_invite", email)) continue;
      if (items.length >= MAX) break;
      items.push({ email, address: area, subject: `${g.emails.size} PropertyDNA neighbors near ${area}`, html: bodyHtml, zip });
    }
  }
  let sent = 0;
  if (mode === "live") for (const it of items) { const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + foot(it.email) }); if (r.status && r.status < 300) { markSent("connector_invite", it.email, { zip: it.zip }); sent++; } }
  await ownerDigest("Connector", mode, items).catch(() => {});
  db.kpi("connector_agent_run", null, { mode, zips: Object.keys(byZip).length, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "connector", mode, candidates: items.length, sent }) };
};
function foot(e){return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(e)}" style="color:#aaa;">unsubscribe</a></p>`;}

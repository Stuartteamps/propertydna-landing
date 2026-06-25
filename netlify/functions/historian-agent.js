/**
 * historian-agent — Audience Engagement OS · Historian (useful · recognized)
 *
 * Turns people who claimed a home into data contributors: asks ONE gap-fill
 * question whose answer flows into the existing property_owner_updates queue
 * (migration 033). Improves data quality; makes the user feel useful.
 * Source: property_owner_claims (existing). Dedup: kpi_events 'historian_ask'.
 * NO new tables. Safe: ENGAGEMENT_MODE=dryrun default. Daily.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, shouldSend, MODE, APP_BASE, db } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MAX = 25;

const SYSTEM = `You are the Historian — PropertyDNA's keeper of each home's true record. Movement: "Take Ownership of Housing." A home's owner knows things public data never will (the year of a remodel, a hidden permit, the roof age). You make contributing feel like a privilege, not a chore.

Write a SHORT email (70-110 words) asking for ONE specific fact about the person's claimed home — frame it as making THEIR home's record (and equity estimate) more accurate, and helping the neighbors who'll look it up next.
- Ask exactly one easy question (e.g., "What year was the kitchen last remodeled?").
- Make them feel recognized as the authority on their home.
- One link to add the detail (given). One emoji max.
Return ONLY the email body as clean HTML (<p> + <a>). No subject, no <html>.`;

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) { const k = event?.headers?.["x-internal-key"]; if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) }; }
  const mode = body.mode || MODE();

  const rows = await db.from("property_owner_claims")
    .select("claimed_email,claimed_name,apn,state,created_at,status")
    .order("created_at", { ascending: false }).limit(150).get().catch(() => []);

  const seen = new Set(); const items = [];
  for (const r of (rows || [])) {
    const email = (r.claimed_email || "").toLowerCase().trim();
    if (!email || seen.has(email)) continue; seen.add(email);
    if (await alreadySent("historian_ask", email)) continue;
    if (!(await shouldSend(email, "historian", { address: r.apn || "" }))) continue;
    if (items.length >= MAX) break;
    const addrLabel = r.apn ? `your home (APN ${r.apn})` : "your home";
    const addUrl = `${APP_BASE}/dashboard`;
    let html;
    try { html = await callClaude(SYSTEM, `Owner: ${r.claimed_name || "there"}\nProperty: ${addrLabel}\nAdd-detail link: ${addUrl}\n\nWrite the gap-fill email body.`); }
    catch { html = `<p>You claimed ${addrLabel} — you know it better than any database.</p><p>One quick fact makes its record (and your equity estimate) sharper: what year was the kitchen last remodeled? <a href="${addUrl}">Add it here →</a></p>`; }
    items.push({ email, address: addrLabel, subject: "One fact only you know about your home", html });
  }
  let sent = 0;
  if (mode === "live") for (const it of items) { const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + foot(it.email) }); if (r.status && r.status < 300) { markSent("historian_ask", it.email, { address: it.address }); sent++; } }
  await ownerDigest("Historian", mode, items).catch(() => {});
  db.kpi("historian_agent_run", null, { mode, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "historian", mode, candidates: items.length, sent }) };
};
function foot(e){return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(e)}" style="color:#aaa;">unsubscribe</a></p>`;}

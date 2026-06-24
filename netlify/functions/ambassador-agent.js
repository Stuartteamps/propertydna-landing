/**
 * ambassador-agent — Audience Engagement OS · Ambassador (recognized · connected)
 *
 * Neighbor-to-neighbor growth, no ads, no feed. Invites engaged users to send a
 * neighbor their free report (the public /report/view/:token is the shareable
 * asset) and recognizes them for spreading the movement.
 * Source: property_reports (existing). Dedup: kpi_events 'ambassador_invite'.
 * NO new tables (full referral attribution = a referrals table in Phase 2).
 * Safe: ENGAGEMENT_MODE=dryrun default. Weekly.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, MODE, APP_BASE, db } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MAX = 25;

const SYSTEM = `You are the Ambassador — PropertyDNA's growth through trust, not ads. Movement: "Take Ownership of Housing." People who took ownership of their home's data help a neighbor do the same.

Write a SHORT email (70-110 words):
- Recognize that they took ownership of their home's data.
- Ask them to send ONE neighbor (or someone about to buy) their free report — frame it as a gift the neighbor will thank them for, and as growing a movement.
- Give them the share link (provided). Make them feel like a founder of something. One emoji max.
Return ONLY the email body as clean HTML (<p> + <a>). No subject, no <html>.`;

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) { const k = event?.headers?.["x-internal-key"]; if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) }; }
  const mode = body.mode || MODE();

  // Engaged users: ran a completed report 3-30 days ago (past first-week, still warm).
  const lo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const hi = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const rows = await db.from("property_reports")
    .select("email,full_address,address,view_token,created_at,status")
    .eq("status", "completed").gte("created_at", lo).lte("created_at", hi)
    .order("created_at", { ascending: false }).limit(200).get().catch(() => []);

  const seen = new Set(); const items = [];
  for (const r of (rows || [])) {
    const email = (r.email || "").toLowerCase().trim();
    if (!email || email.includes("healthcheck+") || seen.has(email)) continue; seen.add(email);
    if (await alreadySent("ambassador_invite", email)) continue;
    if (items.length >= MAX) break;
    const addr = r.full_address || r.address || "your home";
    // Their report is the shareable proof; the home page is where a neighbor runs their own.
    const shareUrl = `${APP_BASE}/?utm_source=ambassador&utm_medium=referral`;
    let html;
    try { html = await callClaude(SYSTEM, `Property they ran: ${addr}\nShare link (neighbor runs their own free report): ${shareUrl}\n\nWrite the ambassador invite body.`); }
    catch { html = `<p>You took ownership of your home's data. Know a neighbor — or someone about to buy — who deserves the same?</p><p>Send them their free report: <a href="${shareUrl}">${shareUrl}</a></p><p>That's how we save the humans, one neighbor at a time. 🏠</p>`; }
    items.push({ email, address: addr, subject: "Help a neighbor take ownership", html });
  }
  let sent = 0;
  if (mode === "live") for (const it of items) { const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + foot(it.email) }); if (r.status && r.status < 300) { markSent("ambassador_invite", it.email, {}); sent++; } }
  await ownerDigest("Ambassador", mode, items).catch(() => {});
  db.kpi("ambassador_agent_run", null, { mode, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "ambassador", mode, candidates: items.length, sent }) };
};
function foot(e){return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(e)}" style="color:#aaa;">unsubscribe</a></p>`;}

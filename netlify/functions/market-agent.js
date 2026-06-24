/**
 * market-agent — Audience Engagement OS · Market Analyst (informed · curious)
 *
 * Sends a personalized "your home this week" — the report that finds the user.
 * Source: property_reports.report_data (existing). Dedup per ISO-week via
 * kpi_events 'market_weekly' (so at most one/user/week). NO new tables.
 * (Cross-time deltas need a market_snapshots table — Phase 2 enhancement.)
 * Safe: ENGAGEMENT_MODE=dryrun default. Weekly.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, shouldSend, MODE, APP_BASE, db } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MAX = 30;

const SYSTEM = `You are the Market Analyst — PropertyDNA's curiosity engine. Movement: "Take Ownership of Housing." You keep people informed and coming back with a sharp, personal read on their home and neighborhood.

Write a SHORT "your home this week" email (90-130 words):
- Lead with one genuinely interesting, specific read on their property (value range, risk standing, or neighborhood character) drawn from the context given.
- Add one "did you know" about their area that rewards curiosity.
- ONE link to re-open the full report. No hard sell. One emoji max.
Voice: smart friend who happens to have institutional data.
Return ONLY the email body as clean HTML (<p> + <a>). No subject, no <html>.`;

function ctx(rd) {
  const v = rd?.normalized?.valuation?.marketValue || rd?.dnaAdjusted?.adjMid;
  const risk = rd?.risk?.overallRating;
  const nb = rd?.neighborhood;
  const bits = [];
  if (v) bits.push(`est value: ${typeof v === "number" ? "$" + v.toLocaleString() : v}`);
  if (risk) bits.push(`risk: ${risk}`);
  if (nb?.medianHomeValue) bits.push(`area median: ${nb.medianHomeValue}`);
  if (nb?.ownershipStability) bits.push(nb.ownershipStability);
  if (nb?.city) bits.push(`area: ${nb.city}`);
  return bits.join(" · ") || "their report data";
}

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) { const k = event?.headers?.["x-internal-key"]; if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) }; }
  const mode = body.mode || MODE();

  // ISO-week tag so dedup is per-week, not forever.
  const week = `${new Date().getUTCFullYear()}W${Math.ceil(((Date.now() - Date.UTC(new Date().getUTCFullYear(),0,1)) / 86400000 + 1) / 7)}`;
  const dedupType = `market_weekly_${week}`;

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const rows = await db.from("property_reports")
    .select("email,full_address,address,view_token,report_data,created_at,status")
    .eq("status", "completed").gte("created_at", since).order("created_at", { ascending: false }).limit(200).get().catch(() => []);

  const seen = new Set(); const items = [];
  for (const r of (rows || [])) {
    const email = (r.email || "").toLowerCase().trim();
    if (!email || email.includes("healthcheck+") || seen.has(email)) continue; seen.add(email);
    if (await alreadySent(dedupType, email)) continue;
    if (!(await shouldSend(email, "market"))) continue;
    if (items.length >= MAX) break;
    const addr = r.full_address || r.address || "your home";
    const url = r.view_token ? `${APP_BASE}/report/view/${r.view_token}` : `${APP_BASE}/dashboard`;
    let html;
    try { html = await callClaude(SYSTEM, `Property: ${addr}\nContext: ${ctx(r.report_data || {})}\nReport link: ${url}\n\nWrite this week's email body.`); }
    catch { html = `<p>Your home this week — <b>${addr}</b>: ${ctx(r.report_data || {})}.</p><p><a href="${url}">See the full picture →</a></p>`; }
    items.push({ email, address: addr, subject: `Your home this week — ${addr}`, html });
  }
  let sent = 0;
  if (mode === "live") for (const it of items) { const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + foot(it.email) }); if (r.status && r.status < 300) { markSent(dedupType, it.email, {}); sent++; } }
  await ownerDigest("Market Analyst", mode, items).catch(() => {});
  db.kpi("market_agent_run", null, { mode, week, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "market", mode, week, candidates: items.length, sent }) };
};
function foot(e){return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(e)}" style="color:#aaa;">unsubscribe</a></p>`;}

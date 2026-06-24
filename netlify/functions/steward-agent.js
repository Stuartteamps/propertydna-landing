/**
 * steward-agent — Audience Engagement OS · Steward (informed · empowered)
 *
 * Welcomes people who just ran a PropertyDNA report and pulls them toward the
 * next step (re-open their report, claim their home, learn what it means).
 * Source of truth: property_reports (existing). Dedup: kpi_events 'steward_welcome'.
 * NO new tables. Safe: ENGAGEMENT_MODE=dryrun (default) emails Dan a preview;
 * set ENGAGEMENT_MODE=live to actually welcome users.
 *
 * Scheduled daily (netlify.toml). Manual POST needs x-internal-key.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, MODE, APP_BASE, db } = require("./_engage");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MAX_PER_RUN = 25;

const SYSTEM = `You are the Steward — the welcoming voice of PropertyDNA, a movement to "Take Ownership of Housing." Mission: save people from asymmetric data; put the institutional-grade truth about a home in the hands of the human with the most at stake.

Write a SHORT welcome email (90-140 words) to someone who just ran a free report. You are a warm, sharp guide — not a marketer.
- Open by naming their property and one specific, real thing from their report context (risk level, value range, or that their data is ready).
- Make them feel informed and empowered: they now hold data the other side of the table has.
- ONE clear next action, phrased as belonging in the movement: re-open their full report (the link given), and a soft mention they can "claim this home" to get ongoing alerts.
- Voice: confident, plain, a little defiant on behalf of regular people. No hype, one emoji max.
Return ONLY the email body as clean HTML (<p> tags, an <a> for the link). No subject line, no <html>/<head>.`;

function reportContext(r) {
  const rd = r.report_data || {};
  const risk = (rd.risk && rd.risk.overallRating) ? rd.risk.overallRating : null;
  const val = rd?.normalized?.valuation?.marketValue || rd?.dnaAdjusted?.adjMid || null;
  const bits = [];
  if (risk) bits.push(`risk: ${risk}`);
  if (val) bits.push(`est. value: ${typeof val === "number" ? "$" + val.toLocaleString() : val}`);
  if (r.role) bits.push(`role: ${r.role}`);
  return bits.join(" · ") || "their report is ready";
}

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) {
    const k = event?.headers?.["x-internal-key"] || event?.headers?.["X-Internal-Key"];
    if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY)
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  const mode = body.mode || MODE();

  // Recent report-runners (last 48h), newest first.
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const rows = await db.from("property_reports")
    .select("email,full_address,address,role,view_token,report_data,created_at")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(150).get().catch(() => []);

  const seen = new Set();
  const items = [];
  for (const r of (rows || [])) {
    const email = (r.email || "").toLowerCase().trim();
    if (!email || email.includes("healthcheck+") || seen.has(email)) continue;
    seen.add(email);
    if (await alreadySent("steward_welcome", email)) continue;
    if (items.length >= MAX_PER_RUN) break;

    const addr = r.full_address || r.address || "your property";
    const reportUrl = r.view_token ? `${APP_BASE}/report/view/${r.view_token}` : `${APP_BASE}/dashboard`;
    let html;
    try {
      html = await callClaude(SYSTEM, `Property: ${addr}\nContext: ${reportContext(r)}\nReport link: ${reportUrl}\n\nWrite the welcome email body.`);
    } catch { html = `<p>Your PropertyDNA report for <b>${addr}</b> is ready — the same data the other side of the table has.</p><p><a href="${reportUrl}">Open your full report →</a></p><p>Welcome to the movement to take ownership of housing. 🏠</p>`; }

    const subject = `Welcome — your home's data is in your hands`;
    items.push({ email, address: addr, subject, html, reportUrl });
  }

  let sent = 0;
  if (mode === "live") {
    for (const it of items) {
      const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + footer(it.email) });
      if (r.status && r.status < 300) { markSent("steward_welcome", it.email, { address: it.address }); sent++; }
    }
  }
  await ownerDigest("Steward", mode, items).catch(() => {});
  db.kpi("steward_agent_run", null, { mode, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "steward", mode, candidates: items.length, sent }) };
};

function footer(email) {
  return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#aaa;">unsubscribe</a></p>`;
}

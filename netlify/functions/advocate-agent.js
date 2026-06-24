/**
 * advocate-agent — Audience Engagement OS · Advocate (empowered · protected)
 *
 * The mission in operational form: proactively warn people whose property shows
 * real risk (flood / fire / quake / elevated overall) with a plain-English
 * "here's what to do." Source: property_reports.report_data.risk (existing).
 * Dedup: kpi_events 'advocate_alert'. NO new tables.
 * Safe: ENGAGEMENT_MODE=dryrun (default) emails Dan a preview; set =live to send.
 *
 * Scheduled daily (netlify.toml). Manual POST needs x-internal-key.
 */
const { callClaude, resendSend, alreadySent, markSent, ownerDigest, shouldSend, MODE, APP_BASE, db } = require("./_engage");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };
const MAX_PER_RUN = 25;

const SYSTEM = `You are the Advocate — PropertyDNA's protector of the homeowner/buyer. Mission: save humans from asymmetric data; warn them about money-and-safety risk in time to act. Movement: "Take Ownership of Housing."

Write a SHORT alert email (90-150 words) about a specific, real risk on someone's property.
- Lead with the concrete concern in plain English (e.g. "Your property sits in a FEMA high-risk flood zone" / "elevated wildfire exposure"). No fear-mongering — facts + agency.
- Give ONE or TWO concrete actions a person can take this month (verify flood insurance & get an elevation certificate; shop insurance before renewal; ask the seller for the elevation cert; appeal an over-assessment).
- Empower, don't alarm. End with re-opening their full report for the detail (link given).
- Voice: calm, credible, on their side. One emoji max.
Return ONLY the email body as clean HTML (<p> tags + an <a> link). No subject, no <html>/<head>.`;

// Decide if a report's risk warrants an alert, and summarize the concern.
function concern(rd) {
  const risk = rd && rd.risk;
  if (!risk) return null;
  const reasons = [];
  if (risk.flood && risk.flood.highRisk) reasons.push(`FEMA high-risk flood zone (${risk.flood.zone || "SFHA"})`);
  if (risk.wildfire && (risk.wildfire.score || 0) >= 50) reasons.push(`elevated wildfire exposure (${risk.wildfire.label || ""})`);
  if (risk.earthquake && (risk.earthquake.score || 0) >= 70) reasons.push(`high seismic risk (${risk.earthquake.label || ""})`);
  const rating = risk.overallRating || "";
  if (!reasons.length && /(Elevated|High)/i.test(rating)) reasons.push(`overall ${rating}`);
  return reasons.length ? reasons.join("; ") : null;
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

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const rows = await db.from("property_reports")
    .select("email,full_address,address,role,view_token,report_data,created_at,status")
    .eq("status", "completed").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(200).get().catch(() => []);

  const seen = new Set();
  const items = [];
  for (const r of (rows || [])) {
    const email = (r.email || "").toLowerCase().trim();
    if (!email || email.includes("healthcheck+") || seen.has(email)) continue;
    const c = concern(r.report_data || {});
    if (!c) continue;
    seen.add(email);
    if (await alreadySent("advocate_alert", email)) continue;
    if (!(await shouldSend(email, "advocate", { bypassCap: true }))) continue;  // safety: respects opt-out, bypasses cap
    if (items.length >= MAX_PER_RUN) break;

    const addr = r.full_address || r.address || "your property";
    const reportUrl = r.view_token ? `${APP_BASE}/report/view/${r.view_token}` : `${APP_BASE}/dashboard`;
    let html;
    try {
      html = await callClaude(SYSTEM, `Property: ${addr}\nConcern(s): ${c}\nReport link: ${reportUrl}\n\nWrite the protective alert email body.`);
    } catch { html = `<p>Heads up about <b>${addr}</b>: ${c}.</p><p>Verify your insurance and review the detail in your report: <a href="${reportUrl}">open report →</a></p>`; }

    items.push({ email, address: addr, subject: `A heads-up about ${addr}`, html, concern: c });
  }

  let sent = 0;
  if (mode === "live") {
    for (const it of items) {
      const r = await resendSend({ to: it.email, subject: it.subject, html: it.html + footer(it.email) });
      if (r.status && r.status < 300) { markSent("advocate_alert", it.email, { address: it.address, concern: it.concern }); sent++; }
    }
  }
  await ownerDigest("Advocate", mode, items).catch(() => {});
  db.kpi("advocate_agent_run", null, { mode, candidates: items.length, sent });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ agent: "advocate", mode, candidates: items.length, sent }) };
};

function footer(email) {
  return `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-family:Arial;font-size:11px;color:#aaa;">PropertyDNA · Take Ownership of Housing · <a href="${APP_BASE}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#aaa;">unsubscribe</a></p>`;
}

/**
 * _engage — shared toolkit for the Audience Engagement OS agents
 * (Steward, Advocate, and future agents). Helper module, not an endpoint.
 *
 * Design goals:
 *  - Zero new tables: dedup + send-history ride on the existing kpi_events table.
 *  - Safe by default: ENGAGEMENT_MODE=dryrun (default) means agents NEVER mail a
 *    real user — they email Dan a digest of what they WOULD send. Set
 *    ENGAGEMENT_MODE=live to actually reach users. Mirrors social-agent draft/publish.
 *  - Claude is the brain (intellagraph-ai pattern). Deterministic code sends.
 */
const https = require("https");
const db = require("./_supabase");

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const OWNER = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const MODE = () => (process.env.ENGAGEMENT_MODE || "dryrun").toLowerCase();

// ── Claude (copy + decisioning) ─────────────────────────────────────────────
function callClaude(system, user, maxTokens = 900) {
  const key = process.env.ANTHROPIC_API_KEY;
  const payload = JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  return new Promise((resolve, reject) => {
    if (!key) return reject(new Error("ANTHROPIC_API_KEY not set"));
    const req = https.request({ hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => { try { resolve(JSON.parse(raw)?.content?.[0]?.text || ""); } catch (e) { reject(new Error("claude_parse")); } }); });
    req.on("error", reject); req.setTimeout(45000, () => { req.destroy(); reject(new Error("claude_timeout")); });
    req.write(payload); req.end();
  });
}

// ── Resend send ─────────────────────────────────────────────────────────────
function resendSend({ to, from, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0, skipped: "no_resend_key" });
  const payload = JSON.stringify({
    from: from || "PropertyDNA <reports@thepropertydna.com>",
    to, subject, html,
    reply_to: replyTo || "stuartteamps@gmail.com",
    headers: { "List-Unsubscribe": `<${APP_BASE}/unsubscribe?email=${encodeURIComponent(Array.isArray(to) ? to[0] : to)}>` },
  });
  return new Promise((resolve) => {
    const req = https.request({ hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => resolve({ status: res.statusCode })); });
    req.on("error", () => resolve({ status: 0 })); req.write(payload); req.end();
  });
}

// ── Dedup / send-history via kpi_events ─────────────────────────────────────
// event_type e.g. 'steward_welcome' / 'advocate_alert'. We treat a matching
// kpi_events row (same type + email) as "already sent" so agents never repeat.
async function alreadySent(eventType, email) {
  const rows = await db.from("kpi_events").select("id")
    .eq("event_type", eventType).eq("email", (email || "").toLowerCase().trim())
    .limit(1).get().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
function markSent(eventType, email, meta = {}) {
  db.kpi(eventType, email, meta);
  // Uniform marker that powers the cross-agent frequency cap (one "slot" used).
  db.kpi("engagement_sent", email, { type: eventType });
}

// ── Consent + frequency cap (anti-spam) ─────────────────────────────────────
// Opt-out model: a notification_preferences row with enabled=false for this
// agent (or agent='all') blocks the send. No row = allowed.
async function consentOk(email, agent) {
  try {
    const rows = await db.from("notification_preferences").select("agent,enabled")
      .eq("email", (email || "").toLowerCase().trim()).in("agent", ["all", agent]).get();
    if (Array.isArray(rows)) for (const r of rows) if (r.enabled === false) return false;
    return true;
  } catch { return true; }
}

// Blocked if this email already got an engagement email within
// ENGAGEMENT_MIN_GAP_DAYS (default 4). This is what assigns each recipient to
// the FIRST agent that reaches them and prevents the other agents from piling on.
async function withinCap(email) {
  try {
    const days = Number(process.env.ENGAGEMENT_MIN_GAP_DAYS || 4);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await db.from("kpi_events").select("id")
      .eq("event_type", "engagement_sent").eq("email", (email || "").toLowerCase().trim())
      .gte("created_at", since).limit(1).get();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

// Single gate. bypassCap=true only for safety-critical agents (Advocate).
async function shouldSend(email, agent, { bypassCap = false } = {}) {
  if (!(await consentOk(email, agent))) return false;
  if (!bypassCap && (await withinCap(email))) return false;
  return true;
}

// ── Referral code (stable, deterministic — no new random) ───────────────────
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
async function getReferralCode(email) {
  const e = (email || "").toLowerCase().trim();
  const fallback = "PD" + Math.abs(hashCode(e)).toString(36).toUpperCase().slice(0, 7);
  try {
    const rows = await db.from("referral_codes").select("code").eq("email", e).limit(1).get();
    if (Array.isArray(rows) && rows[0]) return rows[0].code;
    await db.insert("referral_codes", { email: e, code: fallback }).catch(() => {});
    return fallback;
  } catch { return fallback; }
}

// ── Push (FCM legacy server key; no-op until tokens + key exist) ─────────────
async function sendPush(email, title, msg, url) {
  const serverKey = process.env.FCM_SERVER_KEY;
  let tokens = [];
  try { const rows = await db.from("device_tokens").select("token").eq("email", (email || "").toLowerCase().trim()).get(); tokens = (rows || []).map(r => r.token).filter(Boolean); } catch {}
  if (!serverKey || !tokens.length) return { sent: 0, reason: !serverKey ? "no_fcm_key" : "no_tokens" };
  let sent = 0;
  for (const t of tokens) {
    const payload = JSON.stringify({ to: t, notification: { title, body: msg }, data: { url: url || "" } });
    await new Promise((res) => { const req = https.request({ hostname: "fcm.googleapis.com", path: "/fcm/send", method: "POST", headers: { Authorization: `key=${serverKey}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, (r) => { r.on("data", () => {}); r.on("end", () => { sent++; res(); }); }); req.on("error", () => res()); req.write(payload); req.end(); });
  }
  return { sent };
}

// ── Owner digest (dry-run output) ───────────────────────────────────────────
async function ownerDigest(agent, mode, items) {
  const rows = items.map(it => `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial;font-size:13px;">${it.email||""}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial;font-size:13px;">${(it.address||"").replace(/</g,"&lt;")}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial;font-size:13px;color:#555;">${(it.subject||"").replace(/</g,"&lt;")}</td>
  </tr>`).join("");
  const sample = items[0];
  const html = `<div style="max-width:680px;margin:0 auto;font-family:Arial;">
    <p style="color:#777;">${agent} agent · <b>${mode.toUpperCase()}</b> · ${new Date().toISOString().slice(0,16)}Z · ${items.length} recipients</p>
    ${mode === "dryrun" ? `<p style="color:#b15;">DRY RUN — no user was emailed. Review below, then set ENGAGEMENT_MODE=live.</p>` : `<p style="color:#161;">LIVE — these users were emailed.</p>`}
    <table style="border-collapse:collapse;width:100%;"><tr>
      <th style="text-align:left;padding:6px 10px;font-family:Arial;font-size:12px;color:#999;">Email</th>
      <th style="text-align:left;padding:6px 10px;font-family:Arial;font-size:12px;color:#999;">Property</th>
      <th style="text-align:left;padding:6px 10px;font-family:Arial;font-size:12px;color:#999;">Subject</th></tr>${rows}</table>
    ${sample ? `<h3 style="font-family:Arial;margin-top:20px;">Sample message (${sample.email})</h3>
      <div style="border:1px solid #eee;padding:12px;background:#faf8f5;">${sample.html||""}</div>` : ""}
  </div>`;
  return resendSend({ to: OWNER, from: "PropertyDNA Engagement <reports@thepropertydna.com>", subject: `🤖 ${agent} agent — ${mode} — ${items.length} recipients`, html });
}

module.exports = { callClaude, resendSend, alreadySent, markSent, ownerDigest, shouldSend, consentOk, withinCap, getReferralCode, sendPush, MODE, APP_BASE, OWNER, db };

/**
 * submitter-feedback — One-question feedback survey to real form submitters
 * who didn't subscribe. Manual trigger (not scheduled).
 *
 * Sends a minimal "what kept you from upgrading?" email with Reply-To set
 * to the owner so replies land in your inbox.
 *
 * Skip rules:
 *   - Owner email
 *   - Disposable/anonymized domains (badgerhole, mailinator, privaterelay, etc.)
 *   - Already-sent (kpi_event `submitter_feedback_sent`)
 *   - Active subscribers
 *
 * Usage:
 *   Dry-run (lists who would get it):
 *     curl "https://thepropertydna.com/.netlify/functions/submitter-feedback?dry_run=1"
 *   Send for real:
 *     curl -X POST "https://thepropertydna.com/.netlify/functions/submitter-feedback?confirm=1"
 *
 * Requires confirm=1 to actually send — prevents accidental fire.
 */
const https = require("https");
const db = require("./_supabase");

const OWNER  = (process.env.OWNER_EMAIL  || "stuartteamps@gmail.com").toLowerCase();
const SENDER = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = "Dan Stuart, PropertyDNA";
const REPLY_TO = process.env.REPLY_TO_EMAIL || "stuartteamps@gmail.com";

const DISPOSABLE_DOMAINS = [
  "badgerhole.com", "mailinator.com", "tempmail.com", "guerrillamail.com",
  "throwaway.email", "10minutemail.com", "yopmail.com", "trash-mail.com",
  "privaterelay.appleid.com",  // can't be re-engaged — relay drops marketing
];

function isDisposable(email) {
  const domain = (email || "").toLowerCase().split("@")[1] || "";
  return DISPOSABLE_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

function httpsPost(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve({ status: res.statusCode, body: raw })); }
    );
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

function buildEmail({ address }) {
  const safe = (s) => (s || "").replace(/[<>]/g, "");
  const a = safe(address) || "the property";
  const shortAddress = a.split(",")[0]; // just the street

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#222;font-size:15px;line-height:1.75;">
<div style="max-width:520px;margin:0 auto;">
<p style="margin:0 0 16px;">Hi there,</p>
<p style="margin:0 0 16px;">Dan here — saw you ran a PropertyDNA report on <strong>${shortAddress}</strong> a little while back.</p>
<p style="margin:0 0 16px;">Quick question, no wrong answer: what's the one thing that would have made the paid version a yes for you?</p>
<p style="margin:0 0 16px;">Was it the price? The features? Timing? Something I'm not even thinking about?</p>
<p style="margin:0 0 16px;">Just hit reply with a sentence or two. It goes straight to me, and it'll genuinely help me build this better.</p>
<p style="margin:0 0 4px;">Thanks for the candor,</p>
<p style="margin:0;">— Dan Stuart</p>
<p style="margin:0;font-size:13px;color:#888;">PropertyDNA</p>
</div></body></html>`;

  const text = [
    "Hi there,",
    "",
    `Dan here — saw you ran a PropertyDNA report on ${shortAddress} a little while back.`,
    "",
    "Quick question, no wrong answer: what's the one thing that would have made the paid version a yes for you?",
    "",
    "Was it the price? The features? Timing? Something I'm not even thinking about?",
    "",
    "Just hit reply with a sentence or two. It goes straight to me, and it'll genuinely help me build this better.",
    "",
    "Thanks for the candor,",
    "— Dan Stuart",
    "PropertyDNA",
  ].join("\n");

  return {
    subject: `Quick question about your ${shortAddress} report`,
    html, text,
  };
}

async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: 0, error: "no_resend_key" };
  return httpsPost("api.resend.com", "/emails",
    { Authorization: `Bearer ${key}` },
    { from: `${SENDER_NAME} <${SENDER}>`, reply_to: REPLY_TO, to, subject, html, text });
}

exports.handler = async (event) => {
  const dryRun = event?.queryStringParameters?.dry_run === "1";
  const confirmed = event?.queryStringParameters?.confirm === "1";

  if (!dryRun && !confirmed) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Add ?confirm=1 to send for real, or ?dry_run=1 to preview the list",
      }),
    };
  }

  // Pull all submissions, de-dupe by email
  const reports = await db.from("property_reports")
    .select("email,full_address,address,created_at")
    .order("created_at", { ascending: false })
    .limit(500)
    .get().catch(() => []);

  const byEmail = {};
  for (const r of (reports || [])) {
    const e = (r.email || "").toLowerCase().trim();
    if (!e || !e.includes("@")) continue;
    if (e === OWNER) continue;
    if (e.startsWith("healthcheck+") || e.startsWith("test+")) continue;
    if (isDisposable(e)) continue;
    if (!byEmail[e]) byEmail[e] = r;  // keep most recent (already sorted desc)
  }
  const candidates = Object.entries(byEmail);

  if (candidates.length === 0) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ran_at: new Date().toISOString(), candidates: 0 }) };
  }

  const emails = candidates.map(([e]) => e);

  // De-dupe: who's already received this feedback email
  const alreadySent = await db.from("kpi_events")
    .select("email").eq("event_type", "submitter_feedback_sent")
    .in("email", emails).get().catch(() => []);
  const sentSet = new Set((alreadySent || []).map(k => (k.email || "").toLowerCase()));

  // De-dupe: active subscribers
  const subs = await db.from("subscriptions")
    .select("email").eq("status", "active")
    .in("email", emails).get().catch(() => []);
  const subbedSet = new Set((subs || []).map(s => (s.email || "").toLowerCase()));

  const queue = candidates.filter(([e]) => !sentSet.has(e) && !subbedSet.has(e));

  if (dryRun) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dry_run: true,
        total_candidates: candidates.length,
        already_sent: candidates.length - queue.length,
        will_send: queue.length,
        queue: queue.map(([e, r]) => ({ email: e, address: r.full_address || r.address, last_request: r.created_at?.slice(0, 10) })),
      }, null, 2),
    };
  }

  // Send for real
  const results = [];
  for (const [email, r] of queue) {
    const tmpl = buildEmail({ address: r.full_address || r.address });
    const res = await sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      db.kpi("submitter_feedback_sent", email, { address: r.full_address || r.address });
    }
    results.push({ email, ok, status: res.status });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ran_at: new Date().toISOString(),
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    }, null, 2),
  };
};

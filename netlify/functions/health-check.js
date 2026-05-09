/**
 * Pipeline health check — tests every node in the report delivery chain.
 *
 * GET or POST /.netlify/functions/health-check
 * Header: x-internal-key: <INTERNAL_API_KEY>
 *
 * Returns { healthy: bool, checks: { ... }, issues: [...] }
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function request(method, hostname, path, headers, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request(
      {
        hostname, path, method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let data;
          try { data = JSON.parse(raw); } catch { data = { _raw: raw.slice(0, 200) }; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data, ms: Date.now() - start });
        });
      }
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message, ms: Date.now() - start }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, error: "timeout", ms: 8000 }); });
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const checks = {};
  const issues = [];

  // ── 1. Env vars ────────────────────────────────────────────────────────────
  const envCheck = {
    INTERNAL_API_KEY:  !!process.env.INTERNAL_API_KEY,
    RESEND_API_KEY:    !!process.env.RESEND_API_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    SENDER_EMAIL:      !!process.env.SENDER_EMAIL,
    APP_BASE_URL:      !!process.env.APP_BASE_URL,
  };
  checks.env = envCheck;
  for (const [k, v] of Object.entries(envCheck)) {
    if (!v) issues.push(`Missing env var: ${k}`);
  }

  // ── 2. Resend API key format check ────────────────────────────────────────
  // (Sending-only keys can't call admin endpoints — just verify format)
  const resendKey = process.env.RESEND_API_KEY || "";
  const resendOk = resendKey.startsWith("re_") && resendKey.length > 10;
  checks.resend = { ok: resendOk, key_prefix: resendKey.slice(0, 6) || "unset" };
  if (!resendOk) issues.push("RESEND_API_KEY missing or malformed (expected re_...)");

  // ── 3. n8n reachable ──────────────────────────────────────────────────────
  const n8n = await request("GET", "dillabean.app.n8n.cloud", "/healthz", {});
  checks.n8n = { ok: n8n.ok, status: n8n.status, ms: n8n.ms, error: n8n.error || undefined };
  if (!n8n.ok) issues.push(`n8n instance not reachable (${n8n.error || "HTTP " + n8n.status})`);

  // ── 4. save-report + send-report-email reachable ──────────────────────────
  const appHost = (process.env.APP_BASE_URL || "https://thepropertydna.com")
    .replace(/^https?:\/\//, "").replace(/\/$/, "");

  const [saveProbe, emailProbe] = await Promise.all([
    request("POST", appHost, "/.netlify/functions/save-report",
      { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
      { _probe: true }),
    request("POST", appHost, "/.netlify/functions/send-report-email",
      { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
      { _probe: true }),
  ]);

  // 400 = function alive, rejected probe payload (expected)
  // 401 = function alive, wrong internal key (n8n env mismatch)
  // 5xx = function crashed
  checks.save_report      = { ok: saveProbe.status  < 500, status: saveProbe.status,  ms: saveProbe.ms  };
  checks.send_report_email = { ok: emailProbe.status < 500, status: emailProbe.status, ms: emailProbe.ms };

  if (saveProbe.status  >= 500) issues.push(`save-report returning ${saveProbe.status}`);
  if (emailProbe.status >= 500) issues.push(`send-report-email returning ${emailProbe.status}`);

  if (saveProbe.status  === 401) issues.push("CRITICAL: save-report rejected INTERNAL_API_KEY — set it in n8n env vars");
  if (emailProbe.status === 401) issues.push("CRITICAL: send-report-email rejected INTERNAL_API_KEY — set it in n8n env vars");

  // ── 6. Recent activity from Supabase ──────────────────────────────────────
  try {
    const [reports, emails] = await Promise.all([
      db.from("property_reports").select("email,status,created_at")
        .order("created_at", { ascending: false }).limit(1).get(),
      db.from("email_delivery_events").select("recipient_email,status,created_at")
        .order("created_at", { ascending: false }).limit(1).get(),
    ]);

    const lastReport = Array.isArray(reports) && reports[0];
    const lastEmail  = Array.isArray(emails)  && emails[0];

    checks.last_report = lastReport
      ? { email: lastReport.email, status: lastReport.status, at: lastReport.created_at }
      : { note: "no reports found" };

    checks.last_email = lastEmail
      ? { to: lastEmail.recipient_email, status: lastEmail.status, at: lastEmail.created_at }
      : { note: "no email events found" };

    if (!lastReport) issues.push("No reports ever saved — n8n is not calling save-report successfully");
    if (!lastEmail)  issues.push("No emails ever sent — n8n is not calling send-report-email successfully");

    if (lastReport && lastEmail) {
      const reportAge = Date.now() - new Date(lastReport.created_at).getTime();
      const emailAge  = Date.now() - new Date(lastEmail.created_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (reportAge > sevenDays) issues.push(`Last report was ${Math.floor(reportAge / 86400000)} days ago — pipeline may be stale`);
      if (emailAge  > sevenDays) issues.push(`Last email was ${Math.floor(emailAge  / 86400000)} days ago — email delivery may be broken`);
    }
  } catch (e) {
    checks.supabase = { ok: false, error: e.message };
    issues.push(`Supabase unreachable: ${e.message}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const healthy = issues.length === 0;

  return {
    statusCode: healthy ? 200 : 207,
    headers: CORS,
    body: JSON.stringify({ healthy, issues, checks, checked_at: new Date().toISOString() }, null, 2),
  };
};

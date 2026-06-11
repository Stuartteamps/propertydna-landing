/**
 * submit-story — Captures a user-submitted real-estate story.
 *
 * "Tell us your real estate horror story. We'll share the ones that
 * pattern-match." Builds a recurring weekly content pipeline + community
 * moat — no competitor has this user-generated angle.
 *
 * POST /.netlify/functions/submit-story
 *   body: { email, name?, role?, allow_public, anonymize, contact_for_followup,
 *           property_address?, property_city?, property_state?,
 *           story_category, story_title, story_body, financial_impact_usd?,
 *           what_pdna_caught? }
 *
 * Emails Dan instantly when a new story comes in. Confirms submitter via
 * Resend with the "we'll be in touch" template.
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const SENDER = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = process.env.SENDER_NAME || "PropertyDNA";

function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 503, data: { error: "no_resend_key" } });
  const payload = JSON.stringify({ from: `${SENDER_NAME} <${SENDER}>`, to, reply_to: replyTo || "stuartteamps@gmail.com", subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: { _raw: raw } }); } });
    });
    req.on("error", err => resolve({ status: 0, data: { error: err.message } }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, data: { error: "timeout" } }); });
    req.write(payload);
    req.end();
  });
}

function safe(s) { return (s || "").toString().replace(/[<>]/g, ""); }

function ownerNotificationEmail(row) {
  const cityState = [row.property_city, row.property_state].filter(Boolean).join(", ");
  const html = `<table cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;max-width:560px;border-collapse:collapse;">
<thead><tr><td colspan="2" style="padding:12px 0;border-bottom:1px solid #ddd;font-size:13px;letter-spacing:2px;color:#999;text-transform:uppercase;">New story submitted</td></tr></thead>
<tbody>
<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;width:140px;">From</td><td style="padding:8px 0;font-size:14px;color:#222;">${safe(row.submitter_name) || "(no name)"} · ${safe(row.submitter_email)}${row.submitter_role ? ` · ${safe(row.submitter_role)}` : ""}</td></tr>
${row.property_address ? `<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Property</td><td style="padding:8px 0;font-size:14px;color:#222;">${safe(row.property_address)}${cityState ? `, ${cityState}` : ""}</td></tr>` : ""}
<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Category</td><td style="padding:8px 0;font-size:14px;color:#222;">${safe(row.story_category)}</td></tr>
<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Title</td><td style="padding:8px 0;font-size:15px;color:#222;font-family:Georgia,serif;">${safe(row.story_title)}</td></tr>
${row.financial_impact_usd ? `<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Financial impact</td><td style="padding:8px 0;font-size:14px;color:#222;">$${Number(row.financial_impact_usd).toLocaleString()}</td></tr>` : ""}
<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Public OK?</td><td style="padding:8px 0;font-size:14px;color:${row.allow_public ? "#00cc77" : "#ff8800"};">${row.allow_public ? `Yes${row.anonymize ? " · anonymized" : ""}` : "No · private"}</td></tr>
<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#888;vertical-align:top;">Follow-up?</td><td style="padding:8px 0;font-size:14px;color:#222;">${row.contact_for_followup ? "Yes" : "No"}</td></tr>
</tbody>
</table>
<p style="margin:20px 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">The story</p>
<p style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#222;border-left:3px solid #C9A84C;padding:12px 16px;background:#fafaf7;white-space:pre-wrap;margin:0;">${safe(row.story_body)}</p>
${row.what_pdna_caught ? `<p style="margin:20px 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">What PropertyDNA caught</p><p style="font-size:13px;color:#222;line-height:1.7;border-left:3px solid #00cc77;padding:10px 14px;background:#f3faf6;margin:0;">${safe(row.what_pdna_caught)}</p>` : ""}
<p style="margin:24px 0 0;font-size:12px;color:#aaa;">Submitted ${new Date().toISOString()} · submitted_stories.id=${row.id || "(pending)"}</p>`;

  return {
    subject: `Story: "${safe(row.story_title).slice(0, 70)}" — ${row.story_category}`,
    html,
    text: `New story from ${row.submitter_name || row.submitter_email}\n\nCategory: ${row.story_category}\nTitle: ${row.story_title}\n\n${row.story_body}\n\n— ${row.submitter_email}`,
  };
}

function submitterConfirmationEmail({ submitter_email, submitter_name, story_title }) {
  const n = (submitter_name || "").split(" ")[0] || "there";
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · Save the Humans</p>
</td></tr>
<tr><td style="padding:32px 40px;">
<p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">Hi ${safe(n)},</p>
<p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.75;">Thank you for sharing your story. I read every one personally.</p>
<p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.75;">If your story pattern-matches what other buyers are facing — and a lot of them do — we'll feature it (anonymized if you asked us to) in an upcoming piece. That's how we turn private hurt into a public warning that helps the next person avoid it.</p>
<p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.75;">I'll be in touch within 5 business days. If you want to talk live in the meantime, hit reply.</p>
<p style="margin:24px 0 6px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">— Dan Stuart</p>
<p style="margin:0;font-size:13px;color:#888;">PropertyDNA · thepropertydna.com</p>
</td></tr>
<tr><td style="padding:18px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0;font-size:11px;color:#999;">Your story · "${safe(story_title)}"</p>
</td></tr>
</table></td></tr></table></body></html>`;

  return {
    subject: "We received your story — thank you for sharing.",
    html,
    text: `Hi ${n},\n\nThank you for sharing your story. I read every one personally.\n\nIf your story pattern-matches what other buyers are facing — and a lot of them do — we'll feature it (anonymized if you asked us to) in an upcoming piece. That's how we turn private hurt into a public warning that helps the next person avoid it.\n\nI'll be in touch within 5 business days. If you want to talk live in the meantime, hit reply.\n\n— Dan Stuart\nPropertyDNA · thepropertydna.com\n\nYour story: "${story_title}"`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const email = (body.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };
  }
  if (!body.story_body || body.story_body.length < 40) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Story too short — please share at least a few sentences." }) };
  }
  if (!body.story_title) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Title required" }) };
  }

  const row = {
    submitter_email: email,
    submitter_name: body.name || null,
    submitter_role: body.role || null,
    allow_public: body.allow_public !== false,
    anonymize: !!body.anonymize,
    contact_for_followup: body.contact_for_followup !== false,
    property_address: body.property_address || null,
    property_city: body.property_city || null,
    property_state: body.property_state || null,
    story_category: body.story_category || "other",
    story_title: body.story_title.slice(0, 240),
    story_body: body.story_body.slice(0, 8000),
    financial_impact_usd: body.financial_impact_usd ? Number(body.financial_impact_usd) : null,
    what_pdna_caught: body.what_pdna_caught || null,
    status: "pending_review",
  };

  let inserted;
  try {
    const result = await db.insert("submitted_stories", row);
    inserted = Array.isArray(result) && result[0] ? result[0] : row;
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not save story: " + e.message }) };
  }
  row.id = inserted.id;

  // Notify Dan (priority)
  const owner = ownerNotificationEmail(row);
  await sendEmail({ to: OWNER_EMAIL, ...owner, replyTo: email });

  // Confirm submitter
  const conf = submitterConfirmationEmail({ submitter_email: email, submitter_name: row.submitter_name, story_title: row.story_title });
  await sendEmail({ to: email, ...conf });

  db.kpi("story_submitted", email, { category: row.story_category, allow_public: row.allow_public });

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ success: true, id: inserted.id }),
  };
};

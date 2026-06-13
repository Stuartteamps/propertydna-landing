/**
 * recruit-intake — Captures /recruit submissions. Two roles: agent +
 * assistant. Inserts to agent_referral_network (agents) or
 * kpi_events (assistants for now until we add an assistants table).
 * Emails Dan instantly + confirms applicant via Resend.
 */
const https = require("https");
const db = require("./_supabase");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const SENDER      = process.env.SENDER_EMAIL || "reports@thepropertydna.com";

function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0 });
  const payload = JSON.stringify({ from: `PropertyDNA <${SENDER}>`, to, reply_to: replyTo || "stuartteamps@gmail.com", subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode }); } });
    });
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

const safe = (s) => (s || "").toString().replace(/[<>]/g, "");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const role = body.role === "assistant" ? "assistant" : "agent";
  const email = (body.email || "").toLowerCase().trim();
  if (!email || !email.includes("@") || !body.name) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Name + email required" }) };
  }

  // Persist
  if (role === "agent") {
    await db.upsert("agent_referral_network", {
      agent_name: body.name,
      agent_email: email,
      agent_phone: body.phone || null,
      brokerage: body.brokerage || null,
      city: body.city || null,
      state: body.state || null,
      license_state: body.license_state || null,
      license_number: body.license_number || null,
      source: "recruit_form",
      status: "applied",
      notes: JSON.stringify({
        specialty: body.specialty,
        years_in_business: body.years_in_business,
        avg_listing_price: body.avg_listing_price,
        why_interested: body.why_interested,
      }),
      first_contacted_at: new Date().toISOString(),
      last_contacted_at: new Date().toISOString(),
    }, "agent_email").catch(() => {});
  } else {
    // Assistant goes to kpi_events for now
    await db.insert("kpi_events", {
      event_type: "assistant_applied",
      email,
      metadata: {
        name: body.name,
        phone: body.phone,
        city: body.city,
        state: body.state,
        portfolio_url: body.portfolio_url,
        available_hours: body.available_hours,
        can_film: !!body.can_film,
        can_edit: !!body.can_edit,
        has_studio_space: !!body.has_studio_space,
        why_interested: body.why_interested,
      },
    }).catch(() => {});
  }

  // Notify Dan
  const subject = role === "agent"
    ? `🤝 New agent application: ${body.name} (${body.brokerage || "—"}, ${body.city || "—"})`
    : `🎥 New content-assistant application: ${body.name}`;

  const detailsRows = role === "agent" ? [
    ["Name",        body.name],
    ["Email",       email],
    ["Phone",       body.phone || "—"],
    ["City/State",  [body.city, body.state].filter(Boolean).join(", ")],
    ["License",     `${body.license_state || "—"} ${body.license_number || ""}`],
    ["Brokerage",   body.brokerage || "—"],
    ["Years",       body.years_in_business || "—"],
    ["Specialty",   body.specialty || "—"],
    ["Avg listing $", body.avg_listing_price || "—"],
  ] : [
    ["Name",     body.name],
    ["Email",    email],
    ["Phone",    body.phone || "—"],
    ["City/State", [body.city, body.state].filter(Boolean).join(", ")],
    ["Hrs/wk",   body.available_hours || "—"],
    ["Portfolio", body.portfolio_url || "—"],
    ["Can film", body.can_film ? "yes" : "—"],
    ["Can edit", body.can_edit ? "yes" : "—"],
    ["Studio",   body.has_studio_space ? "yes" : "—"],
  ];

  const html = `<table cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;max-width:560px;border-collapse:collapse;">
<thead><tr><td colspan="2" style="padding:12px 0;border-bottom:1px solid #ddd;font-size:13px;letter-spacing:2px;color:#999;text-transform:uppercase;">${role === "agent" ? "New agent application" : "New content-assistant application"}</td></tr></thead>
<tbody>${detailsRows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-size:12px;color:#888;vertical-align:top;width:140px;">${k}</td><td style="padding:6px 0;font-size:14px;color:#222;">${safe(v)}</td></tr>`).join("")}</tbody>
</table>
<p style="margin:20px 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">Why interested</p>
<p style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#222;border-left:3px solid #C9A84C;padding:12px 16px;background:#fafaf7;white-space:pre-wrap;margin:0;">${safe(body.why_interested)}</p>`;

  await sendEmail({ to: OWNER_EMAIL, subject, html, text: detailsRows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\nWhy interested:\n" + (body.why_interested || ""), replyTo: email });

  // Confirm applicant
  await sendEmail({
    to: email,
    subject: "Application received — PropertyDNA",
    html: `<table cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;max-width:560px;">
<tr><td style="padding:24px 0;font-size:14px;color:#222;line-height:1.7;">
<p>Hi ${safe(body.name.split(" ")[0])},</p>
<p>Thanks for applying ${role === "agent" ? "to join the PropertyDNA referral network" : "for the content-assistant role"}. I read every application personally — you'll hear from me within 3 business days.</p>
<p style="margin-top:18px;">— Dan Stuart<br/>PropertyDNA</p>
</td></tr></table>`,
    text: `Hi ${body.name.split(" ")[0]},\n\nThanks for applying. I read every application personally — you'll hear from me within 3 business days.\n\n— Dan Stuart\nPropertyDNA`,
  });

  db.kpi(`recruit_${role}_applied`, email, { name: body.name, city: body.city });

  return { statusCode: 201, headers: CORS, body: JSON.stringify({ success: true }) };
};

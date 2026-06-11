#!/usr/bin/env node
/**
 * send-filming-kit.js — emails Dan the filming kit + 5 scripts as a single
 * attachment-rich Resend email so he can read everything on his phone the
 * morning of the shoot.
 *
 * Usage:
 *   RESEND_API_KEY=re_... node tools/youtube/send-filming-kit.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const RECIPIENT = process.env.RECIPIENT || "stuartteamps@gmail.com";

const FILES = [
  { name: "00-filming-kit.md",                              path: "filming-kit.md",                                       label: "🎬 Read this first — full filming kit (90-min shoot plan, wardrobe, lighting, audio)" },
  { name: "01-thunderbird-luxury-head-to-head.md",          path: "queue/01-thunderbird-2.999m-vs-thunderbird-3.895m.md", label: "🎥 Long-form #1 — Thunderbird $2.999M vs $3.895M (9-11 min)" },
  { name: "02-florida-insurance-collapse.md",               path: "queue/02-florida-hurricane-insurance-collapse.md",     label: "🎥 Long-form #2 — Florida insurance collapse (7-9 min)" },
  { name: "03-how-agents-cherry-pick-comps.md",             path: "queue/03-how-agents-cherry-pick-comps.md",             label: "🎬 Short #3 — How agents cherry-pick comps (60s)" },
  { name: "04-three-lies-on-every-zillow-estimate.md",      path: "queue/04-three-lies-on-every-zillow-estimate.md",      label: "🎬 Short #4 — Three lies on every Zillow estimate (60s)" },
  { name: "05-the-permit-history-trick.md",                 path: "queue/05-the-permit-history-trick.md",                 label: "🎬 Short #5 — The permit-history trick (60s)" },
];

const ROOT = path.resolve(__dirname);

function readFile(rel) {
  const p = path.join(ROOT, rel);
  return fs.readFileSync(p, "utf8");
}

function postResend(body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set in env");
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, raw }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const attachments = FILES.map(f => ({
    filename: f.name,
    content: Buffer.from(readFile(f.path), "utf8").toString("base64"),
  }));

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e5e0d8;">

<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
  <p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · YouTube</p>
  <p style="margin:10px 0 0;font-size:24px;color:#1a1a1a;font-family:Georgia,serif;">Your filming kit + 5 scripts</p>
  <p style="margin:6px 0 0;font-size:13px;color:#777;">Read on your phone the morning of the shoot</p>
</td></tr>

<tr><td style="padding:24px 40px 8px;">
  <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">
    Dan — everything for the first 5 videos is attached. The plan: <strong>one 90-minute recording session</strong> gets all 5 videos shot. I edit + post over the next 72 hours.
  </p>
  <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">
    Start with <strong>00-filming-kit.md</strong> — that's the full briefing (location, wardrobe, lighting, audio, energy). Then the 5 scripts. The shoot order I'd recommend:
  </p>
  <ol style="margin:0 0 16px 20px;padding:0;font-size:14px;color:#444;line-height:1.85;">
    <li>Warm-up clip (looking into lens, "agent works for the commission, we work for you")</li>
    <li>Short #03 (cherry-pick comps) — easiest, 60s, low-stakes</li>
    <li>Short #04 (3 Zillow lies)</li>
    <li>Short #05 (permit-history trick)</li>
    <li>Long-form #01 (Thunderbird head-to-head) — biggest of the day</li>
    <li>Long-form #02 (FL insurance) — just the CTA on camera, VO done separately</li>
  </ol>
</td></tr>

<tr><td style="padding:0 40px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    ${FILES.map(f => `
    <tr>
      <td style="padding:14px 0;border-top:1px solid #f0ece4;font-size:13px;color:#1a1a1a;font-family:Georgia,serif;">
        <strong>${f.name}</strong><br/>
        <span style="font-size:12px;color:#777;">${f.label}</span>
      </td>
    </tr>`).join("")}
  </table>
</td></tr>

<tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
  <p style="margin:0 0 8px;font-size:13px;color:#444;line-height:1.7;">
    <strong>Once you've recorded</strong> — drop the files in a folder named <code>2026-06-XX-shoot-raw/</code> and text me. I'll start assembly immediately. Goal: first Short live on YouTube within 24h.
  </p>
  <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
    PropertyDNA · save the humans · thepropertydna.com
  </p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    "PropertyDNA · YouTube — Your filming kit + 5 scripts",
    "",
    "Read 00-filming-kit.md first. Then the 5 scripts.",
    "",
    "Recommended shoot order:",
    "  1. Warm-up clip (the hero loop)",
    "  2. Short #03 (cherry-pick comps)",
    "  3. Short #04 (3 Zillow lies)",
    "  4. Short #05 (permit-history trick)",
    "  5. Long-form #01 (Thunderbird head-to-head)",
    "  6. Long-form #02 (FL insurance — CTA only on camera)",
    "",
    "Attachments:",
    ...FILES.map(f => `  • ${f.name} — ${f.label}`),
    "",
    "After the shoot, drop files in a folder and text me. First Short live on YouTube within 24h.",
    "",
    "PropertyDNA · save the humans",
  ].join("\n");

  console.log(`Sending filming kit + 5 scripts to ${RECIPIENT}...`);
  const result = await postResend({
    from: "PropertyDNA <reports@thepropertydna.com>",
    to: RECIPIENT,
    reply_to: "stuartteamps@gmail.com",
    subject: "🎬 Your filming kit + 5 scripts — 90-min shoot, then we ship",
    html, text, attachments,
  });

  if (result.status >= 200 && result.status < 300) {
    console.log(`✅ Email sent. Resend ID: ${result.data?.id || "(unknown)"}`);
  } else {
    console.error(`❌ Email failed: ${result.status}`);
    console.error(result.data || result.raw);
    process.exit(1);
  }
})().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});

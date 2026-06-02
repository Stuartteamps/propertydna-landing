#!/usr/bin/env node
/**
 * generate-open-house-qrs.js
 *
 * Generates QR codes for each open-house property and emails them to Dan.
 * QR codes point to: https://thepropertydna.com/open-house?property=SLUG&agent=daniel&source=qr
 *
 * Usage:
 *   RESEND_API_KEY=re_... node tools/generate-open-house-qrs.js
 *   (Or pass --send-to=email@example.com to override the recipient)
 *
 * Outputs:
 *   - tools/open-house-qrs/{slug}.png  (PNG QR code per property)
 *   - Email to OWNER with all 3 attached
 */
const fs    = require("fs");
const path  = require("path");
const https = require("https");

const SITE = "https://thepropertydna.com";
const QR_API_HOST = "api.qrserver.com";

// Recipient
const argSendTo = (process.argv.find(a => a.startsWith("--send-to=")) || "").split("=")[1];
const RECIPIENT = argSendTo || process.env.OWNER_EMAIL || "stuartteamps@gmail.com";

// 3 properties — kept in sync with app/frontend/src/config/properties.ts
const PROPERTIES = [
  {
    slug: "40380-tonopah",
    address: "40380 Tonopah Road",
    community: "Thunderbird Heights",
    price: "$2,999,999",
    specs: "3 BR · 4.5 BA · 4,181 sqft",
  },
  {
    slug: "70629-boothill",
    address: "70629 Boothill Road",
    community: "Thunderbird Heights",
    price: "$3,895,000",
    specs: "4 BR · 4.5 BA · 6,452 sqft",
  },
  {
    slug: "40231-club-view",
    address: "40231 Club View Drive",
    community: "Thunderbird Country Club Estates",
    price: "$4,300,000",
    specs: "4 BR · 4 BA · 4,821 sqft (William Cody, 1955)",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fetchBinary(host, path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: host, path, headers: { "User-Agent": "PropertyDNA-QRGen/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`QR API ${res.statusCode}: ${path}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function sendEmailWithAttachments({ to, subject, html, text, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set in env");

  const from = "PropertyDNA <reports@thepropertydna.com>";
  const payload = JSON.stringify({
    from, to, reply_to: "stuartteamps@gmail.com",
    subject, html, text, attachments,
  });

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

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  const outDir = path.join(__dirname, "open-house-qrs");
  fs.mkdirSync(outDir, { recursive: true });

  const attachments = [];
  const summary = [];

  for (const p of PROPERTIES) {
    const url = `${SITE}/open-house?property=${p.slug}&agent=daniel&source=qr`;
    // QRServer GET — large, high-error-correction, generous quiet zone for print
    const qrPath = `/v1/create-qr-code/?size=900x900&format=png&margin=24&ecc=H&data=${encodeURIComponent(url)}`;

    console.log(`Generating QR for ${p.address}...`);
    const png = await fetchBinary(QR_API_HOST, qrPath);
    const filename = `${p.slug}.png`;
    const fullPath = path.join(outDir, filename);
    fs.writeFileSync(fullPath, png);
    console.log(`  → ${fullPath}  (${png.length} bytes)`);

    attachments.push({
      filename: `qr_${p.slug}.png`,
      content: png.toString("base64"),
    });
    summary.push({ ...p, url });
  }

  // ── Build email ─────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;">
<tr><td align="center" style="padding:40px 20px;">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e5e0d8;">

<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
  <p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA</p>
  <p style="margin:8px 0 0;font-size:22px;color:#1a1a1a;font-family:Georgia,serif;">Open House QR Codes — Thunderbird</p>
  <p style="margin:6px 0 0;font-size:13px;color:#777;">3 properties · weekend of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
</td></tr>

<tr><td style="padding:24px 40px 8px;">
  <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.7;">
    Dan — your 3 QR codes are attached as PNGs. Each one prints to letter-size for the sign-in table. Scanning lands the guest on the property-specific sign-in page; on submit they get an instant confirmation email (and SMS once Quo is wired tonight), then enter the 8-touch follow-up cadence automatically.
  </p>
  <p style="margin:0 0 4px;font-size:12px;color:#888;line-height:1.6;">
    Direct URLs (in case you want to text/share without the QR):
  </p>
</td></tr>

${summary.map(p => `
<tr><td style="padding:18px 40px;border-top:1px solid #f0ece4;">
  <p style="margin:0 0 4px;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">${p.community}</p>
  <p style="margin:0 0 4px;font-size:17px;color:#1a1a1a;font-family:Georgia,serif;">${p.address}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#666;">${p.price} · ${p.specs}</p>
  <p style="margin:0 0 4px;font-size:11px;color:#999;">QR file: <strong>qr_${p.slug}.png</strong></p>
  <p style="margin:0;font-size:11px;"><a href="${p.url}" style="color:#C9A84C;text-decoration:none;word-break:break-all;">${p.url}</a></p>
</td></tr>`).join("")}

<tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
  <p style="margin:0;font-size:12px;color:#777;line-height:1.6;">
    Print each QR at 4" × 4" minimum (8" is better for a tabletop sign). Black ink on white card stock scans cleanly from 3-4 feet away.
  </p>
</td></tr>

<tr><td style="padding:16px 40px;background:#fff;border-top:1px solid #e5e0d8;">
  <p style="margin:0;font-size:11px;color:#bbb;">PropertyDNA · thepropertydna.com</p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    "PropertyDNA — Open House QR Codes (Thunderbird, 3 properties)", "",
    "Three QR codes are attached. URLs below for sharing:", "",
    ...summary.flatMap(p => [
      `${p.address} — ${p.community}`,
      `${p.price} · ${p.specs}`,
      `Attachment: qr_${p.slug}.png`,
      `URL: ${p.url}`, "",
    ]),
    "Print each QR at 4\" × 4\" minimum. Black ink on white card stock scans cleanly from 3-4 feet.",
  ].join("\n");

  console.log(`\nSending email to ${RECIPIENT}...`);
  const result = await sendEmailWithAttachments({
    to: RECIPIENT,
    subject: "Your 3 open-house QR codes — Thunderbird (Tonopah, Boothill, Club View)",
    html, text, attachments,
  });

  if (result.status >= 200 && result.status < 300) {
    console.log(`✅ Email sent. Resend ID: ${result.data?.id || "(unknown)"}`);
  } else {
    console.error(`❌ Email failed: ${result.status}`);
    console.error(result.data || result.raw);
    process.exit(1);
  }

  console.log("\nDone. QRs saved to:", outDir);
  console.log("Direct URLs:");
  summary.forEach(p => console.log(`  ${p.address}\n    ${p.url}`));
})().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});

/**
 * unsubscribe — One-click unsubscribe for outreach campaigns (CAN-SPAM required)
 *
 * GET ?e={base64email}&c={campaignId}
 *
 * Adds email to campaign_unsubscribes, returns a plain HTML confirmation page.
 */
const db = require("./_supabase");

exports.handler = async (event) => {
  const { e: encoded, email: plainEmail, c: campaignId } = event.queryStringParameters || {};

  // Engagement emails (_engage.js) send a plaintext ?email= param; campaign emails
  // send a base64 ?e= param. Accept BOTH — previously the engagement link 400'd
  // because only ?e= was parsed (a CAN-SPAM compliance bug + churn amplifier).
  let email = "";
  if (plainEmail) {
    email = String(plainEmail).toLowerCase().trim();
  } else {
    try { email = Buffer.from(encoded || "", "base64").toString("utf8").toLowerCase().trim(); } catch {}
  }

  if (!email || !email.includes("@")) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: "<html><body style='font-family:Georgia,serif;padding:40px;'><h2>Invalid unsubscribe link.</h2></body></html>",
    };
  }

  // Add to global unsubscribe list (upsert — safe to call multiple times)
  try {
    await db.upsert("campaign_unsubscribes", { email }, "email");
  } catch (err) {
    console.error("[unsubscribe]", err.message);
  }

  // Also suppress ENGAGEMENT emails — the engagement consent model (_engage.js
  // shouldSend) reads notification_preferences, not campaign_unsubscribes. Without
  // this dual-write an engagement unsubscribe would not stop future engagement
  // sends. Best-effort (no-op if the table/constraint isn't present).
  try {
    await db.upsert("notification_preferences", {
      email, agent: "all", channel: "all", enabled: false,
      updated_at: new Date().toISOString(),
    }, "email,agent,channel");
  } catch (err) {
    console.warn("[unsubscribe] notification_preferences:", err.message);
  }

  // Mark any pending/sent contacts for this email as unsubscribed
  if (campaignId) {
    try {
      await db.from("campaign_contacts").eq("email", email).eq("campaign_id", campaignId)
        .update({ status: "unsubscribed" });
      // Update campaign counter
      const rows = await db.from("campaigns").select("unsubscribed_count").eq("id", campaignId).get();
      const prev = rows?.[0]?.unsubscribed_count || 0;
      await db.update("campaigns", { id: campaignId }, { unsubscribed_count: prev + 1 });
    } catch (err) {
      console.warn("[unsubscribe] contact update:", err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribed — PropertyDNA</title>
</head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;min-height:100vh;">
    <tr><td align="center" style="padding:80px 20px;">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#fff;border:1px solid #e5e0d8;padding:48px 40px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA powered by IntellaGraphAI</p>
          <h1 style="margin:0 0 20px;font-size:28px;font-weight:normal;color:#1a1a1a;">You've been unsubscribed.</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.75;"><strong>${email}</strong> has been removed from our outreach list. You won't receive any further emails from this campaign.</p>
          <p style="margin:0 0 32px;font-size:14px;color:#777;line-height:1.75;">If you unsubscribed by mistake or want to reconnect, reply to any previous email or visit <a href="https://thepropertydna.com" style="color:#E8B84B;">thepropertydna.com</a>.</p>
          <p style="margin:0;font-size:13px;color:#999;">— PropertyDNA powered by IntellaGraphAI</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
};

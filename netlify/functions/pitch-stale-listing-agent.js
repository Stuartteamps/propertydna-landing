/**
 * pitch-stale-listing-agent — Send the referral-pitch email to a specific
 * listing agent. Dan triggers this from the daily digest (per-listing,
 * opt-in) so we stay CAN-SPAM safe + relationship-respectful.
 *
 * POST body:
 *   listing_id          uuid  — stale_listing_tracker.id
 *   custom_note         text  — optional one-line Dan can prepend
 *
 * Auth: x-internal-key header.
 *
 * Behavior:
 *   1. Look up the listing in stale_listing_tracker
 *   2. Generate a personalized pitch email
 *   3. Send to listing_agent_email
 *   4. Mark pitched = true, pitched_at = now
 *   5. Add agent to agent_referral_network (status = prospect_pitched)
 */
const https = require("https");
const db = require("./_supabase");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

function sendEmail({ to, replyTo, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0 });
  const from = `Dan Stuart, PropertyDNA <reports@thepropertydna.com>`;
  const payload = JSON.stringify({ from, to, reply_to: replyTo || "stuartteamps@gmail.com", subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode }); } });
    });
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

function buildPitchEmail({ listing, customNote }) {
  const firstName = (listing.listing_agent || "there").split(" ")[0];
  const addrLine  = listing.address || "the property";
  const price     = listing.list_price ? `$${Number(listing.list_price).toLocaleString()}` : "the listed price";
  const dom       = listing.days_on_market;
  const club      = (listing.club_slug || "").replace(/-/g, " ");

  // Peer-to-peer broker voice. NOT consumer marketing. NOT pushy.
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fafaf7;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:28px 36px 8px;">
<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;">Hi ${firstName},</p>
${customNote ? `<p style="margin:0 0 16px;font-size:15px;color:#222;line-height:1.7;font-style:italic;">${customNote}</p>` : ""}
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">Quick note from a fellow broker — I noticed your listing at <strong>${addrLine}</strong> has been on the market ${dom} days in ${club || "the desert"}. Not a knock — the desert market is what it is right now, and luxury inventory in particular is taking 100+ DOM as the norm.</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">I run PropertyDNA, a data platform built to defend buyers from asymmetric information — and the side effect has been that I get the data on which buyers are actively searching in each desert enclave, what their price thresholds are, and what's making them walk vs sign. Right now I'm seeing a healthy active-buyer pool in your enclave at the ${price} band, but a lot of them are getting filtered out before they ever see your listing because of search-bias issues on Zillow + Realtor.com.</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">If you'd consider referring it to me as a co-listing or full referral, I'd be happy to put my buyer pipeline against it. Standard 25% referral fee, or we co-list and split — your call. I'll cover any open-house marketing.</p>
<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.75;">If you want a sample, I'm attaching a quick PropertyDNA report on the property — what the algorithm says about value, the comp spread our data sees, the flood/hazard layer, and where the buyer-side data thinks the right offer is. No pitch, just data.</p>
<p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.75;">If it's a fit, hit reply. If not, no offense — I respect a tightly-held listing. Either way, good selling.</p>
<p style="margin:24px 0 4px;font-size:14px;color:#1a1a1a;">— Dan Stuart</p>
<p style="margin:0 0 4px;font-size:12px;color:#666;">Stuart Team Realty · PropertyDNA</p>
<p style="margin:0;font-size:12px;color:#888;">stuartteamps@gmail.com · (213) 205-4933 · DRE# 02043742</p>
</td></tr>
<tr><td style="padding:14px 36px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0;font-size:10px;color:#999;line-height:1.6;">Sent broker-to-broker. If you'd rather not receive future notes like this, reply STOP and I'll mark your name off the outreach list.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = `Hi ${firstName},

${customNote ? customNote + "\n\n" : ""}Quick note from a fellow broker — I noticed your listing at ${addrLine} has been on the market ${dom} days in ${club || "the desert"}. Not a knock — luxury desert inventory is taking 100+ DOM as the norm right now.

I run PropertyDNA, a data platform built to defend buyers from asymmetric information. The side effect has been that I get the data on which buyers are actively searching in each desert enclave and what their price thresholds are. Right now I'm seeing a healthy active-buyer pool in your enclave at the ${price} band, but a lot of them are getting filtered out before they ever see your listing because of search bias on Zillow + Realtor.com.

If you'd consider referring it to me as a co-listing or full referral, I'd be happy to put my buyer pipeline against it. Standard 25% referral fee, or we co-list and split — your call. I'll cover any open-house marketing.

If it's a fit, hit reply. If not, no offense.

— Dan Stuart
Stuart Team Realty · PropertyDNA
stuartteamps@gmail.com · (213) 205-4933
DRE# 02043742

Reply STOP if you'd rather not receive notes like this.`;

  return {
    subject: `Your ${addrLine} listing — quick broker note`,
    html,
    text,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  const internalKey = event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  const { listing_id, custom_note } = body;
  if (!listing_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "listing_id required" }) };

  // Fetch listing
  const rows = await db.from("stale_listing_tracker").select("*").eq("id", listing_id).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Listing not found" }) };
  }
  const listing = rows[0];

  if (!listing.listing_agent_email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No listing_agent_email on file. Enrich the row first." }) };
  }

  if (listing.pitched) {
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: "Already pitched", pitched_at: listing.pitched_at }) };
  }

  const tmpl = buildPitchEmail({ listing, customNote: custom_note });
  const result = await sendEmail({
    to: listing.listing_agent_email,
    replyTo: "stuartteamps@gmail.com",
    subject: tmpl.subject,
    html: tmpl.html,
    text: tmpl.text,
  });

  if (result.status < 200 || result.status >= 300) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Send failed", status: result.status, response: result.data }) };
  }

  // Mark pitched + upsert agent into the referral network
  await db.from("stale_listing_tracker").eq("id", listing_id).update({
    pitched: true,
    pitched_at: new Date().toISOString(),
  }).catch(() => {});

  await db.upsert("agent_referral_network", {
    agent_name: listing.listing_agent,
    agent_email: listing.listing_agent_email,
    brokerage: listing.listing_brokerage,
    city: listing.city,
    state: listing.state,
    source: "stale_listing_pitch",
    status: "prospect_pitched",
    first_contacted_at: new Date().toISOString(),
    last_contacted_at: new Date().toISOString(),
  }, "agent_email").catch(() => {});

  db.kpi("stale_listing_pitch_sent", listing.listing_agent_email, {
    listing_id, mls_number: listing.mls_number, days_on_market: listing.days_on_market, club_slug: listing.club_slug,
  });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ status: "ok", sent_to: listing.listing_agent_email, message_id: result.data?.id }),
  };
};

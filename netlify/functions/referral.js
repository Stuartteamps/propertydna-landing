/**
 * referral — attribution entry point for Ambassador-agent links.
 * GET /.netlify/functions/referral?ref=CODE
 *   1. Logs the click (who shared, via referral_codes) into referrals.
 *   2. Redirects the invitee to the site with ?ref carried through, so the
 *      eventual report-run can be attributed (queue-report captures body.ref).
 */
const db = require("./_supabase");
const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");

exports.handler = async (event) => {
  const ref = (event.queryStringParameters && event.queryStringParameters.ref) || "";
  if (ref) {
    try {
      const codes = await db.from("referral_codes").select("email").eq("code", ref).limit(1).get().catch(() => []);
      const referrer = Array.isArray(codes) && codes[0] ? codes[0].email : null;
      await db.insert("referrals", { referrer_email: referrer, code: ref, channel: "link", status: "clicked" }).catch(() => {});
      db.kpi("referral_click", referrer, { code: ref });
    } catch { /* never block the redirect */ }
  }
  const dest = `${APP_BASE}/?ref=${encodeURIComponent(ref)}&utm_source=ambassador&utm_medium=referral`;
  return { statusCode: 302, headers: { Location: dest }, body: "" };
};

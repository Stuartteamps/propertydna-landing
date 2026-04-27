const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email } = body;
  if (!email || !email.includes("@")) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null }) };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Count paid + free property reports for this email
    const reports = await db.from("property_reports")
      .select("id")
      .eq("email", normalizedEmail)
      .get();

    const reportCount = Array.isArray(reports) ? reports.length : 0;

    // Check active subscription in new subscriptions table
    const subs = await db.from("subscriptions")
      .select("id,plan_name,status,current_period_end,cancel_at_period_end")
      .eq("email", normalizedEmail)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .get();

    let isSubscribed = false;
    let plan = null;
    let subscriptionId = null;

    if (Array.isArray(subs) && subs.length > 0) {
      const sub = subs[0];
      // Verify period hasn't expired
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!periodEnd || periodEnd > new Date()) {
        isSubscribed = true;
        plan = sub.plan_name;
        subscriptionId = sub.id;
      }
    }

    // Fallback: also check legacy reports table for SUBSCRIPTION records
    if (!isSubscribed) {
      const legacySubs = await db.from("reports")
        .select("property_dna")
        .eq("email", normalizedEmail)
        .eq("role", "SUBSCRIPTION")
        .get()
        .catch(() => []);

      if (Array.isArray(legacySubs)) {
        for (const row of legacySubs) {
          let meta = row.property_dna;
          if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
          if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
        }
      }
    }

    db.kpi("usage_check", normalizedEmail, { reportCount, isSubscribed });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount, isSubscribed, plan, subscriptionId }) };
  } catch (err) {
    console.error("[check-usage]", err.message);
    // Fail open — don't block report generation on DB errors
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null }) };
  }
};

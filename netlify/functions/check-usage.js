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
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email } = body;
  if (!email || !email.includes("@")) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null }) };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Owner bypass — always subscribed, upsert subscription so DB is authoritative
  const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
  if (normalizedEmail === OWNER_EMAIL) {
    db.upsert("subscriptions", {
      email: OWNER_EMAIL,
      plan_name: "enterprise",
      status: "active",
      current_period_end: null,
    }, "email").catch(() => {});
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount: 0, isSubscribed: true, plan: "enterprise" }) };
  }

  try {
    // Count from property_reports (new schema)
    const newReports = await db.from("property_reports")
      .select("id")
      .eq("email", normalizedEmail)
      .get()
      .catch(() => []);

    // Count from legacy reports table — exclude SUBSCRIPTION pseudo-records
    const legacyReports = await db.from("reports")
      .select("id,role")
      .eq("email", normalizedEmail)
      .get()
      .catch(() => []);

    const legacyCount = Array.isArray(legacyReports)
      ? legacyReports.filter(r => r.role !== "SUBSCRIPTION").length
      : 0;

    const reportCount = (Array.isArray(newReports) ? newReports.length : 0) + legacyCount;

    // Check active subscription
    const subs = await db.from("subscriptions")
      .select("id,plan_name,status,current_period_end")
      .eq("email", normalizedEmail)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .get()
      .catch(() => []);

    let isSubscribed = false;
    let plan = null;
    let subscriptionId = null;

    if (Array.isArray(subs) && subs.length > 0) {
      const sub = subs[0];
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!periodEnd || periodEnd > new Date()) {
        isSubscribed = true;
        plan = sub.plan_name;
        subscriptionId = sub.id;
      }
    }

    // Fallback subscription check from legacy reports table
    if (!isSubscribed && Array.isArray(legacyReports)) {
      for (const row of legacyReports) {
        if (row.role !== "SUBSCRIPTION") continue;
        let meta = row.property_dna;
        if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
        if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
      }
    }

    db.kpi("usage_check", normalizedEmail, { reportCount, isSubscribed });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ reportCount, isSubscribed, plan, subscriptionId }),
    };
  } catch (err) {
    console.error("[check-usage]", err.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null }) };
  }
};

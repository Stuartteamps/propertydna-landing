const db = require("./_supabase");
const { getTier, billingCycleStart, OVERAGE_RATE_PER_REPORT } = require("./_quota-config");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const OWNER_EMAILS = [
  process.env.OWNER_EMAIL || "stuartteamps@gmail.com",
];

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
    const tier = getTier("free");
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      reportCount: 0, isSubscribed: false, plan: null,
      quota: { limit: tier.limit, used: 0, remaining: tier.limit, overageRate: null, tierLabel: tier.label },
    })};
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Owner bypass — unlimited
  if (OWNER_EMAILS.includes(normalizedEmail)) {
    db.upsert("subscriptions", {
      email: normalizedEmail, plan_name: "enterprise", status: "active", current_period_end: null,
    }, "email").catch(() => {});
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      reportCount: 0, isSubscribed: true, plan: "owner",
      quota: { limit: null, used: 0, remaining: null, overageRate: null, tierLabel: "Owner" },
    })};
  }

  try {
    const cycleStart = billingCycleStart();

    // Monthly report count (current billing cycle only — resets each month)
    const [newReports, legacyReports, newMonthly] = await Promise.all([
      db.from("property_reports").select("id").eq("email", normalizedEmail).get().catch(() => []),
      db.from("reports").select("id,role").eq("email", normalizedEmail).get().catch(() => []),
      db.from("property_reports").select("id").eq("email", normalizedEmail)
        .gte("created_at", cycleStart).get().catch(() => []),
    ]);

    const legacyCount = Array.isArray(legacyReports)
      ? legacyReports.filter(r => r.role !== "SUBSCRIPTION").length : 0;
    const totalReportCount = (Array.isArray(newReports) ? newReports.length : 0) + legacyCount;

    // Monthly count (for quota enforcement) — legacy reports don't have timestamps we can trust,
    // so only count new-schema reports within the current billing cycle
    const monthlyUsed = Array.isArray(newMonthly) ? newMonthly.length : 0;

    // Check active subscription
    const subs = await db.from("subscriptions")
      .select("id,plan_name,status,current_period_end")
      .eq("email", normalizedEmail).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).get().catch(() => []);

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

    // Fallback: legacy subscription record
    if (!isSubscribed && Array.isArray(legacyReports)) {
      for (const row of legacyReports) {
        if (row.role !== "SUBSCRIPTION") continue;
        let meta = row.property_dna;
        if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
        if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
      }
    }

    // Determine effective tier and quota
    const effectivePlan = isSubscribed ? plan : (totalReportCount === 0 ? "free" : "free");
    const tier = getTier(effectivePlan);

    // For free users: use total all-time count (first report ever is free, then gate)
    // For paid users: use monthly count against tier limit
    const quotaUsed     = isSubscribed ? monthlyUsed : totalReportCount;
    const quotaLimit    = tier.limit;
    const quotaRemaining = quotaLimit === Infinity ? null : Math.max(0, quotaLimit - quotaUsed);
    const quotaExceeded  = quotaLimit !== Infinity && quotaUsed >= quotaLimit;

    db.kpi("usage_check", normalizedEmail, {
      totalReportCount, monthlyUsed, isSubscribed, plan: effectivePlan, quotaExceeded,
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        reportCount: totalReportCount,
        isSubscribed,
        plan: effectivePlan,
        subscriptionId,
        quota: {
          limit:       quotaLimit === Infinity ? null : quotaLimit,
          used:        quotaUsed,
          remaining:   quotaRemaining,
          exceeded:    quotaExceeded,
          overageRate: isSubscribed ? OVERAGE_RATE_PER_REPORT : null,
          tierLabel:   tier.label,
          cycleStart,
        },
      }),
    };
  } catch (err) {
    console.error("[check-usage]", err.message);
    const tier = getTier("free");
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      reportCount: 0, isSubscribed: false, plan: null,
      quota: { limit: tier.limit, used: 0, remaining: tier.limit, overageRate: null, tierLabel: tier.label },
    })};
  }
};

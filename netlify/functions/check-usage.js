const https = require("https");

function supabaseRequest(path, query, serviceKey) {
  const url = new URL(`https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/${path}?${query}`);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
          catch { reject(new Error("Bad JSON")); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email } = body;
  if (!email || !email.includes("@")) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid email required" }) };
  }

  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null }) };
  }

  const emailEncoded = encodeURIComponent(email.toLowerCase().trim());

  try {
    // Count all property DNA reports for this email
    const countRes = await supabaseRequest(
      "reports",
      `email=eq.${emailEncoded}&role=neq.SUBSCRIPTION&select=id`,
      SUPABASE_KEY
    );
    const reportCount = Array.isArray(countRes.data) ? countRes.data.length : 0;

    // Check for active subscription
    const subRes = await supabaseRequest(
      "reports",
      `email=eq.${emailEncoded}&role=eq.SUBSCRIPTION&select=property_dna`,
      SUPABASE_KEY
    );

    let isSubscribed = false;
    let plan = null;
    let subscriptionId = null;

    if (Array.isArray(subRes.data) && subRes.data.length > 0) {
      for (const row of subRes.data) {
        let meta = row.property_dna;
        if (typeof meta === "string") {
          try { meta = JSON.parse(meta); } catch { continue; }
        }
        if (meta && meta.status === "active") {
          isSubscribed = true;
          plan = meta.plan || "monthly";
          subscriptionId = meta.stripe_subscription_id || null;
          break;
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reportCount, isSubscribed, plan, subscriptionId }),
    };
  } catch (err) {
    console.error("[check-usage]", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reportCount: 0, isSubscribed: false, plan: null, error: err.message }),
    };
  }
};

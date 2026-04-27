const https = require("https");

function supabaseGet(path, query, serviceKey) {
  const url = `https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/${path}?${query}`;
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
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
          try { resolve(JSON.parse(raw)); }
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

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
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
    return { statusCode: 200, headers, body: JSON.stringify({ reports: [], isSubscribed: false }) };
  }

  const emailEncoded = encodeURIComponent(email.toLowerCase().trim());

  try {
    // Fetch all reports for this email (exclude subscription records)
    const reports = await supabaseGet(
      "reports",
      `email=eq.${emailEncoded}&role=neq.SUBSCRIPTION&order=created_at.desc&select=id,full_name,address,created_at,property_dna`,
      SUPABASE_KEY
    );

    // Check subscription
    const subs = await supabaseGet(
      "reports",
      `email=eq.${emailEncoded}&role=eq.SUBSCRIPTION&select=property_dna`,
      SUPABASE_KEY
    );

    let isSubscribed = false;
    let plan = null;
    if (Array.isArray(subs)) {
      for (const row of subs) {
        let meta = row.property_dna;
        if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
        if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
      }
    }

    const safeReports = Array.isArray(reports) ? reports.map((r) => {
      let meta = r.property_dna;
      if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      return {
        id: r.id,
        address: r.address || meta?.address || "Unknown address",
        createdAt: r.created_at,
        reportUrl: meta?.reportUrl || null,
      };
    }) : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reports: safeReports, isSubscribed, plan }),
    };
  } catch (err) {
    console.error("[get-reports]", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

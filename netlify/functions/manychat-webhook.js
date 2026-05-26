/**
 * manychat-webhook — Single endpoint for ManyChat IG/FB qualifier flows
 *
 * ManyChat (External Request action) calls this at the end of the multi-step
 * qualifier with the captured fields. We:
 *   1. Log the lead into Supabase (campaign_contacts) with source tagging
 *   2. Fire a Resend confirmation email via send-lead-email (per-role template)
 *   3. Optionally queue a real PropertyDNA report if address provided
 *   4. Return a personalized /report-pending bypass URL for ManyChat to DM back
 *
 * Auth: header `x-manychat-token` must equal env MANYCHAT_WEBHOOK_TOKEN.
 *
 * POST body (from ManyChat External Request):
 *   role        text   buyer | seller | agent | investor
 *   firstName   text
 *   lastName    text   (optional)
 *   email       text
 *   phone       text   (optional)
 *   address     text   (optional — only for sellers / address lookups)
 *   city        text   (optional)
 *   state       text   (optional, default "CA")
 *   zip         text   (optional)
 *   platform    text   ig | fb (optional, defaults "ig")
 *   igHandle    text   (optional, ManyChat user info)
 *   subscriberId text  (optional, ManyChat subscriber ID)
 *
 * Response (ManyChat v2 dynamic-block format):
 *   {
 *     version: "v2",
 *     content: { messages: [...], actions: [...set_field_value report_url...] }
 *   }
 */
const https = require("https");
const db    = require("./_supabase");

const SITE  = "https://thepropertydna.com";
const CORS  = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-manychat-token",
};

// ── Helpers ────────────────────────────────────────────────────────────

function normPhone(raw) {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return String(raw).trim();
}

function normName(raw) {
  if (!raw) return "";
  return String(raw).trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normEmail(raw) {
  return (String(raw || "")).trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function roleToFunnel(role) {
  const r = String(role || "").toLowerCase();
  if (r.includes("sell") || r.includes("owner")) return "seller";
  if (r.includes("agent") || r.includes("broker")) return "contact";
  if (r.includes("invest")) return "off_market";
  return "buyer";
}

// Fire-and-forget POST to internal Netlify function (same site)
function postInternal(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const host = process.env.URL || process.env.DEPLOY_URL || "https://thepropertydna.com";
    const u = new URL(host + path);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "x-internal-key": process.env.INTERNAL_API_KEY || "",
      },
    }, (res) => {
      let r = ""; res.on("data", c => r += c);
      res.on("end", () => resolve({ status: res.statusCode, body: r }));
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.write(data);
    req.end();
  });
}

// Build the personalized /report-pending bypass URL
function buildReportUrl(c) {
  const params = new URLSearchParams();
  params.set("bypass", "1");
  if (c.fullName) params.set("fullName", c.fullName);
  if (c.email)    params.set("email",    c.email);
  if (c.phone)    params.set("phone",    c.phone);
  if (c.role)     params.set("role",     c.role);
  if (c.address)  params.set("address",  c.address);
  if (c.city)     params.set("city",     c.city);
  if (c.state)    params.set("state",    c.state);
  if (c.zip)      params.set("zip",      c.zip);
  params.set("utm_source",  "manychat");
  params.set("utm_medium",  c.platform === "fb" ? "fb_dm" : "ig_dm");
  params.set("utm_campaign", "dm_qualifier");
  return `${SITE}/report-pending?${params.toString()}`;
}

// Per-role DM message
function dmMessage(role, firstName, reportUrl, hasAddress) {
  const first = firstName || "there";
  const r = String(role || "").toLowerCase();

  if (r.includes("sell") || r.includes("owner")) {
    return hasAddress
      ? `Got it, ${first}. I'm pulling your full PropertyDNA report — valuation, comps, flood zone, and a direct verdict. It'll land in your inbox in under 3 minutes. Tap below to watch it generate live.`
      : `Got it, ${first}. Tap below to drop your address — I'll pull your full PropertyDNA seller report (valuation, comps, market velocity) for free.`;
  }
  if (r.includes("agent") || r.includes("broker")) {
    return `Welcome, ${first}. PropertyDNA gives you instant institutional-grade reports for any address — perfect for buyer presentations and listing prep. Tap below to run your first report free.`;
  }
  if (r.includes("invest")) {
    return `${first}, you're on the off-market list. I'll DM you first when something fits your criteria. In the meantime, tap below to run a free DNA report on any address you're tracking.`;
  }
  return `Awesome, ${first}. Tap below to run your free PropertyDNA report — full valuation, flood zone, crime, and a direct buy/skip verdict in under 3 minutes.`;
}

// ── Carousel comment-bait keyword library ──────────────────────────────
// Each keyword maps to a 2-message DM flow + a lead tag.
// First message is the hook (no link); second is the link payload.
// Voice rules per tools/manychat-dm-library.md: lowercase, short, one question.
const KEYWORD_FLOWS = {
  DOSSIER: {
    tag: "lead_dossier",
    msg1: "hey — sending it over right now. quick q: are you looking at a specific property, or browsing the index?",
    msg2: "if specific → DM me the address (just street + city is fine), I'll pull what we have. if general → here's the full index: https://www.thepropertydna.com/pedigree-index?utm_source=ig&utm_medium=dm&utm_campaign=dossier_bait\n\n53 verified dossiers in there. kaufmann, sinatra, bob hope, the elrod (yes, the bond house).",
  },
  VERIFIED: {
    tag: "lead_celebrity",
    msg1: "here's the wild part — we verified 53 of them but had to refute or downgrade dozens more. people just make stuff up because it sounds good.",
    msg2: "full verified list (with sources for every claim): https://www.thepropertydna.com/pedigree-index?utm_source=ig&utm_medium=dm&utm_campaign=verified\n\nif you're looking at a property right now that \"celebrity X lived there\" — send me the address. I can usually tell you in 24 hours if the claim holds.",
  },
  SINATRA: {
    tag: "lead_sinatra",
    msg1: "the sinatra map. ok this one's a rabbit hole — the man owned 4 separate palm springs properties between 1947 and 1995.",
    msg2: "here's the full map with verified ownership dates: https://www.thepropertydna.com/dossier/508038001?utm_source=ig&utm_medium=dm&utm_campaign=sinatra\n\nthe wild one is the rancho mirage compound — JFK stayed there in 1962, three weeks before he ditched it for crosby's place. that's a whole separate story.",
  },
  FREY: {
    tag: "lead_frey",
    msg1: "there are 47 verified frey commissions in palm springs. most people know the gas station and his own house. there's like 45 more.",
    msg2: "full architect portfolio: https://www.thepropertydna.com/architect/albert-frey?utm_source=ig&utm_medium=dm&utm_campaign=frey\n\nif you're looking at a specific property and want to know if it's actually a frey or just frey-influenced — send me the address. they trade once every 5.2 years so authenticated attribution = real $.",
  },
  FREY47: {
    tag: "lead_frey",
    msg1: "the full frey portfolio. 47 verified commissions over 50 years. most people only know 2 of them.",
    msg2: "complete list: https://www.thepropertydna.com/architect/albert-frey?utm_source=ig&utm_medium=dm&utm_campaign=frey47\n\nthe tramway gas station + frey house ii get all the press, but he designed the loewy house, the cree house, frey house I, and dozens of private residences across vista las palmas, the mesa, and old las palmas.",
  },
  BOND: {
    tag: "lead_film_provenance",
    msg1: "the elrod is wild. you can see the exact spot bambi and thumper fought 007 — it's the sunken living room with the concrete dome.",
    msg2: "full dossier with the film clips referenced: https://www.thepropertydna.com/dossier/510250031?utm_source=ig&utm_medium=dm&utm_campaign=bond\n\nlast verified sale was in 2018. it's not on market right now. when it comes up, it'll move in days.",
  },
  HOPE: {
    tag: "lead_lautner",
    msg1: "the mushroom roof. yep, that's it. lautner designed it in 73, hope's family had it until 2003. you'd recognize it instantly.",
    msg2: "full dossier: https://www.thepropertydna.com/dossier/510260033?utm_source=ig&utm_medium=dm&utm_campaign=hope\n\nfun fact: the original burned during construction in 73. what you see today is the rebuild. lautner refused to change the design.",
  },
  LIBERACE: {
    tag: "lead_celebrity",
    msg1: "the piano pool. yep, it was real. filled in by the 90s but the dossier shows you the original.",
    msg2: "https://www.thepropertydna.com/dossier/505301005?utm_source=ig&utm_medium=dm&utm_campaign=liberace\n\ncasa de liberace at 501 belardo. verified through the liberace foundation + riverside county deeds + palm springs life feature 1973. wild place.",
  },
  SMOKE: {
    tag: "lead_neighborhood",
    msg1: "smoke tree is one of the most private gated communities in palm springs — like 50 homes, founders since 1936, disney summered there 1948-66.",
    msg2: "the neighborhood dossier: https://www.thepropertydna.com/neighborhood/smoke-tree-ranch?utm_source=ig&utm_medium=dm&utm_campaign=smoke\n\nhomes there don't list on MLS. most trade off-market through relationships. that's why they hold value.",
  },
  INDEX: {
    tag: "lead_data",
    msg1: "the full breakdown — 16,787 properties, 13 named hoods, 11 documented architects. it's a lot.",
    msg2: "here: https://www.thepropertydna.com/pedigree-index?utm_source=ig&utm_medium=dm&utm_campaign=index\n\nfilter by tier (A is verified primary-source, B is top-hood-MCM-era), neighborhood, or architect. the inventory page lets you browse all 16k properties. https://www.thepropertydna.com/luxury-inventory",
  },
  LAUTNER: {
    tag: "lead_lautner",
    msg1: "8 lautners in palm springs. trades once every 4.7 years on average. that's not marketing — that's the lautner foundation registry.",
    msg2: "the full portfolio: https://www.thepropertydna.com/architect/john-lautner?utm_source=ig&utm_medium=dm&utm_campaign=lautner\n\nelrod, hope, walstrom, hoover all there. when one comes on market it doesn't sit.",
  },
  STORY: {
    tag: "lead_owner",
    msg1: "100%. is the property in palm springs, rancho mirage, or somewhere else? want to know what we'd need to start the dossier.",
    msg2: "what we'd dig for: deed chain, period press, architect drawings if it's MCM, any film/photo references. dossier turnaround is 7-14 days depending on archive availability. fee structure: https://www.thepropertydna.com/dossier-request?utm_source=ig&utm_medium=dm&utm_campaign=story\n\nwant me to start a free preliminary search? just send the address.",
  },
  DUE: {
    tag: "lead_buyer",
    msg1: "sending the buyer checklist. real estate's not great about teaching this. how big a budget are you in? changes what i'd flag.",
    msg2: "https://www.thepropertydna.com/blog/permit-history-property-purchase?utm_source=ig&utm_medium=dm&utm_campaign=due\n\ntl;dr — always pull the permit history. always ask for architect drawings if MCM. always cross-check listing sqft against the assessor's record. that one bit catches 30% of overstated listings.",
  },
};

// Match a comment/message string to a trigger word (case-insensitive, fuzzy)
function matchKeyword(text) {
  if (!text) return null;
  const upper = String(text).toUpperCase();
  // Exact word match (handles "DOSSIER" / "send me the DOSSIER please" / "Dossier!")
  for (const kw of Object.keys(KEYWORD_FLOWS)) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(upper)) return kw;
  }
  return null;
}

// Build the v2 dynamic-block response for a keyword trigger
function keywordResponse(keyword, flow) {
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      version: "v2",
      content: {
        messages: [
          { type: "text", text: flow.msg1 },
          { type: "text", text: flow.msg2 },
        ],
        actions: [
          { action: "add_tag", tag_name: flow.tag },
          { action: "add_tag", tag_name: "lead_carousel_comment" },
          { action: "set_field_value", field_name: "lead_funnel", value: "carousel_dm" },
          { action: "set_field_value", field_name: "execution_id", value: `kw_${keyword}_${Date.now()}` },
        ],
      },
    }),
  };
}

// ── Handler ────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")   return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // Auth: ManyChat must include x-manychat-token header
  const expected = process.env.MANYCHAT_WEBHOOK_TOKEN;
  const got      = event.headers["x-manychat-token"] || event.headers["X-Manychat-Token"];
  if (expected && got !== expected) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // ── KEYWORD-TRIGGER MODE ─────────────────────────────────────────────
  // Fired by ManyChat when a user comments a trigger word on a carousel post,
  // or sends one as a DM. Body contains the user's message text.
  const messageText = body.message_text || body.comment_text || body.last_input_text || body.text || "";
  const isKeywordTrigger = !!messageText && !body.email;  // qualifier always has email; keyword does not
  if (isKeywordTrigger) {
    const keyword = matchKeyword(messageText);
    if (keyword) {
      const flow = KEYWORD_FLOWS[keyword];
      // Fire-and-forget log to ops_activity_log
      db.from("ops_activity_log").insert({
        agent: "manychat",
        event_type: "keyword_trigger",
        status: "ok",
        summary: `${keyword} triggered → ${flow.tag}`,
        metadata: { keyword, message_text: messageText.slice(0, 200), subscriber_id: body.subscriber_id || null, platform: body.platform || "ig" },
        affected_rows: 1,
      }).catch(() => {});
      return keywordResponse(keyword, flow);
    }
    // No keyword match — return a polite generic
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        version: "v2",
        content: {
          messages: [{
            type: "text",
            text: "hey! not sure which dossier you're after — try DOSSIER, SINATRA, FREY, BOND, HOPE, LAUTNER, LIBERACE, SMOKE, INDEX, VERIFIED, STORY, or DUE. each one sends a different file.",
          }],
        },
      }),
    };
  }

  const role         = String(body.role || "buyer").trim();
  const firstName    = normName(body.firstName || body.first_name || "");
  const lastName     = normName(body.lastName  || body.last_name  || "");
  const email        = normEmail(body.email);
  const phone        = normPhone(body.phone);
  const address      = (body.address || "").trim();
  const city         = normName(body.city || "");
  const state        = (body.state || "CA").trim().toUpperCase().slice(0,2);
  const zip          = (body.zip || "").trim().slice(0,5);
  const platform     = (body.platform || "ig").toLowerCase();
  const igHandle     = (body.igHandle || body.ig_handle || "").trim();
  const subscriberId = (body.subscriberId || body.subscriber_id || "").toString();

  if (!isValidEmail(email)) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        version: "v2",
        content: {
          messages: [{
            type: "text",
            text: "Hmm — that email doesn't look right. Reply with a valid email and I'll send your free PropertyDNA report.",
          }],
        },
      }),
    };
  }

  const fullName  = `${firstName} ${lastName}`.trim() || firstName;
  const funnel    = roleToFunnel(role);
  const source    = platform === "fb" ? "manychat_fb" : "manychat_ig";
  const executionId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── 1. Persist contact (fire-and-forget; never block the DM) ─────────
  db.upsert("campaign_contacts", {
    first_name: firstName,
    last_name:  lastName,
    email,
    phone,
    address,
    city,
    state,
    zip,
    status:     "pending",
    metadata: {
      source,
      role,
      platform,
      ig_handle:     igHandle,
      subscriber_id: subscriberId,
      execution_id:  executionId,
      captured_at:   new Date().toISOString(),
    },
  }, "email").catch(e => console.warn("[manychat] contact upsert:", e.message));

  db.kpi("manychat_lead", email, { source, role, platform, has_address: !!address });

  // ── 2. Fire confirmation email (fire-and-forget) ─────────────────────
  postInternal("/.netlify/functions/send-lead-email", {
    funnelType:      funnel,
    recipientEmail:  email,
    recipientName:   fullName,
    propertyAddress: address,
    executionId,
    phone,
    message:         `Captured via ManyChat ${platform.toUpperCase()} (${role})${igHandle ? " @" + igHandle : ""}`,
  }).catch(e => console.warn("[manychat] send-lead-email:", e.message));

  // ── 3. If address provided, kick off a real DNA report ───────────────
  if (address && city) {
    postInternal("/.netlify/functions/queue-report", {
      fullName,
      email,
      phone,
      role:    funnel === "seller" ? "Seller" : "Buyer",
      address,
      city,
      state,
      zip,
      notes:   `ManyChat ${platform.toUpperCase()} qualifier`,
      stripeSessionId: "manychat",
    }).catch(e => console.warn("[manychat] queue-report:", e.message));
  }

  // ── 4. Build personalized link + return ManyChat v2 response ─────────
  const reportUrl = buildReportUrl({
    fullName, email, phone, role: funnel === "seller" ? "Seller" : "Buyer",
    address, city, state, zip, platform,
  });

  const text = dmMessage(role, firstName, reportUrl, !!address);
  const buttonText = address ? "Open my report" : "Run my free report";

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      version: "v2",
      content: {
        messages: [{
          type: "text",
          text,
          buttons: [{ type: "url", caption: buttonText, url: reportUrl }],
        }],
        actions: [
          { action: "set_field_value", field_name: "report_url",   value: reportUrl },
          { action: "set_field_value", field_name: "lead_funnel",  value: funnel    },
          { action: "set_field_value", field_name: "execution_id", value: executionId },
        ],
      },
    }),
  };
};

/**
 * fix-corrupted-cities.js — one-shot repair of the NC-indexer geo-corruption.
 *
 * 178 Mecklenburg County NC properties were written with city="GREENWICH" and
 * zip="06830" (a leaked CT default). State=NC is correct; the REAL city sits in
 * the address ("... CHARLOTTE NC"). This parses the real city from the address
 * and corrects city + clears the bad zip. Uses the service key (PostgREST PATCH).
 *
 * GET /.netlify/functions/fix-corrupted-cities?key=INTERNAL_API_KEY[&dryRun=1]
 */
const https = require("https");
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

function sreq(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: new URL(SUPA_URL).hostname, path, method,
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}) },
    }, (res) => { let raw=""; res.on("data",c=>raw+=c); res.on("end",()=>{ try{resolve({status:res.statusCode,data:raw?JSON.parse(raw):null});}catch{resolve({status:res.statusCode,data:raw});} }); });
    req.on("error",(e)=>resolve({status:0,err:e.message}));
    req.setTimeout(20000,()=>{req.destroy();resolve({status:0,err:"timeout"});});
    if (payload) req.write(payload);
    req.end();
  });
}

function realCityFromAddress(addr) {
  const toks = String(addr || "").trim().toUpperCase().split(/\s+/);
  if (toks.length < 2) return null;
  // last token is the state (NC); the token(s) before it are the city.
  let i = toks.length - 1;
  if (toks[i] === "NC") i--;
  const city = toks[i];
  if (!city) return null;
  if (city === "UNINC") return "Unincorporated";
  // title-case
  return city.charAt(0) + city.slice(1).toLowerCase();
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const key = q.key || event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  const dryRun = q.dryRun === "1";

  // pull the corrupted rows
  const get = await sreq("GET", `/rest/v1/property_master?select=apn,address,city,state,zip&city=ilike.greenwich&state=eq.NC&limit=500`, null);
  const rows = Array.isArray(get.data) ? get.data : [];
  let fixed = 0, skipped = 0;
  const sample = [];
  for (const r of rows) {
    const realCity = realCityFromAddress(r.address);
    if (!realCity || realCity === "Greenwich") { skipped++; continue; }
    if (sample.length < 6) sample.push({ apn: r.apn, address: r.address, from: r.city, to: realCity, zip_was: r.zip });
    if (!dryRun) {
      const upd = await sreq("PATCH", `/rest/v1/property_master?apn=eq.${encodeURIComponent(r.apn)}`, { city: realCity, zip: null });
      if (upd.status >= 200 && upd.status < 300) fixed++; else skipped++;
    } else { fixed++; }
  }
  return { statusCode: 200, headers: CORS, body: JSON.stringify({
    ok: true, dryRun, totalCorrupted: rows.length, fixed, skipped, sample }, null, 2) };
};

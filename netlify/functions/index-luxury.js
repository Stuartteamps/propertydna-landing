/**
 * PropertyDNA — Multi-Market Luxury Indexer (config-driven)
 *
 * One Netlify function, many markets. Pass {market: "<key>"} to select.
 * Each market config maps source-specific field names to the property_master schema.
 *
 * POST /.netlify/functions/index-luxury
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { market: "tx-travis", offset?: number, batchSize?: number, dryRun?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const DEFAULT_BATCH = 1000;

// ── Market configs (field map per source) ─────────────────────────────────────

const MARKETS = {
  "tx-travis": {
    label: "Travis County TX (Austin)",
    base: "https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0",
    fips: "48453", state: "TX",
    where: "py_owner_name IS NOT NULL AND geo_id IS NOT NULL",
    map: { apn: "geo_id", owner: "py_owner_name", appraised: "appraised_val", market: "market_value", assessed: "assessed_val" },
  },
  "co-pitkin": {
    label: "Pitkin County CO (Aspen)",
    base: "https://maps.pitkincounty.com/arcgis/rest/services/Sages/SagesParcelAddress/MapServer/0",
    fips: "08097", state: "CO",
    where: "owner_name IS NOT NULL AND parcel IS NOT NULL",
    map: {
      apn: "parcel", owner: "owner_name",
      ownerAddr: "owner_address1", ownerCity: "owner_city",
      ownerState: "owner_state", ownerZip: "owner_zip",
      city: "jurisdiction", addressHouse: "situs_address_housenumber",
    },
  },
  "sc-charleston": {
    label: "Charleston County SC",
    base: "https://gisccapps.charlestoncounty.org/arcgis/rest/services/GIS_VIEWER/Public_Search/MapServer/0",
    fips: "45019", state: "SC",
    where: "Owner IS NOT NULL",
    map: { owner: "Owner", coOwner: "Owner2" },
  },
  "az-pima": {
    label: "Pima County AZ (Tucson)",
    base: "https://gisdata.pima.gov/arcgis1/rest/services/GISOpenData/Parcels/MapServer/0",
    fips: "04019", state: "AZ",
    where: "OWNER IS NOT NULL",
    map: { owner: "OWNER" },
  },
  "nc-wake": {
    label: "Wake County NC (Raleigh)",
    base: "https://services8.arcgis.com/eJ9GuQwMsO1iIOw1/ArcGIS/rest/services/parcels/FeatureServer/0",
    fips: "37183", state: "NC",
    where: "OWNER IS NOT NULL",
    map: { owner: "OWNER" },
  },
  "nc-buncombe": {
    label: "Buncombe County NC (Asheville)",
    base: "https://arcgis.ashevillenc.gov/arcgis/rest/services/Properties_Addresses/BuncombeCountyProperty/FeatureServer/0",
    fips: "37021", state: "NC",
    where: "OwnerName IS NOT NULL",
    map: { owner: "OwnerName" },
  },
  "tn-davidson": {
    label: "Davidson County TN (Nashville)",
    base: "https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0",
    fips: "47037", state: "TN",
    where: "name IS NOT NULL",
    map: { owner: "name", apn: "parcelid", address1: "address1", address2: "address2", city: "city", zip: "PostalCode", sale: "SalePrice", saleDate: "DateAcquired" },
  },
  "ga-fulton": {
    label: "Fulton County GA (Atlanta)",
    base: "https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/0",
    fips: "13121", state: "GA",
    where: "Owner IS NOT NULL",
    map: { owner: "Owner" },
  },
  "hi-honolulu": {
    label: "Honolulu County HI (Oahu)",
    base: "https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/11",
    fips: "15003", state: "HI",
    where: "1=1",
    map: { apn: "TMK" },
  },
  "nv-washoe": {
    label: "Washoe County NV (Reno)",
    base: "https://wcgisweb.washoecounty.us/arcgis/rest/services/OpenData/OpenData/FeatureServer/0",
    fips: "32031", state: "NV",
    where: "OWNER IS NOT NULL",
    map: { owner: "OWNER" },
  },
};

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchJSON(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "PropertyDNA/3.0" },
    }, (res) => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ statusCode: res.statusCode, data: null }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function fetchBatch(market, offset, count) {
  const params = new URLSearchParams({
    where: market.where,
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "OBJECTID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${market.base}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(market) {
  const params = new URLSearchParams({
    where: market.where,
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${market.base}/query?${params}`);
  return Number(res.data?.features?.[0]?.attributes?.cnt) || 0;
}

// ── Generic row builder — pulls field from map, falls back to common names ────

function pick(row, field, fallbacks = []) {
  if (row[field] != null && row[field] !== "") return row[field];
  for (const fb of fallbacks) {
    if (row[fb] != null && row[fb] !== "") return row[fb];
  }
  return null;
}

function buildRows(rows, market, today) {
  const master = [], history = [];
  const m = market.map || {};
  for (const row of rows) {
    // APN: prefer mapped field, fall back to common parcel ID names
    const rawApn = String(
      pick(row, m.apn || "_none_",
        ["PARCEL_ID","PIN","APN","parcel","PARCEL","PARCELID","TMK","geo_id","ParcelID","parcelid","PRINT_KEY"])
      || row.OBJECTID || ""
    ).trim();
    if (!rawApn) continue;

    const owner = String(pick(row, m.owner || "_none_", ["OWNER","Owner","OWNER_NAME","OwnerName","owner_name","name","PRIMARY_OWNER"]) || "").trim();
    if (!owner) continue;

    // Address: try common situs/address fields
    const address = String(
      pick(row, m.address || "_none_",
        ["SITUS_ADDR","SITE_ADDRESS","situs_address","Location","Full_Address","SITE_ADDR","address1","ADDRESS","PARCEL_ADDR"])
      || pick(row, m.addressHouse || "_none_", []) || ""
    ).trim();
    const city = String(
      pick(row, m.city || "_none_", ["SITUS_CITY","CITY","city","Property_City","SITUSCITY","jurisdiction"]) || ""
    ).trim();
    const zip = String(
      pick(row, m.zip || "_none_", ["SITUS_ZIP","ZIP","zip","Property_Zip","SITUSZIP","POSTAL_CODE","PostalCode","LOC_ZIP"]) || ""
    ).trim().slice(0, 5);

    const sqft = Number(pick(row, m.sqft || "_none_", ["TOTAL_LIVING_AREA","SQFT","SqFt","Living_Area","BLDG_SQFT","SQFT_LIVING","TOTAL_SQFT"])) || null;
    const yrBlt = Number(pick(row, m.yearBuilt || "_none_", ["YEAR_BUILT","AYB","YrBuilt","YR_BLT","yearbuilt","YearBuilt"])) || null;
    const tav = Number(pick(row, m.assessed || "_none_", ["ASSESSED","Assessed_Total","TOTAL_AV","ASSESSED_VALUE","assessed_val","TOTAL_ASSESS"])) || null;
    const mv = Number(pick(row, m.market || "_none_", ["MARKET_VALUE","FULL_MARKET_VAL","market_value","FMV","MKT_VAL","MKTTL"])) || null;

    const uniqueApn = `${market.state}-${market.fips}-${rawApn}`;

    master.push({
      apn: uniqueApn, county_fips: market.fips,
      address: address || null, city: city || null,
      state: market.state, zip: zip || null,
      sqft, year_built: (yrBlt && yrBlt > 1800) ? yrBlt : null,
      tax_assessed_value: tav,
      last_updated: new Date().toISOString(),
    });
    history.push({
      apn: uniqueApn, event_type: "assessment", event_date: today,
      source: `${market.state.toLowerCase()}_${market.fips}`,
      data: {
        marketLabel: market.label,
        address, city, zip,
        ownerName: owner,
        coOwner: String(pick(row, m.coOwner || "_none_", ["Owner2","CO_NAME","CoOwner","Co_Owner","ADD_OWNER"]) || "").trim() || null,
        ownerAddr: String(pick(row, m.ownerAddr || "_none_", ["OWNER_ADDR","OwnerAddr","owner_address1","OWNERLINE1","Mailing_Address"]) || "").trim() || null,
        ownerCity: String(pick(row, m.ownerCity || "_none_", ["OWNER_CITY","owner_city","OWNERCITY","Mailing_City"]) || "").trim() || null,
        ownerState: String(pick(row, m.ownerState || "_none_", ["OWNER_STATE","owner_state","OWNERSTATE","Mailing_State"]) || "").trim() || null,
        ownerZip: String(pick(row, m.ownerZip || "_none_", ["OWNER_ZIP","owner_zip","OWNERZIP","Mailing_Zip"]) || "").trim() || null,
        absentee: String(pick(row, m.ownerState || "_none_", ["OWNER_STATE","owner_state","OWNERSTATE","Mailing_State"]) || "").trim().toUpperCase() !== market.state,
        rawAPN: rawApn,
        sqft, yearBuilt: yrBlt,
        assessedValue: tav, marketValue: mv,
        salePrice: Number(pick(row, m.sale || "_none_", ["SalePrice","SALE_PRICE","Sale_Price","LAST_SALE_PRICE"])) || null,
        saleDate: pick(row, m.saleDate || "_none_", ["SaleDate","DateAcquired","SALE_DATE","Sale_Date","LAST_SALE_DATE"]) || null,
        scoredAt: new Date().toISOString(),
      },
    });
  }
  return { master, history };
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  // Dedupe by APN within batch
  const seen = {};
  for (const r of masterRows) seen[r.apn] = r;
  const uniqueMaster = Object.values(seen);

  await Promise.all([
    db.upsert("property_master", uniqueMaster, "apn").catch(e => errors.push(e.message.slice(0, 80))),
    db.insert("property_history", historyRows).catch(() => {}),
  ]);
  return errors;
}

async function getProgress(marketKey) {
  const rows = await db.from("kpi_events").select("metadata,created_at")
    .eq("event_type", "luxury_index_progress").eq("email", `luxury:${marketKey}`)
    .order("created_at", { ascending: false }).limit(1).get().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const m = rows[0].metadata || {};
  return { offset: m.nextOffset || 0, total: m.total || null, done: m.done || false };
}

async function saveProgress(marketKey, nextOffset, total, done) {
  db.kpi("luxury_index_progress", `luxury:${marketKey}`, { marketKey, nextOffset, total, done });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 2000);
  const marketKey = (body.market || "").trim().toLowerCase();
  const market = MARKETS[marketKey];

  if (!market) return { statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: "Unknown market", valid: Object.keys(MARKETS) }) };

  const prog = await getProgress(marketKey);
  const offset = body.offset != null ? Number(body.offset) : (body.reset ? 0 : prog.offset);
  let total = prog.total;
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (!total) total = await fetchCount(market);
    console.log(`[index-luxury:${marketKey}] offset=${offset} total=${total}`);

    const rows = await fetchBatch(market, offset, runSize);
    if (!rows.length) {
      const done = total > 0 && offset >= total;
      if (done) await saveProgress(marketKey, 0, total, true);
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ market: market.label, offset, done, retryable: !done }) };
    }

    const { master, history } = buildRows(rows, market, today);
    let writeErrors = [];
    if (!dryRun && master.length > 0) writeErrors = await bulkWrite(master, history);

    const newOffset = offset + rows.length;
    const isDone = rows.length < runSize || newOffset >= total;
    const pct = total > 0 ? Math.round((newOffset / total) * 100) : null;

    if (!dryRun) await saveProgress(marketKey, isDone ? 0 : newOffset, total, isDone);
    db.kpi("luxury_property_indexed", null, { market: market.label, processed: master.length, newOffset, total, dryRun });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      market: market.label, marketKey, fips: market.fips,
      offset, newOffset, total, pctComplete: pct,
      processed: master.length, errors: writeErrors.length,
      done: isDone, dryRun,
      sample: master.slice(0, 2),
      message: isDone ? `${market.label} complete (${total})` : `${market.label}: ${newOffset}/${total} (${pct}%)`,
    }) };
  } catch (err) {
    console.error(`[index-luxury:${marketKey}]`, err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message, market: market.label }) };
  }
};

exports.MARKETS = MARKETS;

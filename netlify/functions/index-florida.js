/**
 * PropertyDNA — Florida Statewide Cadastral Indexer
 *
 * Source: FDOR Florida Statewide Cadastral 2025 (public ArcGIS FeatureServer, no key needed)
 * URL: https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0
 *
 * Covers all 67 FL counties, ~11M parcels. Iterates county-by-county.
 * Writes to property_master + property_history using existing schema (migrations 001-009).
 *
 * DNA formula: improvement_ratio = (JV - LND_VAL) / (sqft × cost_sqft × depreciation(EFF_YR_BLT))
 * Renovation flag: EFF_YR_BLT > ACT_YR_BLT + 10 (FL appraiser updates effective age on permit finalization)
 *
 * POST /.netlify/functions/index-florida
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { county?: number, offset?: number, batchSize?: number, dryRun?: boolean, resetCounty?: boolean }
 */

const https = require("https");
const db = require("./_supabase");

const FL_BASE = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0";
const DEFAULT_BATCH = 1000;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// FDOR CO_NO does NOT follow simple alphabetical order — do not assume 1=Alachua etc.
// We store CO_NO directly and derive county_fips as "12_{coNo}" until a verified
// mapping is built from the data. CO_NO is the partition key for pagination.
// Verified so far: CO_NO=50 → Madison County (confirmed via PHY_CITY/ZIP in live data).

// Residential DOR Use Codes
const RESIDENTIAL_DOR_CODES = ["001","002","003","004","005","006","007","008","009"];

// Improvement quality cost per sqft (IMP_QUAL field: "1"=Excellent → "5"=Poor, numeric string)
const QUAL_COST = { "1": 380, "2": 300, "3": 230, "4": 175, "5": 130, default: 220 };

// Fields requested from the cadastral service
const FIELDS = [
  "PARCEL_ID","CO_NO","PHY_ADDR1","PHY_CITY","PHY_ZIPCD",
  "OWN_NAME","OWN_ADDR1","OWN_CITY","OWN_STATE","OWN_ZIPCD",
  "ACT_YR_BLT","EFF_YR_BLT","TOT_LVG_AR","LND_SQFOOT",
  "NO_BULDNG","NO_RES_UNT","JV","LND_VAL","NCONST_VAL",
  "DOR_UC","IMP_QUAL","CONST_CLAS","ASMNT_YR",
  "SALE_PRC1","SALE_YR1","SALE_MO1",
  "SALE_PRC2","SALE_YR2","SALE_MO2",
].join(",");

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchJSON(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)" },
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

function residentialWhere(coNo) {
  const codes = RESIDENTIAL_DOR_CODES.map(c => `'${c}'`).join(",");
  return `CO_NO=${coNo} AND DOR_UC IN (${codes})`;
}

async function fetchBatch(coNo, offset, count) {
  const params = new URLSearchParams({
    where: residentialWhere(coNo),
    outFields: FIELDS,
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    orderByFields: "PARCEL_ID ASC",
    f: "json",
  });
  const res = await fetchJSON(`${FL_BASE}/query?${params}`);
  if (res.statusCode !== 200 || !res.data?.features) return [];
  return res.data.features.map(f => f.attributes);
}

async function fetchCount(coNo) {
  // returnCountOnly is not supported by this service; use outStatistics instead.
  const params = new URLSearchParams({
    where: residentialWhere(coNo),
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "PARCEL_ID", outStatisticFieldName: "cnt" }]),
    f: "json",
  });
  const res = await fetchJSON(`${FL_BASE}/query?${params}`);
  const val = res.data?.features?.[0]?.attributes?.cnt;
  return Number(val) || 0;
}

// ── Florida DNA formula ───────────────────────────────────────────────────────
// EFF_YR_BLT = effective year built — FL appraisers update this when renovations are permitted.
// If EFF_YR_BLT > ACT_YR_BLT + 10, a significant renovation was officially recognized.
// Renovation ratio = actual improvement value / expected age-depreciated replacement cost.

function computeFloridaDNA(row) {
  const actYr   = Number(row.ACT_YR_BLT) || 0;
  const effYr   = Number(row.EFF_YR_BLT) || actYr;
  const sqft    = Number(row.TOT_LVG_AR) || 0;
  const jv      = Number(row.JV) || 0;
  const lndVal  = Number(row.LND_VAL) || 0;
  const ncVal   = Number(row.NCONST_VAL) || 0;
  const qual    = String(row.IMP_QUAL || "").trim() || "default";

  const improvVal = Math.max(0, jv - lndVal);
  const costSqft  = QUAL_COST[qual] || QUAL_COST.default;
  const now       = new Date().getFullYear();
  const effAge    = effYr > 1800 ? now - effYr : 30;
  const actAge    = actYr > 1800 ? now - actYr : 30;
  const depr      = Math.max(0.20, 1 - effAge * 0.009);
  const expected  = sqft > 0 ? sqft * costSqft * depr : 0;
  const renovRatio = expected > 0 ? Math.round((improvVal / expected) * 100) / 100 : 1.0;

  // Renovation flags
  const renovRecognized = effYr > 1800 && actYr > 1800 && effYr > actYr + 10;
  const newConstruction = ncVal > 5000;
  const fullyRemod      = renovRatio > 1.35 && renovRecognized;
  const updated         = renovRatio >= 1.15 && !fullyRemod;
  const originalCond    = renovRatio < 0.75 && actAge > 20;

  const condScore =
    renovRatio > 1.5 ? 93 :
    renovRatio > 1.3 ? 82 :
    renovRatio > 1.1 ? 72 :
    renovRatio > 0.9 ? 63 :
    renovRatio > 0.7 ? 50 : 38;

  return {
    renovationRatio:     renovRatio,
    conditionScore:      condScore,
    effectiveYearBuilt:  effYr || null,
    assessorLandValue:   lndVal || null,
    assessorImprovValue: improvVal || null,
    assessorTotalValue:  jv || null,
    detectedFeatures: {
      renovation_recognized: renovRecognized,
      new_construction:      newConstruction,
      fully_remodeled:       fullyRemod,
      updated,
      original_condition:    originalCond,
    },
    dataQuality: sqft > 0 && actYr > 0 && jv > 0 ? "complete" : "partial",
    scoredAt: new Date().toISOString(),
  };
}

function buildMasterRow(row, dna, countyFips) {
  const addr = String(row.PHY_ADDR1 || "").trim();
  return {
    apn:                String(row.PARCEL_ID || "").trim(),
    county_fips:        countyFips,
    address:            addr,
    city:               String(row.PHY_CITY || "").trim() || null,
    state:              "FL",
    zip:                row.PHY_ZIPCD ? String(Math.round(row.PHY_ZIPCD)).padStart(5, "0") : null,
    property_type:      row.DOR_UC || null,
    sqft:               Number(row.TOT_LVG_AR) || null,
    year_built:         Number(row.ACT_YR_BLT) > 1800 ? Number(row.ACT_YR_BLT) : null,
    tax_assessed_value: Number(row.JV) || null,
    last_updated:       new Date().toISOString(),
  };
}

function buildHistoryRow(row, dna, today) {
  return {
    apn:        String(row.PARCEL_ID || "").trim(),
    event_type: "assessment",
    event_date: today,
    source:     "fl_fdor_cadastral",
    data: {
      address:          String(row.PHY_ADDR1 || "").trim(),
      city:             row.PHY_CITY || null,
      zip:              row.PHY_ZIPCD || null,
      ownerName:        row.OWN_NAME || null,
      ownerAddr:        row.OWN_ADDR1 || null,
      ownerCity:        row.OWN_CITY || null,
      ownerState:       row.OWN_STATE || null,
      ownerZip:         row.OWN_ZIPCD || null,
      actYearBuilt:     Number(row.ACT_YR_BLT) || null,
      effYearBuilt:     Number(row.EFF_YR_BLT) || null,
      sqft:             Number(row.TOT_LVG_AR) || null,
      lotSqft:          Number(row.LND_SQFOOT) || null,
      numBuildings:     Number(row.NO_BULDNG) || null,
      numResUnits:      Number(row.NO_RES_UNT) || null,
      justValue:        Number(row.JV) || null,
      landValue:        Number(row.LND_VAL) || null,
      newConstVal:      Number(row.NCONST_VAL) || null,
      dorUseCode:       row.DOR_UC || null,
      impQuality:       row.IMP_QUAL || null,
      constClass:       row.CONST_CLAS || null,
      assessmentYear:   Number(row.ASMNT_YR) || null,
      sale1Price:       Number(row.SALE_PRC1) || null,
      sale1Year:        Number(row.SALE_YR1) || null,
      sale1Month:       row.SALE_MO1 || null,
      sale2Price:       Number(row.SALE_PRC2) || null,
      sale2Year:        Number(row.SALE_YR2) || null,
      sale2Month:       row.SALE_MO2 || null,
      renovationRatio:  dna.renovationRatio,
      conditionScore:   dna.conditionScore,
      effectiveYrBuilt: dna.effectiveYearBuilt,
      landValue2:       dna.assessorLandValue,
      improvValue:      dna.assessorImprovValue,
      totalValue:       dna.assessorTotalValue,
      detectedFeatures: dna.detectedFeatures,
      dataQuality:      dna.dataQuality,
    },
  };
}

async function bulkWrite(masterRows, historyRows) {
  const errors = [];
  await Promise.all([
    db.upsert("property_master", masterRows, "apn")
      .catch(e => errors.push(`master: ${e.message.slice(0, 80)}`)),
    db.insert("property_history", historyRows)
      .catch(() => {}),
  ]);
  return errors;
}

// ── Progress tracking ─────────────────────────────────────────────────────────

async function getProgress(coNo) {
  const rows = await db.from("kpi_events")
    .select("metadata,created_at")
    .eq("event_type", "fl_index_progress")
    .eq("email", `fl_county:${coNo}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .get()
    .catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return { offset: 0, total: null, done: false };
  const meta = rows[0].metadata || {};
  return { offset: meta.nextOffset || 0, total: meta.total || null, done: meta.done || false };
}

async function saveProgress(coNo, nextOffset, total, done) {
  db.kpi("fl_index_progress", `fl_county:${coNo}`, {
    coNo, county: CO_NO_TO_NAME[coNo], nextOffset, total, done, ts: new Date().toISOString(),
  });
}

async function getNextCounty() {
  for (let co = 1; co <= 67; co++) {
    const prog = await getProgress(co);
    if (!prog.done) return { coNo: co, offset: prog.offset, total: prog.total };
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const dryRun  = body.dryRun === true;
  const runSize = Math.min(body.batchSize || DEFAULT_BATCH, 5000);

  let coNo   = body.county ? Number(body.county) : null;
  let offset = body.offset != null ? Number(body.offset) : null;
  let total  = null;

  if (!coNo) {
    const next = await getNextCounty();
    if (!next) {
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ message: "All 67 Florida counties fully indexed.", allDone: true }) };
    }
    coNo   = next.coNo;
    offset = next.offset;
    total  = next.total;
  } else {
    if (coNo < 1 || coNo > 67) {
      return { statusCode: 400, headers: CORS,
        body: JSON.stringify({ error: "county must be 1-67 (Florida DOR county number)" }) };
    }
    const prog = await getProgress(coNo);
    if (offset == null) offset = body.resetCounty ? 0 : prog.offset;
    total = prog.total;
  }

  const countyName = `FL County ${coNo}`;
  const countyFips = `12_${coNo}`; // placeholder until verified FDOR→FIPS map is built

  try {
    if (!total) {
      total = await fetchCount(coNo);
    }

    console.log(`[index-florida] ${countyName} (${coNo}) | offset=${offset} | run=${runSize} | total=${total}`);

    const rows = await fetchBatch(coNo, offset, runSize);

    if (!rows.length) {
      const trulyDone = total > 0 && offset >= total;
      if (trulyDone) {
        await saveProgress(coNo, 0, total, true);
        const nextCoNo = coNo < 67 ? coNo + 1 : null;
        return { statusCode: 200, headers: CORS,
          body: JSON.stringify({ county: countyName, coNo, done: true, nextCounty: nextCoNo ? `FL County ${nextCoNo}` : null, total, dryRun }) };
      }
      return { statusCode: 200, headers: CORS,
        body: JSON.stringify({ county: countyName, coNo, offset, newOffset: offset, total,
          processed: 0, retryable: true, message: "Empty batch — ArcGIS may be slow, retry" }) };
    }

    const masterRows  = [];
    const historyRows = [];
    const sample      = [];
    const today       = new Date().toISOString().slice(0, 10);

    for (const row of rows) {
      if (!row.PARCEL_ID) continue;
      const dna = computeFloridaDNA(row);
      const master = buildMasterRow(row, dna, countyFips);
      if (!master.address && !master.apn) continue;
      masterRows.push(master);
      historyRows.push(buildHistoryRow(row, dna, today));
      if (sample.length < 3) {
        sample.push({
          parcelId: master.apn, address: master.address, city: master.city,
          yearBuilt: master.year_built, sqft: master.sqft, justValue: master.tax_assessed_value,
          renovRatio: dna.renovationRatio, condScore: dna.conditionScore,
          features: dna.detectedFeatures,
        });
      }
    }

    let writeErrors = [];
    if (!dryRun && masterRows.length > 0) {
      writeErrors = await bulkWrite(masterRows, historyRows);
    }

    const processed = masterRows.length;
    const newOffset = offset + rows.length;
    const countyDone = rows.length < runSize || newOffset >= total;
    const pct = total > 0 ? Math.round((newOffset / total) * 100) : null;
    const nextCoNo = countyDone && coNo < 67 ? coNo + 1 : null;

    if (!dryRun) {
      await saveProgress(coNo, countyDone ? 0 : newOffset, total, countyDone);
    }

    db.kpi("fl_property_indexed", null, {
      county: countyName, coNo, processed, errors: writeErrors.length,
      offset: newOffset, total, countyDone, dryRun,
    });

    const nextCounty = nextCoNo ? `FL County ${nextCoNo}` : null;
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        county: countyName, coNo, countyFips,
        offset, newOffset, total, pctComplete: pct,
        processed, errors: writeErrors.length,
        countyDone, nextCounty,
        dryRun, sample,
        message: countyDone
          ? `${countyName} complete (${total} properties). Next: ${nextCounty || "ALL DONE"}`
          : `${countyName}: ${newOffset}/${total} (${pct || "?"})`,
      }),
    };
  } catch (err) {
    console.error("[index-florida]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

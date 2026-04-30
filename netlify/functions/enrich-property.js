/**
 * PropertyDNA v3 — Property Enrichment Engine
 *
 * Fetches 11+ free/open data sources in parallel using Promise.allSettled.
 * No single failure crashes the report — each unavailable source is marked
 * "Data Unavailable" instead of throwing. Every raw API response is stored
 * in Supabase report_data_sources for our own database-building.
 *
 * Called by save-report.js (fire-and-forget) after a report is saved.
 * Also callable by n8n as an HTTP node before save-report for real-time enrichment.
 *
 * POST /.netlify/functions/enrich-property
 * Headers: x-internal-key: $INTERNAL_API_KEY
 * Body: { lat, lon, zip, address, city, state, reportId, propertyId, existingValue, existingRent }
 */

const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function fetchJSON(url, headers = {}, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)", ...headers },
    };
    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(raw), raw });
        } catch {
          resolve({ statusCode: res.statusCode, data: null, raw });
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${url.slice(0, 80)}`)); });
    req.on("error", reject);
    req.end();
  });
}

function postJSON(hostname, path, bodyStr, headers = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(bodyStr),
        "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)",
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw), raw }); }
        catch { resolve({ statusCode: res.statusCode, data: null, raw }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("OSM timeout")); });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Individual API fetchers ───────────────────────────────────────────────────

async function fetchCensusACS(zip) {
  const key = process.env.CENSUS_API_KEY;
  if (!key) return { status: "unavailable", reason: "CENSUS_API_KEY not set" };
  try {
    // B19013_001E=median household income, B25077_001E=median home value,
    // B01003_001E=total population, B25003_002E=owner occupied, B25003_003E=renter,
    // B25064_001E=median gross rent, B15003_022E=bachelor's degree holders
    const url = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25077_001E,B01003_001E,B25003_002E,B25003_003E,B25064_001E,B15003_022E&for=zip+code+tabulation+area:${zip}&key=${key}`;
    const res = await fetchJSON(url);
    if (res.statusCode !== 200 || !Array.isArray(res.data) || res.data.length < 2) {
      return { status: "failed", statusCode: res.statusCode };
    }
    const [hdrs, vals] = res.data;
    const get = (name) => { const i = hdrs.indexOf(name); return i >= 0 ? Number(vals[i]) || null : null; };
    return {
      status: "success",
      data: {
        medianHouseholdIncome: get("B19013_001E"),
        medianHomeValue: get("B25077_001E"),
        totalPopulation: get("B01003_001E"),
        ownerOccupiedUnits: get("B25003_002E"),
        renterOccupiedUnits: get("B25003_003E"),
        medianGrossRent: get("B25064_001E"),
        bachelorsOrHigherCount: get("B15003_022E"),
      },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchFRED() {
  const key = process.env.FRED_API_KEY;
  if (!key) return { status: "unavailable", reason: "FRED_API_KEY not set" };
  try {
    const [mortRes, hpiRes] = await Promise.allSettled([
      fetchJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${key}&limit=1&sort_order=desc&file_type=json`),
      fetchJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=CSUSHPISA&api_key=${key}&limit=13&sort_order=desc&file_type=json`),
    ]);
    const mortRate = mortRes.status === "fulfilled" ? mortRes.value.data?.observations?.[0]?.value : null;
    const hpiObs   = hpiRes.status  === "fulfilled" ? hpiRes.value.data?.observations : [];
    const hpiNow   = hpiObs?.[0]?.value;
    const hpiYrAgo = hpiObs?.[12]?.value;
    const hpiYoy   = hpiNow && hpiYrAgo ? parseFloat(((hpiNow - hpiYrAgo) / hpiYrAgo * 100).toFixed(1)) : null;
    return {
      status: "success",
      data: {
        mortgage30YrRate: mortRate ? parseFloat(mortRate) : null,
        nationalHPIYoyPct: hpiYoy,
        nationalHPICurrent: hpiNow ? parseFloat(hpiNow) : null,
      },
      raw: { mortgage: mortRes.value?.data ?? null, hpi: hpiRes.value?.data ?? null },
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchHUDFMR(zip) {
  const key = process.env.HUD_API_KEY;
  if (!key) return { status: "unavailable", reason: "HUD_API_KEY not set" };
  try {
    const res = await fetchJSON(`https://www.huduser.gov/hudapi/public/fmr/data/${zip}`, { Authorization: `Bearer ${key}` });
    if (res.statusCode !== 200) return { status: "failed", statusCode: res.statusCode };
    const d = res.data?.data;
    if (!d) return { status: "failed", reason: "empty HUD response" };
    return {
      status: "success",
      data: {
        fmrEfficiency:  d.Efficiency    || null,
        fmrOneBed:      d.One_Bedroom   || null,
        fmrTwoBed:      d.Two_Bedroom   || null,
        fmrThreeBed:    d.Three_Bedroom || null,
        fmrFourBed:     d.Four_Bedroom  || null,
        metro:          d.metroarea_name || null,
        year:           d.year || null,
      },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchFEMAFloodZoneV3(lat, lon) {
  try {
    // FEMA NFHL MapServer — free, no key
    const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${encodeURIComponent(lon + "," + lat)}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE%2CZONE_SUBTY%2CSFHA_TF%2CSTATIC_BFE%2CDEPTH&returnGeometry=false&f=json`;
    const res = await fetchJSON(url, {}, 10000);
    if (res.statusCode !== 200 || !res.data?.features) return { status: "failed", statusCode: res.statusCode };
    const features = res.data.features;
    if (!features.length) return { status: "success", data: { zone: "X", sfha: false, label: "Minimal flood risk" }, raw: res.data };
    const a = features[0].attributes;
    const zone = a.FLD_ZONE || "X";
    const sfha = a.SFHA_TF === "T";
    let label = "Minimal flood risk";
    if (zone.startsWith("V")) label = "Coastal high-hazard area";
    else if (["A","AE","AH","AO","AO"].some(z => zone.startsWith(z) || zone === z)) label = "High-risk flood zone (SFHA)";
    else if (zone === "B" || zone === "C") label = "Moderate to low risk";
    return {
      status: "success",
      data: { zone, sfha, subtype: a.ZONE_SUBTY || null, depth: a.DEPTH || null, label, highRisk: sfha },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchEPAEJScreen(lat, lon) {
  try {
    const geo = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
    const url = `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx?namestr=&geometry=${geo}&distance=1&unit=9035&areatype=&areaid=&f=json`;
    const res = await fetchJSON(url, {}, 12000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data?.results?.rows?.[0] || res.data;
    return {
      status: "success",
      data: {
        ejIndexPctile:     d.P_EJI    != null ? parseFloat(d.P_EJI)    : null,
        airToxicsCancer:   d.P_CANCER != null ? parseFloat(d.P_CANCER) : null,
        pm25Pctile:        d.P_PM25   != null ? parseFloat(d.P_PM25)   : null,
        dieselPmPctile:    d.P_DSLPM  != null ? parseFloat(d.P_DSLPM)  : null,
        wastewaterPctile:  d.P_PWDIS  != null ? parseFloat(d.P_PWDIS)  : null,
        superfundPctile:   d.P_PNPL   != null ? parseFloat(d.P_PNPL)   : null,
      },
      raw: d,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchUSGSSeismic(lat, lon) {
  try {
    const url = `https://earthquake.usgs.gov/ws/designmaps/nehrp-2020.json?latitude=${lat}&longitude=${lon}&riskCategory=III&siteClass=D&title=PropertyDNA`;
    const res = await fetchJSON(url, {}, 10000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data?.response?.data;
    const pga = d?.pga != null ? parseFloat(Number(d.pga).toFixed(3)) : null;
    const ss  = d?.ss  != null ? parseFloat(Number(d.ss).toFixed(3))  : null;
    let riskLevel = "Minimal";
    if (pga >= 0.5) riskLevel = "High";
    else if (pga >= 0.2) riskLevel = "Moderate";
    else if (pga >= 0.05) riskLevel = "Low-Moderate";
    return {
      status: "success",
      data: {
        peakGroundAcceleration: pga,
        shortPeriodSpectral: ss,
        seismicRiskLevel: riskLevel,
        seismicScore: pga ? Math.min(100, Math.round(pga * 150)) : 0,
      },
      raw: res.data?.response,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchAirNow(zip) {
  const key = process.env.AIRNOW_API_KEY;
  if (!key) return { status: "unavailable", reason: "AIRNOW_API_KEY not set" };
  try {
    const url = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${key}`;
    const res = await fetchJSON(url, {}, 8000);
    if (res.statusCode !== 200 || !Array.isArray(res.data)) return { status: "failed", statusCode: res.statusCode };
    if (!res.data.length) return { status: "success", data: { aqi: null, aqiCategory: "No data", mainPollutant: null }, raw: [] };
    const worst = res.data.reduce((a, b) => (b.AQI > a.AQI ? b : a), res.data[0]);
    const catNum = worst.Category?.Number || 1;
    return {
      status: "success",
      data: {
        aqi: worst.AQI,
        aqiCategory: worst.Category?.Name || null,
        aqiColor: catNum <= 2 ? "green" : catNum <= 3 ? "yellow" : "red",
        mainPollutant: worst.ParameterName,
        pollutants: res.data.map(o => ({ name: o.ParameterName, aqi: o.AQI, category: o.Category?.Name })),
      },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchWalkScore(address, lat, lon) {
  const key = process.env.WALK_SCORE_API_KEY;
  if (!key) return { status: "unavailable", reason: "WALK_SCORE_API_KEY not set" };
  try {
    const url = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lon}&bike=1&transit=1&wsapikey=${key}`;
    const res = await fetchJSON(url, {}, 8000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const d = res.data;
    if (d.status !== 1) return { status: "failed", reason: `Walk Score status ${d.status}` };
    return {
      status: "success",
      data: {
        walkScore:           d.walkscore || null,
        walkDescription:     d.description || null,
        transitScore:        d.transit?.score || null,
        transitDescription:  d.transit?.description || null,
        bikeScore:           d.bike?.score || null,
        bikeDescription:     d.bike?.description || null,
      },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchOSMAmenities(lat, lon) {
  try {
    const radius = 2400;
    const query = `[out:json][timeout:25];
(
  node["amenity"~"school|university|college"](around:1600,${lat},${lon});
  way["amenity"~"school|university|college"](around:1600,${lat},${lon});
  node["leisure"="park"](around:${radius},${lat},${lon});
  node["public_transport"="stop_position"](around:${radius},${lat},${lon});
  node["highway"="bus_stop"](around:${radius},${lat},${lon});
  node["railway"~"station|subway_entrance|tram_stop"](around:${radius},${lat},${lon});
  node["amenity"~"supermarket|grocery"](around:${radius},${lat},${lon});
  node["amenity"="hospital"](around:3200,${lat},${lon});
);
out tags qt;`;
    const bodyStr = `data=${encodeURIComponent(query)}`;
    const res = await postJSON("overpass-api.de", "/api/interpreter", bodyStr, {}, 25000);
    if (res.statusCode !== 200 || !res.data?.elements) return { status: "failed", statusCode: res.statusCode };
    let schools = 0, parks = 0, transit = 0, grocery = 0, hospitals = 0;
    for (const el of res.data.elements) {
      const am = el.tags?.amenity || "";
      const le = el.tags?.leisure || "";
      const hw = el.tags?.highway || "";
      const rw = el.tags?.railway || "";
      if (["school","university","college"].includes(am)) schools++;
      else if (le === "park") parks++;
      else if (hw === "bus_stop" || ["station","subway_entrance","tram_stop"].includes(rw)) transit++;
      else if (["supermarket","grocery"].includes(am)) grocery++;
      else if (am === "hospital") hospitals++;
    }
    const proximityScore = Math.min(100,
      Math.min(schools * 8, 25) +
      Math.min(parks * 5, 20) +
      Math.min(transit * 4, 20) +
      Math.min(grocery * 8, 20) +
      Math.min(hospitals * 5, 15)
    );
    return {
      status: "success",
      data: { schoolsNearby: schools, parksNearby: parks, transitStopsNearby: transit, groceryStoresNearby: grocery, hospitalsNearby: hospitals, amenityProximityScore: proximityScore, searchRadiusM: radius },
      raw: { elementCount: res.data.elements.length },
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchFCCBlock(lat, lon) {
  try {
    const res = await fetchJSON(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`, {}, 6000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    return {
      status: "success",
      data: {
        censusFIPS:  res.data?.Block?.FIPS || null,
        countyName:  res.data?.County?.name || null,
        stateCode:   res.data?.State?.code || null,
      },
      raw: res.data,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

// ── Riverside County & Palm Springs permit data ───────────────────────────────
// Uses Riverside County ArcGIS open data (no key, public).
// Covers unincorporated Riverside County. Incorporated cities (Palm Springs,
// Palm Desert, Indian Wells, La Quinta, etc.) use their own city permit systems
// and require BuildZoom or Shovels.ai integration for automated access.

function classifyPermit(caseType, caseWorkClass, description) {
  const t = (caseType || "").toLowerCase();
  const w = (caseWorkClass || "").toLowerCase();
  const d = (description || "").toLowerCase();
  if (d.includes("kitchen") || d.includes("bath") || d.includes("remodel") || w.includes("remodel") || w.includes("alteration")) return "remodel";
  if (d.includes("addition") || d.includes("adu") || d.includes("accessory") || w.includes("addition")) return "addition";
  if (d.includes("pool") || d.includes("spa")) return "pool";
  if (d.includes("roof") || d.includes("hvac") || d.includes("mechanical") || d.includes("plumb") || d.includes("electric") || d.includes("solar")) return "mechanical";
  if (d.includes("new construction") || d.includes("new build") || w.includes("new")) return "new_construction";
  if (t.includes("demolition") || d.includes("demol")) return "demolition";
  return "general";
}

function permitValueAdjustment(permits) {
  // Returns { fullyRemodeled, recentPool, recentAddition, estimatedValuePct }
  const now = Date.now();
  const fiveYears = 5 * 365.25 * 24 * 3600 * 1000;
  const tenYears  = 10 * 365.25 * 24 * 3600 * 1000;
  let remodels = 0, pools = 0, additions = 0, recentAny = 0;
  for (const p of permits) {
    const age = now - (p.appliedMs || 0);
    if (p.category === "remodel"  && age < fiveYears) remodels++;
    if (p.category === "pool"     && age < tenYears)  pools++;
    if (p.category === "addition" && age < fiveYears) additions++;
    if (age < fiveYears) recentAny++;
  }
  return {
    fullyRemodeled:  remodels >= 2,
    recentPool:      pools > 0,
    recentAddition:  additions > 0,
    recentPermits:   recentAny,
    totalPermits:    permits.length,
    estimatedValuePct: Math.min(15, remodels * 4 + pools * 4 + additions * 5),
  };
}

async function fetchRivcoPermits(lat, lon) {
  try {
    const baseUrl = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/General/MapServer/280/query";
    const params = new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "APN,CASE_ID,CASE_DESCR,CASE_TYPE,CASE_WORK_CLASS,CASE_STATUS,APPLIED_DATE,APPROVED_DATE,COMPLETED_DATE",
      returnGeometry: "false",
      resultRecordCount: "20",
      f: "json",
    });
    const res = await fetchJSON(`${baseUrl}?${params}`, {}, 12000);
    if (res.statusCode !== 200 || !res.data?.features) return { status: "failed", statusCode: res.statusCode };
    const features = res.data.features;
    if (!features.length) {
      // Unincorporated Riverside County parcel with no permits, or incorporated city (no data in this layer)
      return { status: "success", data: { source: "rivco_arcgis", jurisdiction: "unincorporated", permits: [], note: "No permits on file in Riverside County public layer. Incorporated cities require city-level lookup." } };
    }
    const apn = features[0]?.attributes?.APN || null;
    const permits = features.map(f => {
      const a = f.attributes;
      const appliedMs = a.APPLIED_DATE ? Number(a.APPLIED_DATE) : null;
      const category = classifyPermit(a.CASE_TYPE, a.CASE_WORK_CLASS, a.CASE_DESCR);
      return {
        caseId:    a.CASE_ID     || null,
        type:      a.CASE_TYPE   || null,
        workClass: a.CASE_WORK_CLASS || null,
        description: a.CASE_DESCR || null,
        status:    a.CASE_STATUS || null,
        appliedMs,
        appliedDate: appliedMs ? new Date(appliedMs).toISOString().slice(0, 10) : null,
        approvedDate: a.APPROVED_DATE ? new Date(Number(a.APPROVED_DATE)).toISOString().slice(0, 10) : null,
        completedDate: a.COMPLETED_DATE ? new Date(Number(a.COMPLETED_DATE)).toISOString().slice(0, 10) : null,
        category,
      };
    });
    const valAdj = permitValueAdjustment(permits);
    return {
      status: "success",
      data: {
        source:        "rivco_arcgis",
        jurisdiction:  "riverside_county",
        apn,
        permits,
        ...valAdj,
      },
      raw: { featureCount: features.length },
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchFBICrime(stateAbbr) {
  const key = process.env.FBI_CRIME_API_KEY;
  if (!key) return { status: "unavailable", reason: "FBI_CRIME_API_KEY not set" };
  if (!stateAbbr) return { status: "unavailable", reason: "no state provided" };
  try {
    const yr = new Date().getFullYear() - 1; // FBI data lags 1 year
    const url = `https://api.usa.gov/crime/fbi/cde/summarized/state/${stateAbbr.toUpperCase()}/violent-crime?from=${yr - 2}&to=${yr}&API_KEY=${key}`;
    const res = await fetchJSON(url, {}, 10000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const results = res.data?.data || res.data?.results || [];
    if (!results.length) return { status: "failed", reason: "no FBI data" };
    const latest = results[results.length - 1];
    const population = latest.population || 1;
    const violentTotal = (latest.violent_crime || 0) + (latest.homicide || 0) + (latest.rape || 0) + (latest.robbery || 0) + (latest.aggravated_assault || 0);
    const violentPer100k = population > 0 ? Math.round((violentTotal / population) * 100000) : null;
    // National average violent crime rate ~380/100k; score inversely
    let crimeScore = 60;
    if (violentPer100k !== null) {
      if (violentPer100k < 150)      crimeScore = 90;
      else if (violentPer100k < 280) crimeScore = 75;
      else if (violentPer100k < 400) crimeScore = 60;
      else if (violentPer100k < 600) crimeScore = 42;
      else                           crimeScore = 25;
    }
    return {
      status: "success",
      data: {
        stateAbbr:        stateAbbr.toUpperCase(),
        year:             latest.year || yr,
        violentCrimePer100k: violentPer100k,
        homicideCount:    latest.homicide || null,
        rapeCount:        latest.rape || null,
        robberyCount:     latest.robbery || null,
        assaultCount:     latest.aggravated_assault || null,
        crimeScore,
        crimeRating:      crimeScore >= 75 ? "Low" : crimeScore >= 50 ? "Moderate" : "High",
      },
      raw: results,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

async function fetchBLSUnemployment(stateAbbr) {
  if (!stateAbbr) return { status: "unavailable", reason: "no state provided" };
  const STATE_CODES = {
    AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",FL:"12",GA:"13",
    HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",LA:"22",ME:"23",MD:"24",
    MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",
    NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
    SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",DC:"11",
  };
  const code = STATE_CODES[stateAbbr.toUpperCase()];
  if (!code) return { status: "unavailable", reason: "unknown state code" };
  try {
    const key = process.env.BLS_API_KEY;
    const seriesId = `LASST${code}0000000000003`;
    const yr = new Date().getFullYear();
    const path = key
      ? `/publicAPI/v2/timeseries/data/${seriesId}?startyear=${yr - 1}&endyear=${yr}&registrationkey=${key}`
      : `/publicAPI/v1/timeseries/data/${seriesId}`;
    const res = await fetchJSON(`https://api.bls.gov${path}`, {}, 8000);
    if (res.statusCode !== 200 || !res.data) return { status: "failed", statusCode: res.statusCode };
    const latest = res.data?.Results?.series?.[0]?.data?.[0];
    if (!latest) return { status: "failed", reason: "no BLS series data" };
    return {
      status: "success",
      data: {
        stateUnemploymentRate: latest.value ? parseFloat(latest.value) : null,
        period: latest.period || null,
        year: latest.year || null,
        stateAbbr: stateAbbr.toUpperCase(),
      },
      raw: res.data?.Results,
    };
  } catch (e) {
    return { status: "failed", error: e.message };
  }
}

// ── Sub-score calculators ────────────────────────────────────────────────────

function scoreLocation(osm, walkScore) {
  let score = 50;
  if (osm?.status === "success") {
    score = 30 + Math.round((osm.data.amenityProximityScore || 0) * 0.7);
  }
  if (walkScore?.status === "success") {
    const ws = walkScore.data.walkScore || 0;
    const ts = walkScore.data.transitScore || 0;
    score = Math.round((score * 0.4) + (ws * 0.4) + (ts * 0.2));
  }
  return Math.min(100, Math.max(0, score));
}

function scoreMarket(census, fred, hud, existingVal) {
  let score = 45;
  if (census?.status === "success") score += 12;
  if (fred?.status === "success" && fred.data.mortgage30YrRate) score += 8;
  if (hud?.status === "success" && hud.data.fmrTwoBed) score += 10;
  if (existingVal) score += 15;
  return Math.min(100, Math.max(0, score));
}

function scoreRisk(fema, usgs, epa, airNow, crime) {
  let score = 65;
  if (fema?.status === "success") {
    const z = (fema.data.zone || "X").toUpperCase();
    if (z.startsWith("X")) score = Math.max(score, 82);
    else if (z === "B" || z === "C") score = Math.max(score, 70);
    else if (z === "A" || z.startsWith("AE")) score = Math.min(score, 38);
    else if (z.startsWith("V")) score = Math.min(score, 22);
  }
  if (usgs?.status === "success") {
    const pga = usgs.data.peakGroundAcceleration || 0;
    const seismicRisk = Math.min(100, Math.round(pga * 150));
    score = Math.round((score + (100 - seismicRisk)) / 2);
  }
  if (epa?.status === "success" && epa.data.ejIndexPctile != null) {
    score = Math.round((score + (100 - epa.data.ejIndexPctile)) / 2);
  }
  if (airNow?.status === "success" && airNow.data.aqi != null) {
    const aqiScore = airNow.data.aqi <= 50 ? 90 : airNow.data.aqi <= 100 ? 72 : airNow.data.aqi <= 150 ? 45 : 20;
    score = Math.round((score + aqiScore) / 2);
  }
  if (crime?.status === "success" && crime.data.crimeScore != null) {
    score = Math.round((score + crime.data.crimeScore) / 2);
  }
  return Math.min(100, Math.max(0, score));
}

function scoreRentalYield(census, hud, existingRent, existingValue) {
  let score = 55;
  const rent  = hud?.data?.fmrTwoBed || existingRent;
  const value = existingValue || census?.data?.medianHomeValue;
  if (rent && value && value > 0) {
    const grossYield = ((rent * 12) / value) * 100;
    if (grossYield >= 8)       score = 92;
    else if (grossYield >= 6)  score = 79;
    else if (grossYield >= 4.5)score = 66;
    else if (grossYield >= 3)  score = 52;
    else if (grossYield >= 1.5)score = 40;
    else                       score = 28;
  }
  return Math.min(100, Math.max(0, score));
}

function scoreTrajectory(census, bls, fred) {
  let score = 55;
  if (bls?.status === "success" && bls.data.stateUnemploymentRate != null) {
    const ur = bls.data.stateUnemploymentRate;
    if (ur < 3)       score += 22;
    else if (ur < 4)  score += 15;
    else if (ur < 5)  score += 6;
    else if (ur > 7)  score -= 18;
    else if (ur > 6)  score -= 10;
  }
  if (fred?.status === "success" && fred.data.nationalHPIYoyPct != null) {
    const h = fred.data.nationalHPIYoyPct;
    if (h > 5)       score += 12;
    else if (h > 0)  score += 5;
    else if (h < -5) score -= 18;
    else if (h < 0)  score -= 8;
  }
  return Math.min(100, Math.max(0, score));
}

function confidencePct(results) {
  const ok = results.filter(r => r?.status === "success").length;
  return Math.round((ok / results.length) * 100);
}

// ── Store raw API responses ───────────────────────────────────────────────────

async function storeDataSources(reportId, sources) {
  if (!reportId) return;
  for (const [sourceName, result] of Object.entries(sources)) {
    db.insert("report_data_sources", {
      report_id:    reportId,
      source_name:  sourceName,
      status:       result?.status || "failed",
      raw_response: result?.raw ? JSON.stringify(result.raw).slice(0, 50000) : null,
      fetched_at:   new Date().toISOString(),
    }).catch(() => {});
  }
}

// ── Main enrichment function ──────────────────────────────────────────────────

async function enrichProperty({ lat, lon, zip, address, city, state, reportId, propertyId, existingValue, existingRent }) {
  if (!lat || !lon) return { error: "lat and lon required" };

  const latN = Number(lat);
  const lonN = Number(lon);

  // Fire all API calls in parallel — Promise.allSettled never rejects
  const [
    censusR, fredR, hudR, femaR, epaR, usgsR, airNowR, walkR, osmR, fccR, blsR, crimeR, permitsR,
  ] = await Promise.allSettled([
    fetchCensusACS(zip),
    fetchFRED(),
    fetchHUDFMR(zip),
    fetchFEMAFloodZoneV3(latN, lonN),
    fetchEPAEJScreen(latN, lonN),
    fetchUSGSSeismic(latN, lonN),
    fetchAirNow(zip),
    fetchWalkScore(address || "", latN, lonN),
    fetchOSMAmenities(latN, lonN),
    fetchFCCBlock(latN, lonN),
    fetchBLSUnemployment(state),
    fetchFBICrime(state),
    fetchRivcoPermits(latN, lonN),
  ]);

  // Unwrap — if the promise itself rejected, treat as failed
  const unwrap = (r) => r.status === "fulfilled" ? r.value : { status: "failed", error: r.reason?.message };
  const census  = unwrap(censusR);
  const fred    = unwrap(fredR);
  const hud     = unwrap(hudR);
  const fema    = unwrap(femaR);
  const epa     = unwrap(epaR);
  const usgs    = unwrap(usgsR);
  const airNow  = unwrap(airNowR);
  const walk    = unwrap(walkR);
  const osm     = unwrap(osmR);
  const fcc     = unwrap(fccR);
  const bls     = unwrap(blsR);
  const crime   = unwrap(crimeR);
  const permits = unwrap(permitsR);

  const allSources = { census, fred, hud, fema_flood_v3: fema, epa_ejscreen: epa, usgs_seismic: usgs, airnow: airNow, walk_score: walk, osm_amenities: osm, fcc_broadband: fcc, bls_unemployment: bls, fbi_crime: crime, rivco_permits: permits };

  // Persist all raw responses for our database-building
  await storeDataSources(reportId, allSources);

  // Write Riverside County permits to permit_registry (fire-and-forget)
  if (reportId && permits?.status === "success" && Array.isArray(permits.data?.permits) && permits.data.permits.length > 0) {
    const permitInserts = permits.data.permits.map(p => db.insert("permit_registry", {
      report_id:       reportId,
      address:         address || null,
      city:            city || null,
      state:           state || null,
      zip:             zip || null,
      permit_number:   p.caseId || null,
      permit_type:     p.type || p.category || null,
      permit_category: p.category || "general",
      description:     p.description || null,
      issued_date:     p.appliedDate || null,
      status:          p.status || "unknown",
      estimated_value: null,
      jurisdiction:    "riverside_county",
      source:          "rivco_arcgis",
      raw_data:        p,
    }).catch(() => {}));
    Promise.all(permitInserts).catch(() => {});
  }

  // Compute weighted category scores
  const locScore     = scoreLocation(osm, walk);
  const mktScore     = scoreMarket(census, fred, hud, existingValue);
  const riskScore    = scoreRisk(fema, usgs, epa, airNow, crime);
  const rentalScore  = scoreRentalYield(census, hud, existingRent, existingValue);
  const trajScore    = scoreTrajectory(census, bls, fred);

  // Per-section confidence (% sources that returned data)
  const locConf    = confidencePct([osm, walk, fcc]);
  const mktConf    = confidencePct([census, fred, hud]);
  const riskConf   = confidencePct([fema, usgs, epa, airNow, crime]);
  const rentalConf = confidencePct([hud, census]);
  const trajConf   = confidencePct([bls, fred, census]);

  // Build plain-English summaries for each section
  const femaZone   = fema?.data?.zone || null;
  const floodLabel = fema?.data?.label || "Flood zone not determined";
  const seismicLevel = usgs?.data?.seismicRiskLevel || "Unknown";
  const crimeData  = crime?.status === "success" ? crime.data : null;
  const aqiCat     = airNow?.data?.aqiCategory || null;
  const walkDesc   = walk?.data?.walkDescription || null;
  const mortgageRate = fred?.data?.mortgage30YrRate;
  const hpiYoy     = fred?.data?.nationalHPIYoyPct;
  const fmrTwoBed  = hud?.data?.fmrTwoBed;
  const medIncome  = census?.data?.medianHouseholdIncome;
  const unemploy   = bls?.data?.stateUnemploymentRate;

  const enrichment = {
    v3_enriched:  true,
    enriched_at:  new Date().toISOString(),

    // ── Location Intelligence ──
    locationIntelligence: {
      _confidence:      locConf,
      _subscore:        locScore,
      _interpretation:  walk?.status === "success"
        ? `${walkDesc || "Walkability score " + walk.data.walkScore + "/100"}. ${osm?.data?.schoolsNearby ?? "Unknown"} schools and ${osm?.data?.transitStopsNearby ?? "unknown"} transit stops within 1.5 miles.`
        : "Walk Score and amenity data unavailable for this address.",
      walkScore:        walk?.status === "success" ? walk.data : null,
      amenities:        osm?.status  === "success" ? osm.data  : null,
      broadband:        fcc?.status  === "success" ? fcc.data  : null,
    },

    // ── Market & Valuation ──
    marketData: {
      _confidence:      mktConf,
      _subscore:        mktScore,
      _interpretation:  [
        mortgageRate ? `Current 30-year mortgage rate: ${mortgageRate}%.` : null,
        hpiYoy != null ? `National home price index ${hpiYoy > 0 ? "up" : "down"} ${Math.abs(hpiYoy)}% YoY.` : null,
        fmrTwoBed ? `HUD fair market rent (2-bed): $${fmrTwoBed.toLocaleString()}/mo.` : null,
        medIncome ? `Median household income: $${medIncome.toLocaleString()}.` : null,
      ].filter(Boolean).join(" ") || "Census, FRED, and HUD market data unavailable.",
      census:           census?.status === "success" ? census.data : null,
      fred:             fred?.status   === "success" ? fred.data   : null,
      hud:              hud?.status    === "success" ? hud.data    : null,
    },

    // ── Hazard & Environmental ──
    hazardEnrichment: {
      _confidence:      riskConf,
      _subscore:        riskScore,
      _interpretation:  [
        femaZone ? `FEMA flood zone ${femaZone}: ${floodLabel}.` : null,
        seismicLevel !== "Unknown" ? `Seismic risk: ${seismicLevel}.` : null,
        epa?.data?.ejIndexPctile != null ? `Environmental Justice Index at ${epa.data.ejIndexPctile.toFixed(0)}th percentile nationally.` : null,
        aqiCat ? `Air quality: ${aqiCat} (AQI ${airNow.data.aqi}).` : null,
        crime?.status === "success" && crime.data.violentCrimePer100k != null ? `State violent crime: ${crime.data.violentCrimePer100k}/100k (${crime.data.crimeRating} risk).` : null,
      ].filter(Boolean).join(" ") || "Extended hazard data unavailable.",
      femaFlood:        fema?.status  === "success" ? fema.data  : null,
      seismic:          usgs?.status  === "success" ? usgs.data  : null,
      environmental:    epa?.status   === "success" ? epa.data   : null,
      airQuality:       airNow?.status === "success" ? airNow.data : null,
      crime:            crime?.status  === "success" ? crime.data  : null,
    },

    // ── Rental Yield Analysis ──
    rentalAnalysis: {
      _confidence:      rentalConf,
      _subscore:        rentalScore,
      _interpretation:  fmrTwoBed && existingValue
        ? `HUD FMR 2-bed rent of $${fmrTwoBed.toLocaleString()}/mo implies a ${((fmrTwoBed * 12 / existingValue) * 100).toFixed(1)}% gross yield on the current estimated value.`
        : fmrTwoBed
          ? `HUD fair market 2-bed rent for this area: $${fmrTwoBed.toLocaleString()}/mo.`
          : "Rental yield data unavailable.",
      hudFMR:           hud?.status    === "success" ? hud.data    : null,
      censusIncome:     census?.status === "success" ? { medianHouseholdIncome: census.data.medianHouseholdIncome, medianGrossRent: census.data.medianGrossRent } : null,
    },

    // ── Neighborhood Trajectory ──
    neighborhoodTrajectory: {
      _confidence:      trajConf,
      _subscore:        trajScore,
      _interpretation:  [
        unemploy != null ? `State unemployment rate: ${unemploy}%${unemploy < 4 ? " (strong labor market)" : unemploy > 6 ? " (elevated)" : ""}.` : null,
        hpiYoy != null ? `National housing prices trending ${hpiYoy > 0 ? "upward" : "downward"} at ${Math.abs(hpiYoy)}% YoY.` : null,
      ].filter(Boolean).join(" ") || "Trajectory data unavailable.",
      laborMarket:      bls?.status  === "success" ? bls.data  : null,
      nationalHousing:  fred?.status === "success" ? { hpiYoyPct: fred.data.nationalHPIYoyPct, mortgage30YrRate: fred.data.mortgage30YrRate } : null,
    },

    // ── Permit History (Riverside County public layer + auto-detected DNA features) ──
    permitHistory: (() => {
      const pd = permits?.status === "success" ? permits.data : null;
      if (!pd) {
        return {
          _confidence: 0,
          _interpretation: "Permit data unavailable for this parcel. Riverside County public layer covers unincorporated areas; city-level permits (Palm Springs, Palm Desert, etc.) require BuildZoom or Shovels.ai integration.",
          permits: [],
          autoDetectedFeatures: {},
        };
      }
      const hasList = Array.isArray(pd.permits) && pd.permits.length > 0;
      const interp = hasList
        ? `${pd.totalPermits} permit(s) on file (${pd.recentPermits} in past 5 years). ${pd.fullyRemodeled ? "Property appears fully remodeled based on permit history." : ""} ${pd.recentPool ? "Pool permit detected." : ""} ${pd.recentAddition ? "Addition/ADU permit detected." : ""}`.trim()
        : `No permits found in Riverside County public layer. ${pd.note || ""}`.trim();
      return {
        _confidence: hasList ? 80 : 10,
        _interpretation: interp,
        source: pd.source || "rivco_arcgis",
        apn: pd.apn || null,
        permits: pd.permits || [],
        totalPermits: pd.totalPermits || 0,
        recentPermits: pd.recentPermits || 0,
        autoDetectedFeatures: {
          fully_remodeled: pd.fullyRemodeled || false,
          pool:            pd.recentPool || false,
          addition:        pd.recentAddition || false,
        },
        estimatedPermitValuePct: pd.estimatedValuePct || 0,
      };
    })(),

    // ── Source status map (for UI display) ──
    sourceStatuses: Object.fromEntries(
      Object.entries(allSources).map(([k, v]) => [k, v?.status || "failed"])
    ),

    // ── Rolled-up category scores (powers updated dnaScore.ts) ──
    categoryScores: {
      locationQuality:     locScore,
      marketValueAccuracy: mktScore,
      riskScore,
      rentalYieldPotential: rentalScore,
      neighborhoodTrajectory: trajScore,
      locationConfidence:  locConf,
      marketConfidence:    mktConf,
      riskConfidence:      riskConf,
      rentalConfidence:    rentalConf,
      trajectoryConfidence: trajConf,
    },
  };

  // Update property_intelligence with enrichment columns (if property is already ingested)
  if (propertyId) {
    const piUpdate = {
      walk_score:            walk?.data?.walkScore        ?? null,
      transit_score:         walk?.data?.transitScore     ?? null,
      bike_score:            walk?.data?.bikeScore        ?? null,
      schools_nearby:        osm?.data?.schoolsNearby     ?? null,
      parks_nearby:          osm?.data?.parksNearby       ?? null,
      transit_stops_nearby:  osm?.data?.transitStopsNearby ?? null,
      amenity_proximity_score: osm?.data?.amenityProximityScore ?? null,
      census_median_income:  census?.data?.medianHouseholdIncome ?? null,
      census_median_home_value: census?.data?.medianHomeValue    ?? null,
      census_total_population: census?.data?.totalPopulation     ?? null,
      hud_fmr_2bed:          hud?.data?.fmrTwoBed   ?? null,
      hud_fmr_3bed:          hud?.data?.fmrThreeBed ?? null,
      fred_mortgage_rate:    fred?.data?.mortgage30YrRate  ?? null,
      fred_hpi_yoy:          fred?.data?.nationalHPIYoyPct ?? null,
      fema_flood_zone_v3:    fema?.data?.zone  ?? null,
      fema_flood_sfha:       fema?.data?.sfha  ?? null,
      epa_ej_index_pctile:   epa?.data?.ejIndexPctile ?? null,
      epa_pm25_pctile:       epa?.data?.pm25Pctile    ?? null,
      usgs_pga:              usgs?.data?.peakGroundAcceleration ?? null,
      usgs_seismic_risk:     usgs?.data?.seismicRiskLevel ?? null,
      airnow_aqi:            airNow?.data?.aqi         ?? null,
      airnow_aqi_category:   airNow?.data?.aqiCategory ?? null,
      bls_state_unemployment: bls?.data?.stateUnemploymentRate ?? null,
      fbi_violent_crime_per100k: crimeData?.violentCrimePer100k ?? null,
      fbi_crime_rating:      crimeData?.crimeRating       ?? null,
      census_block_fips:     fcc?.data?.censusFIPS     ?? null,
      v3_location_score:     locScore,
      v3_market_score:       mktScore,
      v3_risk_score:         riskScore,
      v3_rental_score:       rentalScore,
      v3_trajectory_score:   trajScore,
      v3_enriched_at:        new Date().toISOString(),
    };
    db.from("property_intelligence").eq("property_id", propertyId).update(piUpdate)
      .catch(e => console.warn("[enrich:pi update]", e.message));
  }

  // Update property_reports.enrichment_data if we have a reportId
  if (reportId) {
    db.from("property_reports").eq("id", reportId).update({ enrichment_data: enrichment })
      .catch(e => console.warn("[enrich:report update]", e.message));
  }

  return enrichment;
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { lat, lon, zip, address, city, state, reportId, propertyId, existingValue, existingRent } = body;
  if (!lat || !lon) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "lat and lon required" }) };
  }

  try {
    const result = await enrichProperty({ lat, lon, zip, address, city, state, reportId, propertyId, existingValue, existingRent });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ enriched: true, ...result }) };
  } catch (err) {
    console.error("[enrich-property]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// Export for direct import by save-report.js (avoids HTTP round-trip)
exports.enrichProperty = enrichProperty;

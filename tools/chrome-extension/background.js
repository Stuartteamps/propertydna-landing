// PropertyDNA Chrome Extension — Service Worker
//
// Receives address payloads from content scripts (Zillow / Redfin) and
// queries the PropertyDNA API to fetch the DNA score + valuation + risk.
// Caches results in chrome.storage.session so revisits are instant.

const API_BASE = "https://thepropertydna.com";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min cache per address

async function getCached(address) {
  try {
    const key = `dna:${address.toLowerCase()}`;
    const stored = await chrome.storage.session.get(key);
    const entry = stored[key];
    if (!entry) return null;
    if (Date.now() - entry.t > CACHE_TTL_MS) return null;
    return entry.v;
  } catch { return null; }
}

async function setCached(address, value) {
  try {
    const key = `dna:${address.toLowerCase()}`;
    await chrome.storage.session.set({ [key]: { t: Date.now(), v: value } });
  } catch { /* noop */ }
}

async function fetchDnaScore(address) {
  const cached = await getCached(address);
  if (cached) return { ...cached, _cached: true };

  try {
    const res = await fetch(
      `${API_BASE}/.netlify/functions/property-query?address=${encodeURIComponent(address)}`,
      { headers: { "Accept": "application/json", "X-PDNA-Source": "chrome-ext-0.1.0" } }
    );
    if (!res.ok) return { error: `api_${res.status}` };
    const data = await res.json();

    const p = data.property || data;
    const v = data.valuation || p.valuation || {};
    const r = data.risk || p.risk || {};

    const result = {
      address: p.address || address,
      city: p.city, state: p.state, zip: p.zip,
      dna_score: v.dna_score ?? null,
      confidence: v.confidence ?? null,
      estimate: v.estimate ?? p.current_estimated_value ?? null,
      estimate_low: v.low ?? null,
      estimate_high: v.high ?? null,
      flood_zone: r.flood_zone ?? null,
      in_sfha: r.in_sfha ?? null,
      unfinaled_permits: r.unfinaled_permits ?? null,
      hazard_rating: r.hazard_rating ?? null,
      verdict: v.verdict ?? null,
      report_url: `${API_BASE}/property-dna?address=${encodeURIComponent(address)}`,
      indexed: !!(p.address || v.dna_score),
    };

    await setCached(address, result);
    return result;
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PDNA_GET_SCORE" && msg.address) {
    fetchDnaScore(msg.address).then(sendResponse);
    return true; // keep channel open for async response
  }
  if (msg?.type === "PDNA_OPEN_REPORT" && msg.address) {
    chrome.tabs.create({ url: `${API_BASE}/property-dna?address=${encodeURIComponent(msg.address)}` });
    sendResponse({ ok: true });
    return false;
  }
});

// Install / update lifecycle
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: `${API_BASE}/?utm_source=chrome_ext_install&utm_medium=extension` });
  }
});

// Shared overlay renderer — used by both zillow.js and redfin.js
//
// Exposes window.pdnaRenderBadge(address) — extracts address from the page,
// asks the service worker for the DNA score, and injects a fixed-position
// badge on the right edge of the viewport.

(function () {
  if (window.__pdnaInitialized) return;
  window.__pdnaInitialized = true;

  const BADGE_ID = "pdna-badge-root";

  function getScoreClass(score) {
    if (score == null) return "";
    if (score >= 80) return "pdna-high";
    if (score < 65)  return "pdna-low";
    return "";
  }

  function getVerdict(score, confidence) {
    if (score == null) return null;
    if (score >= 82 && confidence !== "low") return "buy";
    if (score < 70 || confidence === "low")  return "walk";
    return "hold";
  }

  function fmtUSD(n) {
    if (n == null) return null;
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000)     return "$" + Math.round(n / 1_000) + "K";
    return "$" + n.toLocaleString();
  }

  function buildBadge(data, address) {
    const wrap = document.createElement("div");
    wrap.id = BADGE_ID;
    wrap.className = "pdna-badge";

    const brandHtml = `
      <div class="pdna-badge-header">
        <div class="pdna-badge-brand">
          <span class="pdna-badge-brand-mark">
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke="#C9A84C"/>
              <line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" stroke-width="0.75"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" stroke-width="0.75"/>
            </svg>
          </span>
          PropertyDNA
        </div>
        <button class="pdna-badge-close" title="Dismiss">×</button>
      </div>
    `;

    if (data?.error || !data) {
      wrap.innerHTML = brandHtml + `
        <div class="pdna-empty">
          Couldn't load DNA score for this address.<br/>
          <a class="pdna-cta" href="https://thepropertydna.com/property-dna?address=${encodeURIComponent(address)}" target="_blank" rel="noopener">
            Run a free report →
          </a>
        </div>
      `;
      return wrap;
    }

    if (!data.indexed && data.dna_score == null) {
      wrap.innerHTML = brandHtml + `
        <div class="pdna-empty">
          This address isn't in the sovereign index yet.<br/>
          Run a report — we'll index it free.
          <a class="pdna-cta" href="${data.report_url}" target="_blank" rel="noopener">
            Run a free report →
          </a>
        </div>
      `;
      return wrap;
    }

    const verdict = getVerdict(data.dna_score, data.confidence);
    const verdictLabel = verdict === "buy" ? "Algorithm verdict · Buy"
                       : verdict === "walk" ? "Algorithm verdict · Walk"
                       : verdict === "hold" ? "Algorithm verdict · Hold"
                       : null;

    const rows = [];
    if (data.estimate != null) {
      rows.push({ label: "Est. value", value: fmtUSD(data.estimate) });
    }
    if (data.flood_zone) {
      const isSfha = data.in_sfha;
      rows.push({ label: "Flood zone", value: data.flood_zone + (isSfha ? " · SFHA" : ""), warn: isSfha });
    }
    if (data.unfinaled_permits != null && data.unfinaled_permits > 0) {
      rows.push({ label: "Unfinaled permits", value: String(data.unfinaled_permits), warn: true });
    }
    if (data.hazard_rating) {
      rows.push({ label: "Hazard tier", value: data.hazard_rating, warn: /high|severe/i.test(data.hazard_rating) });
    }

    wrap.innerHTML = brandHtml + `
      <div class="pdna-badge-body">
        <div class="pdna-score-row">
          <div>
            <div class="pdna-score-label">DNA Score</div>
            <div class="pdna-score-num ${getScoreClass(data.dna_score)}">${data.dna_score ?? "—"}<span style="font-size:14px;color:rgba(244,240,232,0.4);"> / 100</span></div>
          </div>
          ${data.confidence ? `<div class="pdna-score-label" style="text-align:right;">Conf:<br/>${data.confidence}</div>` : ""}
        </div>
        ${rows.map(r => `
          <div class="pdna-row">
            <span class="pdna-row-label">${r.label}</span>
            <span class="pdna-row-value ${r.warn ? "pdna-warn" : ""}">${r.value}</span>
          </div>
        `).join("")}
        ${verdict ? `<div class="pdna-verdict pdna-verdict-${verdict}">${verdictLabel}</div>` : ""}
        <a class="pdna-cta" href="${data.report_url}" target="_blank" rel="noopener">Full report →</a>
      </div>
    `;
    return wrap;
  }

  function buildLoading(address) {
    const wrap = document.createElement("div");
    wrap.id = BADGE_ID;
    wrap.className = "pdna-badge pdna-loading";
    wrap.innerHTML = `
      <div class="pdna-badge-header">
        <div class="pdna-badge-brand">
          <span class="pdna-badge-brand-mark">
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke="#C9A84C"/>
            </svg>
          </span>
          PropertyDNA
        </div>
        <button class="pdna-badge-close" title="Dismiss">×</button>
      </div>
      <div class="pdna-empty">
        Scanning <em>${address || "this property"}</em>…
      </div>
    `;
    return wrap;
  }

  function attachCloseHandler(badge) {
    const closeBtn = badge.querySelector(".pdna-badge-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        badge.remove();
        try { sessionStorage.setItem("pdna_dismissed_url", location.href); } catch {}
      });
    }
  }

  async function renderBadge(address) {
    if (!address) return;
    try {
      if (sessionStorage.getItem("pdna_dismissed_url") === location.href) return;
    } catch {}

    document.getElementById(BADGE_ID)?.remove();
    const loading = buildLoading(address);
    document.body.appendChild(loading);
    attachCloseHandler(loading);

    let data;
    try {
      data = await chrome.runtime.sendMessage({ type: "PDNA_GET_SCORE", address });
    } catch (e) {
      data = { error: String(e?.message || e) };
    }

    loading.remove();
    const badge = buildBadge(data, address);
    document.body.appendChild(badge);
    attachCloseHandler(badge);
  }

  window.pdnaRenderBadge = renderBadge;
})();

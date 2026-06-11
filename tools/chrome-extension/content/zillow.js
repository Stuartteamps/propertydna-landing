// PropertyDNA — Zillow content script
//
// Extracts the property address from a Zillow listing page and asks the
// service worker for the DNA score. Renders a fixed badge in the
// top-right corner. Listens for URL changes (Zillow is SPA-ish).

(function () {
  // Inline the renderer so we don't need an injected web-accessible script
  // (manifest content_scripts can include multiple JS files; we list zillow.js
  // alone and inline the renderer in this file for simplicity).

  function extractAddress() {
    // 1. Try the og:title meta tag (most reliable on Zillow)
    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content) {
      // Zillow og:title format: "1234 Main St, City, ST 12345 | Zillow" or just "1234 Main St ... | MLS#..."
      const clean = og.content
        .replace(/\s*\|\s*Zillow.*$/i, "")
        .replace(/\s*\|\s*MLS\s*#.*$/i, "")
        .trim();
      if (clean.length > 10 && /\d/.test(clean)) return clean;
    }

    // 2. Try the title tag
    const title = document.title || "";
    const titleClean = title.replace(/\s*\|\s*Zillow.*$/i, "").replace(/\s*\|\s*MLS\s*#.*$/i, "").trim();
    if (titleClean.length > 10 && /\d/.test(titleClean)) return titleClean;

    // 3. Try common Zillow DOM selectors
    const selectors = [
      'h1[class*="address"]',
      '[data-testid="home-details-summary-address"]',
      '[class*="ds-address-container"] h1',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim().replace(/\s+/g, " ");
    }

    // 4. URL fallback: /homedetails/123-Main-St-City-ST-12345/...
    const url = location.pathname;
    const match = url.match(/\/homedetails\/([^/]+)/);
    if (match) {
      // "123-Main-St-City-ST-12345" → "123 Main St City ST 12345"
      return match[1].replace(/-/g, " ").trim();
    }
    return null;
  }

  let lastUrl = location.href;
  let lastAddress = null;

  function tryRender() {
    const address = extractAddress();
    if (!address || address === lastAddress) return;
    lastAddress = address;
    if (window.pdnaRenderBadge) {
      window.pdnaRenderBadge(address);
    }
  }

  // _render.js is loaded before this script via the content_scripts array
  // in manifest.json, so window.pdnaRenderBadge is already available.
  tryRender();

  // Watch for SPA navigation (Zillow rewrites URL on listing changes)
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastAddress = null;
      setTimeout(tryRender, 800); // give Zillow time to swap content
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also re-check on history change
  window.addEventListener("popstate", () => setTimeout(tryRender, 600));
})();

// PropertyDNA — Redfin content script

(function () {
  function extractAddress() {
    // 1. og:title
    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content) {
      const clean = og.content
        .replace(/\s*\|\s*Redfin.*$/i, "")
        .replace(/\s*\|\s*MLS.*$/i, "")
        .replace(/\s*\(Sold\)\s*/i, "")
        .replace(/\s*\(Pending\)\s*/i, "")
        .trim();
      if (clean.length > 10 && /\d/.test(clean)) return clean;
    }

    // 2. Redfin's specific DOM
    const selectors = [
      "h1.full-address",
      '[data-rf-test-name="abp-streetLine"]',
      ".street-address",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        // Redfin sometimes splits address into streetLine + cityStateZip
        const street = el.textContent.trim();
        const csz = document.querySelector('[data-rf-test-name="abp-cityStateZip"]')?.textContent?.trim();
        return csz ? `${street}, ${csz}` : street;
      }
    }

    // 3. URL fallback: /CA/Palm-Springs/123-Main-St-92262/home/12345678
    const url = location.pathname;
    const match = url.match(/^\/([A-Z]{2})\/([^/]+)\/([^/]+)-(\d{5})\/home/i);
    if (match) {
      const [, state, city, street, zip] = match;
      return `${street.replace(/-/g, " ")}, ${city.replace(/-/g, " ")}, ${state} ${zip}`;
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

  // _render.js is loaded before this script via the content_scripts array.
  tryRender();

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastAddress = null;
      setTimeout(tryRender, 800);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("popstate", () => setTimeout(tryRender, 600));
})();

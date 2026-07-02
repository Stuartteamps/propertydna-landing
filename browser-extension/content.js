/**
 * PropertyDNA content script — reads the listing the USER is viewing (facts only:
 * address, price, beds/baths/sqft) and opens our AVM prefilled. User-initiated,
 * single-property, on a page the user is entitled to view. No mass harvesting.
 */
(function () {
  const SITE = "https://thepropertydna.com";
  const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) || !n ? null : n; };

  // 1) Prefer schema.org JSON-LD (facts, structured, present on most listing sites)
  function fromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data; try { data = JSON.parse(s.textContent); } catch { continue; }
      const arr = Array.isArray(data) ? data : [data];
      for (const d of arr) {
        const node = d && (d["@graph"] ? d["@graph"].find(x => /Residence|House|Product|Place|Offer|SingleFamily|Apartment/i.test(JSON.stringify(x["@type"] || ""))) : d) || d;
        if (!node) continue;
        const addr = node.address || (node.item && node.item.address);
        const price = node.offers?.price || node.price || node.offers?.lowPrice;
        if (addr || price) {
          return {
            address: addr?.streetAddress || "",
            city: addr?.addressLocality || "",
            state: addr?.addressRegion || "",
            zip: addr?.postalCode || "",
            listPrice: num(price),
            beds: num(node.numberOfRooms || node.numberOfBedrooms),
            baths: num(node.numberOfBathroomsTotal || node.numberOfBathrooms),
            sqft: num(node.floorSize?.value),
          };
        }
      }
    }
    return null;
  }

  // 2) Fallback: OpenGraph / meta + visible text patterns
  function fromMeta() {
    const og = (p) => document.querySelector(`meta[property="${p}"],meta[name="${p}"]`)?.content || "";
    const title = og("og:title") || document.title;
    const desc = og("og:description") || "";
    const blob = `${title} ${desc}`;
    // "123 Main St, City, ST 92262" pattern
    const addrM = blob.match(/(\d+[^,]+),\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s*(\d{5})?/);
    const priceM = blob.match(/\$\s?([\d,]{4,})/);
    const bedM = blob.match(/(\d+)\s*(?:bd|bed|beds|bedroom)/i);
    const bathM = blob.match(/(\d+(?:\.\d)?)\s*(?:ba|bath|baths|bathroom)/i);
    const sqftM = blob.match(/([\d,]{3,})\s*(?:sq\.?\s?ft|sqft|square\s?feet)/i);
    if (!addrM && !priceM) return null;
    return {
      address: addrM ? addrM[1].trim() : "",
      city: addrM ? (addrM[2] || "").trim() : "",
      state: addrM ? (addrM[3] || "") : "",
      zip: addrM ? (addrM[4] || "") : "",
      listPrice: priceM ? num(priceM[1]) : null,
      beds: bedM ? num(bedM[1]) : null,
      baths: bathM ? num(bathM[1]) : null,
      sqft: sqftM ? num(sqftM[1]) : null,
    };
  }

  function openPriceCheck() {
    const d = fromJsonLd() || fromMeta();
    const q = new URLSearchParams();
    if (d) for (const [k, v] of Object.entries(d)) if (v) q.set(k, String(v));
    window.open(`${SITE}/price-check?${q.toString()}`, "_blank", "noopener");
  }
  window.__pdnaOpen = openPriceCheck;

  // Floating button
  if (!document.getElementById("pdna-btn")) {
    const b = document.createElement("button");
    b.id = "pdna-btn";
    b.textContent = "🧬 Overpriced? — PropertyDNA";
    Object.assign(b.style, {
      position: "fixed", bottom: "22px", right: "22px", zIndex: 2147483647,
      background: "#B89355", color: "#0F0E0D", border: "none", borderRadius: "40px",
      padding: "13px 20px", fontFamily: "Arial,sans-serif", fontSize: "14px", fontWeight: "700",
      cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,.35)", letterSpacing: ".3px",
    });
    b.onclick = openPriceCheck;
    document.body.appendChild(b);
  }
})();

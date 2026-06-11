// PropertyDNA Chrome extension popup — runs in extension context

const input = document.getElementById("search-input");
const cta = document.getElementById("search-cta");
const form = document.getElementById("search-form");

function updateCta() {
  const value = input.value.trim();
  if (value.length > 4) {
    cta.href = `https://thepropertydna.com/property-dna?address=${encodeURIComponent(value)}&utm_source=chrome_ext_popup`;
  } else {
    cta.href = "https://thepropertydna.com/?utm_source=chrome_ext_popup";
  }
}

input.addEventListener("input", updateCta);
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  chrome.tabs.create({
    url: `https://thepropertydna.com/property-dna?address=${encodeURIComponent(value)}&utm_source=chrome_ext_popup`
  });
});

input.focus();
updateCta();

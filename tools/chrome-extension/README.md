# PropertyDNA Chrome Extension

DNA score, flood-zone designation, comp truth — injected directly onto every Zillow and Redfin listing page.

## What it does

- You browse Zillow or Redfin like normal
- A gold PropertyDNA badge appears in the corner of every listing page
- Badge shows: DNA score · estimated value · flood zone · unfinaled permits · hazard rating · buy/hold/walk verdict
- One click → opens the full PropertyDNA report

Zero account required. No tracking. Free forever.

## File structure

```
tools/chrome-extension/
├── manifest.json           Manifest v3 — host permissions, content scripts, popup
├── background.js           Service worker — fetches DNA score from API + cache
├── popup.html / popup.js   Toolbar popup — search any address + watch-list link
├── content/
│   ├── _render.js          Shared overlay renderer (window.pdnaRenderBadge)
│   ├── overlay.css         Badge styles
│   ├── zillow.js           Zillow address extractor + observer
│   └── redfin.js           Redfin address extractor + observer
└── icons/                  16/32/48/128 PNG (placeholders for now)
```

## Local install (for testing)

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select `tools/chrome-extension/`
4. Visit any Zillow listing (e.g. https://www.zillow.com/homedetails/...) — badge appears in the top-right corner

## Icons

The 4 sizes (16/32/48/128) need to be added under `icons/`. The brand mark is the PropertyDNA black-on-gold square with the cross-hatch glyph. Use Figma or the existing brand assets in `app/frontend/public/social/`. Until icons are in, Chrome shows a generic puzzle piece.

To generate placeholder icons quickly:

```bash
# from any 512×512 brand square
sips -z 16 16 source.png   --out icons/icon-16.png
sips -z 32 32 source.png   --out icons/icon-32.png
sips -z 48 48 source.png   --out icons/icon-48.png
sips -z 128 128 source.png --out icons/icon-128.png
```

## Address extraction strategy

Both Zillow and Redfin are SPAs that don't trigger full page loads when you click between listings. The content scripts:

1. Extract the address from the page's `og:title`, then DOM selectors, then URL pattern (in that order of reliability)
2. Render the badge once on initial load
3. Watch for URL changes via MutationObserver — when the URL shifts, re-extract and re-render
4. Cache DNA results per address in `chrome.storage.session` (30 min TTL) so revisits are instant

## API

The extension calls `https://thepropertydna.com/.netlify/functions/property-query?address=...` which is the same endpoint the web app uses. No new backend code required.

## Publishing to the Chrome Web Store

1. Create a Chrome Web Store Developer account ($5 one-time, https://chrome.google.com/webstore/devconsole)
2. ZIP the contents of `tools/chrome-extension/` (NOT the parent folder)
3. Dashboard → Add new item → Upload ZIP
4. Fill in store listing:
   - **Name**: PropertyDNA — DNA Score for Zillow & Redfin
   - **Summary** (132 char): See the PropertyDNA score, flood zone, permit history, and comp-truth on every Zillow & Redfin listing. Free, no account.
   - **Description**: lift from `tools/youtube/social-bios.md` → YouTube About section
   - **Category**: Productivity (or Shopping)
   - **Screenshots**: 5× 1280×800 — one per overlay state (high score, low score, flood-zone warning, unfinaled permits, walk verdict)
   - **Privacy policy URL**: https://thepropertydna.com/privacy
   - **Single purpose**: "Show PropertyDNA intelligence on Zillow and Redfin listings"
5. Submit for review (typically 1-3 days, can be longer for the first version of a new extension)

## What ships next

- [ ] **Icons** (above) — required before publish
- [ ] **5 screenshots** for the store listing
- [ ] **Realtor.com support** — add a third content script once Zillow + Redfin are stable
- [ ] **Add-to-watch-list button** in the badge (calls `/.netlify/functions/watch-list` POST with the address)
- [ ] **Sign-in state** — if a user is signed in on `thepropertydna.com`, the badge shows their email and the "Watch this property" action one-taps to add
- [ ] **Heat map mini** — small zoom-around-this-address heat snapshot inline in the badge

## Privacy

The extension calls a single URL: `thepropertydna.com/.netlify/functions/property-query?address=...`

It sends the property address from the page you're viewing. Nothing else. No personal info, no cookies, no user identifier.

We will declare this clearly in the store listing under "Permissions justification."

## Brand mission

> The data your real estate agent doesn't want you to see — now inside the platforms where the buyer already lives.

— Dan Stuart, PropertyDNA · save the humans

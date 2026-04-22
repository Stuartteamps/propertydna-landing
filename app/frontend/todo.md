# PropertyDNA React App - Development Plan

## Design Guidelines (port 1:1 from original HTML)

### Color Palette
- Canvas: #F4F0E8 (main background)
- White: #FDFCF9 (panels)
- Espresso: #1E1A17 (deep footer)
- Warm Dark: #2C2825 (text / dark sections)
- Gold: #B89355 (primary accent)
- Gold Light: #D4AE6E
- Warm Gray: #8C7E72 (secondary text)
- Rule: #DDD8CE (borders/dividers)

### Typography
- Serif: 'Cormorant Garamond' (headings, italics with gold for emphasis)
- Sans: 'Jost' (body, labels, uppercase eyebrows with wide letter-spacing)

### Key Visual Motifs
- Fixed grain/noise overlay on body
- Fixed translucent nav with backdrop-blur
- Uppercase eyebrow labels with gold 32px leading line
- Gold italic emphasis inside serif headlines
- Bottom-border-only form inputs with animated gold underline on focus
- Role chips (Buyer / Seller / Agent / Investor / Lender) - active state in gold
- Submit button with left-to-right gold wipe on hover
- Floating sample report card with subtle bob animation
- Dark features strip (warm-dark bg, gold numerals)

## File Structure (7 files total)

1. `src/index.css` - Import Google Fonts, CSS variables, grain overlay, global reset
2. `tailwind.config.ts` - Extend with custom colors + serif/sans font families
3. `src/App.tsx` - Add routes for /, /about, /how-it-works, /sample-report
4. `src/components/Nav.tsx` - Fixed top nav with PropertyDNA logo + links
5. `src/components/Footer.tsx` - Espresso footer with logo + disclaimer
6. `src/pages/Index.tsx` - Home: hero left (headline+stats) + form right + features strip + sample preview
7. `src/pages/About.tsx` - Brand story, mission, values
8. `src/pages/HowItWorks.tsx` - 4-step process + features grid
9. `src/pages/SampleReport.tsx` - Full mock intelligence report
10. `public/_redirects` - Netlify SPA redirect
11. `netlify.toml` - Netlify build config

## Form Endpoint
POST https://dillabean.app.n8n.cloud/webhook/homefax/report (mode: no-cors)
Payload: { name, email, role, address, city, state, zip }

## Netlify Deployment
- Build command: `pnpm run build`
- Publish directory: `dist`
- SPA redirect via _redirects and netlify.toml
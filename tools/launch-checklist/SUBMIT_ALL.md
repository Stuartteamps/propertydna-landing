# PropertyDNA — Launch Checklist (Dan's 60-minute distribution sprint)

Once these are done, PropertyDNA is in every channel where the AI-native + homebuyer audiences live. Total active time: ~60 minutes.

## ⏱️ 5 min — npm package launched

✅ **DONE** — `@propertydna/mcp-server@0.1.0` is live on https://www.npmjs.com/package/@propertydna/mcp-server

Watch downloads weekly. Target: 100/week by day 30, 1000/week by day 90.

## ⏱️ 10 min — Submit to MCP directories

### Smithery (largest MCP directory)
1. Open https://smithery.ai/new
2. Sign in with GitHub
3. Paste repo URL: `https://github.com/Stuartteamps/propertydna-landing`
4. Smithery auto-detects `tools/mcp-server/smithery.yaml` (already committed)
5. Confirm metadata + categories: `real-estate`, `data`, `valuation`, `risk-intelligence`
6. Submit. Live in ~24h.

### mcp.so
1. Open https://mcp.so/submit
2. Paste npm package: `@propertydna/mcp-server`
3. Tags: `Real Estate`, `Data Intelligence`, `Valuation`
4. Submit. Live in ~48-72h.

### Anthropic's official MCP servers repo (highest credibility)
1. Fork https://github.com/modelcontextprotocol/servers
2. Edit `README.md` → "Community Servers" section
3. Add this line (alphabetical order):
   ```markdown
   - [**PropertyDNA**](https://github.com/Stuartteamps/propertydna-landing/tree/main/tools/mcp-server) - Run DNA reports, find comps, check flood zones, query luxury dossiers. 3.58M parcels indexed across 9 states.
   ```
4. Open PR: title `Add PropertyDNA MCP server`, body cites the npm package
5. Review takes 3-14 days. Acceptance = level-up signal.

### awesome-mcp-servers (community curation)
1. Fork https://github.com/punkpeye/awesome-mcp-servers
2. Add under "🏠 Real Estate" (create the section if it doesn't exist):
   ```markdown
   - [PropertyDNA](https://www.npmjs.com/package/@propertydna/mcp-server) - Property intelligence with DNA scores, flood zones, comp truth, luxury provenance. 3.58M parcels indexed.
   ```
3. PR title: `Add PropertyDNA — property intelligence MCP server`

## ⏱️ 15 min — Chrome Web Store

### Prereqs (already done)
- Manifest v3: ✅ `tools/chrome-extension/manifest.json`
- Background worker + content scripts: ✅
- Icons (16/32/48/128 PNG): ✅ `tools/chrome-extension/icons/`

### Submission
1. Pay one-time $5 dev fee at https://chrome.google.com/webstore/devconsole
2. ZIP contents of `tools/chrome-extension/`:
   ```bash
   cd tools/chrome-extension
   zip -r propertydna-extension.zip . -x "*.DS_Store" "README.md"
   ```
3. Dashboard → Add new item → Upload ZIP
4. Fill in store listing:
   - **Name**: PropertyDNA — DNA Score for Zillow & Redfin
   - **Summary** (132 char): See the PropertyDNA score, flood zone, permit history, and comp-truth on every Zillow & Redfin listing. Free, no account.
   - **Description**: Use the "About" section from `tools/youtube/social-bios.md`
   - **Category**: Productivity
   - **Privacy policy**: https://thepropertydna.com/privacy
   - **Single purpose**: "Show PropertyDNA intelligence on Zillow and Redfin listings"
5. **Screenshots** (5× 1280×800):
   - Need: visit a Zillow listing locally with the extension loaded, screenshot each overlay state. Easiest 5:
     1. High-DNA-score property (green verdict)
     2. Low-score property (red, walk verdict)
     3. Flood-zone warning visible
     4. Unfinaled permits visible
     5. Comp spread > 8% visible
6. Submit. Review: 1-3 days for new extensions.

## ⏱️ 10 min — Product Hunt launch

1. Go to https://www.producthunt.com/posts/new
2. Schedule for **Tuesday 12:01 AM PT** (the algorithmic sweet spot)
3. Fields:
   - **Name**: PropertyDNA
   - **Tagline**: Robinhood for real estate. Free for buyers, forever.
   - **Description**: Use the press-kit intro paragraph
   - **Topics**: Real Estate, Productivity, AI, iOS Apps
   - **Logo**: 240×240 brand mark
   - **Gallery**: 4-6 screenshots (landing hero, heat map, dossier, DNA report, MCP install)
   - **First comment** (queue this for launch morning):
     > Hey HN/PH! 👋 Dan from PropertyDNA here. After 18 months building this with my own money, today we're launching a tool I wish existed when I was buying my first house — the data your real estate agent doesn't want you to see. Free iOS app, free web reports, no upsells. AMA.
4. Line up 5-10 friends to upvote in the first hour (NOT bot accounts)

## ⏱️ 10 min — HackerNews "Show HN"

Best window: **Tuesday-Thursday 9-11 AM PT**

1. Title: `Show HN: First MCP server for property intelligence (free, no account)`
2. URL: https://www.npmjs.com/package/@propertydna/mcp-server
3. First comment (post immediately):
   > Hi HN — Dan from PropertyDNA. We just shipped `@propertydna/mcp-server` so you can ask Claude / Cursor / Cline "run a DNA report on 1234 Main St" or "check flood zone for this Florida address" and get a real answer from our 3.58M-parcel index. Free, no account.
   >
   > Why we built it: most property data APIs are gated, expensive, or built for institutional buyers. The retail buyer — who actually carries the financial risk — has had to use Zillow's black box. We've spent 18 months building the sovereign index + the algorithm.
   >
   > Setup in Claude Desktop: paste this into `~/Library/Application Support/Claude/claude_desktop_config.json`:
   > ```json
   > {"mcpServers": {"propertydna": {"command": "npx", "args": ["-y", "@propertydna/mcp-server"]}}}
   > ```
   >
   > Web version: https://thepropertydna.com (free reports, no account, no tracking).
   >
   > Happy to answer questions about the data, the algorithm (methodology page at /methodology), or the business model.

## ⏱️ 5 min — Reddit launches

### r/ClaudeAI (~80K)
Title: `Built an MCP server for property intelligence — Claude can now run DNA reports on any US address`
Body: Same content as HN post, abbreviated.

### r/cursor (~50K)
Title: `New MCP server: PropertyDNA — property intelligence for Cursor`

### r/LocalLLaMA (~250K)
Title: `Open-source MCP server for property data — 3.58M-parcel index, free`

### r/RealEstate (~1.5M) — careful, mods strict
Title: `Built a free tool that surfaces the data your agent doesn't want you to see`
Body: lead with mission, frame as user-built / for-buyers, NO hard sell. Don't link in title.

## ⏱️ 5 min — Social posts

Post the same launch tweet on X, LinkedIn, Threads (different angles per platform):

**X (concise, screenshot-friendly):**
> The first MCP server for property intelligence is live.
>
> npm: @propertydna/mcp-server
>
> Install in Claude Desktop, Cursor, or any MCP-aware AI. Ask: "Run a DNA report on 1234 Main St" or "Check flood zone for this Florida address." Get a real answer from a 3.58M-parcel index. Free.
>
> 🏠 Save the humans. https://thepropertydna.com

**LinkedIn (story arc):**
> Eighteen months ago I started building PropertyDNA because the real estate industry is structurally designed so the agent on the other side of the table has more data than you do.
>
> Today, two milestones:
> 1. Web + iOS app live, fully free, no account required
> 2. First MCP server for property intelligence (npm: @propertydna/mcp-server) — meaning Claude, Cursor, Cline, and ChatGPT-compatible AI tools can now run DNA reports, find comps, check flood zones, and query luxury provenance dossiers from inside your AI session.
>
> If you're an agent, lender, insurer, or enterprise interested in partnership: partnerships@thepropertydna.com.
>
> If you're a journalist: press kit at thepropertydna.com/press-kit.
>
> If you're a homebuyer — the tool is free. Always. https://thepropertydna.com 🏠

**Threads (curiosity-bait):**
> The data your real estate agent doesn't want you to see is now installable inside ChatGPT, Claude, Cursor, and any MCP-aware AI.
>
> Free. No account. 3.58M parcels indexed. 🏠
>
> https://thepropertydna.com

## ⏱️ — Press outreach (run in parallel, days 2-7)

See `tools/podcast-outreach/queue.json` for pitch queue. Top 5 to send THIS week:
1. **The Real Estate Guys Radio** — long-form, big audience
2. **BiggerPockets Real Estate Podcast** — 1M+ download/episode
3. **Pat Flynn's Smart Passive Income** — tech + entrepreneurship lean
4. **The Verge / Decoder (Nilay Patel)** — tech-policy angle, "industry data asymmetry"
5. **Marketplace / How I Built This** — long shot but the story has legs

## 📈 What to watch in the first 30 days

- npm downloads weekly (target: 100/week by day 30)
- Smithery install button clicks (track in their analytics)
- Chrome Web Store install count
- New PropertyDNA reports/day (kpi_events `report_generated`)
- /share-your-story submissions (`submitted_stories` table)
- Inbound to partnerships@ + press@ + enterprise@
- Reddit AMA traffic
- Newsletter subscribers (target +500 in 30 days)

## 🟢 Ready to ship checklist (everything below is already done)

- ✅ Web app live, free reports, heat map ungated
- ✅ iOS app live in App Store (Build 17)
- ✅ MCP server published to npm
- ✅ Smithery YAML committed
- ✅ Submit-your-story funnel live at /share-your-story
- ✅ Accuracy dashboard live at /accuracy
- ✅ Methodology page live at /methodology
- ✅ Press kit live at /press-kit
- ✅ Partners landing live at /partners
- ✅ Buyer-protection PDF generator live at /buyer-protection
- ✅ Watch list live at /watch
- ✅ Chrome extension code + icons ready (in tools/chrome-extension/)
- ✅ Newsletter cron firing weekly (4:20 PM PT Thursdays)
- ✅ YouTube engagement cron live (lights up when YouTube OAuth granted)
- ✅ Reddit monitor cron live (twice daily, 5 subreddits)
- ✅ Watch-list daily diff cron live
- ✅ Social poster infrastructure for YT/IG/TikTok/X/LinkedIn/FB/Reddit
- ✅ OAuth admin UI at /admin/oauth

Let's go.

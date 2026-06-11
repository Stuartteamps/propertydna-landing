# Submitting @propertydna/mcp-server to MCP Directories

The npm publish made the package installable. These submissions make it **discoverable** by the people who haven't heard of us yet — the AI-native audience browsing MCP marketplaces.

## 1. Smithery — https://smithery.ai

**Status:** Ready to submit. `smithery.yaml` is in this folder.

Submission steps:
1. Visit https://smithery.ai/new
2. Sign in with GitHub
3. Paste repo URL: `https://github.com/Stuartteamps/propertydna-landing`
4. Smithery auto-detects `tools/mcp-server/smithery.yaml`
5. Confirm the metadata + categories
6. Submit

Expected: appears in directory within 24h. Gets a `smithery.ai/server/@propertydna/mcp-server` URL with a one-click "Install in Claude / Cursor / Cline" button.

## 2. mcp.so — https://mcp.so

**Status:** Ready to submit (no config file needed; reads npm directly).

Submission steps:
1. Visit https://mcp.so/submit
2. Paste npm package name: `@propertydna/mcp-server`
3. Tag: `Real Estate`, `Data Intelligence`, `Valuation`
4. Submit

Expected: appears within 48-72h.

## 3. modelcontextprotocol/servers — Anthropic's official repo

**Status:** Ready for PR.

Submission steps:
1. Fork https://github.com/modelcontextprotocol/servers
2. Edit `README.md` under the "Community Servers" section, add:
   ```markdown
   - [**PropertyDNA**](https://github.com/Stuartteamps/propertydna-landing/tree/main/tools/mcp-server) - Run DNA reports, find comps, check flood zones, query luxury dossiers across 3.58M parcels.
   ```
3. Submit PR titled `Add PropertyDNA MCP server`
4. PR body: 1 paragraph summary + npm link + "Free for all users, no authentication required"

Expected: review in 3-14 days. Acceptance is a major credibility signal.

## 4. punkpeye/awesome-mcp-servers — Community list

**Status:** Ready for PR.

Submission steps:
1. Fork https://github.com/punkpeye/awesome-mcp-servers
2. Add under "🏠 Real Estate" (or create the section if it doesn't exist):
   ```markdown
   - [PropertyDNA](https://www.npmjs.com/package/@propertydna/mcp-server) - Property intelligence with DNA scores, flood zones, comp truth, luxury provenance. 3.58M parcels indexed.
   ```
3. PR: `Add PropertyDNA — property intelligence MCP server`

## 5. Cursor MCP marketplace — when it opens

Cursor's MCP marketplace is in private beta. Apply: https://cursor.com/mcp-marketplace-interest (form may move).

## Discovery hacks beyond directories

- **HackerNews "Show HN":** `Show HN: PropertyDNA — first MCP server for real estate intelligence`. Best window: Tuesday-Thursday 9-11 AM PT.
- **Reddit:** `/r/ClaudeAI`, `/r/cursor`, `/r/LocalLLaMA`, `/r/RealEstate` (with care — Reddit hates promo)
- **Twitter/X:** tag @AnthropicAI, @cursor_ai, @cline_dev, @smitheryai with one-screenshot install demo
- **YouTube:** the planned long-form #1 (Thunderbird video) can demo "running DNA report from inside Claude" as a 20-sec hook
- **AnthropicAI MCP collection:** they pin community servers on their /mcp page periodically; submit by tagging in a tweet

## Tracking adoption

After submission, monitor:
- npm weekly downloads at https://npmjs.com/package/@propertydna/mcp-server
- Smithery install button click count (their analytics)
- Referral traffic to thepropertydna.com from the directory pages (set utm_source=smithery / mcp_so / awesome_mcp)

If we hit 100 weekly npm downloads in the first 30 days, we're on the right track. 1000+ is breakout.

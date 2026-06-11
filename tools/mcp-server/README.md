# @propertydna/mcp-server

**PropertyDNA inside Claude Desktop, Cursor, Cline, or any MCP-aware AI client.**

The first property-intelligence MCP server. Ask your AI assistant to "run a DNA report on 1234 Main St" or "find comps near 40380 Tonopah Rd" or "check the flood zone on this Florida address" and get a real answer pulled from PropertyDNA's 3.58M-parcel index — with valuation, comps, flood-zone designation, permit history, and a buy/hold/walk verdict.

## Why this exists

> The data your real estate agent doesn't want you to see — now inside your AI.

PropertyDNA is the institutional-grade property intelligence platform homebuyers were never supposed to have. We index 3.58M parcels across 9 states. The web app + iOS app are free. This MCP server brings the same intelligence to your AI session, so you can investigate a property without leaving the chat.

## What it does

| Tool | What it returns |
|---|---|
| `get_dna_report` | Full DNA score + valuation + risk + comp summary for an address |
| `find_comps` | Every comparable sale in a radius — not a cherry-picked 3-comp CMA |
| `check_flood_zone` | FEMA NFHL designation including post-Helene/Milton revisions |
| `find_off_market` | Long-tenured-owner properties matching a buyer profile |
| `query_dossier` | Verified architect + celebrity provenance dossiers |
| `get_market_heat` | Live market data for a city / zip / metro |

## Install in Claude Desktop

1. Install Node 18+ (one-time)
2. Edit your Claude Desktop config:

   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

3. Add the `propertydna` MCP server:

   ```json
   {
     "mcpServers": {
       "propertydna": {
         "command": "npx",
         "args": ["-y", "@propertydna/mcp-server"]
       }
     }
   }
   ```

4. Restart Claude Desktop. The `propertydna` tools will appear in the connector list.

## Install in Cursor

Settings → MCP → Add new server:

- Name: `propertydna`
- Command: `npx`
- Args: `-y @propertydna/mcp-server`

## Install in Cline / Continue / other MCP clients

Same pattern — point the client at the published npm package.

## Try it

Ask your AI:

> "Run a DNA report on 40380 Tonopah Rd, Rancho Mirage CA 92270"
>
> "Find comps within half a mile of 70629 Boothill Rd, Rancho Mirage CA"
>
> "What's the flood zone on 88 Brickell Ave, Miami FL 33131?"
>
> "Find off-market opportunities in Rancho Mirage CA, 3-4 beds, $2M-$4M, long-tenured owners"
>
> "Show me verified William Cody architecture in Palm Springs"
>
> "What's the heat map look like for Scottsdale AZ?"

## Privacy + cost

- The server makes HTTPS calls to `thepropertydna.com` (public API)
- No data leaves your machine besides the address/query you ask about
- No login required for read-only intelligence tools
- Free, forever — same as the iOS app and the web

## Configuration

Override the API base (for testing against staging):

```json
{
  "mcpServers": {
    "propertydna": {
      "command": "npx",
      "args": ["-y", "@propertydna/mcp-server"],
      "env": {
        "PROPERTYDNA_API_BASE": "https://staging.thepropertydna.com"
      }
    }
  }
}
```

## Develop locally

```bash
git clone https://github.com/Stuartteamps/propertydna-landing
cd propertydna-landing/tools/mcp-server
npm install
npm run dev        # starts the server in TS-watch mode
# In Claude Desktop config, point at the local file:
#   "command": "node",
#   "args": ["/absolute/path/to/dist/index.js"]
```

## Publish a new version

```bash
cd tools/mcp-server
npm version patch
npm run build
npm publish --access public
```

## License

MIT — use it freely.

## The mission

PropertyDNA exists to defend homebuyers from information asymmetry. Every real estate agent has data the buyer doesn't. Every AI assistant should have it too — yours, on your side of the table, the moment you ask.

🏠 Save the humans.

— Dan Stuart, PropertyDNA · [thepropertydna.com](https://thepropertydna.com)

#!/usr/bin/env node
/**
 * @propertydna/mcp-server
 *
 * MCP server exposing PropertyDNA intelligence tools to any MCP-aware AI
 * client (Claude Desktop, Cursor, Cline, Windsurf, ChatGPT GPTs via shim).
 *
 * Tools exposed:
 *   - get_dna_report      Run a full PropertyDNA report on an address
 *   - find_comps          Comparable sales (radius + price band)
 *   - check_flood_zone    FEMA NFHL designation for an address
 *   - find_off_market     Long-tenured-owner matches near a subject
 *   - query_dossier       Verified luxury provenance dossier lookup
 *   - get_market_heat     Heat map slice for a city/zip/metro
 *
 * Run:
 *   npx @propertydna/mcp-server
 *
 * Configure in Claude Desktop:
 *   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   {
 *     "mcpServers": {
 *       "propertydna": {
 *         "command": "npx",
 *         "args": ["-y", "@propertydna/mcp-server"]
 *       }
 *     }
 *   }
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API_BASE = process.env.PROPERTYDNA_API_BASE || "https://thepropertydna.com";

// ── Tool schemas (Zod for validation + JSON Schema for MCP) ──────────────

const GetDnaReportArgs = z.object({
  address: z.string().min(5).describe("Full street address with city + state, e.g. '40380 Tonopah Rd, Rancho Mirage, CA 92270'"),
});

const FindCompsArgs = z.object({
  address: z.string().min(5).describe("Subject property address"),
  radius_mi: z.number().min(0.05).max(5).optional().default(0.5).describe("Search radius in miles (default 0.5)"),
  max_results: z.number().min(1).max(50).optional().default(10).describe("Max comps to return (default 10)"),
});

const CheckFloodZoneArgs = z.object({
  address: z.string().min(5).describe("Address to check FEMA NFHL designation for"),
});

const FindOffMarketArgs = z.object({
  city: z.string().min(2).describe("City name, e.g. 'Rancho Mirage'"),
  state: z.string().length(2).describe("Two-letter state code, e.g. 'CA'"),
  min_price: z.number().optional().describe("Minimum price band"),
  max_price: z.number().optional().describe("Maximum price band"),
  beds: z.number().optional().describe("Target bedroom count (±1 match)"),
  max_results: z.number().min(1).max(20).optional().default(5),
});

const QueryDossierArgs = z.object({
  query: z.string().min(2).describe("Search term — address, architect name (e.g. 'William Cody'), neighborhood, or notable owner"),
  tier: z.enum(["A", "B", "C", "D", "any"]).optional().default("any").describe("Pedigree tier filter (A = verified dossier, D = mid-century provenance)"),
  max_results: z.number().min(1).max(20).optional().default(5),
});

const GetMarketHeatArgs = z.object({
  geo: z.string().min(2).describe("City name OR 5-digit ZIP OR metro slug (e.g. 'Palm Springs', '92270', 'la-metro')"),
  geo_type: z.enum(["city", "zip", "metro"]).optional().default("city"),
});

// ── HTTP helper ──────────────────────────────────────────────────────────

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "PropertyDNA-MCP/0.1" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PropertyDNA API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Tool implementations ─────────────────────────────────────────────────

async function getDnaReport(args: z.infer<typeof GetDnaReportArgs>) {
  const data = await fetchJson(`/.netlify/functions/property-query?address=${encodeURIComponent(args.address)}`);
  return formatReport(data);
}

async function findComps(args: z.infer<typeof FindCompsArgs>) {
  const params = new URLSearchParams({
    address: args.address,
    radius_mi: String(args.radius_mi ?? 0.5),
    limit: String(args.max_results ?? 10),
  });
  const data = await fetchJson(`/.netlify/functions/property-query?${params.toString()}&mode=comps`);
  return formatComps(data);
}

async function checkFloodZone(args: z.infer<typeof CheckFloodZoneArgs>) {
  const data = await fetchJson(`/.netlify/functions/property-query?address=${encodeURIComponent(args.address)}&mode=flood`);
  return formatFlood(data);
}

async function findOffMarket(args: z.infer<typeof FindOffMarketArgs>) {
  const params = new URLSearchParams({ city: args.city, state: args.state });
  if (args.min_price) params.set("min_price", String(args.min_price));
  if (args.max_price) params.set("max_price", String(args.max_price));
  if (args.beds) params.set("beds", String(args.beds));
  params.set("limit", String(args.max_results ?? 5));
  const data = await fetchJson(`/api/dossiers/off-market?${params.toString()}`);
  return formatOffMarket(data);
}

async function queryDossier(args: z.infer<typeof QueryDossierArgs>) {
  const params = new URLSearchParams({ q: args.query, limit: String(args.max_results ?? 5) });
  if (args.tier && args.tier !== "any") params.set("tier", args.tier);
  const data = await fetchJson(`/api/dossiers?${params.toString()}`);
  return formatDossiers(data);
}

async function getMarketHeat(args: z.infer<typeof GetMarketHeatArgs>) {
  const data = await fetchJson(`/.netlify/functions/get-heatmap-parcels?geo=${encodeURIComponent(args.geo)}&geo_type=${args.geo_type}`);
  return formatHeatMap(data, args);
}

// ── Formatters — text output optimized for AI consumption ───────────────

function formatReport(d: any): string {
  if (!d || d.error) return `No PropertyDNA report available. ${d?.error || ""}`;
  const p = d.property || d;
  const v = d.valuation || p.valuation || {};
  const r = d.risk || p.risk || {};
  return [
    `## PropertyDNA Report — ${p.address || "subject property"}`,
    p.city ? `Location: ${p.city}, ${p.state} ${p.zip || ""}` : "",
    "",
    `### Valuation`,
    `DNA Score: ${v.dna_score ?? "n/a"} / 100  (confidence: ${v.confidence ?? "n/a"})`,
    `Estimated value: $${(v.estimate ?? p.current_estimated_value ?? 0).toLocaleString()} (range $${(v.low ?? 0).toLocaleString()} – $${(v.high ?? 0).toLocaleString()})`,
    v.drivers?.length ? `Key drivers: ${v.drivers.slice(0, 5).map((x: any) => x.label || x).join(", ")}` : "",
    "",
    `### Risk`,
    r.flood_zone ? `Flood zone: ${r.flood_zone}` : "",
    r.hazard_composite_score != null ? `Hazard composite: ${r.hazard_composite_score} (${r.hazard_rating || "n/a"})` : "",
    r.unfinaled_permits != null ? `Unfinaled permits: ${r.unfinaled_permits}` : "",
    "",
    `### Property`,
    `${p.beds ?? "?"} BR / ${p.baths ?? "?"} BA / ${p.sqft ? Number(p.sqft).toLocaleString() : "?"} sqft  ·  built ${p.year_built ?? "?"}`,
    p.last_sale_price ? `Last sale: $${Number(p.last_sale_price).toLocaleString()} (${p.last_sale_date || "?"})` : "",
    "",
    `Full report: ${API_BASE}/property-dna?address=${encodeURIComponent(p.address || "")}`,
  ].filter(Boolean).join("\n");
}

function formatComps(d: any): string {
  const comps = d?.comps || d?.results || (Array.isArray(d) ? d : []);
  if (!comps.length) return "No comparable sales found for that radius. Try widening with radius_mi.";
  return [
    `## ${comps.length} comparable sales`,
    "",
    ...comps.slice(0, 20).map((c: any, i: number) =>
      `${i + 1}. **${c.address}** — $${Number(c.sale_price || c.price || 0).toLocaleString()} (${c.sale_date || "n/a"}) · ${c.beds ?? "?"}BR/${c.baths ?? "?"}BA · ${c.sqft ? Number(c.sqft).toLocaleString() + " sqft" : "?"} · ${c.distance_mi != null ? c.distance_mi + " mi" : ""}`
    ),
  ].join("\n");
}

function formatFlood(d: any): string {
  const f = d?.flood || d?.risk?.flood || d;
  if (!f) return "Flood zone data not available for that address.";
  return [
    `## FEMA Flood Zone — ${d?.address || "subject"}`,
    "",
    `Zone designation: **${f.zone || f.flood_zone || "n/a"}**`,
    f.base_flood_elevation ? `Base flood elevation: ${f.base_flood_elevation} ft` : "",
    f.in_sfha != null ? `In Special Flood Hazard Area: ${f.in_sfha ? "YES — lender will require flood insurance" : "no"}` : "",
    f.revised_since ? `Designation revised: ${f.revised_since} (post-Helene/Milton update applied)` : "",
    f.nfip_estimate ? `Estimated NFIP premium: $${Number(f.nfip_estimate).toLocaleString()} / yr` : "",
  ].filter(Boolean).join("\n");
}

function formatOffMarket(d: any): string {
  const list = d?.matches || d?.results || (Array.isArray(d) ? d : []);
  if (!list.length) return "No off-market matches found for that profile.";
  return [
    `## ${list.length} off-market opportunities (long-tenured owners matching profile)`,
    "",
    ...list.map((m: any, i: number) =>
      `${i + 1}. **${m.address}** — ${m.city || ""} ${m.state || ""} · ${m.beds ?? "?"}BR/${m.baths ?? "?"}BA · ${m.sqft ? Number(m.sqft).toLocaleString() + " sqft" : "?"}\n   Last sold ${m.last_sale_date || "?"}${m.last_sale_price ? ` for $${Number(m.last_sale_price).toLocaleString()}` : ""} · est. value $${Number(m.estimated_value || 0).toLocaleString()}\n   ${m.dossier_url || ""}`
    ),
  ].join("\n");
}

function formatDossiers(d: any): string {
  const list = d?.dossiers || (Array.isArray(d) ? d : []);
  if (!list.length) return "No dossier matches.";
  return [
    `## ${list.length} verified provenance dossiers`,
    "",
    ...list.map((x: any, i: number) =>
      `${i + 1}. **${x.address || x.name}** — Tier ${x.tier || "?"}\n   ${x.architect ? `Architect: ${x.architect}` : ""}${x.architect && x.notable_owner ? "  ·  " : ""}${x.notable_owner ? `Notable: ${x.notable_owner}` : ""}\n   ${x.summary || x.description || ""}\n   ${x.url || ""}`
    ),
  ].join("\n");
}

function formatHeatMap(d: any, args: any): string {
  const tiles = d?.parcels || d?.tiles || (Array.isArray(d) ? d : []);
  const summary = d?.summary || {};
  return [
    `## Market heat — ${args.geo} (${args.geo_type})`,
    summary.median_price ? `Median price: $${Number(summary.median_price).toLocaleString()}` : "",
    summary.appreciation_rate_yoy != null ? `YoY change: ${summary.appreciation_rate_yoy > 0 ? "↑" : "↓"} ${Math.abs(summary.appreciation_rate_yoy).toFixed(1)}%` : "",
    summary.demand_score != null ? `Demand score: ${summary.demand_score} / 100` : "",
    summary.median_dom != null ? `Median days on market: ${summary.median_dom}` : "",
    "",
    tiles.length ? `${tiles.length} parcels in the heat tile.` : "",
    `Live map: ${API_BASE}/market-heatmaps`,
  ].filter(Boolean).join("\n");
}

// ── MCP server boilerplate ───────────────────────────────────────────────

const server = new Server(
  { name: "propertydna", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  { name: "get_dna_report",   description: "Run a full PropertyDNA report on any address — valuation with DNA score, risk signals, comparable trajectory, permit history, and a buy/hold/walk verdict. Indexed 3.58M parcels across AZ, CA, NV, WA, TX, CT, FL, NY.", inputSchema: zodToJsonSchema(GetDnaReportArgs) },
  { name: "find_comps",       description: "Find comparable sales near a subject property. Returns every comp in the radius — not a cherry-picked 3-comp CMA. Algorithm pulls within ±15% sqft, similar beds/baths, within last 90-180 days.", inputSchema: zodToJsonSchema(FindCompsArgs) },
  { name: "check_flood_zone", description: "FEMA NFHL flood-zone designation for an address — including post-Helene/Milton revised AE designations. Tells you whether a lender will require flood insurance and the estimated NFIP premium.", inputSchema: zodToJsonSchema(CheckFloodZoneArgs) },
  { name: "find_off_market",  description: "Find long-tenured-owner properties in a target city/state matching a price/bed profile. These aren't listed publicly — they're the off-market opportunities the algorithm flags from the sovereign parcel index.", inputSchema: zodToJsonSchema(FindOffMarketArgs) },
  { name: "query_dossier",    description: "Search the PropertyDNA luxury provenance database — verified architect attributions (Cody, Neutra, Wexler, Lautner, Cliff May, etc.), celebrity-owned estates, historic enclaves (Thunderbird, Vista Las Palmas, Movie Colony, Bel Air, Trousdale). 92 verified Tier-A dossiers + 16,788 pedigree-classified across 9 states.", inputSchema: zodToJsonSchema(QueryDossierArgs) },
  { name: "get_market_heat",  description: "Live market intelligence for a city/zip/metro — median price, YoY appreciation, days-on-market trend, demand score. Pulled from market_snapshots + market_ticker.", inputSchema: zodToJsonSchema(GetMarketHeatArgs) },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  try {
    let text: string;
    switch (name) {
      case "get_dna_report":   text = await getDnaReport(GetDnaReportArgs.parse(rawArgs)); break;
      case "find_comps":       text = await findComps(FindCompsArgs.parse(rawArgs)); break;
      case "check_flood_zone": text = await checkFloodZone(CheckFloodZoneArgs.parse(rawArgs)); break;
      case "find_off_market":  text = await findOffMarket(FindOffMarketArgs.parse(rawArgs)); break;
      case "query_dossier":    text = await queryDossier(QueryDossierArgs.parse(rawArgs)); break;
      case "get_market_heat":  text = await getMarketHeat(GetMarketHeatArgs.parse(rawArgs)); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error calling ${name}: ${msg}` }], isError: true };
  }
});

// Convert Zod schema to JSON Schema (minimal — MCP just needs shape + descriptions)
function zodToJsonSchema(schema: z.ZodObject<any>): Record<string, any> {
  const shape = (schema as any)._def.shape();
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape) as Array<[string, any]>) {
    const def = value._def;
    let type = "string";
    let enumValues: string[] | undefined;
    if (def.typeName === "ZodNumber") type = "number";
    else if (def.typeName === "ZodBoolean") type = "boolean";
    else if (def.typeName === "ZodEnum") { type = "string"; enumValues = def.values; }
    properties[key] = { type, description: def.description || value.description || "" };
    if (enumValues) properties[key].enum = enumValues;
    if (!value.isOptional()) required.push(key);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

// ── Run ──────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`PropertyDNA MCP server v0.1.0 — listening on stdio, API: ${API_BASE}`);

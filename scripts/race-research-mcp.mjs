#!/usr/bin/env node

// Minimal local MCP server for the race-research pipeline. It intentionally
// has no third-party dependency: the scraper can run on a clean Node install.
// stdout is reserved for JSON-RPC; diagnostics go to stderr.
import { fetchPage, searchFieldContexts } from "./enrich-format-import-queue.mjs";
import { parseGpx } from "./research-format-catalog.mjs";
import { isUnsafeResearchUrl } from "./catalog-research-contract.mjs";

const tools = [
  {
    name: "crawl_source",
    description: "Fetch an official or secondary race source and its prioritized linked pages.",
    inputSchema: { type: "object", additionalProperties: false, required: ["url"], properties: {
      url: { type: "string", description: "Source URL" },
      event_name: { type: "string" }, format_name: { type: "string" }, distance_km: { type: ["string", "number"] },
      target_edition_year: { type: "string" }, city: { type: "string" }, prospect_city: { type: "string" }, country: { type: "string" },
      min_event_date: { type: "string" }, max_event_date: { type: "string" },
      missing_fields: { type: "string" }, search_depth: { type: "string", enum: ["normal", "deep"] },
      race_url: { type: "string" },
    } },
  },
  {
    name: "fetch_page",
    description: "Fetch one page and return bounded text/HTML for local deterministic extraction.",
    inputSchema: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string" }, max_chars: { type: "number" } } },
  },
  {
    name: "search_page",
    description: "Search one page for evidence windows for requested catalog fields and format.",
    inputSchema: { type: "object", additionalProperties: false, required: ["url", "fields"], properties: {
      url: { type: "string" }, fields: { type: "array", items: { type: "string" } },
      event_name: { type: "string" }, format_name: { type: "string" }, distance_km: { type: ["string", "number"] },
    } },
  },
  {
    name: "parse_gpx",
    description: "Parse a GPX payload and return distance, elevation, altitude, coordinates and waypoints.",
    inputSchema: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string" } } },
  },
  {
    name: "download_and_parse_gpx",
    description: "Download a GPX URL and parse its metrics locally.",
    inputSchema: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string" } } },
  },
];

const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
const failure = (id, message) => reply(id, { isError: true, content: [{ type: "text", text: message }] });
const success = (id, value) => reply(id, { content: [{ type: "text", text: JSON.stringify(value) }] });
const argsObject = (params) => (params && typeof params.arguments === "object" ? params.arguments : (params || {}));

const callTool = async (name, args) => {
  if (["fetch_page", "search_page"].includes(name) && isUnsafeResearchUrl(String(args.url || ""))) {
    throw new Error("URL excluded from race research: participant list, results, export or administration path");
  }
  if (name === "crawl_source") {
    const result = await fetchPage(String(args.url), {
      event_name: String(args.event_name || ""),
      format_name: String(args.format_name || ""),
      distance_km: args.distance_km === undefined ? "" : String(args.distance_km),
      target_edition_year: String(args.target_edition_year || ""),
      city: String(args.city || ""), prospect_city: String(args.prospect_city || ""), country: String(args.country || ""),
      min_event_date: String(args.min_event_date || ""), max_event_date: String(args.max_event_date || ""),
      missing_fields: String(args.missing_fields || ""),
      search_depth: String(args.search_depth || "normal"),
      race_url: String(args.race_url || ""),
    });
    return {
      url: args.url,
      html: result.html,
      urls: result.urls,
      page_catalog: result.page_catalog || [],
      pages: result.pages || [],
      errors: result.errors || [],
      resolved_url: result.resolved_url || args.url,
      discovered_from: result.discovered_from || "",
      discovery_method: result.discovery_method || "",
      field_contexts: searchFieldContexts(result.html, args, String(args.missing_fields || "").split(";").filter(Boolean)),
    };
  }
  if (name === "fetch_page") {
    const response = await fetch(String(args.url), { signal: AbortSignal.timeout(12_000), headers: { "user-agent": "PaceYourself-RaceResearch-MCP/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    const maxChars = Math.min(250_000, Math.max(1_000, Number(args.max_chars || 250_000)));
    return { url: args.url, status: response.status, contentType: response.headers.get("content-type") || "", body: body.slice(0, maxChars), truncated: body.length > maxChars };
  }
  if (name === "search_page") {
    const response = await fetch(String(args.url), { signal: AbortSignal.timeout(12_000), headers: { "user-agent": "PaceYourself-RaceResearch-MCP/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return {
      url: args.url,
      fields: searchFieldContexts(body, args, Array.isArray(args.fields) ? args.fields : []),
    };
  }
  if (name === "parse_gpx") return parseGpx(String(args.content));
  if (name === "download_and_parse_gpx") {
    const response = await fetch(String(args.url), { signal: AbortSignal.timeout(12_000), headers: { accept: "application/gpx+xml,text/xml,application/xml" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { url: args.url, ...parseGpx(await response.text()) };
  }
  throw new Error(`Unknown tool: ${name}`);
};

const handle = async (message) => {
  const { id, method, params } = message;
  if (!method || id === undefined) return;
  if (method === "initialize") {
    return reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "paceyourself-race-research", version: "1.0.0" } });
  }
  if (method === "tools/list") return reply(id, { tools });
  if (method === "tools/call") {
    try { return success(id, await callTool(String(params?.name || ""), argsObject(params))); }
    catch (error) { return failure(id, error instanceof Error ? error.message : String(error)); }
  }
  return failure(id, `Unsupported method: ${method}`);
};

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try { void handle(JSON.parse(line)); } catch (error) { process.stderr.write(`MCP invalid request: ${error}\n`); }
  }
});

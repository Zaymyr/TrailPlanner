#!/usr/bin/env node

// Normalizes route references found in race pages (OpenRunner IDs/URLs and
// generic UTMB/official route pages) into reviewable route metrics. This tool
// never treats page metrics as an official race-format claim by itself.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TIMEOUT_MS = 15_000;
const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const normalizeRouteReference = (value) => {
  const raw = compact(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const openRunnerId = raw.match(/openrunner\s*(?:n(?:°|o|º)?\s*)?(\d{5,})/i)?.[1];
  if (openRunnerId) return `https://www.openrunner.com/route-details/${openRunnerId}`;
  return raw;
};

const parseJsonLd = (html) => [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
  try {
    const value = JSON.parse(match[1]);
    return Array.isArray(value) ? value : [value];
  } catch { return []; }
});

const jsonLdPropertyMap = (record) => Object.fromEntries((record?.additionalProperty || [])
  .filter((property) => property && property.name !== undefined)
  .map((property) => [compact(property.name).toLowerCase(), property.value]));

const numberFrom = (value) => {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return numberFrom(match[1]);
  }
  return null;
};

export const parseRoutePage = (html, url) => {
  const records = parseJsonLd(html);
  const record = records.find((item) => item && (item.additionalProperty || item.distance || item.name));
  const properties = jsonLdPropertyMap(record);
  const text = compact(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const title = compact(record?.name || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const source = /openrunner\.com/i.test(url) ? "openrunner" : /utmb\./i.test(url) ? "utmb" : "route_page";
  const distanceRaw = properties.distance ?? record?.distance;
  const distanceNumber = numberFrom(distanceRaw);
  const distanceKm = distanceNumber === null ? firstNumber(text, [/(?:distance|distance totale)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*km/i]) : (distanceNumber > 1000 ? distanceNumber / 1000 : distanceNumber);
  const elevationGainM = numberFrom(properties["dénivelé +"] ?? properties["denivele +"] ?? properties["elevation gain"])
    ?? firstNumber(text, [/(?:d[ée]nivel[ée]|elevation|elevaci[oó]n)\s*\+?\s*[:：]?\s*(\d[\d\s.,]*)\s*m/i]);
  const elevationLossM = numberFrom(properties["dénivelé -"] ?? properties["denivele -"] ?? properties["elevation loss"])
    ?? firstNumber(text, [/(?:d[ée]nivel[ée]|elevation)\s*-\s*[:：]?\s*(\d[\d\s.,]*)\s*m/i]);
  const altitudeMinM = numberFrom(properties["altitude minimale"] ?? properties["altitude min"]);
  const altitudeMaxM = numberFrom(properties["altitude maximale"] ?? properties["altitude max"]);
  const location = compact(record?.location?.name || record?.location?.address?.addressLocality || properties.location || "");
  return {
    source,
    route_url: url,
    name: title,
    location,
    distance_km: distanceKm,
    elevation_gain_m: elevationGainM,
    elevation_loss_m: elevationLossM,
    altitude_min_m: altitudeMinM,
    altitude_max_m: altitudeMaxM,
    metrics_status: distanceKm !== null || elevationGainM !== null ? "metrics_found" : "metrics_missing",
    trace_status: /<gpx\b/i.test(html) ? "gpx_payload" : "route_page_metrics",
  };
};

export const fetchAndParseRoute = async (reference, fetchImpl = fetch) => {
  const url = normalizeRouteReference(reference);
  if (!url) return { source: "unknown", route_url: "", metrics_status: "missing_reference" };
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return { source: "unknown", route_url: url, metrics_status: "invalid_url" }; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(parsedUrl.href, { signal: controller.signal, headers: { accept: "text/html,application/json,application/gpx+xml,text/xml", "user-agent": "PaceYourself-RouteParser/1.0" } });
    if (!response.ok) return { source: /openrunner\.com/i.test(parsedUrl.hostname) ? "openrunner" : /utmb\./i.test(parsedUrl.hostname) ? "utmb" : "route_page", route_url: parsedUrl.href, metrics_status: "http_error", http_status: response.status };
    return parseRoutePage(await response.text(), parsedUrl.href);
  } catch (error) {
    return { source: /openrunner\.com/i.test(parsedUrl.hostname) ? "openrunner" : /utmb\./i.test(parsedUrl.hostname) ? "utmb" : "route_page", route_url: parsedUrl.href, metrics_status: error?.name === "AbortError" ? "timeout" : "fetch_error", error: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timer); }
};

const parseArgs = (argv) => {
  const args = { references: [], input: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const next = argv[index + 1];
    if (arg === "--url" || arg === "--reference") { args.references.push(next); index += 1; continue; }
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--output") { args.output = next; index += 1; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!args.references.length && !args.input) throw new Error("--url/--reference ou --input est requis.");
  return args;
};

export const run = async (argv = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  let references = [...args.references];
  if (args.input) references.push(...(await readFile(args.input, "utf8")).split(/\r?\n/).map(compact).filter(Boolean));
  const results = [];
  for (const reference of references) {
    const result = await fetchAndParseRoute(reference);
    results.push({ reference, ...result });
    console.error(`${reference} -> ${result.metrics_status}${result.distance_km ? ` | ${result.distance_km} km` : ""}${result.elevation_gain_m ? ` | D+ ${result.elevation_gain_m} m` : ""}`);
  }
  const payload = JSON.stringify(results, null, 2);
  if (args.output) await writeFile(args.output, payload, "utf8");
  else console.log(payload);
  return results;
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

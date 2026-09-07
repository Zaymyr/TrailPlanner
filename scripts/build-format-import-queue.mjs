#!/usr/bin/env node

// Builds a format-level research queue from either the BeTrail scraper CSV or
// an export of the Prospects tab. It never writes Supabase and never treats an
// extrapolated outreach date as a verified race date.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { parseCsvTable, serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";
import { parseResearchDate, classifySourceUrl } from "./catalog-research-contract.mjs";

export const FORMAT_QUEUE_HEADERS = [
  "research_schema_version", "target_edition_year", "campaign_as_of", "min_event_date", "field_provenance_json", "research_errors_json",
  "prospect_distance_km", "prospect_elevation_gain_m", "gpx_verified_fields", "gpx_previous_values_json", "gpx_sha256",
  "format_key", "prospect_uuid", "event_name", "format_name", "official_format_name", "format_raw",
  "race_url", "official_website", "city", "country", "candidate_event_date",
  "source_role", "source_quality",
  "event_date_basis", "priority_date", "prospect_date", "prospect_city", "prospect_country",
  "official_date", "official_location", "official_distance_km", "official_source_url",
  "distance_km", "elevation_gain_m",
  "format_location", "event_end_date", "format_start_time", "format_end_time",
  "elevation_loss_m", "altitude_min_m", "altitude_max_m", "latitude", "longitude", "maps_url",
  "participation_mode", "gpx_url", "aid_stations_json", "cutoff_times_json", "mandatory_equipment",
  "gpx_status", "gpx_distance_km", "gpx_elevation_gain_m", "gpx_elevation_loss_m", "gpx_altitude_min_m", "gpx_altitude_max_m", "gpx_error",
  "bib_pickup_json", "access_json", "parking_json", "shuttle_json", "services_json",
  "event_social_links_json", "event_contact_json", "event_details_json", "source_pages_json",
  "candidate_mandatory_complete", "coverage_pct", "verified_pct", "missing_fields", "required_fields_status_json",
  "research_status", "date_source_url", "location_source_url", "distance_source_url",
  "elevation_source_url", "evidence_summary", "field_evidence_json", "llm_context_summary", "llm_confidence",
  "page_catalog_json", "page_map_json",
  "verified_fields", "unverified_fields", "conflict_fields", "verification_alert", "rejected_claims_json", "crawl_transport",
  "ready_to_import", "supabase_import_status",
];

const aliases = {
  id: ["prospect_uuid", "uuid"],
  eventName: ["event_name", "race_name", "Organization name"],
  raceUrl: ["race_url", "Organization website"],
  officialWebsite: ["official_website"],
  formats: ["formats_raw"],
  city: ["city", "Organization city"],
  country: ["country", "Organization country"],
  exactDate: ["date", "event_date_verified", "overloop_event_date_safe", "outreach_event_date"],
  planningDate: ["priority_date", "outreach_planning_date", "outreach_event_date", "next_event_date"],
  dateBasis: ["event_date_basis", "overloop_event_date_basis"],
  dateSource: ["event_date_source_url", "next_event_date_source_url"],
};

const valueFor = (row, names) => {
  for (const name of names) {
    const value = String(row[name] ?? "").trim();
    if (value) return value;
  }
  return "";
};

const parseDate = value => parseResearchDate(value, { spreadsheet: true });

const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
};

const parseNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseFormatText = (raw) => {
  const formats = String(raw ?? "").split(";").map((entry) => entry.trim()).filter(Boolean);
  return formats.map((entry, index) => {
    const distanceMatch = entry.match(/(\d+(?:[.,]\d+)?)\s*km/i);
    const elevationMatch = entry.match(/(\d+(?:[.,]\d+)?)\s*d\s*\+/i);
    const distanceKm = distanceMatch ? parseNumber(distanceMatch[1]) : null;
    const elevationGainM = elevationMatch ? parseNumber(elevationMatch[1]) : null;
    const formatName = entry
      .replace(/\s*\/\s*[^/]*d\s*\+.*$/i, "")
      .replace(/\s*\/.*$/, "")
      .trim() || `Format ${index + 1}`;
    return { entry, formatName, distanceKm, elevationGainM };
  });
};

const sha = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const isExactDate = (basis) => /date\s+exacte/i.test(String(basis));
const isFilled = (value) => String(value ?? "").trim().length > 0;
const coverageFor = ({ candidateEventDate, city, country, distanceKm, elevationGainM, officialWebsite, formatName }) => {
  const fields = [
    [isFilled(candidateEventDate), 2],
    [isFilled(city) && isFilled(country), 2],
    [distanceKm !== null, 2],
    [elevationGainM !== null, 2],
    [isFilled(officialWebsite), 1],
    [isFilled(formatName), 1],
  ];
  return Math.round((fields.filter(([present]) => present).reduce((sum, [, weight]) => sum + weight, 0) / 10) * 100);
};

const missingFor = ({ candidateEventDate, city, country, distanceKm, elevationGainM }) => [
  !isFilled(candidateEventDate) && "race_date",
  (!isFilled(city) || !isFilled(country)) && "location",
  distanceKm === null && "distance_km",
  elevationGainM === null && "elevation_gain_m",
].filter(Boolean).join(";");

export const buildFormatQueue = (rows, { asOf = new Date().toISOString().slice(0, 10), minDaysBefore = 0, limit = null, offset = 0, onExcluded = () => {} } = {}) => {
  if (!parseDate(asOf) || !Number.isInteger(minDaysBefore) || minDaysBefore < 0 || !Number.isInteger(offset) || offset < 0 || (limit !== null && (!Number.isInteger(limit) || limit < 1))) throw new Error("Paramètres de campagne invalides.");
  const minStartDate = Number(minDaysBefore) > 0 ? addDays(asOf, Number(minDaysBefore)) : "";
  const queue = [];
  for (const row of rows) {
    const eventName = valueFor(row, aliases.eventName);
    const raceUrl = valueFor(row, aliases.raceUrl);
    const exclude = reason => onExcluded({ prospect_uuid: valueFor(row, aliases.id), event_name: eventName, race_url: raceUrl, reason });
    if (!eventName || !raceUrl) { exclude("missing_event_identity"); continue; }
    const officialWebsite = valueFor(row, aliases.officialWebsite);
    const sourceClassification = classifySourceUrl(officialWebsite);
    const city = valueFor(row, aliases.city);
    const country = valueFor(row, aliases.country);
    const dateBasis = valueFor(row, aliases.dateBasis);
    const exactDate = isExactDate(dateBasis) || (!dateBasis && row.date) ? parseDate(valueFor(row, aliases.exactDate)) : "";
    const priorityDate = exactDate || aliases.planningDate.map(name => parseDate(row[name])).find(Boolean) || "9999-12-31";
    if (exactDate && exactDate < asOf) { exclude("past_exact_date"); continue; }
    if (minStartDate && (priorityDate === "9999-12-31" || priorityDate < minStartDate)) { exclude(priorityDate === "9999-12-31" ? "missing_planning_date" : "before_campaign_window"); continue; }
    const formats = parseFormatText(valueFor(row, aliases.formats));
    if (!formats.length) exclude("missing_formats");
    formats.forEach((format, index) => {
      const candidateMandatoryComplete = Boolean(exactDate && city && country && format.distanceKm !== null && format.elevationGainM !== null);
      const coveragePct = coverageFor({ candidateEventDate: exactDate, city, country, ...format, officialWebsite });
      queue.push({
        research_schema_version: "", target_edition_year: priorityDate === "9999-12-31" ? "" : priorityDate.slice(0, 4),
        campaign_as_of: asOf, min_event_date: minStartDate || asOf, field_provenance_json: "{}", research_errors_json: "[]",
        prospect_distance_km: format.distanceKm === null ? "" : String(format.distanceKm),
        prospect_elevation_gain_m: format.elevationGainM === null ? "" : String(format.elevationGainM),
        format_key: `format-${sha(`${raceUrl}|${index}|${format.entry}`)}`,
        prospect_uuid: valueFor(row, aliases.id),
        event_name: eventName,
        format_name: format.formatName,
        format_raw: format.entry,
        race_url: raceUrl,
        official_website: officialWebsite,
        source_role: sourceClassification.role,
        source_quality: sourceClassification.quality,
        city,
        country,
        candidate_event_date: exactDate,
        event_date_basis: dateBasis,
        priority_date: priorityDate,
        prospect_date: exactDate,
        prospect_city: city,
        prospect_country: country,
        official_date: "",
        official_location: "",
        official_distance_km: "",
        official_source_url: "",
        distance_km: format.distanceKm === null ? "" : String(format.distanceKm),
        elevation_gain_m: format.elevationGainM === null ? "" : String(format.elevationGainM),
        format_location: "",
        event_end_date: "",
        format_start_time: "",
        format_end_time: "",
        elevation_loss_m: "",
        altitude_min_m: "",
        altitude_max_m: "",
        latitude: "",
        longitude: "",
        maps_url: "",
        participation_mode: "",
        gpx_url: "",
        aid_stations_json: "",
        cutoff_times_json: "",
        mandatory_equipment: "",
        gpx_status: "not_processed",
        gpx_distance_km: "",
        gpx_elevation_gain_m: "",
        gpx_elevation_loss_m: "",
        gpx_altitude_min_m: "",
        gpx_altitude_max_m: "",
        gpx_error: "",
        bib_pickup_json: "",
        access_json: "",
        parking_json: "",
        shuttle_json: "",
        services_json: "",
        event_social_links_json: "",
        event_contact_json: "",
        event_details_json: "",
        source_pages_json: officialWebsite ? JSON.stringify([officialWebsite]) : "[]",
        candidate_mandatory_complete: candidateMandatoryComplete ? "TRUE" : "FALSE",
        coverage_pct: String(coveragePct),
        verified_pct: "0",
        missing_fields: missingFor({ candidateEventDate: exactDate, city, country, ...format }),
        required_fields_status_json: JSON.stringify({ race_date: exactDate ? "candidate" : "missing", location: city && country ? "candidate" : "missing", distance_km: format.distanceKm === null ? "missing" : "candidate", elevation_gain_m: format.elevationGainM === null ? "missing" : "candidate" }),
        research_status: candidateMandatoryComplete ? "review_required" : "needs_enrichment",
        date_source_url: valueFor(row, aliases.dateSource),
        location_source_url: "",
        distance_source_url: raceUrl,
        elevation_source_url: raceUrl,
        evidence_summary: "Prospect candidate; source verification required.",
        field_evidence_json: "{}",
        llm_context_summary: "",
        llm_confidence: "",
        verified_fields: "",
        unverified_fields: "",
        conflict_fields: "",
        verification_alert: "Donnée non vérifiée : enrichissement à effectuer.",
        rejected_claims_json: "[]",
        crawl_transport: "not_run",
        ready_to_import: "FALSE",
        supabase_import_status: "not_imported",
      });
    });
  }
  const sourceRank = (row) => row.source_role === "official_candidate" ? 0 : row.source_role === "registration_or_aggregator" ? 1 : 2;
  const dateConfidenceRank = (row) => isExactDate(row.event_date_basis) ? 0 : 1;
  queue.sort((left, right) => sourceRank(left) - sourceRank(right)
    || right.candidate_mandatory_complete.localeCompare(left.candidate_mandatory_complete)
    || dateConfidenceRank(left) - dateConfidenceRank(right)
    || left.priority_date.localeCompare(right.priority_date)
    || Number(right.coverage_pct) - Number(left.coverage_pct)
    || left.event_name.localeCompare(right.event_name, "fr"));
  // A first paid batch should cover many events instead of spending its whole
  // budget on every format of the first multi-format event. Keep the sorted
  // priority inside each event, then take one row per event in round-robin.
  const groups = new Map();
  for (const row of queue) {
    const key = `${row.race_url}|${row.priority_date}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  const selected = [];
  const selectionEnd = limit === null ? Infinity : limit + offset;
  while (selected.length < selectionEnd) {
    let added = false;
    for (const group of groups.values()) {
      if (group.length && selected.length < selectionEnd) {
        selected.push(group.shift());
        added = true;
      }
    }
    if (!added) break;
  }
  return selected.slice(offset, limit === null ? undefined : offset + limit);
};

const parseArgs = (argv) => {
  const args = { input: null, output: null, asOf: new Date().toISOString().slice(0, 10), minDaysBefore: 0, limit: null, offset: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--output") { args.output = next; index += 1; continue; }
    if (arg === "--as-of") { args.asOf = next; index += 1; continue; }
    if (arg === "--min-days-before") { args.minDaysBefore = Number(next); index += 1; continue; }
    if (arg === "--limit") { args.limit = Number(next); index += 1; continue; }
    if (arg === "--offset") { args.offset = Number(next); index += 1; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!args.input) throw new Error("--input est requis.");
  if (!args.output) args.output = args.input.replace(/\.csv$/i, "") + "-formats.csv";
  return args;
};

export const run = async (argv = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  const input = await readFile(args.input, "utf8");
  const table = parseCsvTable(input);
  const rows = buildFormatQueue(table.rows, { asOf: args.asOf, minDaysBefore: args.minDaysBefore, limit: args.limit, offset: args.offset });
  await writeFile(args.output, serializeCsvTable(FORMAT_QUEUE_HEADERS, rows), "utf8");
  console.error(`Queue formats : ${rows.length} ligne(s) écrite(s) dans ${args.output}.`);
  return rows;
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

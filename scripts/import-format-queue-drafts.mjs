#!/usr/bin/env node

// Imports only source-backed rows marked ready_to_import by the local format
// queue. It groups formats back into one admin API request per event and keeps
// the API idempotency/draft rules as the final safety boundary.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parseCsvTable } from "./prepare-betrail-outreach-csv.mjs";

import { RESEARCH_SCHEMA_VERSION, FIELD_COLUMNS, REQUIRED_FIELDS, verifiedValue, jsonValue } from "./catalog-research-contract.mjs";
import { refreshImportReadiness } from "./catalog-research-validation.mjs";

const parseArgs = (argv) => {
  const args = { input: null, baseUrl: process.env.ADMIN_API_BASE_URL || "", token: process.env.ADMIN_ACCESS_TOKEN || "", dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--base-url") { args.baseUrl = next; index += 1; continue; }
    if (arg === "--token") { args.token = next; index += 1; continue; }
    if (arg === "--dry-run") { args.dryRun = true; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!args.input) throw new Error("--input est requis.");
  if (!args.dryRun && (!args.baseUrl || !args.token)) throw new Error("--base-url et --token sont requis, sauf avec --dry-run.");
  return args;
};

export const buildDraftRequests = (rows, {asOf = new Date().toISOString().slice(0,10), onRejected = () => {}} = {}) => {
  const groups = new Map();
  for (const input of rows) {
    const row = {...input}; refreshImportReadiness(row);
    const reject = reason => onRejected({format_key:row.format_key,event_name:row.event_name,reason});
    if (row.research_schema_version !== RESEARCH_SCHEMA_VERSION) {reject('legacy_schema_requires_new_research'); continue;}
    if (row.ready_to_import !== 'TRUE' || !row.race_url || !row.event_name) {reject('unverified_required_fields'); continue;}
    const date = verifiedValue(row,'race_date');
    if (date < asOf) {reject('past_verified_date'); continue;}
    const fields = Object.fromEntries(Object.keys(FIELD_COLUMNS).filter(field=>verifiedValue(row,field)!==undefined).map(field=>[field,String(row[FIELD_COLUMNS[field]])]));
    const provenance = Object.fromEntries(Object.entries(jsonValue(row.field_provenance_json)).filter(([field])=>field in fields));
    const key = `${row.race_url}|${row.event_name}|${date}`;
    const group = groups.get(key) || {importKind:'catalog_research_v2',raceUrl:row.race_url,raceName:row.event_name,date,
      officialWebsite:row.official_website,locationText:fields.location,formats:[],formatLocations:new Set()};
    group.formatLocations.add(fields.location);
    group.formats.push({distance:`${fields.distance_km}km`,elevation:fields.elevation_gain_m===undefined ? '' : `${fields.elevation_gain_m} D+`,
      name:row.official_format_name || row.format_name,
      research:{schemaVersion:RESEARCH_SCHEMA_VERSION,formatKey:row.format_key,fields,provenance,
        candidates:{date:row.prospect_date || '',city:row.prospect_city || '',country:row.prospect_country || '',distance_km:row.prospect_distance_km || '',elevation_gain_m:row.prospect_elevation_gain_m || ''},
        route:{url:fields.gpx_url || '',status:row.gpx_status || 'not_processed',sha256:row.gpx_sha256 || ''},
      }});
    groups.set(key,group);
  }
  return [...groups.values()].map(({formatLocations,...group})=>formatLocations.size>1
    ? {...group,invalidReason:'Les formats prêts ont des lieux différents : revue manuelle requise.'} : {...group,action:'import'});
};

export const run = async (argv = process.argv.slice(2), fetchImpl = fetch) => {
  const args = parseArgs(argv);
  const rows = parseCsvTable(await readFile(args.input, "utf8")).rows;
  const rejected = [];
  const requests = buildDraftRequests(rows, {onRejected: row => rejected.push(row)});
  for (const row of rejected) console.error(`[écarté] ${row.event_name || row.format_key} : ${row.reason}`);
  let imported = 0;
  let failed = 0;
  for (const body of requests) {
    if (body.invalidReason) {
      console.error(`[bloqué] ${body.raceName} : ${body.invalidReason}`);
      failed += 1;
      continue;
    }
    if (args.dryRun) {
      console.error(`[dry-run] ${body.raceName} : ${body.formats.length} format(s), ${body.date}`);
      continue;
    }
    const response = await fetchImpl(`${args.baseUrl}/api/admin/race-catalog/betrail-import`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${args.token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`[échec] ${body.raceName} : HTTP ${response.status}`);
      failed += 1;
      continue;
    }
    imported += 1;
  }
  console.error(`Import terminé : ${imported} événement(s), ${failed} échec(s).`);
  return { requests, imported, failed, rejected };
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

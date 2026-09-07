#!/usr/bin/env node

// End-to-end local catalog research pipeline.
// It creates one review CSV per final import scope, enriches official sources,
// downloads/parses validated GPX files, and never writes Supabase.
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parseCsvTable, serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";
import { buildFormatQueue, FORMAT_QUEUE_HEADERS } from "./build-format-import-queue.mjs";
import { enrichQueue, normalizeGpxReference, refreshImportReadiness } from "./enrich-format-import-queue.mjs";

import { createHash } from "node:crypto";
import { RESEARCH_SCHEMA_VERSION, FIELD_COLUMNS, jsonValue, numericValue, normalizeAidStations, targetEdition, verifiedValue } from "./catalog-research-contract.mjs";
import { fetchResearchResource } from "./catalog-research-http.mjs";

const GPX_TIMEOUT_MS = 15_000;
const DISTANCE_MATCH_RATIO = 0.12;
const GPX_ELEVATION_MATCH_RATIO = 0.5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const number = numericValue;
const editionYearForRow = targetEdition;
const gpxYear = (url) => {
  try { return new URL(url).pathname.match(/\b(20\d{2})\b/)?.[1] || ""; } catch { return ""; }
};
const haversineMeters = (a, b) => {
  const radians = (value) => (value * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const parseGpx = (content) => {
  if (!/<gpx\b/i.test(content) || /<(?:html|body|kml)\b/i.test(content)) throw new Error("GPX invalide");
  const segments = [...content.matchAll(/<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi)].map(match=>match[1]);
  const points = (segments.length ? segments : [content]).flatMap((segment,segmentIndex) => [...segment.matchAll(/<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/gi)].map(match => {
    const lat = number(match[1].match(/\blat\s*=\s*["']([^"']+)/i)?.[1]);
    const lng = number(match[1].match(/\blon\s*=\s*["']([^"']+)/i)?.[1]);
    const ele = number((match[2] || '').match(/<ele\b[^>]*>([^<]+)/i)?.[1]);
    if (lat === null || lng === null || Math.abs(lat)>90 || Math.abs(lng)>180) throw new Error('GPX coordonnées invalides');
    return {lat,lng,ele,segmentIndex};
  }));
  if (points.length > 200_000) throw new Error('GPX trop de points');
  if (points.length < 2) throw new Error("GPX sans points de trace");
  let distanceM = 0;
  let gainM = 0;
  let lossM = 0;
  let previousEle = null;
  const cumulative = [];
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0 && points[index-1].segmentIndex === points[index].segmentIndex) distanceM += haversineMeters(points[index - 1], points[index]);
    else previousEle = null;
    if (points[index].ele !== null && previousEle !== null) {
      const delta = points[index].ele - previousEle;
      if (delta > 1) gainM += delta;
      if (delta < -1) lossM += Math.abs(delta);
    }
    previousEle = points[index].ele;
    cumulative.push(distanceM / 1000);
  }
  const elevations = points.map((point) => point.ele).filter((value) => value !== null);
  const waypoints = [...content.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi)].flatMap((match) => {
    const lat = number(match[1].match(/\blat\s*=\s*["']([^"']+)/i)?.[1]);
    const lng = number(match[1].match(/\blon\s*=\s*["']([^"']+)/i)?.[1]);
    const name = compact(match[2].match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1]?.replace(/<[^>]+>/g, " "));
    if (lat === null || lng === null) return [];
    let nearest = Infinity;
    let distanceKm = 0;
    points.forEach((point, index) => {
      const distance = Math.abs(point.lat - lat) + Math.abs(point.lng - lng);
      if (distance < nearest) { nearest = distance; distanceKm = cumulative[index]; }
    });
    return [{ name: name || `Point ${Math.round(distanceKm * 10) / 10} km`, distanceKm: Number(distanceKm.toFixed(1)), type: "waypoint" }];
  });
  return {
    distanceKm: Number((distanceM / 1000).toFixed(2)),
    elevationGainM: elevations.length === points.length ? Math.round(gainM) : null,
    elevationLossM: elevations.length === points.length ? Math.round(lossM) : null,
    altitudeMinM: elevations.length ? elevations.reduce((min,value)=>Math.min(min,value),Infinity) : null,
    altitudeMaxM: elevations.length ? elevations.reduce((max,value)=>Math.max(max,value),-Infinity) : null,
    latitude: points[0].lat,
    longitude: points[0].lng,
    aidStations: [],
    waypoints,
  };
};

export const fetchGpx = async url => {
  const resource = await fetchResearchResource(url, {timeoutMs:GPX_TIMEOUT_MS,maxBytes:12_000_000});
  const content = resource.html;
  if (/<gpx\b/i.test(content)) return {...parseGpx(content), content, sha256:createHash('sha256').update(content).digest('hex')};
  const jsonLd = [...content.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; } catch { return []; }
  });
  const record = jsonLd.find(item=>item && Array.isArray(item.additionalProperty));
  if (!record) throw new Error('Référence de parcours sans trace GPX ni métriques structurées');
  const properties = Object.fromEntries(record.additionalProperty.map(item=>[String(item.name || '').toLowerCase(),item.value]));
  const distance = number(properties.distance);
  const gain = number(properties['dénivelé +'] ?? properties['denivele +']);
  if (distance === null || gain === null) throw new Error('Métriques de parcours incomplètes');
  return {distanceKm:distance > 1000 ? distance/1000 : distance,elevationGainM:gain,
    elevationLossM:number(properties['dénivelé -'] ?? properties['denivele -']),
    altitudeMinM:number(properties['altitude minimale']),altitudeMaxM:number(properties['altitude maximale']),
    latitude:number(record.geo?.latitude),longitude:number(record.geo?.longitude),aidStations:[],sourceType:'route_metrics'};
};

const json = (value, fallback) => {
  try { return JSON.parse(value || ""); } catch { return fallback; }
};
const parseArgs = (argv) => {
  const args = { input: "tmp/prospects.csv", outputDir: "tmp/catalog-research", asOf: new Date().toISOString().slice(0, 10), minDaysBefore: 21, limit: null, offset: 0, resume: false, noLlm: false, verbose: false, delayMs: 500 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const next = argv[index + 1];
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--output-dir") { args.outputDir = next; index += 1; continue; }
    if (arg === "--as-of") { args.asOf = next; index += 1; continue; }
    if (arg === "--min-days-before") { args.minDaysBefore = Number(next); index += 1; continue; }
    if (arg === "--limit") { args.limit = Number(next); index += 1; continue; }
    if (arg === "--offset") { args.offset = Number(next); index += 1; continue; }
    if (arg === "--resume") { args.resume = true; continue; }
    if (arg === "--delay-ms") { args.delayMs = Number(next); index += 1; continue; }
    if (arg === "--no-llm") { args.noLlm = true; continue; }
    if (arg === "--verbose") { args.verbose = true; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  return args;
};

export const buildExports = (rows) => {
  const eventMap = new Map();
  const claims = [];
  const aidStations = [];
  const gpx = [];
  const formatHeaders = FORMAT_QUEUE_HEADERS;
  const eventHeaders = ["event_key", "event_name", "official_website", "city", "country", "candidate_event_date", "event_end_date", "format_location", "event_social_links_json", "event_contact_json", "event_details_json", "access_json", "parking_json", "shuttle_json", "services_json", "bib_pickup_json", "source_pages_json", "format_count"];
  const formatRows = rows.map((row) => Object.fromEntries(formatHeaders.map((header) => [header, row[header] ?? ""])));
  for (const row of rows) {
    const eventKey = `${row.race_url || row.event_name}|${targetEdition(row)}`;
    if (!eventMap.has(eventKey)) eventMap.set(eventKey, { event_key: eventKey, event_name: row.event_name, official_website: row.official_website, city: row.city, country: row.country, candidate_event_date: row.candidate_event_date, event_end_date: row.event_end_date, format_location: row.format_location, event_social_links_json: row.event_social_links_json, event_contact_json: row.event_contact_json, event_details_json: row.event_details_json, access_json: row.access_json, parking_json: row.parking_json, shuttle_json: row.shuttle_json, services_json: row.services_json, bib_pickup_json: row.bib_pickup_json, source_pages_json: row.source_pages_json, format_count: 0 });
    const event = eventMap.get(eventKey);
    event.format_count += 1;
    const evidence = json(row.field_evidence_json, {});
    const provenance = jsonValue(row.field_provenance_json);
    for (const [field,excerpt] of Object.entries(evidence)) claims.push({event_key:eventKey,format_key:row.format_key,
      scope:['access','parking','shuttle','services','bib_pickup','event_details','social_links','emergency_contact'].includes(field) ? 'event' : 'format',
      field,value:row[FIELD_COLUMNS[field]] ?? '',source_url:provenance[field]?.source_url || '',
      method:provenance[field]?.method || '',status:verifiedValue(row,field) !== undefined ? 'verified' : 'candidate',
      source_pages_json:row.source_pages_json,evidence:excerpt,confidence:row.llm_confidence || 'none',research_status:row.research_status});
    normalizeAidStations(row.aid_stations_json).forEach(station=>aidStations.push({format_key:row.format_key,event_name:row.event_name,format_name:row.format_name,...station}));
    if (row.gpx_url || row.gpx_distance_km) gpx.push({ format_key: row.format_key, event_name: row.event_name, format_name: row.format_name, gpx_url: row.gpx_url, gpx_status: row.gpx_status || "not_processed", gpx_distance_km: row.gpx_distance_km || "", gpx_elevation_gain_m: row.gpx_elevation_gain_m || "", gpx_elevation_loss_m: row.gpx_elevation_loss_m || "", gpx_altitude_min_m: row.gpx_altitude_min_m || "", gpx_altitude_max_m: row.gpx_altitude_max_m || "", gpx_error: row.gpx_error || "" });
  }
  return { formatRows, formatHeaders, events: [...eventMap.values()], eventHeaders, claims, aidStations, gpx };
};

const atomicWrite = async (path, content) => {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary,content,'utf8');
  await rename(temporary,path);
};
export const resolveGpxAmbiguity = rows => {
  const groups = new Map();
  for (const row of rows) {
    if (!row.gpx_url || !['verified','ambiguous'].includes(row.gpx_status)) continue;
    const group = groups.get(row.gpx_url) || [];
    group.push(row); groups.set(row.gpx_url,group);
  }
  for (const group of groups.values()) if (new Set(group.map(row=>row.format_key)).size > 1) for (const row of group) {
    row.gpx_status = 'ambiguous';
    row.gpx_error = 'Trace partagée entre plusieurs formats : attribution manuelle requise';
  }
  rows.forEach(refreshImportReadiness);
};
export const processGpx = async (row, fetchImpl = fetchGpx) => {
  if (verifiedValue(row,'gpx_url') === undefined) return;
  row.gpx_url = normalizeGpxReference(row.gpx_url);
  try {
    const stats = await fetchImpl(row.gpx_url);
    for (const [field,key] of Object.entries({gpx_distance_km:'distanceKm',gpx_elevation_gain_m:'elevationGainM',gpx_elevation_loss_m:'elevationLossM',gpx_altitude_min_m:'altitudeMinM',gpx_altitude_max_m:'altitudeMaxM'})) row[field] = stats[key] == null ? '' : String(stats[key]);
    row.gpx_sha256 = stats.sha256 || '';
    const expected = number(row.distance_km);
    const gain = number(verifiedValue(row,'elevation_gain_m'));
    if (expected === null || Math.abs(stats.distanceKm-expected) > Math.max(1,expected*.12)) {
      row.gpx_status = 'mismatch'; row.gpx_error = `Distance de trace ${stats.distanceKm} incompatible avec le format ${row.distance_km}`;
    } else if (gpxYear(row.gpx_url) && gpxYear(row.gpx_url) !== targetEdition(row)) {
      row.gpx_status = 'historical_candidate'; row.gpx_error = 'Trace d’une autre édition';
    } else if (stats.sourceType === 'route_metrics') {
      row.gpx_status = 'route_metrics'; row.gpx_error = 'Métriques de plateforme, fichier GPX non téléchargé';
    } else if (gain !== null && stats.elevationGainM !== null && Math.abs(gain-stats.elevationGainM)>Math.max(250,gain*.5)) {
      row.gpx_status = 'elevation_mismatch'; row.gpx_error = 'D+ de trace incompatible avec le D+ officiel';
    } else { row.gpx_status = 'verified'; row.gpx_error = ''; }
    // GPX measures are a separate evidence scope. They never validate a candidate text value or invent aid stations.
    return stats;
  } catch (error) { row.gpx_status = 'error'; row.gpx_error = error.message || String(error); }
};
const writeExports = async (outputDir, rows) => {
  const result = buildExports(rows);
  for (const [name,headers,values] of [
    ['formats.csv',result.formatHeaders,result.formatRows],['formats-wide.csv',FORMAT_QUEUE_HEADERS,rows],
    ['events.csv',result.eventHeaders,result.events],
    ['source-claims.csv',['event_key','format_key','scope','field','value','source_url','method','status','source_pages_json','evidence','confidence','research_status'],result.claims],
    ['aid-stations.csv',['format_key','event_name','format_name','name','distanceKm','waterRefill','solidRefill','assistanceAllowed','details'],result.aidStations],
    ['gpx-manifest.csv',['format_key','event_name','format_name','gpx_url','gpx_status','gpx_distance_km','gpx_elevation_gain_m','gpx_elevation_loss_m','gpx_altitude_min_m','gpx_altitude_max_m','gpx_error'],result.gpx],
  ]) await atomicWrite(`${outputDir}/${name}`,serializeCsvTable(headers,values));
  return result;
};

export const run = async (argv = process.argv.slice(2), {enrichImpl = enrichQueue, fetchGpxImpl = fetchGpx} = {}) => {
  const args = parseArgs(argv);
  await mkdir(args.outputDir,{recursive:true});
  const lockPath = `${args.outputDir}/catalog.lock`;
  let lock;
  try { lock = await open(lockPath,'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Répertoire déjà verrouillé par une campagne ; vérifier catalog.lock avant reprise.'); throw error; }
  await lock.writeFile(JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));
  try {
    const inputText = await readFile(args.input,'utf8');
    const inputHash = createHash('sha256').update(inputText).digest('hex');
    const statePath = `${args.outputDir}/catalog-progress.json`;
    let state;
    try { state = JSON.parse(await readFile(statePath,'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state && !args.resume) throw new Error('Cette campagne existe déjà : utiliser --resume ou un nouveau répertoire.');
    if (state && (state.schema_version !== RESEARCH_SCHEMA_VERSION || state.input_sha256 !== inputHash)) throw new Error('Entrée ou version différente : créer une nouvelle campagne pour conserver une reprise fiable.');
    if (state) {
      if (argv.includes('--as-of') && args.asOf !== state.as_of || argv.includes('--min-days-before') && args.minDaysBefore !== state.min_days_before || args.noLlm !== state.no_llm) throw new Error('Paramètres différents de la campagne enregistrée.');
      args.asOf = state.as_of; args.minDaysBefore = state.min_days_before;
    } else {
      try { await readFile(`${args.outputDir}/formats-wide.csv`); throw new Error('Export sans progression compatible : utiliser un nouveau répertoire.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const excluded = [];
    const queue = buildFormatQueue(parseCsvTable(inputText).rows,{asOf:args.asOf,minDaysBefore:args.minDaysBefore,onExcluded:row=>excluded.push(row)});
    state ||= {schema_version:RESEARCH_SCHEMA_VERSION,input_sha256:inputHash,as_of:args.asOf,min_days_before:args.minDaysBefore,
      no_llm:args.noLlm,next_offset:args.offset,rows:[],queue_keys:queue.map(row=>row.format_key)};
    if (JSON.stringify(state.queue_keys) !== JSON.stringify(queue.map(row=>row.format_key))) throw new Error('Ordre de sélection modifié : démarrer une nouvelle campagne.');
    await atomicWrite(`${args.outputDir}/excluded-prospects.csv`,serializeCsvTable(['prospect_uuid','event_name','race_url','reason'],excluded));
    const selected = queue.slice(state.next_offset,args.limit === null ? undefined : state.next_offset+args.limit);
    const byKey = new Map(state.rows.map(row=>[row.format_key,row]));
    await mkdir(`${args.outputDir}/evidence`,{recursive:true});
    const checkpoint = async () => {
      state.rows = [...byKey.values()]; resolveGpxAmbiguity(state.rows);
      state.complete = state.next_offset >= queue.length; state.updated_at = new Date().toISOString();
      await atomicWrite(statePath,JSON.stringify(state,null,2));
    };
    await checkpoint();
    await enrichImpl(selected,{noLlm:args.noLlm,delayMs:args.delayMs,verbose:args.verbose,onRow:async (row,audit={}) => {
      const stats = await processGpx(row,fetchGpxImpl);
      if (stats?.content && stats.sha256) await atomicWrite(`${args.outputDir}/evidence/${stats.sha256}.gpx`,stats.content);
      await atomicWrite(`${args.outputDir}/evidence/${row.format_key}.json`,JSON.stringify({...audit,result:row},null,2));
      byKey.set(row.format_key,row); state.next_offset += 1;
      await checkpoint();
    }});
    const result = await writeExports(args.outputDir,state.rows);
    await atomicWrite(`${args.outputDir}/run-summary.json`,JSON.stringify({schema_version:RESEARCH_SCHEMA_VERSION,input_sha256:inputHash,
      selected:selected.length,processed:state.rows.length,total_eligible:queue.length,excluded:excluded.length,
      ready:state.rows.filter(row=>row.ready_to_import==='TRUE').length,source_errors:state.rows.filter(row=>row.research_status==='source_error').length,
      next_offset:state.next_offset,complete:state.complete,as_of:args.asOf},null,2));
    console.error(`Exports écrits dans ${args.outputDir} : ${state.rows.length} formats, ${state.complete ? 'campagne terminée' : 'reprise disponible'}.`);
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

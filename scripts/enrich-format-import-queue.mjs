#!/usr/bin/env node

// Enriches the format queue locally. The web page is fetched locally, basic
// facts are extracted deterministically, then an optional LLM pass interprets
// page context. Every accepted LLM claim must include an exact page excerpt.
// This script only writes a CSV; it never writes Supabase.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parseCsvTable, serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";
import { FORMAT_QUEUE_HEADERS } from "./build-format-import-queue.mjs";
import { createRaceResearchMcpClient } from "./race-research-mcp-client.mjs";
import { cachedResearchResource } from "./catalog-research-http.mjs";
import { RESEARCH_SCHEMA_VERSION, FIELD_COLUMNS, REQUIRED_FIELDS, jsonValue, numericValue, normalizeText,
  parseResearchDate, datesInText, targetEdition, classifySourceUrl, normalizeAidStations, verifiedValue } from "./catalog-research-contract.mjs";

import { applyClaims, refreshImportReadiness, evidenceIdentifiesFormat, validateClaimForRow } from "./catalog-research-validation.mjs";
export { applyClaims, refreshImportReadiness, evidenceIdentifiesFormat, validateClaimForRow };

const FETCH_TIMEOUT_MS = 12_000;
const LLM_TIMEOUT_MS = 60_000;
const CRAWL_MAX_PAGES = 8;
const DEEP_CRAWL_MAX_PAGES = 18;
const FIELD_PATH_HINTS = {
  location: /(lieu|ville|localisation|depart|arrivee|acces|parking|plan|carte|contact)/i,
  elevation_gain_m: /(denivele|profil|parcours|trace|gpx|roadbook|technique)/i,
  gpx_url: /(gpx|trace|parcours|telecharg|roadbook|fichier)/i,
  start_time: /(horaire|programme|depart|briefing)/i,
  aid_stations: /(ravito|ravitail|poste|assistance|nutrition)/i,
  cutoff_times: /(barriere|cut.?off|horaire|temps.?limite|limite)/i,
  mandatory_equipment: /(equipement|obligatoire|materiel)/i,
};
const CRAWL_PATH_HINTS = /(course|parcours|programme|horaire|reglement|règlement|pratique|inscription|ravito|ravitail|gpx|roadbook|dossard|acces|accès|parking|navette|equipement|équipement)/i;
const EXTERNAL_OFFICIAL_HINTS = /(site officiel|organisateur|association|club|website|official|course)/i;
const EXTERNAL_BLOCKED_HOSTS = /(?:facebook|instagram|linkedin|youtube|tiktok|chrono[-]?start|klikego|njuko|milesrepublic|sportsnconnect|timepulse|protiming|helloasso|billetweb)\./i;

const discoverOfficialLinks = (html, rootUrl) => {
  const discovered = [];
  const add = (value, score = 50) => {
    if (typeof value !== "string" || !value.trim()) return;
    try {
      const candidate = new URL(value, rootUrl);
      if (EXTERNAL_BLOCKED_HOSTS.test(candidate.hostname)) return;
      discovered.push({ href: candidate.href.split("#")[0], score });
    } catch { /* ignore malformed metadata */ }
  };
  for (const match of html.matchAll(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)/gi)) add(match[1], 55);
  for (const match of html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*content=["']([^"']+)/gi)) add(match[1], 50);
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const records = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const record of records) {
        if (!record || typeof record !== "object") continue;
        add(record.organizer?.url, 100); add(record.organizer?.sameAs, 90);
      }
    } catch { /* malformed JSON-LD is handled by the normal text extractor */ }
  }
  return discovered;
};
const discoverOfficialFromSecondary = (html, rootUrl) => {
  const candidates = discoverOfficialLinks(html, rootUrl).filter(item => item.score >= 90);
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = compact(match[2].replace(/<[^>]+>/g, " "));
    if (!/(site\s*(officiel|web)|organisateur|website|official)/i.test(label)) continue;
    try {
      const href = new URL(match[1], rootUrl);
      if (!EXTERNAL_BLOCKED_HOSTS.test(href.hostname)) candidates.push({ href: href.href.split("#")[0], score: 120 });
    } catch { /* ignore malformed links */ }
  }
  return [...new Map(candidates.sort((a, b) => b.score - a.score).filter(item => new URL(item.href).hostname !== new URL(rootUrl).hostname && classifySourceUrl(item.href).role === "official_candidate").map((item) => [item.href, item])).values()];
};
const SOURCE_TEXT_LIMIT = 80_000;
// The full crawl stays local for evidence validation; only focused excerpts
// are sent to the model to control input-token usage.
const LLM_TEXT_LIMIT = 9_000;
const DISTANCE_MATCH_RATIO = 0.12;
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4})\b/giu;
const MONTHS = {
  janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
export const normalizeGpxReference = (value) => {
  const raw = compact(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const openRunnerId = raw.match(/openrunner\s*(?:n(?:°|o|º)?\s*)?(\d{5,})/i)?.[1];
  return openRunnerId ? `https://www.openrunner.com/route-details/${openRunnerId}` : raw;
};
const expectedEditionYear = (row) => {
  return targetEdition(row);
};
const parseDate = parseResearchDate;
const isApplicableEditionDate = (value, row) => {
  const parsed = parseDate(value);
  const year = parsed.slice(0, 4);
  const expected = expectedEditionYear(row);
  return Boolean(parsed && (!expected || expected === year) && (!row.min_event_date || parsed >= row.min_event_date)) ? parsed : "";
};

const htmlToText = (html) => compact(
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
);
const pageCatalogEntry = (url, html, row) => {
  const title = compact(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => compact(match[1].replace(/<[^>]+>/g, " "))).filter(Boolean).slice(0, 8);
  const text = htmlToText(html).slice(0, 25_000);
  const fields = searchFieldContexts(text, row);
  const keywordFields = Object.entries(fields).filter(([, snippets]) => snippets.length).map(([field]) => field);
  return { url, title, headings, keyword_fields: keywordFields, text_length: text.length };
};

const FIELD_SEARCH_TERMS = {
  race_date: /(date|edition|Ã©dition|se tiendra|rendez-vous|dimanche|samedi)/i,
  location: /(lieu|ville|commune|d[ée]part|depart|arriv[ée]e|arrivee|adresse|parking|stade|salle)/i,
  distance_km: /(distance|km|kilom|parcours|format|boucle)/i,
  elevation_gain_m: /(d\+|dÃ©nivelÃ©|denivele|positif|profil|altitude|m\+|elevation)/i,
  gpx_url: /(gpx|trace|fichier|tÃ©lÃ©charg|telecharg|roadbook)/i,
  start_time: /(dÃ©part|depart|horaire|heure|programme|briefing)/i,
  event_end_date: /(fin|clÃ´ture|cloture|week-end|weekend)/i,
  cutoff_times: /(barriÃ¨re|barriere|cut.?off|temps limite|limite horaire)/i,
  aid_stations: /(ravito|ravitaillement|poste|point d'eau|eau|assistance)/i,
  mandatory_equipment: /(Ã©quipement|equipement|obligatoire|matÃ©riel|materiel)/i,
  bib_pickup: /(dossard|retrait|remise|inscription)/i,
  access: /(accÃ¨s|acces|venir|transport|gare|route)/i,
  parking: /(parking|stationnement|se garer)/i,
  shuttle: /(navette|bus|transport)/i,
  services: /(service|sanitaire|douche|consigne|ravitaillement)/i,
};

export const searchFieldContexts = (text, row = {}, fields = Object.keys(FIELD_SEARCH_TERMS)) => {
  const source = /<[^>]+>/.test(String(text)) ? htmlToText(String(text)) : compact(text);
  const lowered = source.toLowerCase();
  const formatNeedles = [row.format_name, row.format_raw, row.distance_km && `${row.distance_km} km`, row.distance_km && `${row.distance_km}km`, row.event_name]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  const result = {};
  for (const field of fields) {
    const pattern = FIELD_SEARCH_TERMS[field];
    if (!pattern) continue;
    const candidates = [];
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))) {
      const index = match.index || 0;
      const window = source.slice(Math.max(0, index - 420), Math.min(source.length, index + 980));
      const formatScore = formatNeedles.reduce((score, needle) => score + (window.toLowerCase().includes(needle) ? 20 : 0), 0);
      candidates.push({ value: window, score: formatScore - index / 1_000_000 });
    }
    result[field] = [...new Map(candidates.sort((left, right) => right.score - left.score).slice(0, 3).map((item) => [item.value, item.value])).values()];
  }
  return result;
};

const extractJsonLd = (html) => Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
  .flatMap((match) => {
    try { return [JSON.parse(match[1])]; } catch { return []; }
  });

const findContext = (text, needle) => {
  const index = text.toLowerCase().indexOf(String(needle).toLowerCase());
  if (index < 0) return text.slice(0, 900);
  return text.slice(Math.max(0, index - 350), Math.min(text.length, index + String(needle).length + 550));
};
const findFormatContext = (text, row) => {
  const candidates = [
    row.format_name,
    String(row.format_name || "").replace(/(\d+(?:[.,]\d+)?)\s*km/i, "$1 km"),
    row.format_raw,
    row.distance_km && `${row.distance_km} km`,
    row.distance_km && `${row.distance_km}km`,
    row.event_name,
  ].filter(Boolean);
  const expectedElevation = String(row.elevation_gain_m || "").replace(/\s/g, "");
  const lowered = text.toLowerCase();
  const matches = candidates.flatMap((needle) => {
    const value = String(needle).toLowerCase();
    const found = [];
    let from = 0;
    while (from < lowered.length) {
      const index = lowered.indexOf(value, from);
      if (index < 0) break;
      const window = text.slice(Math.max(0, index - 250), Math.min(text.length, index + value.length + 900));
      found.push({ needle, index, score: expectedElevation && new RegExp(`D\\+\\s*[:\\-]?\\s*${expectedElevation}\\s*m?`, "i").test(window) ? 100 : 0 });
      from = index + value.length;
    }
    return found;
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const match = matches[0];
  return match ? text.slice(Math.max(0, match.index - 220), Math.min(text.length, match.index + String(match.needle).length + 850)) : text.slice(0, 1_000);
};

const buildLlmContext = (text, row) => {
  const needles = [row.format_name, row.format_raw, row.distance_km && `${row.distance_km} km`, row.distance_km && `${row.distance_km}km`, row.event_name]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  const lowered = text.toLowerCase();
  const windows = [];
  for (const needle of needles) {
    let from = 0;
    while (from < lowered.length && windows.length < 12) {
      const index = lowered.indexOf(needle, from);
      if (index < 0) break;
      windows.push(text.slice(Math.max(0, index - 700), Math.min(text.length, index + needle.length + 1_500)));
      from = index + needle.length;
    }
  }
  const fieldContexts = searchFieldContexts(text, row, ["race_date", "location", "distance_km", "elevation_gain_m", "gpx_url", "start_time", "cutoff_times", "aid_stations", "mandatory_equipment", "bib_pickup", "access", "parking", "shuttle", "services"]);
  const fieldWindows = Object.values(fieldContexts).flatMap((snippets) => snippets.slice(0, 2));
  return [...new Set([text.slice(0, 1_500), ...windows, ...fieldWindows].map(compact).filter(Boolean))].join("\n---\n").slice(0, LLM_TEXT_LIMIT);
};

export const deterministicExtract = (html, row) => {
  const sourceUrl = row.official_website;
  const text = htmlToText(html);
  const events = extractJsonLd(html).flatMap(value => Array.isArray(value) ? value : [value, ...(value?.['@graph'] || [])])
    .filter(value => value && /Event/.test(String(value['@type'] || '')));
  const structuredText = events.map(value => JSON.stringify(value)).join(' ');
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match => {
    try { return [{url: new URL(match[1].replace(/&amp;/g, '&'), sourceUrl).href, label: htmlToText(match[2])}]; } catch { return []; }
  });
  const heading = htmlToText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const headingDistances = [...normalizeText(heading).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:km|kms|k|kilometres?)\b/g)];
  const formatContext = headingDistances.length === 1 && evidenceIdentifiesFormat(heading, row) ? heading : '';
  const validationText = [text, structuredText, ...links.map(link => `${link.label} ${link.url}`)].join(' ');
  const page = {url:sourceUrl, text:validationText, title:heading, format_context:formatContext};
  const claims = [];
  const add = (field, value, evidence) => claims.push({field, value, evidence, source_url:sourceUrl, method:'deterministic'});
  const eventName = normalizeText(row.event_name);
  const matchesEvent = value => eventName && (normalizeText(value).includes(eventName) || eventName.includes(normalizeText(value)) && normalizeText(value).length > 5);
  for (const event of events) {
    if (!matchesEvent(event.name) && !(events.length === 1 && matchesEvent(text))) continue;
    const evidence = JSON.stringify(event);
    if (event.startDate) add('race_date', String(event.startDate).slice(0,10), evidence);
    if (event.location && typeof event.location === 'object') {
      const location = [event.location.name, event.location.address?.addressLocality, event.location.address?.addressCountry].filter(Boolean).join(', ');
      if (location) add('location', location, evidence);
    }
  }
  const dates = [...new Set(datesInText(text))];
  if (dates.length === 1 && matchesEvent(text)) {
    const dateEvidence = text.length < 700 ? text : (text.match(DATE_PATTERN) || []).map(value => findContext(text,value)).find(value => datesInText(value).includes(dates[0]));
    if (dateEvidence) add('race_date', dates[0], dateEvidence);
  }
  const contentHtml = html.replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  const blocks = contentHtml.replace(/<\/(?:p|li|tr|h[1-6]|div|section|article)>/gi,'\n').split('\n').map(htmlToText).filter(Boolean);
  for (const block of blocks) {
    const evidence = formatContext ? `${formatContext} ${block}` : block;
    const ds = [...normalizeText(evidence).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:km|kms|k|kilometres?)\b/g)].map(match => Number(match[1].replace(',','.')));
    if (!evidenceIdentifiesFormat(evidence,row) || new Set(ds).size !== 1) continue;
    if (block.length > 1000) continue;
    add('distance_km', ds[0], block);
    const elevation = normalizeText(block).match(/(?:d\s*\+\s*[:=-]?\s*(\d[\d ]*)|(?:denivele positif(?: total)?(?: de)?\s*)(\d[\d ]*)|(\d[\d ]*)\s*m?\s*d\s*\+)/);
    if (elevation) add('elevation_gain_m', numericValue(elevation[1] || elevation[2] || elevation[3]), block);
  }
  for (const link of links) {
    if (/\.gpx(?:$|[?#])/i.test(link.url) && evidenceIdentifiesFormat(`${formatContext} ${link.label} ${link.url}`,row)) add('gpx_url',link.url,`${link.label} ${link.url}`);
  }
  return {text, validation_text:validationText, pages:[page], claims, dates,
    location:claims.find(c=>c.field==='location')?.value || '',
    distance_km:claims.find(c=>c.field==='distance_km')?.value || '',
    elevation_gain_m:claims.find(c=>c.field==='elevation_gain_m')?.value ?? '',
    gpx_url:claims.find(c=>c.field==='gpx_url')?.value || '', links:links.map(link=>link.url),
    evidence:claims.map(c=>c.evidence).join(' | ').slice(0,1000),
    field_contexts:searchFieldContexts(text,row), llm_context:buildLlmContext(text,row)};
};

const claimSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "value", "evidence", "confidence", "rationale", "format_label", "source_url"],
  properties: {
    field: { type: "string", enum: [
      "race_date", "event_end_date", "location", "distance_km", "elevation_gain_m", "elevation_loss_m",
      "start_time", "end_time", "cutoff_times", "altitude_min_m", "altitude_max_m", "latitude", "longitude", "maps_url",
      "participation_mode", "gpx_url", "aid_stations", "mandatory_equipment", "bib_pickup", "access", "parking", "shuttle", "services",
      "social_links", "emergency_contact", "event_details",
    ] },
    format_label: { anyOf: [{ type: "string" }, { type: "null" }] },
    source_url: { type: "string", description: "Exact URL of the provided page containing this evidence" },
    // Complex values are returned as JSON-encoded strings so the strict
    // OpenAI schema remains portable across compatible providers.
    value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
    evidence: { type: "string", minLength: 1, maxLength: 700 },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rationale: { type: "string", minLength: 1, maxLength: 500 },
  },
};

const callLlm = async (row, extraction, api) => {
  if (api.skip) return { claims: [], summary: "LLM non necessaire.", confidence: "none" };
  if (!api.key) return { claims: [], summary: "LLM non exécuté : clé absente.", confidence: "none" };
  const verifiedFields = new Set(String(row.verified_fields || "").split(";").filter(Boolean));
  const mandatory = [
    !verifiedFields.has("race_date") && "race_date",
    !verifiedFields.has("location") && "location",
    !verifiedFields.has("distance_km") && "distance_km",
    !verifiedFields.has("elevation_gain_m") && "elevation_gain_m",
  ].filter(Boolean);
  const requestedFields = [...new Set([
    ...mandatory,
    ...Object.keys(FIELD_SEARCH_TERMS),
    "end_time", "altitude_min_m", "altitude_max_m", "latitude", "longitude", "maps_url",
    "participation_mode", "social_links", "emergency_contact", "event_details",
  ])];
  const prompt = {
    event_name: row.event_name,
    format_name: row.format_name,
    expected_distance_km: row.distance_km,
    source_url: row.official_website,
    target_edition_year: targetEdition(row),
    requested_fields: requestedFields,
    deterministic_extract: { dates: extraction.dates, location: extraction.location, distance_km: extraction.distance_km, elevation_gain_m: extraction.elevation_gain_m, gpx_url: extraction.gpx_url },
    page_text: extraction.llm_context,
    source_pages: (extraction.pages || []).map(page => ({url: page.url, title: page.title || ""})),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let response;
  let responseText;
  try {
    response = await fetch(api.url, {
    method: "POST",
    signal: controller.signal,
    headers: { Authorization: `Bearer ${api.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: api.model,
      temperature: 0,
      store: false,
      response_format: {
        type: "json_schema",
        json_schema: { name: "format_page_claims", strict: true, schema: { type: "object", additionalProperties: false, required: ["summary", "claims"], properties: { summary: { type: "string", maxLength: 800 }, claims: { type: "array", maxItems: 30, items: claimSchema } } } },
      },
      messages: [
        { role: "developer", content: "Recherche exhaustive : extrais aussi les horaires, D-, barrières horaires, altitudes, GPX, ravitaillements, équipement obligatoire, retrait des dossards, accès, parking, navettes, services, réseaux sociaux et contact d'urgence lorsqu'ils sont explicitement présents. Les objets et tableaux doivent conserver leurs détails utiles sous forme de chaîne JSON valide dans value. N'invente rien et rattache chaque claim à une citation exacte." },
          { role: "developer", content: "Tu analyses une page officielle de course trail. Utilise uniquement le texte fourni. N'invente jamais. Retourne uniquement des claims dont la preuve est une citation exacte du texte. Pour chaque claim lie a un format, renseigne format_label avec le nom officiel visible (ex: RENARDEAU), meme s'il differe du nom du prospect. Ignore les dates d'inscription, résultats historiques et archives si elles ne concernent pas l'édition du format demandé. Si une information est ambiguë, ne la retourne pas." },
        { role: "user", content: `<untrusted_page_payload>\n${JSON.stringify(prompt)}\n</untrusted_page_payload>` },
      ],
    }),
    });
    responseText = await response.text();
  } catch (error) {
    if (error?.name === "AbortError") return { claims: [], summary: `LLM timeout après ${LLM_TIMEOUT_MS / 1000}s`, confidence: "none", error: `LLM timeout après ${LLM_TIMEOUT_MS / 1000}s` };
    return { claims: [], summary: "LLM indisponible : extraction déterministe conservée.", confidence: "none", error: `LLM ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return { claims: [], summary: "LLM indisponible : extraction deterministe conservee.", confidence: "none", error: `LLM HTTP ${response.status}: ${responseText.slice(0, 300)}` };
  let body;
  try { body = JSON.parse(responseText); } catch { throw new Error("Réponse LLM non JSON"); }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) return { claims: [], summary: "LLM réponse vide : extraction déterministe conservée.", confidence: "none", error: "LLM réponse vide" };
  try { return {...JSON.parse(content), usage:body.usage || null}; } catch { return { claims: [], summary: "LLM contenu invalide : extraction deterministe conservee.", confidence: "none", error: "LLM contenu non JSON" }; }
};

export const fetchPage = async (url, row = {}) => {
  const errors = [];
  const resources = new Map();
  const fetchOne = async target => {
    const resource = await cachedResearchResource(target);
    resources.set(target, resource);
    return resource.html;
  };
  let root = new URL(url);
  let rootHtml;
  let discoveredFrom = '';
  try {
    rootHtml = await fetchOne(root.href);
    root = new URL(resources.get(root.href).url);
  } catch (error) {
    errors.push({url, error:String(error.message || error)});
    if (!row.race_url || row.race_url === url) throw error;
    let secondaryHtml;
    try { secondaryHtml = await fetchOne(String(row.race_url)); }
    catch (secondaryError) { throw new Error(`${error.message}; fallback: ${secondaryError.message}`); }
    const fallback = discoverOfficialFromSecondary(secondaryHtml, String(row.race_url))[0];
    if (!fallback) throw error;
    root = new URL(fallback.href);
    rootHtml = await fetchOne(root.href);
    discoveredFrom = String(row.race_url);
  }
  if (classifySourceUrl(root.href).role !== 'official_candidate') {
    const official = discoverOfficialFromSecondary(rootHtml,root.href)[0];
    if (!official) throw new Error(`${root.href}: official organizer source not found`);
    discoveredFrom = root.href;
    root = new URL(official.href);
    rootHtml = await fetchOne(root.href);
  }
  const formatNeedles = [row.format_name, row.distance_km && `${row.distance_km} km`, row.distance_km && `${row.distance_km}km`]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  const requestedFields = String(row.missing_fields || "").split(";").filter(Boolean);
  const maxPages = row.search_depth === "deep" ? DEEP_CRAWL_MAX_PAGES : CRAWL_MAX_PAGES;
  const metadataLinks = discoverOfficialLinks(rootHtml, root.href).filter(link => new URL(link.href).hostname === root.hostname);
  const links = [...rootHtml.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      try {
        const candidate = new URL(match[1], root.href);
        const label = compact(match[2].replace(/<[^>]+>/g, " ")).toLowerCase();
        const target = `${candidate.pathname} ${candidate.search} ${label}`.toLowerCase();
        const isGpx = /\.gpx(?:$|[?#])|(?:trace|parcours).*(?:gpx|download|telecharg|télécharg)/i.test(target);
        const sameHost = candidate.hostname === root.hostname;
        const formatMatch = formatNeedles.some((needle) => target.includes(needle));
        const thematic = CRAWL_PATH_HINTS.test(target);
        const fieldMatch = requestedFields.some((field) => FIELD_PATH_HINTS[field]?.test(target));
        const metadataOfficial = metadataLinks.some((item) => item.href === candidate.href);
        const externalOfficial = false; // External organizer discovery is handled before the authoritative crawl.
        if ((!sameHost && !isGpx && !externalOfficial) || (!isGpx && !formatMatch && !thematic && !fieldMatch && !externalOfficial)) return null;
        const metadataScore = metadataLinks.find((item) => item.href === candidate.href)?.score || 0;
        const score = (isGpx ? 100 : 0) + metadataScore + (formatMatch ? 30 : 0) + (thematic ? 10 : 0) + (fieldMatch ? 25 : 0) + (externalOfficial ? 20 : 0);
        return { href: candidate.href.split("#")[0], score };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.href);
  let sitemapLinks = [];
  if (row.search_depth === "deep") {
    try {
      const sitemapResponse = await fetchOne(new URL("/sitemap.xml", root).href);
      sitemapLinks = [...sitemapResponse.matchAll(/<loc[^>]*>([^<]+)<\/loc>/gi)]
        .map((match) => match[1].trim())
        .filter((candidate) => {
          try { return new URL(candidate).hostname === root.hostname; } catch { return false; }
        })
        .map((candidate) => ({
          href: candidate,
          score: requestedFields.some((field) => FIELD_PATH_HINTS[field]?.test(candidate)) ? 35 : 5,
        }))
        .sort((left, right) => right.score - left.score)
        .map((item) => item.href);
    } catch { /* sitemap is optional */ }
  }
  const urls = [...new Set([root.href, ...metadataLinks.sort((left, right) => right.score - left.score).map((item) => item.href), ...links, ...sitemapLinks])].slice(0, maxPages);
  const pageRecords = [{ url: root.href, html: rootHtml }];
  for (const childUrl of urls.slice(1)) {
    try { pageRecords.push({ url: childUrl, html: await fetchOne(childUrl) }); } catch (error) { errors.push({url:childUrl,error:String(error.message || error)}); }
  }
  return {
    html: pageRecords.map((page) => page.html).join("\n<!-- OFFICIAL_PAGE_BREAK -->\n"),
    urls: pageRecords.map((page) => page.url),
    page_catalog: pageRecords.map((page) => pageCatalogEntry(page.url, page.html, row)),
    pages: pageRecords.map(page => ({...page, ...(resources.get(page.url) || {}), authority: new URL(page.url).hostname === root.hostname ? "official" : "secondary"})),
    errors,
    resolved_url: root.href,
    discovered_from: discoveredFrom,
  };
};

const fetchPageLegacy = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "PaceYourself-CatalogResearch/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const parseArgs = (argv) => {
  const args = { input: null, output: null, limit: null, noLlm: false, verbose: false, delayMs: 500 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--output") { args.output = next; index += 1; continue; }
    if (arg === "--limit") { args.limit = Number(next); index += 1; continue; }
    if (arg === "--delay-ms") { args.delayMs = Number(next); index += 1; continue; }
    if (arg === "--no-llm") { args.noLlm = true; continue; }
    if (arg === "--verbose") { args.verbose = true; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!args.input) throw new Error("--input est requis.");
  if (!args.output) args.output = args.input.replace(/\.csv$/i, "") + "-enriched.csv";
  return args;
};

export const enrichQueue = async (rows, { noLlm = false, limit = null, delayMs = 500, verbose = false, fetchImpl = fetchPage, llmImpl = callLlm, onRow = async () => {} } = {}) => {
  const api = {key:process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || '',
    url:process.env.LLM_API_URL?.trim() || 'https://api.openai.com/v1/chat/completions',
    model:process.env.OPENAI_ORGANIZER_IMPORT_MODEL?.trim() || process.env.LLM_MODEL?.trim() || 'gpt-4.1-mini'};
  const selected = limit === null ? rows : rows.slice(0, limit);
  let mcpClient = null;
  if (fetchImpl === fetchPage && process.env.RACE_RESEARCH_USE_MCP !== '0') {
    try { mcpClient = await createRaceResearchMcpClient(); }
    catch (error) { console.error(`MCP indisponible, HTTP local : ${error.message}`); }
  }
  const fetchSource = mcpClient ? (url,row) => mcpClient.callTool('crawl_source', {
    url, event_name:row.event_name, format_name:row.format_name, distance_km:row.distance_km,
    missing_fields:row.search_fields, search_depth:'deep', race_url:row.race_url,
  }) : fetchImpl;
  const pageCache = new Map();
  try {
    for (const [index,row] of selected.entries()) {
      const started = Date.now();
      let fetched = null, extraction = null, llm = {claims:[]};
      // Never inherit a previously exported TRUE flag after a failed refresh.
      row.ready_to_import = 'FALSE';
      row.field_provenance_json = '{}';
      row.verified_fields = '';
      row.research_errors_json = '[]';
      try {
        const source = row.official_website || row.race_url;
        if (!source) throw new Error('Source officielle ou secondaire manquante');
        row.search_fields = Object.keys(FIELD_COLUMNS).join(';');
        row.search_depth = 'deep';
        row.crawl_transport = mcpClient ? 'mcp_stdio' : fetchImpl === fetchPage ? 'http_direct' : 'custom';
        const pageKey = JSON.stringify([source,row.race_url,row.format_name,row.prospect_distance_km || row.distance_km,targetEdition(row)]);
        if (!pageCache.has(pageKey)) pageCache.set(pageKey, await fetchSource(source,row));
        fetched = pageCache.get(pageKey);
        if (fetched?.resolved_url) {
          row.official_website = fetched.resolved_url;
          row.source_role = classifySourceUrl(fetched.resolved_url).role;
          if (fetched.discovered_from) row.source_quality = 'discovered_organizer';
        }
        row.source_role ||= classifySourceUrl(row.official_website).role;
        const records = fetched?.pages || [{url:row.official_website || source, html:typeof fetched === 'string' ? fetched : fetched.html}];
        const extracts = records.map(page => {
          const result = deterministicExtract(page.html, {...row,official_website:page.url});
          result.pages[0].authority = page.authority;
          return result;
        });
        const pages = extracts.flatMap(result=>result.pages);
        const ranked = extracts.map(result => ({result, score:(result.pages[0].format_context ? 100 : 0) + result.claims.length * 3 - ((/archives?|resultats?/.test(result.pages[0].url) || [...result.pages[0].url.matchAll(/\b(20\d{2})\b/g)].some(match => match[1] !== targetEdition(row))) ? 10 : 0)})).sort((a,b)=>b.score-a.score).slice(0,10);
        const budget = Math.floor(LLM_TEXT_LIMIT / Math.max(1,ranked.length));
        const llmContext = ranked.map(({result}) => `SOURCE ${result.pages[0].url}\nFORMAT ${result.pages[0].format_context}\n${result.llm_context}`.slice(0,budget)).join('\n---\n').slice(0,LLM_TEXT_LIMIT);
        extraction = {text:pages.map(p=>p.text).join(' '), validation_text:pages.map(p=>p.text).join(' '),pages,
          claims:extracts.flatMap(result=>result.claims), dates:[...new Set(extracts.flatMap(result=>result.dates))],
          llm_context:llmContext};
        row.source_pages_json = JSON.stringify([...new Set([source,...pages.map(page=>page.url),fetched?.discovered_from].filter(Boolean))]);
        row.page_catalog_json = JSON.stringify(fetched?.page_catalog || []);
        row.page_map_json = JSON.stringify(ranked.map(({result,score})=>({url:result.pages[0].url,relevance:score,method:'deterministic'})));
        row.research_errors_json = JSON.stringify(fetched?.errors || []);
        // A single semantic pass also researches optional logistics, even if the minimum is complete.
        if (!noLlm && row.source_role === 'official_candidate') {
          try { llm = await llmImpl(row,extraction,api); }
          catch (error) { llm = {claims:[],error:`LLM: ${error.message || error}`}; }
        }
        if (llm.error) row.research_errors_json = JSON.stringify([...jsonValue(row.research_errors_json,[]),{error:llm.error}]);
        applyClaims(row,extraction,llm);
      } catch (error) {
        row.research_status = 'source_error';
        row.research_errors_json = JSON.stringify([{error:error.message || String(error)}]);
        refreshImportReadiness(row);
      }
      console.error(`[${index+1}/${selected.length}] ${row.event_name} / ${row.format_name} — ${row.research_status}`);
      if (verbose) console.error(`  ${row.verified_fields || 'aucun champ vérifié'} | ${row.verification_alert}`);
      await onRow(row, {schema_version:RESEARCH_SCHEMA_VERSION,format_key:row.format_key,model:api.model,
        target_edition_year:targetEdition(row),duration_ms:Date.now()-started,fetched_at:new Date().toISOString(),
        pages:fetched?.pages || [],request_context:extraction?.llm_context || '',llm_response:llm,errors:jsonValue(row.research_errors_json,[])});
      if (delayMs > 0 && index < selected.length-1) await sleep(delayMs);
    }
  } finally { mcpClient?.close(); }
  return rows;
};

export const run = async (argv = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  const table = parseCsvTable(await readFile(args.input, "utf8"));
  const rows = await enrichQueue(table.rows, args);
  await writeFile(args.output, serializeCsvTable(FORMAT_QUEUE_HEADERS, rows), "utf8");
  console.error(`Queue enrichie : ${rows.length} ligne(s) écrite(s) dans ${args.output}.`);
  return rows;
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

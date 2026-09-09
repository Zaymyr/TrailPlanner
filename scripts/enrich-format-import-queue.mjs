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
  parseResearchDate, datesInText, targetEdition, classifySourceUrl, isUnsafeResearchUrl, normalizeAidStations, verifiedValue,
  SOURCE_IDENTITY_STATUS } from "./catalog-research-contract.mjs";

import { applyClaims, refreshImportReadiness, evidenceIdentifiesFormat, validateClaimForRow } from "./catalog-research-validation.mjs";
import { buildDocumentBlocks, groundLlmClaimsToBlocks, renderDocumentBlockContext, selectDocumentBlocks } from "./catalog-research-document-blocks.mjs";
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
const CRAWL_PATH_HINTS = /(course|parcours|programme|horaire|reglement|règlement|organisation|pratique|inscription|ravito|ravitail|gpx|roadbook|dossard|acces|accès|parking|navette|equipement|équipement)/i;
const EXTERNAL_OFFICIAL_HINTS = /(site officiel|organisateur|association|club|website|official|course)/i;
const EXTERNAL_BLOCKED_HOSTS = /(?:facebook|instagram|linkedin|youtube|tiktok|chrono[-]?start|klikego|njuko|milesrepublic|sportsnconnect|timepulse|protiming|helloasso|billetweb)\./i;
export const sitemapLocations = (xml, rootUrl) => [...String(xml).matchAll(/<loc[^>]*>([^<]+)<\/loc>/gi)]
  .map(match => match[1].trim())
  .filter(candidate => {
    try { return new URL(candidate).hostname === new URL(rootUrl).hostname && !isUnsafeResearchUrl(candidate); } catch { return false; }
  });
export const canonicalResearchUrl = (value, baseUrl = undefined) => {
  try {
    const url = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch { return ""; }
};
export const robotsSitemapLocations = (text, rootUrl) => [...String(text).matchAll(/^\s*sitemap\s*:\s*(\S+)\s*$/gim)]
  .map(match => canonicalResearchUrl(match[1], rootUrl))
  .filter(candidate => candidate && new URL(candidate).hostname === new URL(rootUrl).hostname && !isUnsafeResearchUrl(candidate));

const discoverOfficialLinks = (html, rootUrl) => {
  const discovered = [];
  const add = (value, score = 50) => {
    if (typeof value !== "string" || !value.trim()) return;
    try {
      const candidate = new URL(value, rootUrl);
      if (EXTERNAL_BLOCKED_HOSTS.test(candidate.hostname) || isUnsafeResearchUrl(candidate.href)) return;
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
      if (!EXTERNAL_BLOCKED_HOSTS.test(href.hostname) && !isUnsafeResearchUrl(href.href)) candidates.push({ href: href.href.split("#")[0], score: 120 });
    } catch { /* ignore malformed links */ }
  }
  return [...new Map(candidates.sort((a, b) => b.score - a.score).filter(item => new URL(item.href).hostname !== new URL(rootUrl).hostname && classifySourceUrl(item.href).role === "official_candidate").map((item) => [item.href, item])).values()];
};
const IDENTITY_STOP_WORDS = new Set(['trail','trails','course','courses','run','running','edition','challenge','de','du','des','la','le','les','en','au','aux']);
const identityWords = value => normalizeText(value).match(/[a-z0-9]+/g) || [];
const eventIdentityTokens = row => identityWords(String(row.event_name || '').replace(/\s*\(\d+\)\s*$/,''))
  .filter(token=>token.length >= 3 && !IDENTITY_STOP_WORDS.has(token));
const tokenCoverage = (needles,haystack) => {
  if (!needles.length) return 0;
  const words = new Set(identityWords(haystack));
  return needles.filter(token=>words.has(token)).length / needles.length;
};
export const assessSourceIdentity = (pages, url, row = {}) => {
  const records = Array.isArray(pages) ? pages : [{html:String(pages || "")}];
  const tokens = eventIdentityTokens(row);
  const cityTokens = identityWords(row.prospect_city || row.city || '').filter(token=>token.length >= 3);
  const eventSlug = identityWords(String(row.event_name || '').replace(/\s*\(\d+\)\s*$/,'')).join('');
  const assessPage = page => {
    const html = String(page.html || "");
    const headings = htmlToText(`${html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''} ${[...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(match=>match[1]).join(' ')}`);
    const pageText = htmlToText(html);
    const headingCoverage = tokenCoverage(tokens,headings);
    const pageCoverage = tokenCoverage(tokens,pageText);
    const pageUrl = page.url || url;
    const hostWords = new Set(identityWords(new URL(pageUrl).hostname.replace(/^www\./,'')));
    const hostMatch = Boolean(eventSlug && eventSlug.length >= 5 && hostWords.has(eventSlug));
    const pageWords = new Set(identityWords(pageText));
    const cityMatch = !cityTokens.length || cityTokens.every(token=>pageWords.has(token));
    const eventSemantics = /(?:inscription|programme|parcours|depart|arrivee|reglement|edition)/.test(normalizeText(pageText));
    const distinctiveMatches = tokens.filter(token=>new Set(identityWords(pageText)).has(token)).length;
    let score = Math.round(headingCoverage*45 + pageCoverage*25 + (hostMatch?15:0) + (cityTokens.length&&cityMatch?15:0)
      + (hostMatch&&cityTokens.length&&cityMatch?30:0) + (eventSemantics?5:0));
    if (cityTokens.length&&!cityMatch) score -= 25;
    score = Math.max(0,Math.min(100,score));
    const localIdentity = distinctiveMatches >= Math.max(1,Math.ceil(tokens.length*.6)) && (headingCoverage>=.5 || pageCoverage>=.75);
    const hostAndLocationIdentity = hostMatch && cityTokens.length>0 && cityMatch;
    const identityStrong = tokens.length>0 && (localIdentity || hostAndLocationIdentity);
    const status = identityStrong&&cityMatch&&score>=60 ? SOURCE_IDENTITY_STATUS.VERIFIED
      : identityStrong&&score>=40 ? SOURCE_IDENTITY_STATUS.PROBABLE : SOURCE_IDENTITY_STATUS.UNKNOWN;
    return {status,score,heading_coverage:Number(headingCoverage.toFixed(2)),page_coverage:Number(pageCoverage.toFixed(2)),
      host_match:hostMatch,location_match:cityMatch,event_semantics:eventSemantics,distinctive_matches:distinctiveMatches,page_url:pageUrl};
  };
  const assessments = records.map(assessPage);
  const best = assessments.sort((left,right)=>right.score-left.score)[0] || {status:SOURCE_IDENTITY_STATUS.UNKNOWN,score:0};
  return {...best,page_assessments:assessments};
};
export const likelyOrganizerPage = (html, url, row) => {
  return assessSourceIdentity([{url,html}],url,row).status === SOURCE_IDENTITY_STATUS.VERIFIED;
};
export const linkedOrganizerCandidates = (html, rootUrl, row = {}) => {
  const tokens = eventIdentityTokens(row);
  const rootHost = new URL(rootUrl).hostname;
  const candidates = [];
  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const href = new URL(match[1], rootUrl);
      const normalizedTarget = normalizeText(`${href.hostname} ${href.pathname}`);
      const score = tokens.filter(token=>token.length >= 4 && normalizedTarget.includes(token)).length;
      if (href.hostname !== rootHost && score && classifySourceUrl(href.href).role === 'official_candidate' && !EXTERNAL_BLOCKED_HOSTS.test(href.hostname) && !isUnsafeResearchUrl(href.href)) {
        candidates.push({href:href.href.split('#')[0],score});
      }
    } catch { /* ignore malformed links */ }
  }
  return [...new Map(candidates.sort((a,b)=>b.score-a.score).map(candidate=>[candidate.href,candidate])).values()];
};
export const pageMentionsExpectedEvent = (html, row = {}) => {
  const page = normalizeText(htmlToText(String(html)));
  const eventTokens = eventIdentityTokens(row);
  const cityTokens = normalizeText(row.prospect_city || row.city || '').match(/[a-z0-9]+/g)?.filter(token=>token.length >= 3) || [];
  return eventTokens.length > 0 && eventTokens.filter(token=>page.includes(token)).length / eventTokens.length >= .7
    && (!cityTokens.length || cityTokens.every(token=>page.includes(token)));
};
export const weakOrganizerPage = html => {
  const text = normalizeText(htmlToText(String(html)));
  return text.length < 200 || /directory index|domain (?:is )?for sale|buy this domain|privacy policy terms of service|sedo parking|parkingcrew/.test(text);
};
const unwrapSearchResult = value => {
  try {
    const parsed = new URL(String(value).replace(/&amp;/g,'&'),'https://html.duckduckgo.com');
    if (/(?:^|\.)duckduckgo\.com$/i.test(parsed.hostname) && parsed.searchParams.get('uddg')) return decodeURIComponent(parsed.searchParams.get('uddg'));
    return parsed.href;
  } catch { return ''; }
};
export const searchResultCandidates = (html, row = {}) => {
  const tokens = eventIdentityTokens(row);
  const candidates = [];
  for (const match of String(html).matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/result__a/i.test(`${match[1]} ${match[3]}`)) continue;
    const href = unwrapSearchResult(match[2]);
    if (!href || classifySourceUrl(href).role !== 'official_candidate' || isUnsafeResearchUrl(href)) continue;
    const label = normalizeText(htmlToText(match[4]));
    const score = tokens.filter(token=>label.includes(token) || normalizeText(href).includes(token)).length;
    if (score) candidates.push({href:href.split('#')[0],score});
  }
  return [...new Map(candidates.sort((a,b)=>b.score-a.score).map(candidate=>[candidate.href,candidate])).values()];
};
const SOURCE_TEXT_LIMIT = 80_000;
// The full crawl stays local for evidence validation; only focused excerpts
// are sent to the model to control input-token usage.
const LLM_TEXT_LIMIT = 24_000;
const DISTANCE_MATCH_RATIO = 0.12;
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}(?:er)?\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4})\b/giu;
const YEARLESS_EVENT_DATE_PATTERN = /\b(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+)?(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b(?!\s+\d{4})/giu;
const EVENT_DATE_CONTEXT_PATTERN = /(?:programme|edition|aura lieu|se deroul|rendez-vous|depart|partira|venez courir)/;
const MONTHS = {
  janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ").trim();
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

const HTML_ENTITY_VALUES = {
  nbsp:" ",amp:"&",quot:'"',apos:"'",agrave:"à",aacute:"á",acirc:"â",auml:"ä",
  ccedil:"ç",egrave:"è",eacute:"é",ecirc:"ê",euml:"ë",igrave:"ì",iacute:"í",icirc:"î",iuml:"ï",
  ograve:"ò",oacute:"ó",ocirc:"ô",ouml:"ö",ugrave:"ù",uacute:"ú",ucirc:"û",uuml:"ü",
  laquo:"«",raquo:"»",lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”",ndash:"–",mdash:"—",hellip:"…",deg:"°",copy:"©",
};
const decodeHtmlEntities = value => String(value)
  .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(match,hex,decimal)=>{
    const codePoint = Number.parseInt(hex || decimal,hex ? 16 : 10);
    try { return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : match; } catch { return match; }
  })
  .replace(/&([a-z]+);/gi,(match,name)=>HTML_ENTITY_VALUES[name.toLowerCase()] ?? match);
const htmlToText = (html) => compact(
  decodeHtmlEntities(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
);
const pageCatalogEntry = (url, html, row) => {
  const title = compact(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => compact(match[1].replace(/<[^>]+>/g, " "))).filter(Boolean).slice(0, 8);
  const text = htmlToText(html).slice(0, 25_000);
  const fields = searchFieldContexts(text, row);
  const keywordFields = Object.entries(fields).filter(([, snippets]) => snippets.length).map(([field]) => field);
  return { url, title, headings, keyword_fields: keywordFields, text_length: text.length };
};

export const detectRenderingStatus = html => {
  const source = String(html || "");
  const textLength = htmlToText(source).length;
  const hasApplicationShell = /<(?:script|div)\b[^>]*(?:id|class)=["'][^"']*(?:__next|app|root|spa)[^"']*["']/i.test(source);
  const hasFrameworkAssets = /(?:_next\/static|vite|webpack|nuxt|data-reactroot|application\/javascript)/i.test(source);
  return textLength < 200 && (hasApplicationShell || hasFrameworkAssets) ? "js_only_suspected" : "html_available";
};

const rankedPageLinks = (html, pageUrl, rootUrl, row, depth) => {
  const rootHost = new URL(rootUrl).hostname;
  const formatNeedles = [row.format_name, row.distance_km && `${row.distance_km} km`, row.distance_km && `${row.distance_km}km`]
    .filter(Boolean).map(value => normalizeText(value));
  const requestedFields = String(row.search_fields || row.missing_fields || "").split(";").filter(Boolean);
  const candidates = [];
  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = canonicalResearchUrl(match[1], pageUrl);
    if (!href || isUnsafeResearchUrl(href)) continue;
    const candidate = new URL(href);
    const sameHost = candidate.hostname === rootHost;
    const label = normalizeText(htmlToText(match[2]));
    const target = normalizeText(`${candidate.pathname} ${candidate.search} ${label}`);
    const isGpx = /\.gpx(?:$|[?#])|(?:trace|parcours).*(?:gpx|download|telecharg)/i.test(target);
    if (!sameHost && !isGpx) continue;
    if (/\.(?:jpe?g|png|gif|webp|svg|css|js|woff2?|zip)(?:$|[?#])/i.test(candidate.pathname)) continue;
    const formatMatch = formatNeedles.some(needle => target.includes(needle));
    const thematic = CRAWL_PATH_HINTS.test(target);
    const fieldMatch = requestedFields.some(field => FIELD_PATH_HINTS[field]?.test(target));
    const score = (isGpx ? 100 : 0) + (formatMatch ? 35 : 0) + (fieldMatch ? 30 : 0) + (thematic ? 15 : 0)
      + (label && label.length < 80 ? 2 : 0) - depth * 4;
    candidates.push({href, score, depth, external:!sameHost});
  }
  return candidates;
};

const crawlOrganizerPages = async ({root,rootHtml,row,maxPages,fetchOne,resources,errors}) => {
  const rootUrl = canonicalResearchUrl(root.href);
  const rootHost = new URL(rootUrl).hostname;
  const requestedFields = String(row.search_fields || row.missing_fields || "").split(";").filter(Boolean);
  const pages = [{url:rootUrl,html:rootHtml,depth:0}];
  const visited = new Set([rootUrl]);
  const pending = new Map();
  const enqueue = candidate => {
    if (!candidate?.href || visited.has(candidate.href) || isUnsafeResearchUrl(candidate.href) || candidate.depth > 2) return;
    const previous = pending.get(candidate.href);
    if (!previous || candidate.score > previous.score) pending.set(candidate.href,candidate);
  };
  for (const candidate of rankedPageLinks(rootHtml,rootUrl,rootUrl,row,1)) enqueue(candidate);
  for (const item of discoverOfficialLinks(rootHtml,rootUrl)) {
    const href = canonicalResearchUrl(item.href,rootUrl);
    if (href && new URL(href).hostname === rootHost) enqueue({href,score:item.score + 20,depth:1});
  }
  if (row.search_depth === "deep") {
    const sitemapSeeds = new Set([canonicalResearchUrl('/sitemap.xml',rootUrl),canonicalResearchUrl('/wp-sitemap.xml',rootUrl)]);
    const robotsUrl = canonicalResearchUrl('/robots.txt',rootUrl);
    try {
      const robots = await fetchOne(robotsUrl);
      for (const location of robotsSitemapLocations(robots,rootUrl)) sitemapSeeds.add(location);
    } catch (error) { errors.push({url:robotsUrl,error:String(error.message || error),optional:true}); }
    const sitemapQueue = [...sitemapSeeds].filter(Boolean).map(href=>({href,depth:0}));
    const seenSitemaps = new Set();
    while (sitemapQueue.length && seenSitemaps.size < 10) {
      const sitemap = sitemapQueue.shift();
      if (seenSitemaps.has(sitemap.href) || sitemap.depth > 2) continue;
      seenSitemaps.add(sitemap.href);
      try {
        const xml = await fetchOne(sitemap.href);
        for (const location of sitemapLocations(xml,rootUrl)) {
          if (/\.xml(?:\.gz)?(?:$|[?#])/i.test(location)) sitemapQueue.push({href:location,depth:sitemap.depth + 1});
          else {
            const score = requestedFields.some(field=>FIELD_PATH_HINTS[field]?.test(location)) ? 40 : CRAWL_PATH_HINTS.test(location) ? 20 : 4;
            enqueue({href:canonicalResearchUrl(location),score,depth:1});
          }
        }
      } catch (error) { errors.push({url:sitemap.href,error:String(error.message || error),optional:true}); }
    }
  }
  while (pages.length < maxPages && pending.size) {
    const next = [...pending.values()].sort((left,right)=>right.score-left.score || left.depth-right.depth || left.href.localeCompare(right.href))[0];
    pending.delete(next.href);
    if (visited.has(next.href)) continue;
    visited.add(next.href);
    try {
      const html = await fetchOne(next.href);
      const resource = resources.get(next.href);
      const resolvedUrl = canonicalResearchUrl(resource?.url || next.href);
      const external = new URL(resolvedUrl).hostname !== rootHost;
      if (external && !next.external) {
        errors.push({url:next.href,error:`redirected outside organizer host to ${resolvedUrl}`});
        continue;
      }
      pages.push({url:resolvedUrl,html,depth:next.depth});
      if (!external && next.depth < 2) {
        for (const child of rankedPageLinks(html,resolvedUrl,rootUrl,row,next.depth + 1)) enqueue(child);
      }
    } catch (error) { errors.push({url:next.href,error:String(error.message || error)}); }
  }
  return pages;
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
  const documentBlocks = buildDocumentBlocks(html, sourceUrl);
  const page = {url:sourceUrl, text:validationText, title:heading, format_context:formatContext, block_count:documentBlocks.length};
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
  const headingDates = [...new Set(datesInText(heading))];
  if (headingDates.length === 1 && /\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(heading)
    && isApplicableEditionDate(headingDates[0], row)) add('race_date', headingDates[0], heading);
  for (const match of text.matchAll(DATE_PATTERN)) {
    const evidence = text.slice(Math.max(0,match.index-50),Math.min(text.length,match.index+match[0].length+180));
    const date = isApplicableEditionDate(match[0],row);
    if (date && EVENT_DATE_CONTEXT_PATTERN.test(normalizeText(evidence))) add('race_date',date,evidence);
  }
  if (dates.length === 1 && matchesEvent(text)) {
    const dateEvidence = text.length < 700 ? text : (text.match(DATE_PATTERN) || []).map(value => findContext(text,value)).find(value => datesInText(value).includes(dates[0]));
    if (dateEvidence) add('race_date', dates[0], dateEvidence);
  }
  const editionYear = targetEdition(row);
  if (editionYear) for (const match of text.matchAll(YEARLESS_EVENT_DATE_PATTERN)) {
    const evidence = text.slice(Math.max(0,match.index-50),Math.min(text.length,match.index+match[0].length+180));
    if (!EVENT_DATE_CONTEXT_PATTERN.test(normalizeText(evidence))) continue;
    const inferred = isApplicableEditionDate(`${match[2]} ${match[3]} ${editionYear}`, row);
    if (inferred) claims.push({field:'race_date',value:inferred,evidence,source_url:sourceUrl,method:'deterministic_inferred_year'});
  }
  const datedBannerTail = text.match(/rendez-vous\s+le\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}(?:er)?\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+\d{4})?\s+([^.!?\n]{1,100})/iu)?.[1] || '';
  const datedLocationValue = datedBannerTail.match(/^([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,5}(?:,\s*[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,3})?(?:\s*\(\d{2,3}\))?)/u)?.[1] || '';
  const datedRendezVousLocation = datedLocationValue ? [datedBannerTail,datedLocationValue] : null;
  const cleanLocationCandidate = value => {
    const candidate = compact(value).replace(/\s+([,;:])/g,'$1').replace(/^[\s,:;–-]+|[\s,:;–-]+$/g,'');
    return candidate && !/^(?:et|avec|d|de|du|des|la|le|les|et\s+d)$/i.test(normalizeText(candidate)) ? candidate : '';
  };
  const sharedStartFinishMatch = text.match(/(?:[Ll]['’]unique\s+)?(?:lieux?\s+de\s+)?[Dd][ée]part\s+et\s+(?:d['’]\s*)?[Aa]rriv[ée]e(?:(?:\s+se\s+situe(?:nt)?\s+(?:au|aux|sur\s+(?:le|la|les)|[àa]\s+la|[àa]\s+l['’])\s+)|(?:\s*:\s*)(?:(?:au|aux|sur\s+(?:le|la|les)|[àa]\s+la|[àa]\s+l['’])\s+)?)([^.!?]{2,160}?)(?=\s+(?:Les?\s+(?:parcours|courses|inscriptions|d[ée]parts?)|Article|Programme)\b|[.!?]|$)/u);
  const sharedStartFinishValue = cleanLocationCandidate(sharedStartFinishMatch?.[1] || '');
  const sharedStartFinishLocation = sharedStartFinishValue ? [sharedStartFinishMatch[0],sharedStartFinishValue] : null;
  const pairedDepartureMatch = text.match(/\b[Dd][ée]part\s*(?:[àa]|au|aux|:)?\s+([^.!?]{2,160}?)(?=\s+(?:(?:et|avec)\s+une\s+)?[Aa]rriv[ée]e\b)/u);
  const pairedDepartureValue = cleanLocationCandidate(pairedDepartureMatch?.[1] || '').replace(/\s*[-–]\s*$/,'');
  const pairedDepartureLocation = pairedDepartureValue ? [pairedDepartureMatch[0],pairedDepartureValue] : null;
  const eventVenueMatch = text.match(/(?:aura\s+lieu|a\s+lieu|se\s+d[ée]roulera)[^.!?]{0,120}?\s(?:au|sur\s+(?:le|la|les)|[àa]\s+la|[àa]\s+l['’]|aux)\s+([^.!?]{2,120}?)(?=\s+(?:le|les)\s+(?:premier|deuxi[èe]me|prochain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2})\b|[.!?]|$)(?:\.\s*\(\s*([^)]*\b\d{5}\b[^)]*)\))?/iu);
  const eventVenueValue = eventVenueMatch ? [eventVenueMatch[1],eventVenueMatch[2]].filter(Boolean).map(cleanLocationCandidate).filter(Boolean).join(', ') : '';
  const eventVenueLocation = eventVenueValue ? [eventVenueMatch[0],eventVenueValue] : null;
  const namedRendezVousMatch = text.match(/(?:[Rr]endez-vous|[Ll]ieu\s+(?:de\s+)?[Dd][ée]part|[Dd][ée]part)\s+(?:[àa]|au|aux)\s+([\p{Lu}][\p{L}'’-]*(?:\s+(?:(?:de|du|des|la|le|les|en|sur|sous)\s+)?(?!(?:Matériel|Materiel|Inscriptions?|Ravitaillement|Programme|Article|Départ)\b)[\p{Lu}][\p{L}'’-]*){0,7})/u);
  const namedRendezVousLocation = namedRendezVousMatch ? [namedRendezVousMatch[0],namedRendezVousMatch[1]] : null;
  const explicitLocation = datedRendezVousLocation
    || sharedStartFinishLocation
    || pairedDepartureLocation
    || eventVenueLocation
    || namedRendezVousLocation
    || text.match(/(?:lieux?|sites?)\s+de\s+d[ée]part(?:\s+et\s+d['’]arriv[ée]e)?\s+(?:se\s+situe(?:nt)?|sont)[^.!?]{0,140}?\s[àa]\s+([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,7})/u)
    || text.match(/(?:[Rr]endez-vous|[Ll]ieu\s+(?:de\s+)?[Dd][ée]part|[Dd][ée]part)\s+(?:[àa]|au|aux)\s+([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,7})/u)
    || text.match(/(?:[ÀA]|Ã€)\s+([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,7}),\s+(?:le|la|les)\s+(?:trail|course|marche|[ée]preuve)/u);
  if (explicitLocation) add('location', explicitLocation[1], findContext(text, explicitLocation[0]));
  for (const {text:block} of documentBlocks) {
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
    field_contexts:searchFieldContexts(text,row), document_blocks:documentBlocks, llm_context:buildLlmContext(text,row)};
};

const claimSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "value", "evidence", "confidence", "rationale", "format_label", "source_url", "block_id"],
  properties: {
    field: { type: "string", enum: [
      "race_date", "event_end_date", "location", "distance_km", "elevation_gain_m", "elevation_loss_m",
      "start_time", "end_time", "cutoff_times", "altitude_min_m", "altitude_max_m", "latitude", "longitude", "maps_url",
      "participation_mode", "gpx_url", "aid_stations", "mandatory_equipment", "bib_pickup", "access", "parking", "shuttle", "services",
      "social_links", "emergency_contact", "event_details",
    ] },
    format_label: { anyOf: [{ type: "string" }, { type: "null" }] },
    source_url: { type: "string", description: "Exact URL of the provided page containing this evidence" },
    block_id: { type: "string", minLength: 5, description: "Exact BLOCK identifier containing this evidence" },
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
  const optional = requestedFields.filter(field => !mandatory.includes(field));
  const prompt = {
    event_name: row.event_name,
    format_name: row.format_name,
    expected_distance_km: row.distance_km,
    source_url: row.official_website,
    target_edition_year: targetEdition(row),
    mandatory_fields: mandatory,
    optional_fields: optional,
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
        { role: "developer", content: "Tu analyses une page officielle de course trail. Utilise uniquement le texte fourni. N'invente jamais. Retourne uniquement des claims dont la preuve est une citation exacte du texte. Pour chaque claim lie a un format, renseigne format_label avec le nom officiel visible (ex: RENARDEAU), meme s'il differe du nom du prospect. Ignore les dates d'inscription, résultats historiques et archives si elles ne concernent pas l'édition du format demandé. Une distance présente uniquement dans un tarif, un relais, un résultat ou une offre ne prouve pas la distance du format. N'utilise jamais les informations pratiques d'une ancienne édition pour l'édition demandée. Si une information est ambiguë, ne la retourne pas." },
        { role: "developer", content: "Chaque claim doit reprendre le block_id et la source_url exacts du bloc contenant sa citation. Ne combine jamais plusieurs blocs et n'invente aucun identifiant." },
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
  try {
    const parsed = JSON.parse(content);
    return {...parsed,claims:groundLlmClaimsToBlocks(parsed.claims,extraction.document_blocks),usage:body.usage || null};
  } catch { return { claims: [], summary: "LLM contenu invalide : extraction deterministe conservee.", confidence: "none", error: "LLM contenu non JSON" }; }
};

export const fetchPage = async (url, row = {}, {fetchResource = cachedResearchResource} = {}) => {
  const errors = [];
  const resources = new Map();
  const fetchOne = async target => {
    if (isUnsafeResearchUrl(target)) throw new Error(`${target}: URL exclue de la recherche (liste de participants, résultats ou administration)`);
    const canonicalTarget = canonicalResearchUrl(target);
    if (!canonicalTarget) throw new Error(`${target}: invalid research URL`);
    const resource = await fetchResource(canonicalTarget);
    resources.set(canonicalTarget, resource);
    resources.set(canonicalResearchUrl(resource.url) || resource.url, resource);
    return resource.html;
  };
  const resourceFor = target => resources.get(canonicalResearchUrl(target)) || resources.get(target);
  const searchForOrganizer = async excludedHosts => {
    const query = [row.event_name,row.format_name,targetEdition(row),row.city,row.country,'site officiel'].filter(Boolean).join(' ');
    if (!query.trim()) return null;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    let searchHtml;
    try { searchHtml = await fetchOne(searchUrl); }
    catch (error) { errors.push({url:searchUrl,error:String(error.message || error)}); return null; }
    for (const candidate of searchResultCandidates(searchHtml,row).slice(0,8)) {
      try {
        const candidateUrl = new URL(candidate.href);
        if (excludedHosts.has(candidateUrl.hostname)) continue;
        const candidateHtml = await fetchOne(candidate.href);
        const resolved = resourceFor(candidate.href)?.url || candidate.href;
        if (likelyOrganizerPage(candidateHtml,resolved,row)) return {url:resolved,html:candidateHtml,search_url:searchUrl};
      } catch (error) { errors.push({url:candidate.href,error:String(error.message || error)}); }
    }
    return null;
  };
  let root = new URL(url);
  let rootHtml;
  let discoveredFrom = '';
  let discoveryMethod = '';
  try {
    rootHtml = await fetchOne(root.href);
    root = new URL(resourceFor(root.href).url);
  } catch (error) {
    errors.push({url, error:String(error.message || error)});
    let fallbackError = null;
    const originUrl = new URL('/',root).href;
    if (originUrl !== root.href) {
      try {
        const originHtml = await fetchOne(originUrl);
        if (pageMentionsExpectedEvent(originHtml,{...row,city:'',prospect_city:''})) { root = new URL(resourceFor(originUrl)?.url || originUrl); rootHtml = originHtml; discoveredFrom = url; discoveryMethod = 'origin_root'; }
      } catch (originError) { errors.push({url:originUrl,error:String(originError.message || originError)}); }
    }
    if (!rootHtml && row.race_url && row.race_url !== url) {
      try {
        const secondaryHtml = await fetchOne(String(row.race_url));
        const fallback = discoverOfficialFromSecondary(secondaryHtml, String(row.race_url))[0];
        if (fallback) { root = new URL(fallback.href); rootHtml = await fetchOne(root.href); discoveredFrom = String(row.race_url); }
      } catch (secondaryError) { fallbackError = secondaryError; errors.push({url:row.race_url,error:String(secondaryError.message || secondaryError)}); }
    }
    if (!rootHtml) {
      const excludedHosts = new Set([new URL(url).hostname]);
      try { if (row.race_url) excludedHosts.add(new URL(row.race_url).hostname); } catch { /* invalid fallback URL is already non-authoritative */ }
      const discovered = await searchForOrganizer(excludedHosts);
      if (!discovered) throw new Error(`${error.message}${fallbackError ? `; fallback: ${fallbackError.message}` : ''}; recherche de source: aucun site organisateur confirmé`);
      root = new URL(discovered.url); rootHtml = discovered.html; discoveredFrom = url; discoveryMethod = 'web_search';
    }
  }
  if (classifySourceUrl(root.href).role !== 'official_candidate') {
    const official = discoverOfficialFromSecondary(rootHtml,root.href)[0];
    if (official) {
      discoveredFrom = root.href;
      root = new URL(official.href);
      rootHtml = await fetchOne(root.href);
    } else {
      const discovered = await searchForOrganizer(new Set([root.hostname]));
      if (!discovered) throw new Error(`${root.href}: official organizer source not found; recherche de source: aucun site organisateur confirmé`);
      discoveredFrom = root.href; discoveryMethod = 'web_search'; root = new URL(discovered.url); rootHtml = discovered.html;
    }
  }
  if (weakOrganizerPage(rootHtml)) {
    let discovered = null;
    let weakRootDiscoveryMethod = '';
    for (const candidate of linkedOrganizerCandidates(rootHtml, root.href, row).slice(0, 6)) {
      try {
        const candidateHtml = await fetchOne(candidate.href);
        const resolved = resourceFor(candidate.href)?.url || candidate.href;
        if (likelyOrganizerPage(candidateHtml, resolved, row)) { discovered = {url:resolved,html:candidateHtml}; weakRootDiscoveryMethod = 'legacy_link'; break; }
      } catch (error) { errors.push({url:candidate.href,error:String(error.message || error)}); }
    }
    if (!discovered) { discovered = await searchForOrganizer(new Set([root.hostname])); weakRootDiscoveryMethod = discovered ? 'web_search' : ''; }
    if (discovered) { discoveredFrom = root.href; discoveryMethod = weakRootDiscoveryMethod; root = new URL(discovered.url); rootHtml = discovered.html; }
    else {
      const rendering = detectRenderingStatus(rootHtml);
      throw new Error(`${root.href}: ${rendering === 'js_only_suspected' ? 'page probablement rendue en JavaScript' : 'page organisateur vide ou inactive'}; recherche de source: aucun site organisateur confirmé`);
    }
  }
  const robustMaxPages = row.search_depth === "deep" ? DEEP_CRAWL_MAX_PAGES : CRAWL_MAX_PAGES;
  let robustPages = await crawlOrganizerPages({root,rootHtml,row,maxPages:robustMaxPages,fetchOne,resources,errors});
  let identity = assessSourceIdentity(robustPages,root.href,row);
  if (identity.status === SOURCE_IDENTITY_STATUS.UNKNOWN) {
    const rejectedRoot = root.href;
    let discovered = null;
    for (const candidate of linkedOrganizerCandidates(rootHtml,root.href,row).slice(0,6)) {
      try {
        const html = await fetchOne(candidate.href);
        const resolved = resourceFor(candidate.href)?.url || candidate.href;
        if (likelyOrganizerPage(html,resolved,row)) { discovered = {url:resolved,html,method:'legacy_link'}; break; }
      } catch (error) { errors.push({url:candidate.href,error:String(error.message || error)}); }
    }
    if (!discovered) {
      const searchResult = await searchForOrganizer(new Set([root.hostname]));
      if (searchResult) discovered = {...searchResult,method:'web_search'};
    }
    if (!discovered) throw new Error(`${rejectedRoot}: source identity not confirmed (score ${identity.score})`);
    discoveredFrom ||= rejectedRoot;
    discoveryMethod = discovered.method;
    root = new URL(discovered.url); rootHtml = discovered.html;
    robustPages = await crawlOrganizerPages({root,rootHtml,row,maxPages:robustMaxPages,fetchOne,resources,errors});
    identity = assessSourceIdentity(robustPages,root.href,row);
    if (identity.status === SOURCE_IDENTITY_STATUS.UNKNOWN) throw new Error(`${root.href}: discovered source identity not confirmed (score ${identity.score})`);
  }
  const renderingStatus = robustPages.some(page=>detectRenderingStatus(page.html)==='html_available') ? 'html_available' : 'js_only_suspected';
  return {
    html: robustPages.map(page=>page.html).join("\n<!-- OFFICIAL_PAGE_BREAK -->\n"),
    urls: robustPages.map(page=>page.url),
    page_catalog: robustPages.map(page=>pageCatalogEntry(page.url,page.html,row)),
    pages: robustPages.map(page=>{
      const pageIdentity = assessSourceIdentity([page],page.url,row);
      return {...page,...(resourceFor(page.url)||{}),identity_status:pageIdentity.status,identity_score:pageIdentity.score,
        authority:pageIdentity.status===SOURCE_IDENTITY_STATUS.VERIFIED&&new URL(page.url).hostname===root.hostname?'official':'secondary'};
    }),
    errors, resolved_url:root.href, discovered_from:discoveredFrom, discovery_method:discoveryMethod,
    source_identity_status:identity.status, source_identity_score:identity.score, source_identity:identity,
    rendering_status:renderingStatus,
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

export const enrichQueue = async (rows, { noLlm = false, limit = null, delayMs = 500, verbose = false, fetchImpl = fetchPage, llmImpl = callLlm,
  mcpClientFactory = createRaceResearchMcpClient, useMcp = fetchImpl === fetchPage && process.env.RACE_RESEARCH_USE_MCP !== '0', onRow = async () => {} } = {}) => {
  const api = {key:process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || '',
    url:process.env.LLM_API_URL?.trim() || 'https://api.openai.com/v1/chat/completions',
    model:process.env.OPENAI_ORGANIZER_IMPORT_MODEL?.trim() || process.env.LLM_MODEL?.trim() || 'gpt-4.1-mini'};
  const selected = limit === null ? rows : rows.slice(0, limit);
  let mcpClient = null;
  const closeMcp = () => { try { mcpClient?.close(); } catch { /* already closed */ } mcpClient = null; };
  const fetchSource = async (url,row) => {
    if (!useMcp) { row.crawl_transport = fetchImpl === fetchPage ? 'http_direct' : 'custom'; return fetchImpl(url,row); }
    const params = {url, event_name:row.event_name, format_name:row.format_name, distance_km:row.distance_km,
      target_edition_year:targetEdition(row), city:row.city, prospect_city:row.prospect_city, country:row.country,
      min_event_date:row.min_event_date, max_event_date:row.max_event_date,
      missing_fields:row.search_fields, search_depth:'deep', race_url:row.race_url};
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        mcpClient ||= await mcpClientFactory();
        const result = await mcpClient.callTool('crawl_source', params);
        row.crawl_transport = attempt ? 'mcp_stdio_restarted' : 'mcp_stdio';
        return result;
      } catch (error) {
        closeMcp();
        if (attempt === 0) { console.error(`MCP redémarré après erreur : ${error.message || error}`); continue; }
        console.error(`MCP indisponible pour ${row.event_name}, HTTP local : ${error.message || error}`);
      }
    }
    row.crawl_transport = 'http_direct_after_mcp';
    return fetchImpl(url,row);
  };
  const pageCache = new Map();
  try {
    for (const [index,row] of selected.entries()) {
      const started = Date.now();
      let fetched = null, extraction = null, llm = {claims:[]};
      console.error(`[${index+1}/${selected.length}] ${row.event_name} / ${row.format_name} — recherche en cours...`);
      // Never inherit a previously exported TRUE flag after a failed refresh.
      row.ready_to_import = 'FALSE';
      row.research_status = 'researching';
      row.field_provenance_json = '{}';
      row.verified_fields = '';
      row.research_errors_json = '[]';
      try {
        const source = row.official_website || row.race_url;
        if (!source) throw new Error('Source officielle ou secondaire manquante');
        row.search_fields = Object.keys(FIELD_COLUMNS).join(';');
        row.search_depth = 'deep';
        const pageKey = JSON.stringify([source,row.race_url,row.format_name,row.prospect_distance_km || row.distance_km,targetEdition(row)]);
        if (!pageCache.has(pageKey)) pageCache.set(pageKey, await fetchSource(source,row));
        fetched = pageCache.get(pageKey);
        if (fetched?.resolved_url) {
          row.official_website = fetched.resolved_url;
          row.source_role = classifySourceUrl(fetched.resolved_url).role;
          if (fetched.discovered_from) row.source_quality = fetched.discovery_method === 'web_search' ? 'discovered_search_organizer' : 'discovered_organizer';
        }
        row.source_identity_status = fetched?.source_identity_status || '';
        row.source_identity_score = fetched?.source_identity_score ?? '';
        row.source_identity_json = JSON.stringify(fetched?.source_identity || {});
        row.rendering_status = fetched?.rendering_status || '';
        row.source_role ||= classifySourceUrl(row.official_website).role;
        const records = fetched?.pages || [{url:row.official_website || source, html:typeof fetched === 'string' ? fetched : fetched.html}];
        const extracts = records.map(page => {
          const result = deterministicExtract(page.html, {...row,official_website:page.url});
          result.pages[0].authority = page.authority;
          return result;
        });
        const pages = extracts.flatMap(result=>result.pages);
        const ranked = extracts.map(result => {
          const page = result.pages[0];
          const pageDates = datesInText(page.text || '');
          const wrongEditionOnly = pageDates.length > 0 && !pageDates.some(date => date.slice(0,4) === targetEdition(row));
          const staleUrl = /archives?|resultats?/i.test(page.url) || [...page.url.matchAll(/\b(20\d{2})\b/g)].some(match => match[1] !== targetEdition(row));
          const transactionalUrl = /inscri|enregistrement|checkout|panier|commande/i.test(page.url);
          return {result, score:(page.format_context ? 100 : 0) + result.claims.length * 3 - (wrongEditionOnly ? 200 : staleUrl ? 40 : transactionalUrl ? 60 : 0)};
        }).sort((a,b)=>b.score-a.score);
        const selectedBlocks = selectDocumentBlocks(extracts.flatMap(result=>result.document_blocks || []),row,{maxChars:LLM_TEXT_LIMIT});
        const llmContext = renderDocumentBlockContext(selectedBlocks);
        extraction = {text:pages.map(p=>p.text).join(' '), validation_text:pages.map(p=>p.text).join(' '),pages,
          claims:extracts.flatMap(result=>result.claims), dates:[...new Set(extracts.flatMap(result=>result.dates))],
          document_blocks:selectedBlocks, llm_context:llmContext};
        row.source_pages_json = JSON.stringify([...new Set([source,...pages.map(page=>page.url),fetched?.discovered_from].filter(Boolean))]);
        row.page_catalog_json = JSON.stringify(fetched?.page_catalog || []);
        row.page_map_json = JSON.stringify(ranked.map(({result,score})=>({url:result.pages[0].url,relevance:score,method:'deterministic'})));
        row.research_errors_json = JSON.stringify(fetched?.errors || []);
        // A single semantic pass also researches optional logistics, even if the minimum is complete.
        if (!noLlm && row.source_role === 'official_candidate') {
          try { llm = await llmImpl(row,extraction,api); }
          catch (error) { llm = {claims:[],error:`LLM: ${error.message || error}`}; }
        }
        if (Array.isArray(llm.claims) && llm.claims.length) llm.claims = groundLlmClaimsToBlocks(llm.claims,selectedBlocks);
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
        pages:(extraction?.pages || []).map(page=>({url:page.url,title:page.title || '',text:page.text || '',authority:page.authority || ''})),
        request_context:extraction?.llm_context || '',llm_response:llm,errors:jsonValue(row.research_errors_json,[])});
      if (delayMs > 0 && index < selected.length-1) await sleep(delayMs);
    }
  } finally { closeMcp(); }
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

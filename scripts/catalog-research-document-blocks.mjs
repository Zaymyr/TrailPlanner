import { createHash } from "node:crypto";

const BLOCK_MAX_CHARS = 2_800;
const MANDATORY_FIELDS = ["race_date", "location", "distance_km", "elevation_gain_m"];
const FIELD_CUES = {
  race_date: /\b(?:date|edition|dimanche|samedi|vendredi|se tiendra|aura lieu|rendez-vous)\b/i,
  location: /\b(?:lieu|ville|commune|depart|arrivee|adresse|stade|salle|parking)\b/i,
  distance_km: /\b(?:distance|parcours|format|boucle|\d+(?:[.,]\d+)?\s*(?:km|kilometres?))\b/i,
  elevation_gain_m: /(?:\bd\s*\+|denivele|elevation|profil|\d[\d ]*\s*m\s*d\s*\+)/i,
  gpx_url: /\b(?:gpx|trace|roadbook|telechargement)\b/i,
  start_time: /\b(?:depart|horaire|heure|briefing)\b/i,
  event_end_date: /\b(?:fin|cloture|week-end|weekend)\b/i,
  cutoff_times: /\b(?:barriere|cut.?off|temps limite|limite horaire)\b/i,
  aid_stations: /\b(?:ravito|ravitaillement|point d'eau|assistance)\b/i,
  mandatory_equipment: /\b(?:equipement|materiel obligatoire)\b/i,
  bib_pickup: /\b(?:dossard|retrait|remise)\b/i,
  access: /\b(?:acces|venir|transport|gare|route)\b/i,
  parking: /\b(?:parking|stationnement|se garer)\b/i,
  shuttle: /\b(?:navette|bus)\b/i,
  services: /\b(?:service|sanitaire|douche|consigne)\b/i,
};

const ENTITY_VALUES = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", agrave: "à", acirc: "â", auml: "ä",
  ccedil: "ç", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", icirc: "î", iuml: "ï",
  ocirc: "ô", ouml: "ö", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", hellip: "…", deg: "°",
};

const decodeEntities = value => String(value || "")
  .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (match, hex, decimal) => {
    try { return String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)); } catch { return match; }
  })
  .replace(/&([a-z]+);/gi, (match, name) => ENTITY_VALUES[name.toLowerCase()] ?? match);

const cleanText = value => decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ").trim();
const normalized = value => cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const stableId = (sourceUrl, headingPath, text, occurrence) => `blk_${createHash("sha256")
  .update(`${sourceUrl}\n${headingPath.join(" > ")}\n${normalized(text)}\n${occurrence}`)
  .digest("hex").slice(0, 16)}`;

const splitLongBlock = text => {
  if (text.length <= BLOCK_MAX_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|$)/g)?.map(cleanText).filter(Boolean) || [text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > BLOCK_MAX_CHARS) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < sentence.length; offset += BLOCK_MAX_CHARS) chunks.push(sentence.slice(offset, offset + BLOCK_MAX_CHARS));
      current = "";
    } else if (!current || current.length + sentence.length + 1 <= BLOCK_MAX_CHARS) current = `${current} ${sentence}`.trim();
    else { chunks.push(current); current = sentence; }
  }
  if (current) chunks.push(current);
  return chunks;
};

const detectMetadata = text => {
  const search = normalized(text);
  const dates = [...new Set([
    ...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g),
    ...text.matchAll(/\b(\d{1,2}(?:er)?\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+20\d{2})?)\b/gi),
  ].map(match => match[1]))];
  const distances_km = [...new Set([...search.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:km|kilometres?)\b/g)]
    .map(match => Number(match[1].replace(",", "."))).filter(Number.isFinite))];
  const field_cues = Object.entries(FIELD_CUES).filter(([, pattern]) => pattern.test(search)).map(([field]) => field);
  return { dates, distances_km, field_cues };
};

export const buildDocumentBlocks = (html, sourceUrl) => {
  const source = String(html || "")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, content) => `\n@@HEADING:${level}:${cleanText(content)}@@\n`)
    .replace(/<\/?(?:p|li|tr|td|th|dt|dd|blockquote|pre|article|section|div)\b[^>]*>/gi, "\n");
  const headings = [];
  const records = [];
  let buffered = "";
  const flush = () => {
    const text = cleanText(buffered);
    buffered = "";
    if (!text) return;
    for (const part of splitLongBlock(text)) records.push({ heading_path: [...headings], text: part });
  };
  for (const line of source.split(/\r?\n/)) {
    const marker = line.match(/^\s*@@HEADING:(\d):([\s\S]*?)@@\s*$/);
    if (marker) {
      flush();
      const level = Number(marker[1]);
      headings.length = level - 1;
      headings[level - 1] = cleanText(marker[2]);
    } else if (cleanText(line)) {
      if (buffered) flush();
      buffered = line;
    }
  }
  flush();
  const occurrences = new Map();
  return records.map(record => {
    const occurrenceKey = `${record.heading_path.join(" > ")}\n${normalized(record.text)}`;
    const occurrence = occurrences.get(occurrenceKey) || 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    return {
      block_id: stableId(sourceUrl, record.heading_path, record.text, occurrence),
      source_url: sourceUrl,
      heading_path: record.heading_path,
      section: record.heading_path.at(-1) || "document",
      text: record.text,
      ...detectMetadata(record.text),
    };
  });
};

const expectedDistances = row => [row.distance_km, row.prospect_distance_km]
  .map(Number).filter(Number.isFinite);
const formatTerms = row => [row.format_name, row.format_raw, row.event_name]
  .map(normalized).filter(value => value.length >= 3);
const distanceMatches = (actual, expected) => expected.some(value => Math.abs(actual - value) <= Math.max(1, value * .12));

export const scoreDocumentBlock = (block, row = {}, priorityFields = MANDATORY_FIELDS) => {
  const text = normalized(`${block.heading_path.join(" ")} ${block.text}`);
  const expected = expectedDistances(row);
  const matchesExpected = block.distances_km.some(value => distanceMatches(value, expected));
  const hasNeighborOnly = expected.length > 0 && block.distances_km.length > 0 && !matchesExpected;
  const requestedCues = block.field_cues.filter(field => priorityFields.includes(field)).length;
  const formatMatch = formatTerms(row).some(term => text.includes(term));
  return requestedCues * 24 + (matchesExpected ? 80 : 0) + (formatMatch ? 35 : 0)
    - (hasNeighborOnly ? 90 : 0)
    - (/\b(?:archives?|resultats?|classement|photos?|videos?)\b/i.test(text) ? 100 : 0);
};

export const selectDocumentBlocks = (blocks, row = {}, {
  maxChars = 24_000, mandatoryFields = MANDATORY_FIELDS, optionalFields = Object.keys(FIELD_CUES).filter(field => !MANDATORY_FIELDS.includes(field)),
} = {}) => {
  const unique = [...new Map((blocks || []).map(block => [block.block_id, block])).values()];
  const selected = [];
  let used = 0;
  const take = (candidates, section, ceiling = maxChars) => {
    for (const block of candidates) {
      if (selected.some(item => item.block_id === block.block_id)) continue;
      const cost = block.text.length + block.source_url.length + block.section.length + 100;
      if (used + cost > ceiling) continue;
      selected.push({...block, context_section:section});
      used += cost;
    }
  };
  const rank = fields => unique.map(block => ({block,score:scoreDocumentBlock(block,row,fields)}))
    .filter(item => item.score > 0).sort((a,b)=>b.score-a.score || a.block.block_id.localeCompare(b.block.block_id)).map(item=>item.block);
  const mandatoryCeiling = Math.floor(maxChars * .7);
  take(rank(mandatoryFields), "mandatory", mandatoryCeiling);
  take(rank(optionalFields), "optional");
  take(rank(mandatoryFields), "mandatory");
  if (!selected.length) take(unique, "fallback");
  return selected;
};

export const renderDocumentBlockContext = blocks => (blocks || []).map(block => [
  `[BLOCK ${block.block_id}]`,
  `SOURCE ${block.source_url}`,
  `SECTION ${block.heading_path.join(" > ") || block.section}`,
  block.text,
].join("\n")).join("\n---\n");

export const groundLlmClaimsToBlocks = (claims, blocks) => {
  const byId = new Map((blocks || []).map(block => [block.block_id, block]));
  return (claims || []).flatMap(claim => {
    const block = byId.get(claim?.block_id);
    if (!block || claim.source_url !== block.source_url) return [];
    const evidence = cleanText(claim.evidence);
    if (!evidence || !normalized(block.text).includes(normalized(evidence))) return [];
    return [{...claim, evidence, source_url:block.source_url, block_id:block.block_id}];
  });
};

export const DOCUMENT_BLOCK_MANDATORY_FIELDS = MANDATORY_FIELDS;

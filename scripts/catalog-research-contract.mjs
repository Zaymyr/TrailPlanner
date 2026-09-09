// Shared, dependency-free contract for research CSVs, evidence and draft requests.
export const RESEARCH_SCHEMA_VERSION = "2";
export const FIELD_COLUMNS = {
  race_date: "candidate_event_date", location: "format_location", distance_km: "distance_km",
  elevation_gain_m: "elevation_gain_m", elevation_loss_m: "elevation_loss_m",
  event_end_date: "event_end_date", start_time: "format_start_time", end_time: "format_end_time",
  altitude_min_m: "altitude_min_m", altitude_max_m: "altitude_max_m", latitude: "latitude", longitude: "longitude",
  maps_url: "maps_url", participation_mode: "participation_mode", gpx_url: "gpx_url",
  aid_stations: "aid_stations_json", cutoff_times: "cutoff_times_json", mandatory_equipment: "mandatory_equipment",
  bib_pickup: "bib_pickup_json", access: "access_json", parking: "parking_json", shuttle: "shuttle_json",
  services: "services_json", social_links: "event_social_links_json", emergency_contact: "event_contact_json",
  event_details: "event_details_json",
};
export const REQUIRED_FIELDS = ["race_date", "location", "distance_km"];
export const jsonValue = (raw, fallback = {}) => {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
};
export const numericValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};
export const normalizeText = (text) => String(text ?? "")
  .replace(/&(?:nbsp|#160);/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"').replace(/&(?:apos|#39);/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : " ")
  .replace(/&#x([\da-f]+);/gi, (_, code) => parseInt(code, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(code, 16)) : " ")
  .replace(/&(eacute|egrave|ecirc|agrave|acirc|ocirc|icirc|ucirc|ugrave|ccedil|rsquo|lsquo|ndash|mdash);/gi,
    (_, entity) => ({eacute:"é",egrave:"è",ecirc:"ê",agrave:"à",acirc:"â",ocirc:"ô",icirc:"î",ucirc:"û",ugrave:"ù",ccedil:"ç",rsquo:"'",lsquo:"'",ndash:"-",mdash:"-"})[entity.toLowerCase()])
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
export const parseResearchDate = (value, { spreadsheet = false } = {}) => {
  const raw = normalizeText(value);
  if (spreadsheet && /^\d{5}(?:[.,]\d+)?$/.test(raw)) {
    const days = Number(raw.replace(",", "."));
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(days) * 86400000).toISOString().slice(0, 10);
  }
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year, month, day;
  if (match) [, year, month, day] = match;
  else {
    match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (match) [, day, month, year] = match;
    else {
      match = raw.match(/^(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})$/);
      if (!match || !MONTHS.includes(match[2])) return "";
      day = match[1]; month = MONTHS.indexOf(match[2]) + 1; year = match[3];
    }
  }
  const result = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (result.getUTCFullYear() !== Number(year) || result.getUTCMonth() + 1 !== Number(month) || result.getUTCDate() !== Number(day)) return "";
  return result.toISOString().slice(0, 10);
};
export const datesInText = (text) => [...normalizeText(text).replace(/(\d{4}-\d{2}-\d{2})t(?=\d)/g,"$1 ").matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}(?:er)?\s+(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+\d{4})\b/g)]
  .map(match => parseResearchDate(match[0])).filter(Boolean);
export const targetEdition = (row) => String(row.target_edition_year || row.prospect_date || row.priority_date || row.candidate_event_date || "")
  .match(/\b(20\d{2})\b/)?.[1] || "";
export const classifySourceUrl = (value) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    const host = url.hostname.toLowerCase();
    if (/(^|\.)(facebook|instagram|linkedin|youtube|tiktok)\./.test(host)) return {role:"social",quality:"low"};
    if (/(^|\.)(betrail|runtrail|kerrun|normandiecourseapied|klikego|chrono-?start|njuko|milesrepublic|sportsnconnect|timepulse|protiming|ikinoa|ats-sport|helloasso|billetweb|le-sportif|espace-competition|logicourse|chronopale|chronopuces|nordsport-chronometrage|wanatime|finishers|pyreneeschrono|ok-time|sportips)\./.test(host)) return {role:"registration_or_aggregator",quality:"secondary"};
    return {role:"official_candidate",quality:"unclassified"};
  } catch { return {role:"invalid",quality:"invalid"}; }
};
export const isUnsafeResearchUrl = value => {
  try {
    const url = new URL(value);
    let target = `${url.pathname} ${url.search}`;
    try { target = decodeURIComponent(target); } catch { /* inspect the encoded path conservatively */ }
    const normalized = normalizeText(target).replace(/[^a-z0-9]+/g, "-");
    return /(?:^|-)(?:admin|wp-admin|participants?|inscrits?|resultats?|classements?|exports?)(?:-|$)/.test(normalized)
      || /(?:liste|listing)(?:-|)*(?:des-)?(?:inscriptions?|inscrits?|participants?)(?:-|$)/.test(normalized)
      || /(?:inscrits?|participants?)(?:-|)*(?:liste|listing|export)(?:-|$)/.test(normalized)
      || /(?:^|-)(?:comptes?-rendus?|bilans?|race-recaps?)(?:-|$)/.test(normalized)
      || /(?:^|-)(?:download|action)-export(?:-|$)/.test(normalized);
  } catch { return false; }
};
export const normalizeAidStations = (value) => {
  const records = jsonValue(value, []);
  if (!Array.isArray(records)) return [];
  return records.filter(item => item && typeof item === "object").map(item => {
    const distanceKm = numericValue(item.distanceKm ?? item.km);
    const result = {name:String(item.name || item.position || "").trim(), details: item.details || item.type || ""};
    if (distanceKm !== null && distanceKm >= 0) result.distanceKm = distanceKm;
    for (const field of ["waterRefill", "solidRefill", "assistanceAllowed"]) if (typeof item[field] === "boolean") result[field] = item[field];
    return result;
  }).filter(item => item.name || item.distanceKm !== undefined || item.details);
};
export const verifiedValue = (row, field) => {
  const proof = jsonValue(row.field_provenance_json)[field];
  const conflicts = String(row.conflict_fields || "").split(";");
  if (row.research_schema_version !== RESEARCH_SCHEMA_VERSION || !proof || proof.status !== "verified" || !proof.source_url || !proof.evidence || conflicts.includes(field)) return undefined;
  const value = row[FIELD_COLUMNS[field]];
  if (value === undefined || value === "" || value === null) return undefined;
  const comparable = item => typeof item === "object" ? JSON.stringify(item) : String(item);
  return comparable(proof.value) === comparable(value) ? proof.value : undefined;
};

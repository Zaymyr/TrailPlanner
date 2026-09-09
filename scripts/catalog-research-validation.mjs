import { RESEARCH_SCHEMA_VERSION, FIELD_COLUMNS, REQUIRED_FIELDS, jsonValue, numericValue,
  normalizeText, parseResearchDate, datesInText, targetEdition, classifySourceUrl, isUnsafeResearchUrl, normalizeAidStations, verifiedValue } from "./catalog-research-contract.mjs";

const NUMERIC_FIELDS = new Set(["distance_km", "elevation_gain_m", "elevation_loss_m", "altitude_min_m", "altitude_max_m", "latitude", "longitude"]);
const FORMAT_FIELDS = new Set(["distance_km", "elevation_gain_m", "elevation_loss_m", "start_time", "end_time", "cutoff_times", "gpx_url", "aid_stations", "participation_mode", "mandatory_equipment"]);
const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const distances = text => [...normalizeText(text).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:km|kms|k|kilometres?)\b/g)].map(m => Number(m[1].replace(",", ".")));
const evidenceContainsYearlessDate = (date, evidence) => {
  const [, month, day] = String(date).match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  if (!month || !day) return false;
  const monthName = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"][Number(month)-1];
  return new RegExp(`\\b(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+)?0?${Number(day)}(?:er)?\\s+${monthName}\\b`).test(normalizeText(evidence));
};
const dateWindows = (date, evidence) => {
  const [, month, day] = String(date).match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  if (!month || !day) return [];
  const monthName = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"][Number(month)-1];
  const text = normalizeText(evidence);
  const pattern = new RegExp(`\\b0?${Number(day)}(?:er)?\\s+${monthName}\\b`, "g");
  return [...text.matchAll(pattern)].map(match=>text.slice(Math.max(0,match.index-80),Math.min(text.length,match.index+match[0].length+100)));
};
const weekdayContradictsDate = (date, evidence) => {
  const weekdays = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const expected = weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const [, month, day] = String(date).match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  const monthName = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"][Number(month)-1];
  if (!monthName || !day) return false;
  const pair = new RegExp(`\\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\\s+0?${Number(day)}(?:er)?\\s+${monthName}\\b`,"g");
  return [...normalizeText(evidence).matchAll(pair)].some(match=>match[1] !== expected);
};
const dateHasOnlyAdministrativeContext = (date, evidence) => {
  const windows = dateWindows(date,evidence);
  if (!windows.length) return false;
  const [, month, day] = String(date).match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  const monthName = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"][Number(month)-1];
  const datePattern = `0?${Number(day)}(?:er)?\\s+${monthName}`;
  const administrative = /retrait(?:\s+des?)?\s+dossards?|cloture(?:\s+des?)?\s+inscriptions?|inscriptions?\s+(?:ouverte|fermee|jusqu)|(?:inscription|chrono.?start|pps)[^.!?]{0,120}\bjusqu|date\s+limite|publie\s+le|publication|mise\s+a\s+jour|tarifs?|missions?\s+debuteront|benevol/;
  const eventSignal = "(?:depart|partira|aura\\s+lieu|se\\s+deroul(?:e|era)|epreuve\\s+(?:aura|est\\s+organisee)|course\\s+(?:aura|se\\s+deroul)|rendez-vous)";
  const raceStartOnDate = new RegExp(`${eventSignal}[^.!?]{0,70}\\b${datePattern}\\b|\\b${datePattern}\\b[^.!?]{0,70}${eventSignal}`);
  return windows.every(window=>administrative.test(window) && !raceStartOnDate.test(window));
};
const sourceIsHistoricalArchive = (sourceUrl, row) => {
  const expected = targetEdition(row);
  let decoded = String(sourceUrl || "");
  try { decoded = decodeURIComponent(decoded); } catch { /* retain malformed URL text for conservative validation */ }
  const source = normalizeText(decoded);
  if (!expected) return false;
  const years = [...source.matchAll(/(?<!\d)20\d{2}(?!\d)/g)].map(match=>match[0]);
  const historicalSection = /(?:result|classement|photo|video|edition(?:s)?[^a-z0-9]+precedente|archive)/.test(source);
  if (historicalSection && !years.includes(expected)) return true;
  return years.some(year=>year !== expected) && !years.includes(expected) && !/reglement/.test(source);
};
const citationTokens = value => normalizeText(value).match(/[a-z0-9]+/g) || [];
export const citationMatchesPage = (evidence, pageText) => {
  const citation = normalizeText(evidence);
  const page = normalizeText(pageText);
  if (!citation || !page) return false;
  if (page.includes(citation)) return true;
  const evidenceTokens = citationTokens(citation);
  if (evidenceTokens.length < 5) return false;
  const pageTokens = citationTokens(page);
  const pageTrigrams = new Set(pageTokens.slice(0,-2).map((token,index)=>`${token} ${pageTokens[index+1]} ${pageTokens[index+2]}`));
  const evidenceTrigrams = evidenceTokens.slice(0,-2).map((token,index)=>`${token} ${evidenceTokens[index+1]} ${evidenceTokens[index+2]}`);
  return evidenceTrigrams.filter(trigram=>pageTrigrams.has(trigram)).length / evidenceTrigrams.length >= .7;
};
export const evidenceIdentifiesFormat = (evidence, row) => {
  const normalized = normalizeText(evidence);
  const expected = numericValue(row.prospect_distance_km ?? row.distance_km);
  const found = [...new Set(distances(normalized))];
  if (expected !== null && (found.includes(expected) || found.length === 1 && Math.abs(found[0] - expected) <= Math.max(1, expected * .12))) return true;
  const name = normalizeText(row.format_name);
  return Boolean(name && !/^\d/.test(name) && normalized.includes(name));
};
const evidenceIdentifiesAnotherFormat = (evidence, row) => {
  const expected = numericValue(row.prospect_distance_km ?? row.distance_km);
  const found = [...new Set(distances(evidence))];
  return expected !== null && found.length > 0 && !found.some(value => Math.abs(value - expected) <= Math.max(1, expected * .12));
};
const sourceIdentifiesAnotherFormat = (sourceUrl, row) => {
  let source = String(sourceUrl || "");
  try { source = decodeURIComponent(new URL(source).pathname); } catch { /* malformed sources fail elsewhere */ }
  return evidenceIdentifiesAnotherFormat(source.replace(/[-_/]+/g," "),row);
};
const locationTokens = value => normalizeText(value).match(/[a-z0-9]+/g) || [];
const equivalentLocations = (left, right) => {
  const a = locationTokens(left), b = locationTokens(right);
  if (!a.length || !b.length) return false;
  const postalA = a.filter(token=>/^\d{5}$/.test(token)), postalB = b.filter(token=>/^\d{5}$/.test(token));
  if (postalA.length && postalB.length && !postalA.some(token=>postalB.includes(token))) return false;
  const [shorter,longer] = a.length <= b.length ? [a,b] : [b,a];
  return shorter.every(token=>longer.includes(token));
};
const eventWide = (field, evidence) => ["mandatory_equipment", "bib_pickup", "access", "parking", "shuttle", "services"].includes(field)
  && /toutes? les courses|tous les formats|pour les deux|chaque course|tous les participants/.test(normalizeText(evidence));
const tokensSupported = (value, evidence) => {
  const tokens = normalizeText(value).match(/[a-z0-9]+/g) || [];
  const haystack = ` ${normalizeText(evidence).replace(/[^a-z0-9]+/g, " ")} `;
  return tokens.length > 0 && tokens.every(token => haystack.includes(` ${token} `));
};
const normalizedClaim = claim => {
  let value = claim?.value;
  if (NUMERIC_FIELDS.has(claim?.field)) value = numericValue(value);
  if (claim?.field === "gpx_url" && !/^https?:\/\//i.test(String(value))) {
    const id = String(value).match(/openrunner\s*(?:n(?:°|o|º)?\s*)?(\d{5,})/i)?.[1];
    if (id) value = `https://www.openrunner.com/route-details/${id}`;
  }
  if (["race_date", "event_end_date"].includes(claim?.field)) value = parseResearchDate(value);
  if (["start_time", "end_time"].includes(claim?.field)) {
    const match = String(value || "").match(/^(\d{1,2})[:h](\d{2})$/i);
    value = match && Number(match[1]) < 24 && Number(match[2]) < 60 ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  }
  return {...claim, value};
};
export const validateClaimForRow = (input, row) => {
  const claim = normalizedClaim(input);
  if (!(claim.field in FIELD_COLUMNS) || claim.value === null || claim.value === undefined || claim.value === "") return "invalid_value";
  if (isUnsafeResearchUrl(claim.source_url)) return "unsafe_source";
  if (sourceIsHistoricalArchive(claim.source_url,row)) return "historical_evidence";
  if (FORMAT_FIELDS.has(claim.field) && !evidenceIdentifiesFormat(claim.evidence, row) && !eventWide(claim.field, claim.evidence)) return "format_context_missing";
  const isDateField = claim.field === "race_date" || claim.field === "event_end_date";
  if (!isDateField) {
    const evidenceText = normalizeText(claim.evidence);
    const evidenceYears = [...new Set(evidenceText.match(/\b20\d{2}\b/g) || [])];
    const expectedYear = targetEdition(row);
    const historicalEdition = expectedYear && evidenceYears.length && !evidenceYears.includes(expectedYear)
      && /(?:edition|resultats?|photos?|video|trail|course)[^.!?]{0,80}\b20\d{2}\b/.test(evidenceText)
      && !/(?:ne(?:e|es|s)|avant le|categorie|espoirs?|u23|juniors?)\b/.test(evidenceText);
    if (historicalEdition) return "historical_evidence";
    if (claim.field === "location") {
      const evidenceText = normalizeText(claim.evidence);
      const administrativeVenue = /(?:retrait|remise)[^.!?]{0,50}dossards?|notre\s+adresse|adresse\s+du\s+(?:club|siege|contact)/.test(evidenceText);
      const eventVenue = /(?:lieu|site)\s+(?:de\s+)?(?:depart|arrivee)|(?:depart|arrivee)\s+(?:a|au|aux)|aura\s+lieu|se\s+deroul/.test(evidenceText);
      if (administrativeVenue && !eventVenue) return "location_context_ambiguous";
    }
  }
  if (isDateField) {
    if (targetEdition(row) && claim.value.slice(0,4) !== targetEdition(row)) return "edition_mismatch";
    if (claim.method === "deterministic_inferred_year") {
      const evidenceText = normalizeText(claim.evidence);
      const expectedYear = targetEdition(row);
      const otherYears = [...new Set(evidenceText.match(/\b20\d{2}\b/g) || [])].filter(year=>year !== expectedYear);
      const tiedToOlderEdition = otherYears.some(year=>new RegExp(`(?:edition|publie le|aura lieu|se deroul(?:e|era))[^.!?]{0,100}\\b${year}\\b|\\b${year}\\b[^.!?]{0,60}(?:edition|trail|course)`).test(evidenceText));
      if (tiedToOlderEdition) return "historical_evidence";
    }
    if (row.min_event_date && claim.value < row.min_event_date) return "date_outside_campaign";
    if (row.max_event_date && claim.value > row.max_event_date) return "date_outside_campaign";
    if (weekdayContradictsDate(claim.value,claim.evidence)) return "weekday_mismatch";
    if (claim.field === "race_date" && sourceIdentifiesAnotherFormat(claim.source_url,row)) return "neighboring_format";
    if (claim.field === "race_date" && evidenceIdentifiesAnotherFormat(claim.evidence,row)) return "neighboring_format";
    if (claim.field === "race_date" && claim.method === "deterministic_inferred_year"
      && /\b\d{1,2}\s*(?:&|et|au|-)\s*\d{1,2}\s+(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/.test(normalizeText(claim.evidence))
      && !evidenceIdentifiesFormat(claim.evidence,row)) return "date_context_ambiguous";
    if (dateHasOnlyAdministrativeContext(claim.value,claim.evidence)) return "date_context_ambiguous";
    if (!datesInText(claim.evidence).includes(claim.value)
      && !(claim.method === "deterministic_inferred_year" && evidenceContainsYearlessDate(claim.value, claim.evidence))) return "value_not_in_evidence";
    if (/(?:inscription|tarif).*(?:jusqu|avant|cloture)|cloture.*inscription/.test(normalizeText(claim.evidence)) && !/(?:course|epreuve|trail).*(?:aura lieu|se deroul|depart)/.test(normalizeText(claim.evidence))) return "date_context_ambiguous";
  } else if (NUMERIC_FIELDS.has(claim.field)) {
    if (claim.field === "distance_km" && claim.value <= 0) return "invalid_value";
    if (claim.field.startsWith("elevation_") && claim.value < 0) return "invalid_value";
    if (claim.field === "latitude" && Math.abs(claim.value) > 90 || claim.field === "longitude" && Math.abs(claim.value) > 180) return "invalid_value";
    const numberText = escape(claim.value).replace("\\.", "[.,]");
    const normalizedEvidence = normalizeText(claim.evidence).replace(/(\d)[ \u00a0\u202f](?=\d{3}\b)/g, "$1");
    if (claim.field === "distance_km") {
      if (!distances(claim.evidence).includes(claim.value)) return "unit_not_in_evidence";
    } else if (!new RegExp(`(?<![\\d.,])${numberText}(?![\\d.,])`).test(normalizedEvidence)) return "value_not_in_evidence";
    if (claim.field === "distance_km" && /(?:€|\beur(?:o)?s?\b)/i.test(claim.evidence)
      && !/(?:distance|parcours|course\s+chronometree|epreuve\s+(?:de\s+)?\d)/.test(normalizedEvidence)) return "distance_context_ambiguous";
    const expected = numericValue(row.prospect_distance_km ?? row.distance_km);
    if (claim.field === "distance_km" && expected !== null && Math.abs(expected - claim.value) > Math.max(1, expected * .12)) return "distance_mismatch";
    if (claim.field === "elevation_gain_m" && !new RegExp(`(?:d\\s*\\+\\s*[:=-]?\\s*${numberText}(?![\\d.,])|(?<![\\d.,])${numberText}\\s*m?\\s*d\\s*\\+|denivele positif(?: total)?(?: de)?\\s*${numberText}(?![\\d.,]))`).test(normalizedEvidence)) return "unit_not_in_evidence";
  } else if (["start_time", "end_time"].includes(claim.field)) {
    const [hour, minute] = claim.value.split(":");
    if (!new RegExp(`\\b0?${Number(hour)}\\s*[:h]\\s*${minute}\\b`).test(normalizeText(claim.evidence))) return "value_not_in_evidence";
    if (claim.field === "start_time" && /dossard|inscription/.test(normalizeText(claim.evidence)) && !/depart/.test(normalizeText(claim.evidence))) return "time_context_ambiguous";
  } else if (claim.field === "gpx_url" || claim.field === "maps_url") {
    try { if (!["http:","https:"].includes(new URL(claim.value).protocol)) return "invalid_url"; } catch { return "invalid_url"; }
    const reference = String(claim.value).match(/^https:\/\/www\.openrunner\.com\/route-details\/(\d+)$/)?.[1];
    const explicitReference = reference && new RegExp(`openrunner\\s*(?:n(?:°|o|º)?\\s*)?${reference}\\b`,"i").test(claim.evidence);
    if (!normalizeText(claim.evidence).includes(normalizeText(claim.value)) && !explicitReference) return "value_not_in_evidence";
  } else {
    const structured = typeof claim.value === "string" ? jsonValue(claim.value, null) : claim.value;
    const values = item => item && typeof item === "object" ? Object.values(item).flatMap(values) : [item];
    const leaves = structured !== null && typeof structured === "object" ? values(structured) : [claim.value];
    if (leaves.some(value => typeof value === "boolean" || !tokensSupported(value, claim.evidence))) return "value_not_in_evidence";
  }
  return "";
};

export const refreshImportReadiness = (row) => {
  const proofs = jsonValue(row.field_provenance_json);
  const conflicts = new Set(String(row.conflict_fields || "").split(";").filter(Boolean));
  const prospectDistance = numericValue(row.prospect_distance_km);
  const officialDistance = numericValue(proofs.distance_km?.value);
  const formatDrift = prospectDistance !== null && officialDistance !== null
    && Math.abs(prospectDistance - officialDistance) >= Math.max(1, prospectDistance * .03);
  if (formatDrift) conflicts.add("format_identity"); else conflicts.delete("format_identity");
  row.conflict_fields = [...conflicts].join(";");
  const verified = Object.keys(FIELD_COLUMNS).filter(field => verifiedValue(row, field) !== undefined);
  row.verified_fields = verified.join(";");
  const statuses = Object.fromEntries([...REQUIRED_FIELDS, "elevation_gain_m"].map(field => [field,
    verified.includes(field) ? "verified" : row[FIELD_COLUMNS[field]] !== "" && row[FIELD_COLUMNS[field]] != null ? "candidate" : "missing"]));
  row.required_fields_status_json = JSON.stringify(statuses);
  row.missing_fields = Object.keys(statuses).filter(field => statuses[field] === "missing").join(";");
  row.unverified_fields = Object.keys(statuses).filter(field => statuses[field] !== "verified").join(";");
  const date = verifiedValue(row, "race_date");
  const validDate = date && parseResearchDate(date) && (!targetEdition(row) || date.slice(0,4) === targetEdition(row))
    && (!row.min_event_date || date >= row.min_event_date) && (!row.max_event_date || date <= row.max_event_date);
  const ready = row.research_schema_version === RESEARCH_SCHEMA_VERSION && row.source_role === "official_candidate"
    && classifySourceUrl(row.official_website).role === "official_candidate"
    && REQUIRED_FIELDS.every(field => verified.includes(field)) && !conflicts.has("format_identity") && validDate;
  row.ready_to_import = ready ? "TRUE" : "FALSE";
  row.research_status = ready ? "ready_to_import" : ["source_error", "missing_official_source"].includes(row.research_status) ? row.research_status : Object.keys(proofs).length ? "review_required" : "needs_enrichment";
  row.verified_pct = String(Math.round(verified.length / Object.keys(FIELD_COLUMNS).length * 100));
  row.official_date = verified.includes("race_date") ? row.candidate_event_date : "";
  row.official_location = verified.includes("location") ? row.format_location : "";
  row.official_distance_km = verified.includes("distance_km") ? row.distance_km : "";
  row.official_source_url = proofs.race_date?.source_url || proofs.location?.source_url || "";
  row.verification_alert = [row.unverified_fields && `Non vérifié : ${row.unverified_fields}`, row.conflict_fields && `Conflits : ${row.conflict_fields}`,
    jsonValue(row.rejected_claims_json, []).length && "Contexte / propositions rejetées : consulter rejected_claims_json",
    ...jsonValue(row.research_errors_json, []).map(error => typeof error === "string" ? error : error.error)].filter(Boolean).join(" | ");
  return row;
};

export const applyClaims = (row, extraction, llm = {}) => {
  row.prospect_date ??= row.candidate_event_date || "";
  row.prospect_distance_km ??= row.distance_km || "";
  row.prospect_elevation_gain_m ??= row.elevation_gain_m || "";
  row.target_edition_year ||= targetEdition(row);
  const pages = extraction.pages || [{url: row.official_website, text: extraction.validation_text || extraction.text || ""}];
  const proposals = [...(extraction.claims || []), ...(Array.isArray(llm.claims) ? llm.claims : [])];
  const proofs = {}, rejected = [], conflicts = new Set();
  for (const proposal of proposals) {
    const claim = normalizedClaim(proposal);
    const page = pages.find(p => (!claim.source_url || p.url === claim.source_url) && claim.evidence && citationMatchesPage(claim.evidence,p.text));
    let reason = !page ? "evidence_not_found" : "";
    if (!reason) {
      try { if (new URL(page.url).hostname !== new URL(row.official_website).hostname || page.authority === "secondary" || classifySourceUrl(page.url).role !== "official_candidate") reason = "secondary_source"; }
      catch { reason = "invalid_source"; }
    }
    if (!reason && targetEdition(row) && claim.method !== 'deterministic_inferred_year') {
      const pageDates = datesInText(page.text || "");
      if (pageDates.length && !pageDates.some(date => date.slice(0, 4) === targetEdition(row))) reason = "edition_mismatch";
    }
    if (!reason) reason = validateClaimForRow({...claim, evidence: [page.format_context, claim.evidence].filter(Boolean).join(" ")}, row);
    if (reason) { rejected.push({...claim, reason}); continue; }
    let value = claim.value;
    if (claim.field === "aid_stations") {
      const stations = normalizeAidStations(value);
      if (stations.length) value = JSON.stringify(stations);
    }
    const column = FIELD_COLUMNS[claim.field];
    const pageDistances = [...new Set(distances(page.text || ''))];
    const expectedDistance = numericValue(row.prospect_distance_km ?? row.distance_km);
    const namedPage = claim.format_label && normalizeText(page.title || '').includes(normalizeText(claim.format_label));
    const pageHasSingleMatchingDistance = expectedDistance !== null && pageDistances.length === 1 && Math.abs(pageDistances[0]-expectedDistance) <= Math.max(1,expectedDistance*.12);
    const singleDistanceScopesClaim = pageHasSingleMatchingDistance && (claim.field !== 'race_date' || evidenceIdentifiesFormat(claim.evidence,row));
    const baseSpecificity = page.format_context || namedPage || singleDistanceScopesClaim ? 3
      : evidenceIdentifiesFormat(claim.evidence,row) ? 2 : 1;
    const transactionalPage = /(?:inscri|enregistrement|checkout|panier|commande)/.test(normalizeText(page.url));
    const specificity = Math.max(0, baseSpecificity - (transactionalPage ? 2 : 0));
    const existing = proofs[claim.field];
    if (existing && claim.field === "location" && String(existing.value) !== String(value) && equivalentLocations(existing.value,value)) {
      const useNew = specificity > existing.specificity || specificity === existing.specificity && String(value).length > String(existing.value).length;
      if (!useNew) { rejected.push({...claim,reason:'equivalent_location'}); conflicts.delete('location'); continue; }
      rejected.push({...existing,field:claim.field,reason:'superseded_by_more_complete_location'});
      conflicts.delete('location');
    } else if (existing && String(existing.value) === String(value) && specificity < existing.specificity) {
      rejected.push({...claim,reason:'lower_format_specificity'}); continue;
    }
    if (existing && String(existing.value) !== String(value) && !(claim.field === "location" && equivalentLocations(existing.value,value))) {
      if (specificity < existing.specificity) { rejected.push({...claim,reason:'lower_format_specificity'}); continue; }
      if (specificity === existing.specificity) { conflicts.add(claim.field); rejected.push({...claim, reason:"conflicting_verified_values"}); continue; }
      rejected.push({...existing,field:claim.field,reason:'superseded_by_format_specific_claim'});
      conflicts.delete(claim.field);
    }
    proofs[claim.field] = {value, evidence:claim.evidence, context:page.format_context || "", source_url:page.url, method:claim.method || "llm", status:"verified", edition_year:targetEdition(row),specificity};
    row[column] = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (claim.format_label && evidenceIdentifiesFormat(claim.evidence, row) && normalizeText(claim.evidence).includes(normalizeText(claim.format_label))) row.official_format_name = claim.format_label;
  }
  row.research_schema_version = RESEARCH_SCHEMA_VERSION;
  row.field_provenance_json = JSON.stringify(proofs);
  row.field_evidence_json = JSON.stringify(Object.fromEntries(Object.entries(proofs).map(([field, proof]) => [field, proof.evidence])));
  row.rejected_claims_json = JSON.stringify(rejected);
  row.conflict_fields = [...conflicts].join(";");
  for (const [field, column] of [["race_date","date_source_url"],["location","location_source_url"],["distance_km","distance_source_url"],["elevation_gain_m","elevation_source_url"]]) row[column] = proofs[field]?.source_url || "";
  row.llm_context_summary = String(llm.summary || "").slice(0,800);
  row.llm_confidence = Object.keys(proofs).length ? "field_level" : "none";
  row.evidence_summary = Object.entries(proofs).map(([field, proof]) => `${field}: ${proof.evidence}`).join(" | ").slice(0,2000);
  return refreshImportReadiness(row);
};

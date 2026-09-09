#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildFormatQueue, FORMAT_QUEUE_HEADERS } from "./build-format-import-queue.mjs";
import { FIELD_COLUMNS, jsonValue, normalizeText, numericValue, verifiedValue } from "./catalog-research-contract.mjs";
import { parseCsvTable, serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";

export const BENCHMARK_SCHEMA_VERSION = "1";
export const BENCHMARK_FIELDS = ["race_date", "location", "distance_km", "elevation_gain_m"];
export const BENCHMARK_SPLITS = ["dev", "regression", "holdout"];
export const BENCHMARK_QUEUE_HEADERS = [...FORMAT_QUEUE_HEADERS, "benchmark_split", "benchmark_seed"];

export const MANIFEST_HEADERS = [
  "benchmark_schema_version", "benchmark_seed", "split", "stratum", "format_key", "event_key",
  "event_name", "format_name", "format_raw", "target_edition_year", "priority_date", "race_url",
  "official_website", "source_role", "source_quality", "distance_bucket", "url_scheme",
  "event_cardinality", "document_kind", "platform", "annotation_status", "annotation_notes",
  ...BENCHMARK_FIELDS.flatMap(field => [`expected_${field}_status`, `expected_${field}`]),
  "expected_edition_error", "expected_format_error", "expected_source_error", "expected_ready_to_import",
];

const hashRank = (seed, value) => createHash("sha256").update(`${seed}\0${value}`).digest("hex");

export const distanceBucket = value => {
  const distance = numericValue(value);
  if (distance === null) return "unknown";
  if (distance < 20) return "lt20";
  if (distance < 42) return "20_41";
  if (distance < 80) return "42_79";
  if (distance < 160) return "80_159";
  return "gte160";
};

export const sourceSurface = value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (/\.pdf(?:$|[?#])/i.test(url.href)) return { document_kind: "pdf", platform: "pdf" };
    if (host === "sites.google.com") return { document_kind: "html", platform: "google_sites" };
    if (/(^|\.)wixsite\.com$/.test(host)) return { document_kind: "html", platform: "wix" };
    if (/(^|\.)wordpress\.com$/.test(host) || /\bwp-(?:content|json)\b/.test(path)) return { document_kind: "html", platform: "wordpress" };
    if (/(^|\.)blogspot\./.test(host)) return { document_kind: "html", platform: "blogspot" };
    if (/(^|\.)jimdo(?:site)?\.com$/.test(host)) return { document_kind: "html", platform: "jimdo" };
    if (/(^|\.)e-monsite\.com$/.test(host)) return { document_kind: "html", platform: "e_monsite" };
    if (/(^|\.)sitew\.(?:com|fr)$/.test(host)) return { document_kind: "html", platform: "sitew" };
    if (/(^|\.)sportsregions\.fr$/.test(host)) return { document_kind: "html", platform: "sportsregions" };
    if (/(^|\.)free\.fr$/.test(host)) return { document_kind: "html", platform: "free_fr" };
    return { document_kind: "html", platform: "other" };
  } catch {
    return { document_kind: "unknown", platform: "invalid_url" };
  }
};

const eventKeyFor = row => `${row.race_url}|${row.priority_date}`;
const STRATIFICATION_DIMENSIONS = ["source_role", "distance_bucket", "url_scheme", "event_cardinality", "document_kind", "platform"];

export const characterizeQueue = rows => {
  const eventSizes = new Map();
  for (const row of rows) eventSizes.set(eventKeyFor(row), (eventSizes.get(eventKeyFor(row)) || 0) + 1);
  return rows.map(row => {
    const eventKey = eventKeyFor(row);
    const sourceUrl = row.official_website || row.race_url;
    const surface = sourceSurface(sourceUrl);
    const characteristics = {
      ...row,
      event_key: eventKey,
      distance_bucket: distanceBucket(row.prospect_distance_km || row.distance_km),
      url_scheme: (() => { try { return new URL(sourceUrl).protocol.replace(":", ""); } catch { return "invalid"; } })(),
      event_cardinality: eventSizes.get(eventKey) > 1 ? "multi_format" : "single_format",
      ...surface,
    };
    characteristics.stratum = [
      characteristics.source_role,
      characteristics.distance_bucket,
      characteristics.url_scheme,
      characteristics.event_cardinality,
      characteristics.document_kind,
      characteristics.platform,
    ].join("|");
    return characteristics;
  });
};

const takeStratified = ({ candidates, count, seed, split, reservedEvents, companionShare }) => {
  if (!count) return [];
  const available = candidates.filter(row => !reservedEvents.has(row.event_key));
  const populationCounts = Object.fromEntries(STRATIFICATION_DIMENSIONS.map(dimension => [dimension, available.reduce((counts, row) => counts.set(row[dimension], (counts.get(row[dimension]) || 0) + 1), new Map())]));
  const selectedCounts = Object.fromEntries(STRATIFICATION_DIMENSIONS.map(dimension => [dimension, new Map()]));
  const desired = (dimension, value) => Math.max(1, count * (populationCounts[dimension].get(value) || 0) / Math.max(1, available.length));
  const candidateScore = row => STRATIFICATION_DIMENSIONS.reduce((score, dimension) => {
    const target = desired(dimension, row[dimension]);
    const current = selectedCounts[dimension].get(row[dimension]) || 0;
    return score + Math.max(0, target - current) / target;
  }, 0);
  const record = row => {
    for (const dimension of STRATIFICATION_DIMENSIONS) selectedCounts[dimension].set(row[dimension], (selectedCounts[dimension].get(row[dimension]) || 0) + 1);
  };
  const best = rows => rows.sort((a, b) => candidateScore(b) - candidateScore(a)
    || hashRank(seed, `${split}|${a.stratum}|${a.format_key}`).localeCompare(hashRank(seed, `${split}|${b.stratum}|${b.format_key}`)))[0];
  const baseTarget = Math.max(1, count - Math.round(count * companionShare));
  const selected = [];
  const selectedKeys = new Set();
  const ownedEvents = new Set();
  while (selected.length < baseTarget) {
    const candidate = best(available.filter(row => !ownedEvents.has(row.event_key)));
    if (!candidate) break;
    selected.push(candidate);
    selectedKeys.add(candidate.format_key);
    ownedEvents.add(candidate.event_key);
    record(candidate);
  }
  while (selected.length < count) {
    const candidate = best(available.filter(row => ownedEvents.has(row.event_key) && !selectedKeys.has(row.format_key)));
    if (!candidate) break;
    selected.push(candidate);
    selectedKeys.add(candidate.format_key);
    record(candidate);
  }
  while (selected.length < count) {
    const candidate = best(available.filter(row => !selectedKeys.has(row.format_key) && !ownedEvents.has(row.event_key)));
    if (!candidate) break;
    selected.push(candidate);
    selectedKeys.add(candidate.format_key);
    ownedEvents.add(candidate.event_key);
    record(candidate);
  }
  for (const eventKey of ownedEvents) reservedEvents.add(eventKey);
  return selected;
};

const distribution = rows => {
  return Object.fromEntries(STRATIFICATION_DIMENSIONS.map(dimension => [dimension, Object.fromEntries([...rows.reduce((counts, row) => counts.set(row[dimension], (counts.get(row[dimension]) || 0) + 1), new Map())].sort())]));
};

export const selectBenchmark = (queueRows, {
  seed = "catalog-research-v1", devSize = 45, regressionSize = 27, holdoutSize = 18, companionShare = 0.25,
} = {}) => {
  for (const size of [devSize, regressionSize, holdoutSize]) if (!Number.isInteger(size) || size < 0) throw new Error("Les tailles de split doivent être des entiers positifs ou nuls.");
  if (!(companionShare >= 0 && companionShare < 1)) throw new Error("companionShare doit être compris entre 0 inclus et 1 exclu.");
  const characterized = characterizeQueue(queueRows);
  const reservedEvents = new Set();
  const requested = { dev: devSize, regression: regressionSize, holdout: holdoutSize };
  const selectedBySplit = {};
  // Protect the holdout first so it receives rare strata before the development set.
  for (const split of ["holdout", "regression", "dev"]) {
    selectedBySplit[split] = takeStratified({ candidates: characterized, count: requested[split], seed, split, reservedEvents, companionShare });
  }
  const queues = Object.fromEntries(BENCHMARK_SPLITS.map(split => [split, selectedBySplit[split].map(row => ({
    ...Object.fromEntries(FORMAT_QUEUE_HEADERS.map(header => [header, row[header] ?? ""])),
    benchmark_split: split,
    benchmark_seed: seed,
  }))]));
  const rows = BENCHMARK_SPLITS.flatMap(split => selectedBySplit[split].map(row => ({
    benchmark_schema_version: BENCHMARK_SCHEMA_VERSION,
    benchmark_seed: seed,
    split,
    stratum: row.stratum,
    format_key: row.format_key,
    event_key: row.event_key,
    event_name: row.event_name,
    format_name: row.format_name,
    format_raw: row.format_raw,
    target_edition_year: row.target_edition_year,
    priority_date: row.priority_date,
    race_url: row.race_url,
    official_website: row.official_website,
    source_role: row.source_role,
    source_quality: row.source_quality,
    distance_bucket: row.distance_bucket,
    url_scheme: row.url_scheme,
    event_cardinality: row.event_cardinality,
    document_kind: row.document_kind,
    platform: row.platform,
    annotation_status: "pending",
    annotation_notes: "",
    ...Object.fromEntries(BENCHMARK_FIELDS.flatMap(field => [[`expected_${field}_status`, "skip"], [`expected_${field}`, ""]])),
    expected_edition_error: "",
    expected_format_error: "",
    expected_source_error: "",
    expected_ready_to_import: "",
  })));
  return {
    schema_version: BENCHMARK_SCHEMA_VERSION,
    seed,
    requested,
    actual: Object.fromEntries(BENCHMARK_SPLITS.map(split => [split, selectedBySplit[split].length])),
    population_count: characterized.length,
    population_event_count: new Set(characterized.map(row => row.event_key)).size,
    population_distribution: distribution(characterized),
    selected_distribution: distribution(rows),
    rows,
    queues,
  };
};

export const loadBenchmarkQueueText = content => {
  const table = parseCsvTable(content);
  const missingHeaders = FORMAT_QUEUE_HEADERS.filter(header => !table.headers.includes(header));
  if (missingHeaders.length) throw new Error(`Queue benchmark incomplète : ${missingHeaders.join(", ")}.`);
  const keys = new Set();
  for (const row of table.rows) {
    if (!row.format_key) throw new Error("Queue benchmark sans format_key.");
    if (keys.has(row.format_key)) throw new Error(`format_key dupliquée dans la queue benchmark : ${row.format_key}.`);
    keys.add(row.format_key);
  }
  return table.rows;
};

const normalizedField = (field, value) => {
  if (field === "distance_km" || field === "elevation_gain_m") return numericValue(value);
  return normalizeText(value);
};

const sameFieldValue = (field, actual, expected) => {
  const left = normalizedField(field, actual);
  const right = normalizedField(field, expected);
  if (field === "distance_km" || field === "elevation_gain_m") return left !== null && right !== null && Math.abs(left - right) < 0.01;
  return Boolean(left) && left === right;
};

const emptyConfusion = () => ({ tp: 0, fp: 0, fn: 0, tn: 0 });
const finishMetric = counts => ({
  ...counts,
  precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null,
  recall: counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null,
  accuracy: counts.tp + counts.fp + counts.fn + counts.tn ? (counts.tp + counts.tn) / (counts.tp + counts.fp + counts.fn + counts.tn) : null,
});

const parseExpectedBoolean = value => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "oui"].includes(normalized)) return true;
  if (["false", "0", "no", "non"].includes(normalized)) return false;
  return null;
};

const actualErrorFlags = row => {
  const reasons = jsonValue(row.rejected_claims_json, []).map(claim => String(claim?.reason || "")).join(";");
  return {
    edition_error: /edition|historical|campaign_date/i.test(reasons),
    format_error: /format|neighbor|distance_identity/i.test(`${reasons};${row.verification_alert || ""}`),
    source_error: String(row.research_status || "").toLowerCase() === "source_error",
    ready_to_import: parseExpectedBoolean(row.ready_to_import) === true,
  };
};

export const evaluateBenchmark = (manifestRows, predictionRows) => {
  const predictions = new Map();
  for (const row of predictionRows) {
    if (!row.format_key) continue;
    if (predictions.has(row.format_key)) throw new Error(`Prédiction dupliquée pour ${row.format_key}.`);
    predictions.set(row.format_key, row);
  }
  const reviewed = manifestRows.filter(row => String(row.annotation_status).trim().toLowerCase() === "reviewed");
  const fields = Object.fromEntries(BENCHMARK_FIELDS.map(field => [field, emptyConfusion()]));
  const outcomes = Object.fromEntries(["edition_error", "format_error", "source_error", "ready_to_import"].map(field => [field, emptyConfusion()]));
  const unmatched = [];
  for (const truth of reviewed) {
    const prediction = predictions.get(truth.format_key) || {};
    if (!predictions.has(truth.format_key)) unmatched.push(truth.format_key);
    for (const field of BENCHMARK_FIELDS) {
      const status = String(truth[`expected_${field}_status`] || "skip").trim().toLowerCase();
      if (status === "skip" || !status) continue;
      if (!['value', 'absent'].includes(status)) throw new Error(`Statut attendu invalide pour ${truth.format_key}/${field}: ${status}`);
      if (status === "value" && normalizedField(field, truth[`expected_${field}`]) === (field === "distance_km" || field === "elevation_gain_m" ? null : "")) {
        throw new Error(`Valeur attendue manquante pour ${truth.format_key}/${field}.`);
      }
      const actual = verifiedValue(prediction, field);
      const predictedPositive = actual !== undefined;
      const expectedPositive = status === "value";
      const correct = expectedPositive && predictedPositive && sameFieldValue(field, actual, truth[`expected_${field}`]);
      if (correct) fields[field].tp += 1;
      else if (predictedPositive) fields[field].fp += 1;
      else fields[field].tn += expectedPositive ? 0 : 1;
      if (expectedPositive && !correct) fields[field].fn += 1;
    }
    const actualFlags = actualErrorFlags(prediction);
    for (const outcome of Object.keys(outcomes)) {
      const expected = parseExpectedBoolean(truth[`expected_${outcome}`]);
      if (expected === null) continue;
      const actual = actualFlags[outcome];
      if (expected && actual) outcomes[outcome].tp += 1;
      else if (!expected && actual) outcomes[outcome].fp += 1;
      else if (expected && !actual) outcomes[outcome].fn += 1;
      else outcomes[outcome].tn += 1;
    }
  }
  return {
    schema_version: BENCHMARK_SCHEMA_VERSION,
    manifest_rows: manifestRows.length,
    reviewed_rows: reviewed.length,
    matched_rows: reviewed.length - unmatched.length,
    unmatched_format_keys: unmatched,
    fields: Object.fromEntries(Object.entries(fields).map(([field, counts]) => [field, finishMetric(counts)])),
    outcomes: Object.fromEntries(Object.entries(outcomes).map(([field, counts]) => [field, finishMetric(counts)])),
  };
};

const numberArg = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} doit être un entier positif ou nul.`);
  return parsed;
};

const parseArgs = argv => {
  const command = argv[0];
  if (!['select', 'evaluate'].includes(command)) throw new Error("Commande attendue : select ou evaluate.");
  const args = { command, asOf: "2026-09-09", dateFrom: "2026-11-01", dateTo: "2027-02-28", minDaysBefore: 0, seed: "catalog-research-v1", devSize: 45, regressionSize: 27, holdoutSize: 18, companionShare: 0.25 };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const values = { "--input": "input", "--output-dir": "outputDir", "--manifest": "manifest", "--predictions": "predictions", "--output": "output", "--as-of": "asOf", "--date-from": "dateFrom", "--date-to": "dateTo", "--seed": "seed" };
    if (values[arg]) { args[values[arg]] = next; index += 1; continue; }
    if (arg === "--min-days-before") { args.minDaysBefore = numberArg(next, arg); index += 1; continue; }
    if (arg === "--dev-size") { args.devSize = numberArg(next, arg); index += 1; continue; }
    if (arg === "--regression-size") { args.regressionSize = numberArg(next, arg); index += 1; continue; }
    if (arg === "--holdout-size") { args.holdoutSize = numberArg(next, arg); index += 1; continue; }
    if (arg === "--companion-share") { args.companionShare = Number(next); index += 1; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (command === "select" && (!args.input || !args.outputDir)) throw new Error("select requiert --input et --output-dir.");
  if (command === "evaluate" && (!args.manifest || !args.predictions || !args.output)) throw new Error("evaluate requiert --manifest, --predictions et --output.");
  return args;
};

const loadRows = async path => {
  const content = await readFile(path, "utf8");
  if (/\.json$/i.test(path)) {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.rows || [];
  }
  return parseCsvTable(content).rows;
};

export const run = async (argv = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  if (args.command === "select") {
    const prospects = await loadRows(args.input);
    const queue = buildFormatQueue(prospects, { asOf: args.asOf, minDaysBefore: args.minDaysBefore, dateFrom: args.dateFrom, dateTo: args.dateTo });
    const manifest = selectBenchmark(queue, args);
    await mkdir(args.outputDir, { recursive: true });
    const { queues, ...publicManifest } = manifest;
    await writeFile(join(args.outputDir, "benchmark-manifest.json"), `${JSON.stringify({ ...publicManifest, campaign: { as_of: args.asOf, min_days_before: args.minDaysBefore, date_from: args.dateFrom, date_to: args.dateTo }, input: basename(args.input), queue_files: ["benchmark-queue.csv", ...BENCHMARK_SPLITS.map(split => `benchmark-${split}-queue.csv`)] }, null, 2)}\n`, "utf8");
    await writeFile(join(args.outputDir, "benchmark-manifest.csv"), serializeCsvTable(MANIFEST_HEADERS, manifest.rows), "utf8");
    await writeFile(join(args.outputDir, "benchmark-queue.csv"), serializeCsvTable(BENCHMARK_QUEUE_HEADERS, BENCHMARK_SPLITS.flatMap(split => queues[split])), "utf8");
    await Promise.all(BENCHMARK_SPLITS.map(split => writeFile(join(args.outputDir, `benchmark-${split}-queue.csv`), serializeCsvTable(BENCHMARK_QUEUE_HEADERS, queues[split]), "utf8")));
    console.error(`Benchmark : ${manifest.rows.length} format(s), ${new Set(manifest.rows.map(row => row.event_key)).size} événement(s), seed ${args.seed}.`);
    return manifest;
  }
  const manifestRows = await loadRows(args.manifest);
  const predictionRows = await loadRows(args.predictions);
  const report = evaluateBenchmark(manifestRows, predictionRows);
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(`Rapport : ${report.matched_rows}/${report.reviewed_rows} annotation(s) évaluée(s).`);
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

import assert from "node:assert/strict";
import { test } from "node:test";

import { BENCHMARK_QUEUE_HEADERS, BENCHMARK_SPLITS, characterizeQueue, evaluateBenchmark, loadBenchmarkQueueText, selectBenchmark, sourceSurface } from "./catalog-research-benchmark.mjs";
import { serializeCsvTable } from "./prepare-betrail-outreach-csv.mjs";

const queue = Array.from({ length: 18 }, (_, eventIndex) => {
  const multi = eventIndex % 3 !== 0;
  const formats = multi ? 3 : 1;
  return Array.from({ length: formats }, (_, formatIndex) => {
    const distance = [12, 28, 55, 100, 170][(eventIndex + formatIndex) % 5];
    const source = eventIndex % 6 === 0
      ? `http://event-${eventIndex}.free.fr/programme.pdf`
      : eventIndex % 5 === 0
        ? `https://event-${eventIndex}.wixsite.com/trail`
        : eventIndex % 4 === 0
          ? `https://www.klikego.com/inscription/event-${eventIndex}`
          : `https://event-${eventIndex}.fr`;
    return {
      format_key: `format-${eventIndex}-${formatIndex}`,
      event_name: `Événement ${eventIndex}`,
      format_name: `${distance} km`,
      format_raw: `${distance}km/${distance * 20} D+`,
      race_url: `https://betrail.run/event-${eventIndex}`,
      official_website: source,
      priority_date: `2026-11-${String((eventIndex % 20) + 1).padStart(2, "0")}`,
      target_edition_year: "2026",
      prospect_distance_km: String(distance),
      distance_km: String(distance),
      source_role: source.includes("klikego") ? "registration_or_aggregator" : "official_candidate",
      source_quality: source.includes("klikego") ? "secondary" : "unclassified",
    };
  });
}).flat();

test("characterization detects source surfaces and multi-format events", () => {
  assert.deepEqual(sourceSurface("https://club.example/reglement.pdf"), { document_kind: "pdf", platform: "pdf" });
  assert.equal(sourceSurface("https://foo.wixsite.com/trail").platform, "wix");
  const rows = characterizeQueue(queue);
  assert.equal(rows.find(row => row.format_key === "format-1-0").event_cardinality, "multi_format");
  assert.equal(rows.find(row => row.format_key === "format-0-0").event_cardinality, "single_format");
  assert.ok(rows.every(row => row.stratum.split("|").length === 6));
});

test("selection is stable by seed and keeps events in exactly one split", () => {
  const options = { seed: "stable", devSize: 8, regressionSize: 6, holdoutSize: 5, companionShare: 0.3 };
  const first = selectBenchmark(queue, options);
  const second = selectBenchmark([...queue].reverse(), options);
  assert.deepEqual(first.rows.map(row => [row.split, row.format_key]), second.rows.map(row => [row.split, row.format_key]));
  assert.notDeepEqual(first.rows.map(row => row.format_key), selectBenchmark(queue, { ...options, seed: "different" }).rows.map(row => row.format_key));
  const eventSplits = new Map();
  for (const row of first.rows) {
    const splits = eventSplits.get(row.event_key) || new Set();
    splits.add(row.split);
    eventSplits.set(row.event_key, splits);
  }
  assert.ok([...eventSplits.values()].every(splits => splits.size === 1));
  assert.ok(first.rows.some(row => row.event_cardinality === "multi_format"));
  assert.ok(first.rows.some(row => row.source_role === "registration_or_aggregator"));
  assert.deepEqual(new Set(first.rows.map(row => row.split)), new Set(BENCHMARK_SPLITS));
  assert.ok(first.rows.every(row => row.annotation_status === "pending" && row.expected_race_date_status === "skip" && row.expected_race_date === ""));
});

test("a generated split reloads as a complete executable queue without changing format keys", () => {
  const selected = selectBenchmark(queue, { seed: "queue-e2e", devSize: 7, regressionSize: 4, holdoutSize: 3 });
  const csv = serializeCsvTable(BENCHMARK_QUEUE_HEADERS, selected.queues.dev);
  const loaded = loadBenchmarkQueueText(csv);
  assert.ok(loaded.length > 0);
  assert.deepEqual(loaded.map(row => row.format_key), selected.queues.dev.map(row => row.format_key));
  assert.ok(loaded.every(row => row.benchmark_split === "dev"));
  assert.ok(loaded.every(row => row.race_url && row.format_raw && row.priority_date));
});

const verifiedPrediction = ({ key, date = "2026-11-08", location = "Village", distance = "28", ready = "TRUE", rejected = [] }) => ({
  format_key: key,
  research_schema_version: "2",
  candidate_event_date: date,
  format_location: location,
  distance_km: distance,
  elevation_gain_m: "",
  conflict_fields: "",
  research_status: "ready",
  ready_to_import: ready,
  rejected_claims_json: JSON.stringify(rejected),
  verification_alert: "",
  field_provenance_json: JSON.stringify({
    race_date: { status: "verified", value: date, source_url: "https://race.example", evidence: `Date ${date}` },
    location: { status: "verified", value: location, source_url: "https://race.example", evidence: location },
    distance_km: { status: "verified", value: distance, source_url: "https://race.example", evidence: `${distance} km` },
  }),
});

test("evaluation reports field precision/recall and edition/format/source/ready outcomes", () => {
  const manifest = [
    {
      format_key: "a", annotation_status: "reviewed",
      expected_race_date_status: "value", expected_race_date: "2026-11-08",
      expected_location_status: "value", expected_location: "Village",
      expected_distance_km_status: "value", expected_distance_km: "30",
      expected_elevation_gain_m_status: "skip",
      expected_edition_error: "TRUE", expected_format_error: "FALSE", expected_source_error: "FALSE", expected_ready_to_import: "TRUE",
    },
    {
      format_key: "b", annotation_status: "reviewed",
      expected_race_date_status: "absent", expected_location_status: "skip", expected_distance_km_status: "skip", expected_elevation_gain_m_status: "skip",
      expected_edition_error: "FALSE", expected_format_error: "TRUE", expected_source_error: "TRUE", expected_ready_to_import: "FALSE",
    },
    { format_key: "ignored", annotation_status: "pending" },
  ];
  const predictions = [
    verifiedPrediction({ key: "a", rejected: [{ reason: "edition_mismatch" }] }),
    { ...verifiedPrediction({ key: "b", ready: "FALSE", rejected: [{ reason: "neighboring_format" }] }), research_status: "source_error" },
  ];
  const report = evaluateBenchmark(manifest, predictions);
  assert.equal(report.reviewed_rows, 2);
  assert.equal(report.fields.race_date.tp, 1);
  assert.equal(report.fields.race_date.fp, 1);
  assert.equal(report.fields.distance_km.fp, 1);
  assert.equal(report.fields.distance_km.fn, 1);
  assert.equal(report.outcomes.edition_error.tp, 1);
  assert.equal(report.outcomes.format_error.tp, 1);
  assert.equal(report.outcomes.source_error.tp, 1);
  assert.equal(report.outcomes.ready_to_import.tp, 1);
  assert.equal(report.outcomes.ready_to_import.tn, 1);
});

test("evaluation refuses an invalid reviewed field status", () => {
  assert.throws(() => evaluateBenchmark([{ format_key: "a", annotation_status: "reviewed", expected_race_date_status: "maybe" }], [verifiedPrediction({ key: "a" })]), /Statut attendu invalide/);
  assert.throws(() => evaluateBenchmark([{ format_key: "a", annotation_status: "reviewed", expected_location_status: "value", expected_location: "" }], [verifiedPrediction({ key: "a" })]), /Valeur attendue manquante/);
});

test("a reviewed positive without prediction is counted as a false negative", () => {
  const report = evaluateBenchmark([{
    format_key: "missing", annotation_status: "reviewed",
    expected_race_date_status: "value", expected_race_date: "2026-11-08",
    expected_location_status: "skip", expected_distance_km_status: "skip", expected_elevation_gain_m_status: "skip",
    expected_source_error: "TRUE",
  }], []);
  assert.deepEqual(report.unmatched_format_keys, ["missing"]);
  assert.equal(report.fields.race_date.fn, 1);
  assert.equal(report.outcomes.source_error.fn, 1);
});

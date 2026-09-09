import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildFormatQueue, parseFormatText } from "./build-format-import-queue.mjs";

test("expands compact distance lists into independently auditable candidates", () => {
  const formats = parseFormatText("12 / 23 / 51 km");
  assert.deepEqual(formats.map(format => ({
    entry: format.entry,
    sourceEntry: format.sourceEntry,
    distanceKm: format.distanceKm,
    distanceValue: format.distanceValue,
    distanceUnit: format.distanceUnit,
    kind: format.formatKind,
  })), [
    { entry: "12 km", sourceEntry: "12 / 23 / 51 km", distanceKm: 12, distanceValue: 12, distanceUnit: "km", kind: "distance" },
    { entry: "23 km", sourceEntry: "12 / 23 / 51 km", distanceKm: 23, distanceValue: 23, distanceUnit: "km", kind: "distance" },
    { entry: "51 km", sourceEntry: "12 / 23 / 51 km", distanceKm: 51, distanceValue: 51, distanceUnit: "km", kind: "distance" },
  ]);
});

test("converts miles only as an explicit prospect candidate", () => {
  const [format] = parseFormatText("10 miles / 900 D+");
  assert.equal(format.distanceKm, 16.093);
  assert.equal(format.distanceValue, 10);
  assert.equal(format.distanceUnit, "mi");
  assert.equal(format.elevationGainM, 900);
});

test("keeps timed, loop and participation formats without fabricating a distance", () => {
  const formats = parseFormatText("Boucle de 6h; Relais par équipe; Duo 24 h");
  assert.deepEqual(formats.map(format => ({
    distanceKm: format.distanceKm,
    durationHours: format.durationHours,
    kind: format.formatKind,
    tags: format.formatTags,
    participation: format.participationHint,
  })), [
    { distanceKm: null, durationHours: 6, kind: "timed", tags: ["timed", "loop"], participation: "" },
    { distanceKm: null, durationHours: null, kind: "relay", tags: ["relay", "team"], participation: "relay" },
    { distanceKm: null, durationHours: 24, kind: "timed", tags: ["timed", "duo"], participation: "duo" },
  ]);
});

test("retains VK, marathon and semi-marathon as labels instead of inferred distances", () => {
  const formats = parseFormatText("VK des Crêtes; Marathon des Neiges; Semi-marathon découverte");
  assert.deepEqual(formats.map(format => ({ name: format.formatName, distanceKm: format.distanceKm, kind: format.formatKind })), [
    { name: "VK des Crêtes", distanceKm: null, kind: "vertical_kilometer" },
    { name: "Marathon des Neiges", distanceKm: null, kind: "named_distance" },
    { name: "Semi-marathon découverte", distanceKm: null, kind: "named_distance" },
  ]);
});

test("preserves established distance format keys and raw candidates", () => {
  const raceUrl = "https://betrail.example/race/test/2027";
  const [row] = buildFormatQueue([{
    race_name: "Trail stable",
    race_url: raceUrl,
    formats_raw: "64km/3100 D+",
    date: "2027-01-10",
    event_date_basis: "date exacte",
  }], { asOf: "2026-09-08" });
  const expectedHash = createHash("sha256").update(`${raceUrl}|0|64km/3100 D+`).digest("hex").slice(0, 16);
  assert.equal(row.format_key, `format-${expectedHash}`);
  assert.equal(row.format_raw, "64km/3100 D+");
  assert.equal(row.format_source_raw, "64km/3100 D+");
  assert.equal(row.prospect_distance_value, "64");
  assert.equal(row.prospect_distance_unit, "km");
  assert.equal(row.prospect_duration_hours, "");
  assert.equal(row.prospect_format_tags, "[]");
});

test("writes parser metadata as candidates and leaves publication participation empty", () => {
  const [row] = buildFormatQueue([{
    race_name: "Ultra test",
    race_url: "https://betrail.example/race/ultra/2027",
    formats_raw: "100 mi en relais",
    date: "2027-01-10",
    event_date_basis: "date exacte",
  }], { asOf: "2026-09-08" });
  assert.equal(row.prospect_distance_km, "160.934");
  assert.equal(row.prospect_distance_value, "100");
  assert.equal(row.prospect_distance_unit, "mi");
  assert.equal(row.prospect_participation_hint, "relay");
  assert.equal(row.prospect_format_tags, "[\"relay\"]");
  assert.equal(row.participation_mode, "");
  assert.equal(row.ready_to_import, "FALSE");
});

import test from "node:test";
import assert from "node:assert/strict";

import { applyClaims, evidenceIdentifiesFormat, validateClaimForRow } from "./enrich-format-import-queue.mjs";

const row = { format_name: "12km", format_raw: "12km/150 D+", distance_km: "12", elevation_gain_m: "150" };

test("requires the citation to identify the requested format", () => {
  assert.equal(evidenceIdentifiesFormat("Course Nature - 12 km D+ : 150 mètres", row), true);
  assert.equal(evidenceIdentifiesFormat("Trail Lafayette - 27 km D+ : 800 mètres", row), false);
  assert.equal(evidenceIdentifiesFormat("Trail des Sangliers 34 km", { ...row, format_name: "33km", format_raw: "33km/1000 D+", distance_km: "33" }), true);
  assert.equal(evidenceIdentifiesFormat("27 km, puis 11 km", row), false);
});

test("rejects a format-scoped claim copied from a neighboring format", () => {
  assert.equal(validateClaimForRow({ field: "start_time", value: "11:00", evidence: "Départ des courses enfants à 11h" }, row), "format_context_missing");
  assert.equal(validateClaimForRow({ field: "elevation_gain_m", value: 150, evidence: "Course Nature - 12 km D+ : 150 mètres" }, row), "");
});

test("keeps candidate values but blocks import when a mandatory claim has bad context", () => {
  const candidate = {
    event_name: "La Langeadoise",
    format_name: "12km",
    format_raw: "12km/150 D+",
    official_website: "https://example.test",
    source_role: "official_candidate",
    candidate_event_date: "2026-09-06",
    distance_km: "12",
    elevation_gain_m: "150",
    format_location: "Langeac",
    source_pages_json: "[]",
    evidence_summary: "",
    field_evidence_json: "{}",
    verified_fields: "",
    conflict_fields: "",
  };
  applyClaims(candidate, {
    text: "Trail Lafayette - 27 km D+ : 800 mètres",
    dates: ["2026-09-06"],
    location: "Langeac",
    distance_km: "",
    elevation_gain_m: "",
    gpx_url: "",
    evidence: "Trail Lafayette - 27 km D+ : 800 mètres",
  }, {
    claims: [{ field: "elevation_gain_m", value: 800, evidence: "Trail Lafayette - 27 km D+ : 800 mètres", confidence: "high", rationale: "wrong neighboring format" }],
    summary: "",
  });
  assert.equal(candidate.elevation_gain_m, "150");
  assert.equal(candidate.ready_to_import, "FALSE");
  assert.match(candidate.verification_alert, /Contexte/);
  assert.match(candidate.rejected_claims_json, /format_context_missing/);
});

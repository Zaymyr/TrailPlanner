import { describe, expect, it } from "vitest";

import type { FormatCandidate } from "../../../../lib/organizer-import-engine";
import {
  buildInitialWebsiteImportFieldSelections,
  buildInitialWebsiteImportFormatDecisions,
} from "./website-import-review-details";
import type { RaceFormat, WebsiteImportReviewWorkflow } from "./types";

const makeCandidate = (overrides: Partial<FormatCandidate> = {}): FormatCandidate => ({
  candidateKey: "format-42",
  detectionKeys: ["page-42"],
  names: ["Le Grand Trail"],
  proposedName: "Le Grand Trail",
  edition: { date: "2026-09-12", year: "2026" },
  existenceConfidence: "high",
  evidence: [{
    sourceId: "official-format-page",
    kind: "official-page",
    label: "Page officielle",
    url: "https://example.test/grand-trail",
    page: null,
    edition: "2026",
    evidence: "Le Grand Trail 42 km",
  }],
  claims: [],
  completeness: {
    knownRequiredFields: ["name", "raceDate"],
    missingRequiredFields: ["distanceKm", "elevationGainM"],
  },
  suggestedExistingRaceId: null,
  ...overrides,
});

const existingRace: RaceFormat = {
  id: "race-existing",
  edition_group_id: "series-existing",
  series_name: "Le Grand Trail",
  name: "Le Grand Trail",
  distance_km: 42,
  elevation_gain_m: 2_000,
  is_live: true,
};

describe("organizer import two-step defaults", () => {
  it("binds only an exact normalized name and never blocks an incomplete candidate", () => {
    const [decision] = buildInitialWebsiteImportFormatDecisions([makeCandidate()], [existingRace]);

    expect(decision).toMatchObject({
      candidateKeys: ["format-42"],
      mode: "bind-existing",
      targetRaceId: "race-existing",
      name: "Le Grand Trail",
    });
  });

  it("creates a separate draft when no exact name exists", () => {
    const [decision] = buildInitialWebsiteImportFormatDecisions(
      [makeCandidate({ proposedName: "Trail des Crêtes", names: ["Trail des Crêtes"] })],
      [existingRace]
    );

    expect(decision.mode).toBe("create");
    expect(decision.targetRaceId).toBeNull();
  });

  it("preselects only a high-confidence safe fill and never a conflict", () => {
    const workflow: WebsiteImportReviewWorkflow = {
      sessionId: "session-1",
      step: "review",
      confirmedFormats: [],
      fieldSnapshot: {},
      fieldSignature: "signature",
      eventReport: {
        scope: "event",
        name: "Événement",
        resolutions: [{
          field: "location",
          label: "Lieu",
          reason: "Une source officielle complète le champ vide.",
          currentValue: null,
          status: "safe",
          recommendedClaimId: "claim-location",
          claims: [{
            id: "claim-location",
            value: "Annecy",
            source: { kind: "official-page", label: "Site officiel", url: null, fileName: null, page: null, editionYear: "2026" },
            evidence: ["Départ à Annecy"],
            confidence: "high",
          }],
        }],
      },
      formatReports: [{
        scope: "format",
        raceId: "race-existing",
        name: "Le Grand Trail",
        resolutions: [{
          field: "distanceKm",
          label: "Distance",
          reason: "Deux sources officielles sont en conflit.",
          currentValue: 42,
          status: "conflict",
          recommendedClaimId: "claim-distance",
          claims: [{
            id: "claim-distance",
            value: 43,
            source: { kind: "official-document", label: "Règlement", url: null, fileName: "reglement.pdf", page: 4, editionYear: "2026" },
            evidence: ["Parcours de 43 km"],
            confidence: "high",
          }],
        }],
      }],
    };

    const selections = buildInitialWebsiteImportFieldSelections(workflow);

    expect(selections["event:event:location"]).toMatchObject({ decision: "claim", claimId: "claim-location" });
    expect(selections["format:race-existing:distanceKm"]).toMatchObject({ decision: "keep" });
  });
});

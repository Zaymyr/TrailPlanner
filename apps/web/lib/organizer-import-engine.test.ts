import { describe, expect, it } from "vitest";

import {
  buildFormatCandidates,
  buildSourceClaims,
  groupClaimsIntoFieldResolutions,
  organizerClaimValuesAreConcordant,
  type SourceClaim,
} from "./organizer-import-engine";
import type { OrganizerWebsiteImportPreview, OrganizerWebsiteImportRace } from "./organizer-website-import";

const makeRace = (overrides: Partial<OrganizerWebsiteImportRace> = {}): OrganizerWebsiteImportRace => ({
  key: "format-42",
  name: "Trail des Crêtes",
  seriesName: "Trail des Crêtes",
  raceDate: "2026-09-12",
  locationText: "Annecy",
  distanceKm: 42,
  elevationGainM: 2_100,
  elevationLossM: null,
  externalSiteUrl: "https://example.com/formats/cretes",
  thumbnailUrl: null,
  aidStations: [],
  gpxContent: null,
  gpxStorageLabel: null,
  missingFields: [],
  hasReliableGpx: false,
  ...overrides,
});

const makePreview = (races: OrganizerWebsiteImportRace[]): OrganizerWebsiteImportPreview => ({
  source: { provider: "generic", url: "https://example.com", label: "Site officiel" },
  event: {
    name: "Trail Test",
    location: "Annecy",
    raceDate: "2026-09-12",
    officialWebsiteUrl: "https://example.com",
    thumbnailUrl: null,
    logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
  },
  races,
  missingFields: [],
  warnings: [],
  canApply: false,
});

const makeClaim = (overrides: Partial<SourceClaim> = {}): SourceClaim => ({
  claimId: "claim-page",
  scope: { kind: "format", scopeKey: "format-42" },
  field: "distanceKm",
  value: 42,
  source: {
    sourceId: "https://example.com/format",
    kind: "official-page",
    label: "Page format",
    url: "https://example.com/format",
    page: null,
    edition: "2026",
  },
  evidence: "Trail des Crêtes · 42 km",
  confidence: "high",
  claimRole: "candidate",
  ...overrides,
});

describe("organizer import evidence engine", () => {
  it("keeps an existing format candidate even when required details are missing", () => {
    const preview = makePreview([makeRace({ raceDate: null, distanceKm: null, elevationGainM: null, missingFields: ["Date", "Distance", "D+"] })]);

    const candidates = buildFormatCandidates(preview);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      candidateKey: "format-42",
      proposedName: "Trail des Crêtes",
      existenceConfidence: "medium",
      completeness: {
        knownRequiredFields: ["name"],
        missingRequiredFields: ["raceDate", "distanceKm", "elevationGainM"],
      },
    });
  });

  it("never merges or matches formats from distance alone", () => {
    const preview = makePreview([
      makeRace({ key: "red", name: "Boucle Rouge", seriesName: "Boucle Rouge", distanceKm: 42 }),
      makeRace({ key: "blue", name: "Boucle Bleue", seriesName: "Boucle Bleue", distanceKm: 42 }),
    ]);

    const candidates = buildFormatCandidates(preview, [{ id: "existing", name: "Ultra Violet", distanceKm: 42 }]);

    expect(candidates.map((candidate) => candidate.candidateKey)).toEqual(["red", "blue"]);
    expect(candidates.every((candidate) => candidate.suggestedExistingRaceId === null)).toBe(true);
  });

  it("suggests one existing target only from an exact normalized name in a compatible edition", () => {
    const candidates = buildFormatCandidates(makePreview([makeRace()]), [
      { id: "older", name: "Trail des Crêtes", raceDate: "2025-09-12" },
      { id: "current", name: "TRAIL DES CRETES", raceDate: "2026-09-12" },
    ]);

    expect(candidates[0].suggestedExistingRaceId).toBe("current");
  });

  it("turns current and previous-edition data into distinct claims", () => {
    const claims = buildSourceClaims({
      currentData: {
        event: { location: "Annecy" },
        formats: [{ formatKey: "format-42", name: "Trail des Crêtes", values: { distanceKm: 42 } }],
      },
      previousEditionData: {
        edition: "2025",
        formats: [{ formatKey: "format-42", name: "Trail des Crêtes", values: { mandatoryEquipment: ["Gobelet"] } }],
      },
    });

    expect(claims.find((claim) => claim.field === "distanceKm")).toMatchObject({
      claimRole: "current",
      source: { kind: "current-data" },
    });
    expect(claims.find((claim) => claim.field === "mandatoryEquipment")).toMatchObject({
      claimRole: "reference",
      source: { kind: "previous-edition", edition: "2025" },
    });
  });

  it("uses the documented symmetric tolerances for distance and elevation", () => {
    expect(organizerClaimValuesAreConcordant("distanceKm", 42, 42.84)).toBe(true);
    expect(organizerClaimValuesAreConcordant("distanceKm", 42, 42.9)).toBe(false);
    expect(organizerClaimValuesAreConcordant("distanceKm", 5, 5.5)).toBe(true);
    expect(organizerClaimValuesAreConcordant("distanceKm", 5, 5.51)).toBe(false);

    expect(organizerClaimValuesAreConcordant("elevationGainM", 2_000, 2_160)).toBe(true);
    expect(organizerClaimValuesAreConcordant("elevationGainM", 2_000, 2_180)).toBe(false);
    expect(organizerClaimValuesAreConcordant("elevationLossM", 500, 600)).toBe(true);
    expect(organizerClaimValuesAreConcordant("elevationLossM", 500, 601)).toBe(false);
  });

  it("preselects only a high-confidence fill with no current value or conflict", () => {
    const [resolution] = groupClaimsIntoFieldResolutions([makeClaim()]);

    expect(resolution).toMatchObject({
      status: "resolved",
      recommendedClaimId: "claim-page",
      requiresLlm: false,
      canPreselect: true,
    });
  });

  it("can materialize explicit missing rows for the review report", () => {
    const resolutions = groupClaimsIntoFieldResolutions([], {
      expectedScopes: [{ kind: "format", scopeKey: "format-42" }],
      expectedFields: ["distanceKm", "elevationGainM"],
    });

    expect(resolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "distanceKm", status: "missing", claims: [], requiresLlm: false }),
      expect.objectContaining({ field: "elevationGainM", status: "missing", claims: [], requiresLlm: false }),
    ]));
  });

  it("marks incompatible applicable claims as an LLM conflict but keeps history reference-only", () => {
    const resolution = groupClaimsIntoFieldResolutions([
      makeClaim(),
      makeClaim({
        claimId: "claim-current",
        value: 50,
        source: { sourceId: "current", kind: "current-data", label: "Données actuelles", url: null, page: null, edition: "2026" },
        evidence: "Valeur actuelle",
        claimRole: "current",
      }),
      makeClaim({
        claimId: "claim-history",
        value: 42,
        source: { sourceId: "previous", kind: "previous-edition", label: "Édition précédente", url: null, page: null, edition: "2025" },
        evidence: "Valeur 2025",
        claimRole: "reference",
      }),
    ])[0];

    expect(resolution).toMatchObject({
      status: "conflict",
      recommendedClaimId: null,
      requiresLlm: true,
      canPreselect: false,
    });
    expect(resolution.referenceClaims.map((claim) => claim.claimId)).toEqual(["claim-history"]);
  });
});

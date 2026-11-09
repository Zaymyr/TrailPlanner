import { describe, expect, it } from "vitest";

import {
  evaluateRacebookPublicationChecks,
  hasBlockingRacebookPublicationIssue,
  normalizePlaceName,
  racebookPublicationCheckInputFromSnapshot,
  type RacebookPublicationCheckInput,
} from "./racebook-publication-checks";

const base: RacebookPublicationCheckInput = {
  raceName: "La Gran’Canche",
  raceDate: "2026-11-15",
  raceLocation: "Roussillon-en-Morvan",
  eventName: "Topo Athletic Bibracte Ultra-Trail",
  eventLocation: "Morvan",
  editionStartDate: "2026-11-13",
  editionEndDate: "2026-11-15",
  aidStations: [
    { name: "La Grande Verrière", km: 16 },
    { name: "St Prix", km: 22 },
  ],
  supporterPoints: [],
};

const codes = (input: RacebookPublicationCheckInput) => evaluateRacebookPublicationChecks(input).map((issue) => issue.code);

describe("evaluateRacebookPublicationChecks", () => {
  it("returns no issue for a clean format", () => {
    expect(evaluateRacebookPublicationChecks(base)).toEqual([]);
  });

  it("blocks the editor placeholder name and an aid station at kilometre 0", () => {
    const issues = evaluateRacebookPublicationChecks({ ...base, aidStations: [{ name: "Nouveau ravito", km: 0 }, ...base.aidStations] });
    expect(issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ["aid_station_default_name", "blocking"],
      ["aid_station_at_start", "blocking"],
    ]);
    expect(hasBlockingRacebookPublicationIssue(issues)).toBe(true);
  });

  it("treats placeholder variants and empty names as blocking", () => {
    expect(codes({ ...base, aidStations: [{ name: "  nouveau  RAVITO ", km: 5 }] })).toEqual(["aid_station_default_name", "lowercase_name"]);
    expect(codes({ ...base, aidStations: [{ name: "", km: 5 }] })).toEqual(["aid_station_default_name"]);
  });

  it("allows encouragement points between aid stations", () => {
    expect(codes({ ...base, supporterPoints: [{ name: "Table d’orientation", km: 26 }] })).toEqual([]);
  });

  it("warns, without blocking, when one place name appears at different kilometres", () => {
    const issues = evaluateRacebookPublicationChecks({
      ...base,
      supporterPoints: [{ name: "Saint-Prix", km: 18 }, { name: "La Grande Verriere", km: 16.3 }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "place_name_km_mismatch", severity: "warning" });
    expect(issues[0]!.message).toContain("22 km");
    expect(issues[0]!.message).toContain("18 km");
    expect(hasBlockingRacebookPublicationIssue(issues)).toBe(false);
  });

  it("warns when the format date is outside the edition dates", () => {
    expect(codes({ ...base, raceDate: "2026-11-20" })).toEqual(["race_date_outside_edition"]);
    expect(codes({ ...base, editionEndDate: null, raceDate: "2026-11-20" })).toEqual([]);
  });

  it("warns on names or locations starting with a lowercase letter", () => {
    const issues = evaluateRacebookPublicationChecks({
      ...base,
      eventLocation: "morvan",
      supporterPoints: [{ name: "table orientation", km: 26 }],
    });
    expect(issues.map((issue) => issue.code)).toEqual(["lowercase_name", "lowercase_name"]);
    expect(issues.every((issue) => issue.severity === "warning")).toBe(true);
  });
});

describe("normalizePlaceName", () => {
  it("normalizes accents, punctuation and the St abbreviation", () => {
    expect(normalizePlaceName("St-Prix")).toBe(normalizePlaceName("Saint Prix"));
    expect(normalizePlaceName("La Grande Verrière")).toBe("la grande verriere");
  });
});

describe("racebookPublicationCheckInputFromSnapshot", () => {
  it("reads the race, event and course rows of a snapshot", () => {
    const input = racebookPublicationCheckInputFromSnapshot({
      raceRow: { name: "Format", race_date: "2026-11-15", location_text: "Autun", race_events: [{ name: "Event", location: "morvan" }] },
      stationRows: [{ name: "R1", km: "12.5" }],
      supporterPointRows: [{ name: "S1", km: 3 }],
    }, { start_date: "2026-11-13", end_date: "2026-11-15" });
    expect(input).toMatchObject({
      eventLocation: "morvan",
      aidStations: [{ name: "R1", km: 12.5 }],
      supporterPoints: [{ name: "S1", km: 3 }],
      editionStartDate: "2026-11-13",
    });
  });
});

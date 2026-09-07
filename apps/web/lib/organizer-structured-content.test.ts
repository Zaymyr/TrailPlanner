import { describe, expect, it } from "vitest";

import { editionServiceSchema, mapStartWavePayload, raceAwardSchema, startWaveSchema } from "./organizer-structured-content";

describe("structured organizer content validation", () => {
  it("requires a geocoded address for restaurants and accommodation", () => {
    expect(editionServiceSchema.safeParse({ serviceType: "restaurant", name: "Refuge", address: "1 rue du Trail" }).success).toBe(false);
    expect(editionServiceSchema.safeParse({ serviceType: "restaurant", name: "Refuge", address: "1 rue du Trail", latitude: 45, longitude: 6 }).success).toBe(true);
  });

  it("validates typed phones and web URLs", () => {
    expect(editionServiceSchema.safeParse({ serviceType: "other", name: "Info", phone: "not a phone" }).success).toBe(false);
    expect(editionServiceSchema.safeParse({ serviceType: "other", name: "Info", phone: "+33 6 12 34 56 78", websiteUrl: "https://example.test" }).success).toBe(true);
  });

  it.each([
    { eligibilityType: "all" },
    { eligibilityType: "bib_range", bibNumberMin: 1, bibNumberMax: 250 },
    { eligibilityType: "estimated_finish_time", finishMinutesMin: 180, finishMinutesMax: 300 },
    { eligibilityType: "pace", paceSecondsMin: 300, paceSecondsMax: 420 },
    { eligibilityType: "custom", eligibilityNote: "Élites femmes" },
  ])("accepts SAS criterion $eligibilityType", (criterion) => {
    expect(startWaveSchema.safeParse({ name: "SAS A", startTime: "06:30", ...criterion }).success).toBe(true);
  });

  it("rejects incomplete or reversed SAS bounds", () => {
    expect(startWaveSchema.safeParse({ name: "SAS", startTime: "06:30", eligibilityType: "bib_range", bibNumberMin: 10 }).success).toBe(false);
    expect(startWaveSchema.safeParse({ name: "SAS", startTime: "06:30", eligibilityType: "pace", paceSecondsMin: 420, paceSecondsMax: 300 }).success).toBe(false);
  });

  it("clears fields unrelated to the selected SAS criterion", () => {
    const payload = mapStartWavePayload({ name: "Tous", startTime: "08:00", eligibilityType: "all", bibNumberMin: 1, bibNumberMax: 10, eligibilityNote: null }, 0);
    expect(payload.bib_number_min).toBeNull();
    expect(payload.bib_number_max).toBeNull();
  });

  it("requires a valid podium place range and ceremony time", () => {
    expect(raceAwardSchema.safeParse({ categoryKey: "scratch", categoryLabel: "Scratch", audience: "mixed", placeFrom: 1, placeTo: 3, podiumTime: "18:30" }).success).toBe(true);
    expect(raceAwardSchema.safeParse({ categoryKey: "custom", categoryLabel: "", audience: "women", placeFrom: 3, placeTo: 1, podiumTime: "18:30" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { describeAutomationItem, toPlannedCalendarEntries } from "./automation-labels";
import { groupPlannedByDay } from "./publication-calendar";
import type { ReelAutomationItemView } from "./publications-api";

const item = (overrides: Partial<ReelAutomationItemView> = {}): ReelAutomationItemView => ({
  id: "i1",
  raceId: "r1",
  raceName: "Trace des Maquisards",
  mode: "highlights",
  plannedPublishDate: "2027-01-30",
  generateOn: "2027-01-27",
  status: "planned",
  step: null,
  attempts: 0,
  error: null,
  reason: null,
  renderJobId: null,
  socialPostId: null,
  ...overrides,
});

describe("automation labels", () => {
  it("says when a too-late format must be done by hand", () => {
    expect(describeAutomationItem(item({ status: "skipped", reason: "too_late" }))).toEqual({ label: "Trop tard — à faire à la main", tone: "warning" });
  });

  it("describes each state in French", () => {
    expect(describeAutomationItem(item()).label).toBe("Prévu · génération le mer. 27 janv.");
    expect(describeAutomationItem(item({ status: "generating", step: "voice" })).label).toBe("Génération en cours (voix)");
    expect(describeAutomationItem(item({ status: "skipped", reason: "duplicate" })).label).toContain("un reel existe déjà");
    expect(describeAutomationItem(item({ status: "failed", error: "GPU" }))).toEqual({ label: "Échec : GPU", tone: "error" });
    expect(describeAutomationItem(item({ status: "skipped", reason: "ineligible", error: "GPX sans altitudes" })).label).toBe("Non générable automatiquement : GPX sans altitudes");
  });

  it("puts only the reels waiting for their slot in the calendar, grouped by day", () => {
    const entries = toPlannedCalendarEntries([
      item({ id: "a" }),
      item({ id: "b", status: "rendering", raceName: "Astragale" }),
      item({ id: "c", status: "scheduled" }),
      item({ id: "d", status: "skipped", reason: "too_late" }),
      item({ id: "e", status: "drafted", plannedPublishDate: "2027-02-02" }),
    ], "18:00");
    expect(entries.map((entry) => entry.id)).toEqual(["a", "b", "e"]);
    const byDay = groupPlannedByDay(entries);
    expect(byDay.get("2027-01-30")?.map((entry) => entry.label)).toEqual(["Astragale", "Trace des Maquisards"]);
    expect(byDay.get("2027-02-02")?.[0].time).toBe("18:00");
  });
});

import { describe, expect, it } from "vitest";

import { describeAutomationItem, describeCarouselItem, toPlannedCalendarEntries, toPlannedCarouselEntries, toPlannedFlyoverEntries } from "./automation-labels";
import { groupPlannedByDay } from "./publication-calendar";
import type { FlyoverOrderView, ReelAutomationItemView } from "./publications-api";

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

describe("carousel labels", () => {
  const carousel = (overrides = {}) => ({
    id: "c1", series: "week" as const, plannedPublishDate: "2026-11-29", generateOn: "2026-11-26", raceId: null, raceName: null, weekStart: "2026-11-30",
    status: "planned" as const, step: null, attempts: 0, error: null, reason: null, carouselJobId: null, socialPostId: null, ...overrides,
  });

  it("describes a skipped week and marks carousel calendar entries", () => {
    expect(describeCarouselItem(carousel({ status: "skipped", reason: "no_candidate" })).label).toContain("aucune course");
    const [entry] = toPlannedCarouselEntries([carousel()], "18:00");
    expect(entry).toMatchObject({ day: "2026-11-29", kind: "carousel", time: "18:00" });
    expect(entry.label).toContain("La semaine qui vient");
  });
});

describe("flyover calendar entries", () => {
  const order = (overrides: Partial<FlyoverOrderView> = {}): FlyoverOrderView => ({
    id: "o1", raceName: "Trail du Mont", offer: "collab", status: "scripted", statusLabel: "Texte prêt", contactEmail: "orga@example.com", instagramHandle: "traildumont",
    publishLocal: "2026-12-05T18:30", mapPreset: "signature", storyMode: null, distanceKm: 42, aidStationCount: 3, attempts: 0, maxAttempts: 3, error: null, paidAt: null, readyAt: null,
    createdAt: "2026-11-20T10:00:00Z", readyEmailSent: false, renderJobId: null, renderStatus: null, renderProgress: null, socialPostId: null, orderUrl: null, downloadUrl: null, actions: [],
    ...overrides,
  });

  it("puts a paid collaboration on the day and time chosen by the organizer", () => {
    expect(toPlannedFlyoverEntries([order()], [])).toEqual([{ id: "o1", day: "2026-12-05", label: "Trail du Mont", time: "18:30", kind: "flyover" }]);
  });

  it("leaves out downloads, unpaid, refunded or cancelled orders and those without a slot", () => {
    const entries = toPlannedFlyoverEntries([
      order({ id: "download", offer: "download", publishLocal: null }),
      order({ id: "unpaid", status: "pending_payment" }),
      order({ id: "refunded", status: "refunded" }),
      order({ id: "expired", status: "expired" }),
      order({ id: "no-slot", publishLocal: null }),
      order({ id: "rendering", status: "rendering" }),
    ], []);
    expect(entries.map((entry) => entry.id)).toEqual(["rendering"]);
  });

  it("lets the post stand in once it is scheduled or published, not while it is a draft", () => {
    const orders = [order({ id: "scheduled", socialPostId: "p1" }), order({ id: "draft", socialPostId: "p2" })];
    const entries = toPlannedFlyoverEntries(orders, [{ id: "p1", status: "scheduled" }, { id: "p2", status: "draft" }]);
    expect(entries.map((entry) => entry.id)).toEqual(["draft"]);
  });
});

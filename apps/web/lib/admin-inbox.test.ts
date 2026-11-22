import { describe, expect, it } from "vitest";

import {
  claimToItem,
  countedInboxTotal,
  countInboxByType,
  failedFlyoverToItem,
  failedRenderToItem,
  feedbackToItem,
  filterInboxItems,
  formatWaitingSince,
  inboxItemAge,
  isRecentRenderFailure,
  postToItem,
  publicationRequestToItem,
  raceDataGapToItem,
  readInboxFilter,
  sortInboxItems,
  writeInboxFilter,
  type InboxItem,
} from "./admin-inbox";

const NOW = Date.parse("2026-11-22T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("admin inbox mapping", () => {
  it("maps each source to a row that opens the screen where it is handled", () => {
    const bug = feedbackToItem({ id: 12, created_at: hoursAgo(9), kind: "bug", subject: "[bug] Le PDF ne s'ouvre pas", source: "ios", screen: "plan" });
    expect(bug).toMatchObject({ id: "bug:12", type: "bug", title: "« Le PDF ne s'ouvre pas »", context: "Bug · ios · plan", href: "/admin/inbox?vue=bugs" });
    expect(feedbackToItem({ id: 3, created_at: hoursAgo(1), kind: "feedback", subject: "Super", source: "web", screen: null }).href).toBe("/admin/inbox?vue=feedback");

    expect(claimToItem({ id: "c1", created_at: hoursAgo(50), organization_name: "Club", contact_email: "contact@club.fr", race_events: { name: "Ultra des Druides" } }))
      .toMatchObject({ title: "Demande d’accès · Ultra des Druides", href: "/admin/organizers?vue=acces" });
    expect(publicationRequestToItem({ id: "p1", created_at: hoursAgo(72), race_events: { name: "Trail des Aiguilles" }, requested_race: null }).href).toBe("/admin/organizers");
    expect(failedFlyoverToItem({ id: "f1", race_name: "SaintéLyon", offer: "download", error: "arrêtée", updated_at: hoursAgo(2) }))
      .toMatchObject({ title: "Survol « SaintéLyon » en échec", href: "/admin/content/flyovers", since: hoursAgo(2) });
  });

  it("separates failed posts from drafts and links the carousel tab", () => {
    const base = { media_type: "carousel" as const, carousel_series: "brief" as const, error: "Quota", auto_generated: true, dry_run: true, created_at: hoursAgo(30), updated_at: hoursAgo(3), races: { name: "Ultra" } };
    const failed = postToItem({ ...base, id: "post-1", status: "failed" });
    expect(failed).toMatchObject({ type: "post_failed", since: hoursAgo(3), href: "/admin/content/posts?onglet=carousels&post=post-1" });
    expect(failed.title).toContain("Carrousel Le brief · Ultra");
    const draft = postToItem({ ...base, id: "post-2", status: "draft", media_type: "reel", carousel_series: null });
    expect(draft).toMatchObject({ type: "post_draft", since: hoursAgo(30), href: "/admin/content/posts?post=post-2", context: "Instagram · brouillon automatique" });
  });

  it("keeps only the renders failed within the window", () => {
    expect(isRecentRenderFailure({ status: "failed", createdAt: hoursAgo(30), finishedAt: hoursAgo(2) }, NOW, 24 * 3_600_000)).toBe(true);
    expect(isRecentRenderFailure({ status: "failed", createdAt: hoursAgo(30), finishedAt: hoursAgo(25) }, NOW, 24 * 3_600_000)).toBe(false);
    expect(isRecentRenderFailure({ status: "done", createdAt: hoursAgo(1), finishedAt: hoursAgo(1) }, NOW, 24 * 3_600_000)).toBe(false);
    expect(failedRenderToItem({ id: "r1", kind: "reel", title: "Orchis", stage: "Échec : GPU", createdAt: hoursAgo(3), finishedAt: hoursAgo(2) }).context).toBe("Rendu de reel · GPU");
  });

  it("lists a race data gap only while it still keeps a reel from being made", () => {
    const gap = { raceId: "race-1", date: "2026-12-11", eventName: "Trail du Ventoux", name: "42 km", distanceKm: 42, missing: ["gpx" as const], unlocks: ["reel" as const, "plan" as const], reelDeadline: "2026-12-01", reelTooLate: false };
    expect(raceDataGapToItem(gap)).toMatchObject({ title: "GPX manquant · Trail du Ventoux · 42 km", dueDate: "2026-12-01", since: null, href: "/admin/catalog/races?course=race-1" });
    expect(raceDataGapToItem(gap)?.context).toContain("reel possible le 4 déc.");
    expect(raceDataGapToItem({ ...gap, reelTooLate: true })).toBeNull();
    expect(raceDataGapToItem({ ...gap, unlocks: ["brief"], reelDeadline: null })).toBeNull();
  });
});

describe("admin inbox age, sort and filters", () => {
  const item = (overrides: Partial<InboxItem>): InboxItem => ({ id: "x", type: "bug", title: "t", context: "c", since: hoursAgo(1), dueDate: null, href: "/admin/inbox", ...overrides });

  it("formats the waiting time", () => {
    expect(formatWaitingSince(new Date(NOW - 20_000).toISOString(), NOW)).toBe("à l’instant");
    expect(formatWaitingSince(hoursAgo(0.2), NOW)).toBe("depuis 12 min");
    expect(formatWaitingSince(hoursAgo(9), NOW)).toBe("depuis 9 h");
    expect(formatWaitingSince(hoursAgo(75), NOW)).toBe("depuis 3 j");
  });

  it("turns red past the threshold of each type", () => {
    expect(inboxItemAge(item({ type: "bug", since: hoursAgo(23) }), NOW, "2026-11-22").late).toBe(false);
    expect(inboxItemAge(item({ type: "bug", since: hoursAgo(24) }), NOW, "2026-11-22").late).toBe(true);
    expect(inboxItemAge(item({ type: "feedback", since: hoursAgo(48) }), NOW, "2026-11-22").late).toBe(false);
    expect(inboxItemAge(item({ type: "flyover_failed", since: hoursAgo(5) }), NOW, "2026-11-22").late).toBe(true);
    const due = inboxItemAge(item({ type: "race_data", since: null, dueDate: "2026-11-25" }), NOW, "2026-11-22");
    expect(due).toMatchObject({ label: "avant le 25 nov.", late: true });
    expect(inboxItemAge(item({ type: "race_data", since: null, dueDate: "2026-12-01" }), NOW, "2026-11-22").late).toBe(false);
  });

  it("sorts oldest first, deadlines after", () => {
    const sorted = sortInboxItems([
      item({ id: "gap-late", type: "race_data", since: null, dueDate: "2026-12-05" }),
      item({ id: "recent", since: hoursAgo(1) }),
      item({ id: "gap-soon", type: "race_data", since: null, dueDate: "2026-11-30" }),
      item({ id: "old", since: hoursAgo(80) }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["old", "recent", "gap-soon", "gap-late"]);
  });

  it("filters by type and accent-insensitive search; the URL keeps the slugs", () => {
    const items = [
      item({ id: "1", type: "bug", title: "« PDF illisible »" }),
      item({ id: "2", type: "flyover_failed", title: "Survol « SaintéLyon » en échec" }),
      item({ id: "3", type: "race_data", title: "GPX manquant · Ventoux", since: null, dueDate: "2026-12-01" }),
    ];
    expect(filterInboxItems(items, { types: ["flyover_failed"], search: "" }).map((entry) => entry.id)).toEqual(["2"]);
    expect(filterInboxItems(items, { types: [], search: "saintelyon echec" }).map((entry) => entry.id)).toEqual(["2"]);
    expect(filterInboxItems(items, { types: [], search: "données" }).map((entry) => entry.id)).toEqual(["3"]);
    expect(readInboxFilter("survols,bugs,inconnu")).toEqual(["bug", "flyover_failed"]);
    expect(writeInboxFilter(["flyover_failed", "bug"])).toBe("bugs,survols");
    expect(readInboxFilter(null)).toEqual([]);
  });

  it("counts by type; race data stays out of the badge total", () => {
    const counts = countInboxByType([item({ type: "bug" }), item({ type: "bug" }), item({ type: "race_data", since: null })]);
    expect(counts.bug).toBe(2);
    expect(counts.race_data).toBe(1);
    expect(countedInboxTotal(counts)).toBe(2);
  });
});

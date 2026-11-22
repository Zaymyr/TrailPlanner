import { describe, expect, it } from "vitest";

import {
  buildActivityFeed,
  buildAgenda,
  buildOverviewFunnel,
  buildOverviewKpis,
  buildOverviewRevenue,
  resolveOverviewRange,
  sumFlyoverRevenue,
  summarizeAutomationHealth,
  summarizeFlyoverHealth,
  summarizeHealthLine,
  summarizeInstagramHealth,
  summarizeRenderHealth,
  type OverviewGrowth,
} from "./admin-overview";

const growth = (overrides: { newAccounts?: number; net?: number; published?: number } = {}): OverviewGrowth => ({
  overview: { newAccounts: overrides.newAccounts ?? 10, activationEligibleAccounts: 8, activatedUsers: 4, activePlanUsers: 30, newPlans: 12, activePremiumUsers: 5 },
  trend: [
    { date: "2026-11-21", newAccounts: 4, activePlanUsers: 12, newPlans: 5 },
    { date: "2026-11-22", newAccounts: 6, activePlanUsers: 18, newPlans: 7 },
  ],
  organizers: {
    publishedRacebooks: overrides.published ?? 2,
    commercial: { paidTransactions: 2, grossRevenueMinor: 30_000, invalidatedTransactions: 1, invalidatedRevenueMinor: 2_000, netRevenueMinor: overrides.net ?? 28_000, currency: "eur" },
    funnel: [{ step: "Événements de la cohorte", count: 3, conversionFromPrevious: null }],
  },
});

describe("resolveOverviewRange", () => {
  it("gives the period and the previous one of the same length (Paris days, inclusive)", () => {
    expect(resolveOverviewRange({ key: "today", today: "2026-11-22" })).toMatchObject({ key: "today", start: "2026-11-22", end: "2026-11-22", days: 1, previousStart: "2026-11-21", previousEnd: "2026-11-21" });
    expect(resolveOverviewRange({ key: "7d", today: "2026-11-22" })).toMatchObject({ start: "2026-11-16", end: "2026-11-22", days: 7, previousStart: "2026-11-09", previousEnd: "2026-11-15" });
    expect(resolveOverviewRange({ key: "30d", today: "2026-11-22" })).toMatchObject({ start: "2026-10-24", days: 30, previousEnd: "2026-10-23" });
  });

  it("accepts a valid custom span, clamps it to today and falls back to 7 days otherwise", () => {
    expect(resolveOverviewRange({ key: "custom", from: "2026-11-01", to: "2026-11-10", today: "2026-11-22" })).toMatchObject({ key: "custom", days: 10, previousStart: "2026-10-22", previousEnd: "2026-10-31" });
    expect(resolveOverviewRange({ key: "custom", from: "2026-11-20", to: "2026-12-31", today: "2026-11-22" })).toMatchObject({ end: "2026-11-22", days: 3 });
    expect(resolveOverviewRange({ key: "custom", from: "2026-11-10", to: "2026-11-01", today: "2026-11-22" }).key).toBe("7d");
    expect(resolveOverviewRange({ key: "custom", from: "2024-01-01", to: "2026-11-01", today: "2026-11-22" }).key).toBe("7d");
    expect(resolveOverviewRange({ key: "bogus", today: "2026-11-22" }).key).toBe("7d");
  });
});

describe("KPI, funnel and revenue", () => {
  const flyovers = sumFlyoverRevenue([
    { amount_cents: 2_999, status: "ready", paid_at: "2026-11-20T10:00:00Z" },
    { amount_cents: 5_999, status: "rendering", paid_at: "2026-11-21T10:00:00Z" },
    { amount_cents: 2_999, status: "refunded", paid_at: "2026-11-21T11:00:00Z" },
    { amount_cents: 2_999, status: "pending_payment", paid_at: null },
    { amount_cents: 2_999, status: "cancelled", paid_at: "2026-11-21T12:00:00Z" },
  ]);

  it("sums the paid flyover orders and keeps refunds apart", () => {
    expect(flyovers).toEqual({ amountMinor: 8_998, count: 2, refundedMinor: 2_999, refundedCount: 1 });
  });

  it("compares the period with the previous one and adds the flyovers to the revenue", () => {
    const kpis = buildOverviewKpis({ current: growth(), previous: growth({ newAccounts: 8, net: 10_000 }), flyovers, previousFlyovers: null });
    expect(kpis.newAccounts).toEqual({ current: 10, previous: 8, series: [4, 6] });
    expect(kpis.netRevenue).toMatchObject({ current: 36_998, previous: 10_000, partial: false, currency: "eur" });
    expect(kpis.activePremium.series).toEqual([]);
    const partial = buildOverviewKpis({ current: growth(), previous: null, flyovers: null, previousFlyovers: null });
    expect(partial.netRevenue).toMatchObject({ current: 28_000, previous: null, partial: true });
  });

  it("builds the runner funnel from the growth cohort", () => {
    const funnel = buildOverviewFunnel(growth());
    expect(funnel.runners.map((row) => row.count)).toEqual([10, 8, 4]);
    expect(funnel.runners[2].conversionFromPrevious).toBe(50);
    expect(funnel.organizers).toHaveLength(1);
  });

  it("never invents runner revenue and reports an unreadable source", () => {
    const revenue = buildOverviewRevenue({ current: growth(), previous: growth({ net: 1_000 }), flyovers, previousFlyovers: { amountMinor: 0, count: 0, refundedMinor: 0, refundedCount: 0 }, growthError: null, flyoverError: null });
    const runners = revenue.sources.find((source) => source.key === "runners");
    expect(runners).toMatchObject({ tracked: false, amountMinor: null });
    expect(revenue.totalMinor).toBe(36_998);
    expect(revenue.previousTotalMinor).toBe(1_000);
    const broken = buildOverviewRevenue({ current: growth(), previous: null, flyovers: null, previousFlyovers: null, growthError: null, flyoverError: "Les commandes de survol n’ont pas pu être lues." });
    expect(broken.sources.find((source) => source.key === "flyovers")).toMatchObject({ amountMinor: null, error: "Les commandes de survol n’ont pas pu être lues." });
    expect(broken.previousTotalMinor).toBeNull();
  });
});

describe("buildAgenda", () => {
  it("groups the next 7 days by day and time, leaves out the days outside the window", () => {
    const days = buildAgenda({
      today: "2026-11-22",
      publishTime: "18:00",
      posts: [
        { id: "p1", media_type: "reel", carousel_series: null, scheduled_at: "2026-11-24T11:30:00Z", dry_run: true, races: { name: "Trail des Aiguilles" } },
        { id: "p2", media_type: "carousel", carousel_series: "plan", scheduled_at: "2026-12-05T11:30:00Z", dry_run: false, races: null },
      ],
      planned: [
        { id: "i1", kind: "carousel", plannedDate: "2026-11-24", title: "Le brief · Ultra" },
        { id: "i2", kind: "reel", plannedDate: "2026-11-27", title: "Duo Trail" },
        { id: "i3", kind: "reel", plannedDate: "2026-11-29", title: "Hors fenêtre" },
      ],
      races: [{ id: "e1", eventId: "ev", date: "2026-11-28", name: "Trail TST" }],
    });
    expect(days.map((day) => day.date)).toEqual(["2026-11-24", "2026-11-27", "2026-11-28"]);
    expect(days[0].events.map((event) => [event.kind, event.scheduled, event.time])).toEqual([["reel", true, "12:30"], ["carousel", false, "18:00"]]);
    expect(days[0].events[0]).toMatchObject({ title: "Trail des Aiguilles", note: "Reel programmé · simulation", href: "/admin/content/posts?post=p1" });
    expect(days[0].events[1].href).toBe("/admin/content/posts?onglet=carousels&element=i1");
    expect(days[2].events[0]).toMatchObject({ kind: "race", time: null });
  });
});

describe("health", () => {
  it("rates renders by their failures of the last 24 h", () => {
    expect(summarizeRenderHealth([]).detail).toBe("Aucun rendu en 24 h");
    const warn = summarizeRenderHealth([{ status: "failed", created_at: "2026-11-22T10:00:00Z" }, { status: "done", created_at: "2026-11-22T11:00:00Z" }, { status: "running", created_at: "2026-11-22T11:30:00Z" }]);
    expect(warn).toMatchObject({ status: "warning", detail: "1 échec sur 3 rendus en 24 h · 1 en cours", lastAt: "2026-11-22T11:30:00Z" });
    expect(summarizeRenderHealth(Array.from({ length: 3 }, () => ({ status: "failed", created_at: "2026-11-22T10:00:00Z" }))).status).toBe("error");
  });

  it("flags Instagram: missing credentials, token error, simulation, failures, quota", () => {
    const base = { credentialsConfigured: true, profileError: null, quota: { usage: 3, total: 50 }, dryRun: false, failedPosts: 0, lastPublishedAt: null };
    expect(summarizeInstagramHealth(base)).toMatchObject({ status: "ok", detail: "quota 3 / 50 sur 24 h", meter: { value: 3, total: 50 } });
    expect(summarizeInstagramHealth({ ...base, dryRun: true, failedPosts: 2 })).toMatchObject({ status: "warning", detail: "Mode simulation · quota 3 / 50 sur 24 h · 2 publications en échec" });
    expect(summarizeInstagramHealth({ ...base, credentialsConfigured: false }).status).toBe("error");
    expect(summarizeInstagramHealth({ ...base, profileError: "Jeton refusé" })).toMatchObject({ status: "error", detail: "Jeton refusé" });
    expect(summarizeInstagramHealth({ ...base, quota: { usage: 45, total: 50 } }).status).toBe("warning");
  });

  it("flags flyover failures and orders late past 24 h", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(summarizeFlyoverHealth([{ status: "rendering", paid_at: "2026-11-22T10:00:00Z", updated_at: "2026-11-22T11:00:00Z" }], now)).toMatchObject({ status: "ok", detail: "1 en cours" });
    expect(summarizeFlyoverHealth([{ status: "paid", paid_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-20T10:00:00Z" }], now)).toMatchObject({ status: "warning", detail: "1 en cours · 1 au-delà de 24 h" });
    expect(summarizeFlyoverHealth([{ status: "failed", paid_at: "2026-11-22T10:00:00Z", updated_at: "2026-11-22T11:00:00Z" }], now)).toMatchObject({ status: "error", detail: "0 en cours · 1 en échec" });
  });

  it("describes the automation switches and the next slots", () => {
    const off = summarizeAutomationHealth({ generationEnabled: false, autoPublishEnabled: false, carousels: { plan: false, brief: false, week: false }, publishTime: "18:00", nextReel: null, nextCarousel: null, failedItems: 0, updatedAt: null });
    expect(off).toMatchObject({ status: "off", detail: "Reels : coupés · Carrousels : coupés" });
    const on = summarizeAutomationHealth({ generationEnabled: true, autoPublishEnabled: false, carousels: { plan: true, brief: true, week: false }, publishTime: "18:00", nextReel: { date: "2026-11-24", title: "Ultra" }, nextCarousel: null, failedItems: 1, updatedAt: null });
    expect(on.status).toBe("warning");
    expect(on.detail).toContain("Reels : génération, publication après relecture · Carrousels : 2 séries sur 3");
    expect(on.detail).toContain("prochain reel mar. 24 nov. 18:00");
    expect(on.detail).toContain("1 élément en échec");
  });

  it("leaves untracked systems out of the summary line", () => {
    const untracked = { key: "x", label: "X", status: "untracked" as const, detail: "", lastAt: null, meter: null, href: null };
    expect(summarizeHealthLine([untracked])).toBe("tous les systèmes suivis répondent");
    expect(summarizeHealthLine([summarizeRenderHealth([{ status: "failed", created_at: "x" }, { status: "done", created_at: "y" }]), untracked])).toBe("1 avertissement");
  });
});

describe("buildActivityFeed", () => {
  it("merges the latest events newest first", () => {
    const events = buildActivityFeed({
      today: "2026-11-22",
      payments: [{ id: "pay", paid_at: "2026-11-22T11:48:00Z", amount_total: 9_900, currency: "eur", to_tier: "essential", payment_channel: "stripe", eventName: "Trail des Aiguilles" }],
      flyoverOrders: [
        { id: "f1", created_at: "2026-11-22T11:00:00Z", paid_at: "2026-11-22T11:12:00Z", race_name: "Trail des Crêtes", offer: "download", status: "paid" },
        { id: "f2", created_at: "2026-11-22T11:30:00Z", paid_at: null, race_name: "Non payé", offer: "collab", status: "pending_payment" },
      ],
      renders: [
        { id: "r1", kind: "reel", title: "Orchis", status: "failed", stage: "Échec", finishedAt: "2026-11-22T10:00:00Z" },
        { id: "r2", kind: "reel", title: "En cours", status: "active", stage: "…", finishedAt: null },
      ],
      posts: [{ id: "p1", media_type: "reel", published_at: "2026-11-21T18:00:00Z", dry_run: true, races: { name: "Druides" } }],
      accountsToday: { count: 14, at: "2026-11-22T12:00:00Z" },
    });
    expect(events.map((event) => event.kind)).toEqual(["accounts", "payment", "flyover_order", "render_failed", "post_published"]);
    expect(events[0].title).toBe("14 nouveaux comptes");
    expect(events[1].title).toBe("Essentiel payé");
    expect(events[1].detail).toMatch(/^Trail des Aiguilles · 99\s€$/);
    expect(events[4].detail).toBe("Druides · simulation");
  });
});

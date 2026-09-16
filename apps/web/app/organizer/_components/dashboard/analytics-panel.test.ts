import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatAnalyticsDuration, OrganizerAnalyticsPanel, OrganizerAnalyticsSummaryCards } from "./analytics-panel";

vi.mock("../../../../components/ui/MetricCard", async () => {
  const { createElement: createMockElement } = await import("react");
  return {
    MetricCard: ({ label, value, helper }: { label: string; value: string; helper?: string }) =>
      createMockElement("div", null, label, value, helper),
  };
});

describe("organizer analytics presentation", () => {
  it("formats missing, short and minute-long active durations", () => {
    expect(formatAnalyticsDuration(null)).toBe("—");
    expect(formatAnalyticsDuration(42.4)).toBe("42 s");
    expect(formatAnalyticsDuration(125.6)).toBe("2 min 06 s");
  });

  it("does not expose negative durations", () => {
    expect(formatAnalyticsDuration(-4)).toBe("0 s");
  });

  it("shows the event favorite count with the analytics KPIs", () => {
    const html = renderToStaticMarkup(createElement(OrganizerAnalyticsSummaryCards, {
      summary: {
        uniqueReaders: 12,
        totalOpens: 20,
        averageActiveSeconds: 75,
        engagementRate: 0.6,
        favoriteCount: 37,
      },
    }));
    expect(html).toContain("Ajouts aux favoris");
    expect(html).toContain("37");
    expect(html).toContain("Coureurs suivant l’événement");
  });

  it("shows the Signature upgrade message when access is locked", () => {
    const html = renderToStaticMarkup(createElement(OrganizerAnalyticsPanel, {
      editionId: "edition-id",
      accessToken: "token",
      access: { allowed: false, source: null },
      races: [],
      onOpenPricing: () => undefined,
    }));
    expect(html).toContain("Suivez l’usage de votre RaceBook");
    expect(html).toContain("Découvrir l’offre Signature");
    expect(html).not.toContain("Chargement des statistiques");
  });

  it("offers the format and 7/30/90-day filters to authorized organizers", () => {
    const html = renderToStaticMarkup(createElement(OrganizerAnalyticsPanel, {
      editionId: "edition-id",
      accessToken: "token",
      access: { allowed: true, source: "complimentary" },
      races: [{ id: "race-id", name: "42 km" }] as never,
      onOpenPricing: () => undefined,
    }));
    expect(html).toContain("Module offert pour cette édition");
    expect(html).toContain("Tous les formats");
    expect(html).toContain("42 km");
    expect(html).toContain("7 jours");
    expect(html).toContain("30 jours");
    expect(html).toContain("90 jours");
  });
});

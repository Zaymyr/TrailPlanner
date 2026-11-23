import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ChronologySection } from "./chronology-types";
import { ChronologyView } from "./ChronologyView";
import { PlanHeroStats, computeCompleteness } from "./PlanHeroStats";
import { PlanViewTabs } from "./PlanViewTabs";

describe("computeCompleteness", () => {
  it("counts sections whose carbs and sodium are on target", () => {
    expect(
      computeCompleteness([
        { carbs: "success", water: "success", sodium: "success" },
        { carbs: "warning", water: "success", sodium: "success" },
        { carbs: "success", water: "success", sodium: "danger" },
        { carbs: "success", water: "success", sodium: "success" },
      ]),
    ).toEqual({ onTarget: 2, total: 4 });
  });

  it("ignores a neutral water tone but not a failing one", () => {
    expect(
      computeCompleteness([
        { carbs: "success", water: "neutral", sodium: "success" },
        { carbs: "success", water: "danger", sodium: "success" },
      ]),
    ).toEqual({ onTarget: 1, total: 2 });
  });

  it("handles an empty plan", () => {
    expect(computeCompleteness([])).toEqual({ onTarget: 0, total: 0 });
  });
});

describe("PlanHeroStats", () => {
  const base = {
    locale: "fr" as const,
    raceName: "Trail des Monts",
    distanceKm: 24.8,
    elevationGainM: 1200,
    elevationLossM: 1180,
    totalMinutes: 206,
    carbsG: 180,
    carbsPerHour: 52,
    gelsCount: 6,
    waterMl: 3000,
    sodiumMg: 1500,
    profile: [
      { distanceKm: 0, elevationM: 200 },
      { distanceKm: 12, elevationM: 600 },
      { distanceKm: 24.8, elevationM: 250 },
    ],
    aidStationKms: [11],
    sectionsOnTarget: 3,
    sectionsTotal: 4,
  };

  it("formats values for the French locale", () => {
    const html = renderToStaticMarkup(createElement(PlanHeroStats, base));
    expect(html).toContain("24,8 km");
    expect(html).toContain("3,0 L");
    expect(html).toContain("3 h 26");
    expect(html).toContain("3 tronçons sur 4 dans la cible");
    expect(html).toContain("<svg");
  });

  it("shows the lock hint only when locked", () => {
    expect(renderToStaticMarkup(createElement(PlanHeroStats, base))).not.toContain("Débloquez");
    expect(renderToStaticMarkup(createElement(PlanHeroStats, { ...base, locked: true }))).toContain("Débloquez");
  });
});

describe("PlanViewTabs", () => {
  it("renders three tabs with the selected one marked", () => {
    const html = renderToStaticMarkup(
      createElement(PlanViewTabs, { value: "pace", onChange: () => {}, locale: "fr", counts: { stations: 4, sections: 5 } }),
    );
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(3);
    expect(html).toContain("Ravitos");
    expect(html).toContain("Allures");
    expect(html).toContain("Chronologie");
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/id="plan-view-tab-pace"[^>]*aria-selected="true"/);
  });

  it("uses English labels", () => {
    const html = renderToStaticMarkup(createElement(PlanViewTabs, { value: "stations", onChange: () => {}, locale: "en" }));
    expect(html).toContain("Aid stations");
    expect(html).toContain("Timeline");
  });
});

describe("ChronologyView", () => {
  const sections: ChronologySection[] = [
    {
      key: "s1",
      fromName: "Départ",
      toName: "Chaponost",
      startMinute: 0,
      durationMin: 88,
      distanceKm: 11,
      dPlus: 184,
      dMinus: 215,
      events: [{ minute: 45, label: "1 gel", detail: "25 g de glucides", kind: "carbs" }],
    },
    { key: "s2", fromName: "Chaponost", toName: "Arrivée", startMinute: 88, durationMin: 60, distanceKm: 13.8, dPlus: 100, dMinus: 90, events: [] },
    { key: "s3", fromName: "Arrivée", toName: "Bonus", startMinute: 148, durationMin: 30, distanceKm: 5, dPlus: 10, dMinus: 10, events: [] },
  ];

  it("renders clock times, the section header and the empty-section text", () => {
    const html = renderToStaticMarkup(createElement(ChronologyView, { sections, locale: "fr" }));
    expect(html).toContain("0:45");
    expect(html).toContain("1:28");
    expect(html).toContain("Départ → Chaponost");
    expect(html).toContain("Aucune prise prévue sur ce tronçon");
    expect(html).not.toContain("blur-");
  });

  it("blurs sections from lockedFromIndex and renders the CTA", () => {
    const html = renderToStaticMarkup(
      createElement(ChronologyView, { sections, locale: "fr", lockedFromIndex: 1, renderLockedCta: () => createElement("button", null, "Débloquer") }),
    );
    expect(html).toContain("data-chronology-locked");
    expect(html).toContain("blur-");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Débloquer");
    expect(html.indexOf("1:28")).toBeGreaterThan(html.indexOf("data-chronology-locked"));
    expect(html.indexOf("0:45")).toBeLessThan(html.indexOf("data-chronology-locked"));
  });
});

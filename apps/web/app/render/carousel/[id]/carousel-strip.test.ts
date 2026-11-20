import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildBriefSnapshot } from "../../../../lib/carousels/carousel-brief";
import { buildPlanSnapshot, type CarouselRaceData } from "../../../../lib/carousels/carousel-plan";
import { buildWeekSnapshot } from "../../../../lib/carousels/carousel-week";
import { CarouselStrip } from "./CarouselStrip";

const race: CarouselRaceData = {
  raceId: "r", raceName: "SaintéLyon", eventName: "Asics SaintéLyon", shortName: "SaintéLyon", raceDate: "2026-11-28", startTime: "23:30",
  distanceKm: 80, elevationGainM: 2_500, elevationLossM: 2_650,
  profile: Array.from({ length: 81 }, (_, km) => ({ km, elevationM: 400 + Math.sin(km / 6) * 250 })), lat: 45.43, lon: 4.39,
  stations: [17, 32, 46, 60, 67].map((km) => ({ name: `Ravito ${km}`, km, waterAvailable: true, solidAvailable: true, cutoffTime: null })),
  finishCutoffTime: null, startName: "Saint-Étienne", finishName: "Lyon",
  livret: { available: false, equipment: false, bibPickup: false, access: false, services: false },
};

const render = (snapshot: Parameters<typeof CarouselStrip>[0]["snapshot"]) =>
  renderToStaticMarkup(React.createElement(CarouselStrip, { snapshot, fontClassName: "f" }));

describe("carousel strip", () => {
  it("draws the plan as one 3-slide strip with the band, the table and the sections", () => {
    const result = buildPlanSnapshot(race);
    if (!result.ok) throw new Error(result.reason);
    const html = render(result.snapshot);
    expect(html).toContain("width:3240px");
    expect(html).toContain("Combien manger sur SaintéLyon 80");
    expect(html).toContain("KM 17 · Ravito 17");
    expect(html).toContain("tronçon par tronçon");
    expect(html).not.toMatch(/\b1\s*\/\s*3\b/);
  });

  it("draws the brief and the week", () => {
    const brief = buildBriefSnapshot({
      eventName: "Asics SaintéLyon", raceTitle: "SaintéLyon 80 km", shortLabel: "SAINTÉLYON 80 KM", raceDate: "2026-11-28", distanceKm: 80, elevationGainM: 2_500,
      stations: race.stations, finishCutoffTime: null, nightStart: true, livret: race.livret,
    });
    expect(render(brief)).toContain("Les ravitos.");
    const week = buildWeekSnapshot([{ eventId: "e", name: "SaintéLyon", location: null, formats: [{ raceId: "a", name: "80 km", date: "2026-11-28", distanceKm: 80, elevationGainM: 2_500, participationMode: "solo" }] }], "2026-11-23");
    if (!week) throw new Error("no week");
    expect(render(week)).toContain("SAM. 28 NOV.");
  });
});

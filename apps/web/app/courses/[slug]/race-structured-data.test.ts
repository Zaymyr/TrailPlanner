import { describe, expect, it } from "vitest";

import { buildRaceOverview, buildRaceStructuredData } from "./race-structured-data";

const race = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  editionId: "33333333-3333-4333-8333-333333333333",
  slug: "trail-glazig-5-km-2027",
  name: "Trail Glazig — 5 km",
  eventName: "Trail Glazig",
  date: "2027-02-06",
  location: "Plourhan, Côtes-d'Armor",
  distanceKm: 5,
  elevationGainM: 47,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: "https://www.trail-glazig.com/trail-5k",
  updatedAt: "2026-09-09T12:00:00.000Z",
  elevationLossM: null,
  minAltitudeM: null,
  maxAltitudeM: null,
  participationMode: "solo" as const,
  eventEndDate: "2027-02-07",
  officialWebsiteUrl: "https://www.trail-glazig.com/",
  instagramUrl: null,
  facebookUrl: null,
  routePreview: null,
  aidStations: [],
  practical: {
    schedule: { startTime: null, finishCutoffTime: null, cutoffNote: null, note: null },
    equipment: { items: [], note: null },
    bibPickup: { locations: [], schedule: null, requiredDocuments: null, thirdPartyPickupAllowed: null, equipmentCheck: null, note: null },
    access: { startAddress: null, startLocation: { label: null, googleMapsUrl: null }, finishAddress: null, finishLocation: { label: null, googleMapsUrl: null }, officialParkings: null, shuttles: null, shuttleSchedule: null, roadRestrictions: null, mapUrl: null, note: null },
    runnerInfo: { startArea: null, briefing: null, rules: null, note: null },
    services: { supporters: null, accommodations: null, restaurants: null, recovery: null, partners: null, note: null },
  },
};

describe("race SEO content", () => {
  it("builds a physical-event address without extending a format to the whole event weekend", () => {
    const data = buildRaceStructuredData(race, "https://pace-yourself.com/courses/trail-glazig-5-km-2027");

    expect(data).not.toBeNull();
    expect(data.location).toEqual({
      "@type": "Place",
      name: race.location,
      address: { "@type": "PostalAddress", name: race.location },
    });
    expect(data).not.toHaveProperty("endDate");
    expect(data.sameAs).toEqual([race.externalSiteUrl, race.officialWebsiteUrl]);
  });

  it("omits SportsEvent when its required start date is missing or invalid", () => {
    expect(buildRaceStructuredData({ ...race, date: null }, "https://pace-yourself.com/courses/sans-date")).toBeNull();
    expect(buildRaceStructuredData({ ...race, date: "2027-99-99" }, "https://pace-yourself.com/courses/date-invalide")).toBeNull();
    expect(buildRaceStructuredData({ ...race, date: "2027-02-29" }, "https://pace-yourself.com/courses/date-impossible")).toBeNull();
  });

  it("creates a factual, race-specific overview from verified fields", () => {
    expect(buildRaceOverview(race, "6 février 2027")).toContain(
      "Cette course fait partie de l’événement Trail Glazig. Trail Glazig — 5 km est une course prévue le 6 février 2027 à Plourhan, Côtes-d'Armor sur 5 km et 47 m de dénivelé positif.",
    );
  });
});

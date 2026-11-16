import { describe, expect, it } from "vitest";

import { buildRaceOverview, buildRaceStructuredData } from "./race-structured-data";

const race = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  editionId: "33333333-3333-4333-8333-333333333333",
  eventEditionSlug: "trail-glazig-2027",
  slug: "trail-glazig-5-km-2027",
  name: "Trail Glazig — 5 km",
  eventName: "Trail Glazig",
  date: "2027-02-06",
  location: "Plourhan, Côtes-d'Armor",
  locationCity: "Plourhan",
  locationDepartment: "Côtes-d'Armor",
  locationRegion: "Bretagne",
  locationCountry: "France",
  distanceKm: 5,
  elevationGainM: 47,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: "https://www.trail-glazig.com/trail-5k",
  eventWebsiteUrl: "https://www.trail-glazig.com/",
  updatedAt: "2026-09-09T12:00:00.000Z",
  elevationLossM: null,
  minAltitudeM: null,
  maxAltitudeM: null,
  participationMode: "solo" as const,
  startLatitude: 48.63,
  startLongitude: -2.87,
  eventEndDate: "2027-02-07",
  officialWebsiteUrl: "https://www.trail-glazig.com/",
  instagramUrl: null,
  facebookUrl: null,
  routePreview: null,
  racebookAvailable: false,
  aidStations: [],
  aidStationDetails: null,
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
  it("builds Bibracte-style physical event facts without extending a format to the whole event weekend", () => {
    const data = buildRaceStructuredData(race, "https://pace-yourself.com/courses/trail-glazig-5-km-2027");

    expect(data).not.toBeNull();
    expect(data.location).toEqual({
      "@type": "Place",
      name: race.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Plourhan",
        addressRegion: "Bretagne",
        addressCountry: "France",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 48.63,
        longitude: -2.87,
      },
    });
    expect(data).not.toHaveProperty("endDate");
    expect(data?.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(data?.organizer).toEqual({
      "@type": "Organization",
      name: race.eventName,
      url: race.officialWebsiteUrl,
    });
    expect(data?.offers).toEqual({ "@type": "Offer", url: race.eventWebsiteUrl });
    expect(data?.superEvent).toEqual({
      "@id": "https://pace-yourself.com/courses/evenements/trail-glazig-2027#event",
    });
    expect(data.sameAs).toEqual([race.externalSiteUrl, race.officialWebsiteUrl]);
  });

  it("publishes a factual end date only for a single-day race edition", () => {
    const data = buildRaceStructuredData(
      {
        ...race,
        eventEndDate: race.date,
        practical: {
          ...race.practical,
          access: { ...race.practical.access, startAddress: "Place de l'Église" },
        },
      },
      "https://pace-yourself.com/courses/course-un-jour",
    );

    expect(data?.endDate).toBe(race.date);
    expect(data?.location?.address).toEqual(expect.objectContaining({ streetAddress: "Place de l'Église" }));
  });

  it("uses the edition end date for a SaintéLyon-style overnight format", () => {
    const data = buildRaceStructuredData(
      {
        ...race,
        name: "ASICS SaintéLyon 80 km",
        eventName: "ASICS SaintéLyon",
        date: "2026-11-28",
        eventEndDate: "2026-11-29",
        practical: {
          ...race.practical,
          schedule: { ...race.practical.schedule, startTime: "23:30", finishCutoffTime: "16:00" },
        },
      },
      "https://pace-yourself.com/courses/asics-saintelyon-80-km-2026",
    );

    expect(data?.endDate).toBe("2026-11-29");
  });

  it("omits unknown optional and empty fields instead of inventing them", () => {
    const data = buildRaceStructuredData({
      ...race,
      eventName: null,
      eventEditionSlug: null,
      eventWebsiteUrl: null,
      officialWebsiteUrl: null,
      externalSiteUrl: null,
      location: null,
      locationCity: null,
      locationDepartment: null,
      locationRegion: null,
      locationCountry: null,
      startLatitude: null,
      startLongitude: null,
      practical: {
        ...race.practical,
        access: { ...race.practical.access, startAddress: null, startLocation: { label: null, googleMapsUrl: null } },
      },
    }, "https://pace-yourself.com/courses/faits-minimaux");
    const serialized = JSON.stringify(data);

    expect(data).not.toHaveProperty("location");
    expect(data).not.toHaveProperty("offers");
    expect(data?.organizer).toEqual({ "@type": "Organization", name: race.name });
    expect(serialized).not.toMatch(/""|null|price|priceCurrency|availability|postalCode|superEvent/);
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

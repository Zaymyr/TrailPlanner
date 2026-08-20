import { describe, expect, it } from "vitest";

import type { PublicRace } from "../../lib/public-races";
import {
  distanceLandingPages,
  getIndexableDistancePages,
  getOtherEventFormats,
  getSimilarRaces,
  MIN_INDEXABLE_RACES,
} from "../../lib/race-discovery";

const makeRace = (overrides: Partial<PublicRace> & Pick<PublicRace, "id" | "slug" | "name">): PublicRace => {
  const { id, slug, name, ...optionalOverrides } = overrides;
  return {
    eventId: null,
    eventName: null,
    date: null,
    location: null,
    distanceKm: null,
    elevationGainM: null,
    thumbnailUrl: null,
    externalSiteUrl: null,
    ...optionalOverrides,
    id,
    slug,
    name,
  };
};

describe("race discovery", () => {
  it("publishes only distance pages with enough structured races", () => {
    const races = Array.from({ length: MIN_INDEXABLE_RACES }, (_, index) =>
      makeRace({ id: `short-${index}`, slug: `short-${index}`, name: `Short ${index}`, distanceKm: 20 }),
    );
    races.push(
      makeRace({ id: "ultra-1", slug: "ultra-1", name: "Ultra 1", distanceKm: 100 }),
      makeRace({ id: "unknown", slug: "unknown", name: "Unknown" }),
    );

    expect(getIndexableDistancePages(races).map(({ page }) => page.slug)).toEqual(["trail-court"]);
  });

  it("keeps the distance ranges mutually exclusive", () => {
    const distances = [29.9, 30, 79.9, 80];
    const matchingPages = distances.map(
      (distance) => distanceLandingPages.filter((page) => page.matches(distance)).map((page) => page.slug),
    );

    expect(matchingPages).toEqual([
      ["trail-court"],
      ["trail-30-79-km"],
      ["trail-30-79-km"],
      ["ultra-trail"],
    ]);
  });

  it("finds other formats only inside the same event", () => {
    const source = makeRace({ id: "source", slug: "source", name: "Source", eventId: "event-a", distanceKm: 50 });
    const short = makeRace({ id: "short", slug: "short", name: "Short", eventId: "event-a", distanceKm: 20 });
    const long = makeRace({ id: "long", slug: "long", name: "Long", eventId: "event-a", distanceKm: 100 });
    const unrelated = makeRace({ id: "other", slug: "other", name: "Other", eventId: "event-b", distanceKm: 40 });

    expect(getOtherEventFormats(source, [source, long, unrelated, short]).map((race) => race.id)).toEqual([
      "short",
      "long",
    ]);
  });

  it("orders similar races by distance then elevation and excludes sibling formats", () => {
    const source = makeRace({
      id: "source",
      slug: "source",
      name: "Source",
      eventId: "event-a",
      distanceKm: 50,
      elevationGainM: 2000,
    });
    const sibling = makeRace({ id: "sibling", slug: "sibling", name: "Sibling", eventId: "event-a", distanceKm: 50 });
    const closest = makeRace({
      id: "closest",
      slug: "closest",
      name: "Closest",
      eventId: "event-b",
      distanceKm: 51,
      elevationGainM: 2100,
    });
    const second = makeRace({
      id: "second",
      slug: "second",
      name: "Second",
      eventId: "event-c",
      distanceKm: 51,
      elevationGainM: 3000,
    });

    expect(getSimilarRaces(source, [source, sibling, second, closest]).map((race) => race.id)).toEqual([
      "closest",
      "second",
    ]);
  });

  it("can suggest races when legacy rows have no event id", () => {
    const source = makeRace({ id: "source", slug: "source", name: "Source", distanceKm: 50 });
    const candidate = makeRace({ id: "candidate", slug: "candidate", name: "Candidate", distanceKm: 52 });

    expect(getSimilarRaces(source, [source, candidate]).map((race) => race.id)).toEqual(["candidate"]);
  });
});

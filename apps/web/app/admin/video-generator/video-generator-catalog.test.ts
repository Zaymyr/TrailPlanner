import { describe, expect, it } from "vitest";

import { getEventChoices, getRacesForEvent, STANDALONE_EVENT_ID } from "./video-generator-catalog";

const catalog = {
  events: [
    { id: "11111111-1111-4111-8111-111111111111", name: "SaintéLyon" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Événement sans format" },
  ],
  races: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      event_id: "11111111-1111-4111-8111-111111111111",
      name: "82 km",
      distance_km: 82,
      elevation_gain_m: 2300,
      elevation_loss_m: null,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      event_id: null,
      name: "Format autonome",
      distance_km: 20,
      elevation_gain_m: null,
      elevation_loss_m: null,
    },
  ],
};

describe("video generator catalog", () => {
  it("keeps events without formats and adds one standalone group", () => {
    expect(getEventChoices(catalog).map((choice) => choice.name)).toEqual([
      "SaintéLyon",
      "Événement sans format",
      "Formats sans événement",
    ]);
  });

  it("filters formats by stable event id", () => {
    expect(getRacesForEvent(catalog, catalog.events[0].id).map((race) => race.name)).toEqual(["82 km"]);
    expect(getRacesForEvent(catalog, STANDALONE_EVENT_ID).map((race) => race.name)).toEqual(["Format autonome"]);
  });
});

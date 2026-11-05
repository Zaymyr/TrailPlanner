import { describe, expect, it } from "vitest";

import {
  countEventVideos,
  filterEventChoices,
  formatRaceChoiceLabel,
  formatVideoCount,
  getEventChoices,
  getRacesForEvent,
  STANDALONE_EVENT_ID,
} from "./video-generator-catalog";

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

describe("video generator pickers", () => {
  const stats = {
    "33333333-3333-4333-8333-333333333333": { videos: 2, narration: true, voice: true },
  };

  it("filters events while typing, ignoring accents, case and word order", () => {
    const choices = getEventChoices(catalog);
    expect(filterEventChoices(choices, "sainte").map((choice) => choice.name)).toEqual(["SaintéLyon"]);
    expect(filterEventChoices(choices, "FORMAT evenement").map((choice) => choice.name)).toEqual(["Événement sans format", "Formats sans événement"]);
    expect(filterEventChoices(choices, "  ")).toHaveLength(choices.length);
  });

  it("counts the videos of an event and labels each format with its GPX, videos and saved narration", () => {
    expect(countEventVideos(catalog, "11111111-1111-4111-8111-111111111111", stats)).toBe(2);
    expect(formatVideoCount(0)).toBe("aucune vidéo");
    expect(formatVideoCount(1)).toBe("1 vidéo");
    expect(formatRaceChoiceLabel({ ...catalog.races[0], gpx_storage_path: "race/82.gpx" }, stats)).toBe("82 km · GPX · 2 vidéos · récit + voix enregistrés");
    expect(formatRaceChoiceLabel(catalog.races[1], stats)).toBe("Format autonome · sans GPX");
  });
});

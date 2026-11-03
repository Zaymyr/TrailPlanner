import { describe, expect, it } from "vitest";

import { hashRacebookSnapshot, racebookPublishedSnapshotV1Schema, toRacebookPublicationAssets } from "./racebook-publications";

const base = {
  schemaVersion: 1 as const,
  raceRow: {
    id: "11111111-1111-4111-8111-111111111111",
    event_id: "22222222-2222-4222-8222-222222222222",
    edition_id: "33333333-3333-4333-8333-333333333333",
    name: "Ultra test",
    distance_km: 80,
    race_events: { id: "22222222-2222-4222-8222-222222222222" },
  },
  stationRows: [], relayPointRows: [], startWaveRows: [], awardRows: [], editionServiceRows: [], supporterPointRows: [], sponsors: [],
  branding: { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
  modules: { aid_stations: true },
  assets: { gpxStoragePath: "events/test.gpx", imageUrls: [] },
};

describe("RaceBook publication snapshots", () => {
  it("validates V1 and hashes objects canonically", () => {
    const first = racebookPublishedSnapshotV1Schema.parse(base);
    const reordered = racebookPublishedSnapshotV1Schema.parse({ ...base, raceRow: {
      race_events: base.raceRow.race_events,
      distance_km: 80,
      name: "Ultra test",
      edition_id: base.raceRow.edition_id,
      event_id: base.raceRow.event_id,
      id: base.raceRow.id,
    } });
    expect(hashRacebookSnapshot(first)).toBe(hashRacebookSnapshot(reordered));
  });

  it("rejects a public snapshot with an invalid branding color", () => {
    expect(racebookPublishedSnapshotV1Schema.safeParse({
      ...base,
      branding: { ...base.branding, primaryColor: "red" },
    }).success).toBe(false);
  });

  it("retains the Storage identity of internal images for asynchronous cleanup", () => {
    const snapshot = racebookPublishedSnapshotV1Schema.parse({
      ...base,
      assets: {
        ...base.assets,
        imageUrls: [
          "https://db.example.com/storage/v1/object/public/race-images/events%2Flogo.png",
          "https://cdn.example.com/external.png",
        ],
      },
    });
    expect(toRacebookPublicationAssets({ supabaseUrl: "https://db.example.com" }, snapshot)).toEqual([
      { asset_type: "gpx", storage_bucket: "race-gpx", storage_path: "events/test.gpx" },
      { asset_type: "image", storage_bucket: "race-images", storage_path: "events/logo.png", public_url: "https://db.example.com/storage/v1/object/public/race-images/events%2Flogo.png" },
      { asset_type: "image", public_url: "https://cdn.example.com/external.png" },
    ]);
  });
});

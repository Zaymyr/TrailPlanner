import { describe, expect, it } from "vitest";

import { DEFAULT_VIDEO_COMPOSITION_SETTINGS } from "../app/admin/video-generator/video-composition";
import {
  applyFlyoverSettings,
  checkFlyoverGpx,
  createFlyoverOrderToken,
  getFlyoverMode,
  normalizeInstagramHandle,
  prepareAidStations,
  readFlyoverOrderFormData,
  validatePublishLocal,
  verifyFlyoverOrderToken,
  withCollabMention,
} from "./flyover-orders";
import type { ParsedGpx } from "./gpx/parseGpx";

const SECRET = "x".repeat(40);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const base = { raceName: "Trail des Crêtes", email: "Orga@Example.fr", mapPreset: "signature", terrainExaggeration: "2" };

const gpx = (points: Array<number | null>, distanceKm = 12): ParsedGpx => ({
  points: points.map((ele, index) => ({ lat: 45 + index / 1000, lng: 6, ele, distKmCum: index })),
  waypoints: [],
  stats: { distanceKm, gainM: 800, lossM: 800 },
} as unknown as ParsedGpx);

describe("flyover order form", () => {
  it("requires the Instagram account and the slot for the collab offer", () => {
    const result = readFlyoverOrderFormData(form({ ...base, offer: "collab" }));
    expect(result.success).toBe(false);
    const ok = readFlyoverOrderFormData(form({ ...base, offer: "collab", instagramHandle: "@trail_cretes", publishLocal: "2026-12-10T18:00" }));
    expect(ok.success && ok.data.instagramHandle).toBe("trail_cretes");
  });

  it("accepts the download offer without Instagram and normalizes the email", () => {
    const result = readFlyoverOrderFormData(form({ ...base, offer: "download", aidStations: JSON.stringify([{ name: "Col", km: "12.5" }]) }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("orga@example.fr");
      expect(result.data.aidStations).toEqual([{ name: "Col", km: 12.5 }]);
      expect(result.data.instagramHandle).toBeNull();
    }
  });

  it("rejects an invalid relief, preset or Instagram account", () => {
    expect(readFlyoverOrderFormData(form({ ...base, offer: "download", terrainExaggeration: "5" })).success).toBe(false);
    expect(readFlyoverOrderFormData(form({ ...base, offer: "download", mapPreset: "custom" })).success).toBe(false);
    expect(readFlyoverOrderFormData(form({ ...base, offer: "download", instagramHandle: "pas valide !" })).success).toBe(false);
  });

  it("reads Instagram profile links", () => {
    expect(normalizeInstagramHandle("https://www.instagram.com/trail.cretes/")).toBe("trail.cretes");
    expect(normalizeInstagramHandle("  ")).toBeNull();
  });
});

describe("collab slot", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  it("needs 48 h of production and stays within 21 days", () => {
    expect(validatePublishLocal("2026-11-23T18:00", now).ok).toBe(false);
    expect(validatePublishLocal("2026-11-25T18:00", now).ok).toBe(true);
    expect(validatePublishLocal("2026-12-20T18:00", now).ok).toBe(false);
    expect(validatePublishLocal("demain", now).ok).toBe(false);
  });
});

describe("GPX check", () => {
  it("needs altitudes on most points", () => {
    expect(checkFlyoverGpx(gpx([null, null, 300])).ok).toBe(false);
    expect(checkFlyoverGpx(gpx([100, 200, 300]))).toEqual({ ok: true, distanceKm: 12, gainM: 800, lossM: 800 });
  });
  it("rejects a single point or an oversized course", () => {
    expect(checkFlyoverGpx(gpx([100])).ok).toBe(false);
    expect(checkFlyoverGpx(gpx([100, 200], 500)).ok).toBe(false);
  });
});

describe("composition", () => {
  it("maps the preset and clamps the relief", () => {
    const settings = applyFlyoverSettings(DEFAULT_VIDEO_COMPOSITION_SETTINGS, { map_preset: "cinema", terrain_exaggeration: 9 });
    expect(settings.mapStyle).toBe("classic");
    expect(settings.mapAmbiance).toBe("cinematic");
    expect(settings.terrainExaggeration).toBe(3);
  });

  it("tells long courses as highlights, like the automatic reels", () => {
    expect(getFlyoverMode(42)).toBe("full");
    expect(getFlyoverMode(110)).toBe("highlights");
  });

  it("sorts stations along the course with stable ids and drops those beyond the finish", () => {
    const stations = prepareAidStations([{ name: "B", km: 20 }, { name: "A", km: 5 }, { name: "Loin", km: 80 }], 30);
    expect(stations.map((station) => station.name)).toEqual(["A", "B"]);
    expect(stations[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("adds the organizer account to the caption once", () => {
    expect(withCollabMention("Beau parcours", "trail_cretes")).toBe("Beau parcours\n\nEn collaboration avec @trail_cretes");
    expect(withCollabMention("Avec @Trail_Cretes", "trail_cretes")).toBe("Avec @Trail_Cretes");
  });
});

describe("order link", () => {
  it("is bound to one order", () => {
    const token = createFlyoverOrderToken("a", SECRET);
    expect(verifyFlyoverOrderToken("a", token, SECRET)).toBe(true);
    expect(verifyFlyoverOrderToken("b", token, SECRET)).toBe(false);
    expect(verifyFlyoverOrderToken("a", null, SECRET)).toBe(false);
    expect(verifyFlyoverOrderToken("a", token, null)).toBe(false);
  });
});

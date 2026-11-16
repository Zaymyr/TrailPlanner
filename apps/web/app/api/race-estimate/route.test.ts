import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getPublicRaces, getPublicRaceDetail } = vi.hoisted(() => ({
  getPublicRaces: vi.fn(),
  getPublicRaceDetail: vi.fn(),
}));

vi.mock("../../../lib/public-races", () => ({ getPublicRaces }));
vi.mock("../../../lib/public-race-detail", () => ({ getPublicRaceDetail }));

import { POST } from "./route";

const raceId = "11111111-1111-4111-8111-111111111111";
const race = { id: raceId, name: "Trail test", slug: "trail-test", distanceKm: 20, elevationGainM: 1000 };
const detail = {
  ...race,
  elevationLossM: 1000,
  routePreview: {
    points: [
      { distanceKm: 0, elevationM: 200, lat: 45, lon: 6 },
      { distanceKm: 10, elevationM: 1200, lat: 45.1, lon: 6.1 },
      { distanceKm: 20, elevationM: 200, lat: 45.2, lon: 6.2 },
    ],
    stats: { distanceKm: 20, gainM: 1000, lossM: 1000, minAltM: 200, maxAltM: 1200 },
  },
  aidStations: [{ id: "a", name: "Sommet", distanceKm: 10, waterAvailable: true, solidAvailable: true }],
};

let ipCounter = 0;
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/race-estimate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${(ipCounter += 1)}` },
    body: JSON.stringify(body),
  }));

describe("POST /api/race-estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicRaces.mockResolvedValue([race]);
    getPublicRaceDetail.mockResolvedValue(detail);
  });

  it("returns pace and UTMB estimates without exposing route points", async () => {
    const response = await post({ catalogRaceId: raceId, flatPaceMinPerKm: 6, utmbIndex: 500 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fromPace.totalSeconds).toBeGreaterThan(0);
    expect(body.fromPace.checkpoints.map((checkpoint: { name: string }) => checkpoint.name)).toEqual(["Sommet", "Arrivée"]);
    expect(body.fromUtmb.utmbIndex).toBe(500);
    expect(JSON.stringify(body)).not.toContain('"lat"');
    expect(JSON.stringify(body)).not.toContain("elevationM");
  });

  it("requires a pace or an index", async () => {
    const response = await post({ catalogRaceId: raceId });
    expect(response.status).toBe(400);
  });

  it("refuses races that are not web-public", async () => {
    getPublicRaces.mockResolvedValue([]);
    const response = await post({ catalogRaceId: raceId, flatPaceMinPerKm: 6 });
    expect(response.status).toBe(404);
    expect(getPublicRaceDetail).not.toHaveBeenCalled();
  });
});

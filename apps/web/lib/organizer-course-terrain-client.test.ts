import { describe, expect, it, vi } from "vitest";
import {
  OrganizerCourseTerrainError,
  fetchOrganizerCourseTerrain,
  saveOrganizerCourseTerrainOverrides,
} from "./organizer-course-terrain-client";

const payload = {
  terrain: { status: "pending", raceId: "race-1" },
  osmSegments: [],
  overrides: [{ fromKm: 1, toKm: 2, class: "trail" }],
  overridesNeedReview: false,
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("organizer course terrain client", () => {
  it("GETs the race terrain with the auth header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const result = await fetchOrganizerCourseTerrain("race-1", { Authorization: "Bearer t" }, { fetchImpl });
    expect(result.overrides).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/organizer/races/race-1/terrain");
    expect(init.headers).toEqual({ Authorization: "Bearer t" });
  });

  it("PUTs the overrides as JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    await saveOrganizerCourseTerrainOverrides("race-1", { overrides: payload.overrides as never }, { Authorization: "Bearer t" }, { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ overrides: payload.overrides });
  });

  it("throws a typed error on failure or malformed payloads", async () => {
    const failing = vi.fn().mockResolvedValue(jsonResponse({ message: "Forbidden" }, 403));
    await expect(fetchOrganizerCourseTerrain("race-1", {}, { fetchImpl: failing })).rejects.toMatchObject({ status: 403, message: "Forbidden" });
    const malformed = vi.fn().mockResolvedValue(jsonResponse({ nope: true }));
    await expect(fetchOrganizerCourseTerrain("race-1", {}, { fetchImpl: malformed })).rejects.toBeInstanceOf(OrganizerCourseTerrainError);
  });
});

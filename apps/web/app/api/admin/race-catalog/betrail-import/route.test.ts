import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../../../../lib/supabase", () => ({
  extractBearerToken: vi.fn(() => "admin-token"),
  fetchSupabaseUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" })),
  getSupabaseAnonConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
  getSupabaseServiceConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-key",
  })),
  isAdminUser: vi.fn(() => true),
}));

import { parseDistanceKm, parseElevationM, POST } from "./route";

const requestFor = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/race-catalog/betrail-import", {
    method: "POST",
    headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("parseDistanceKm / parseElevationM", () => {
  it("parses BeTrail distance and elevation labels", () => {
    expect(parseDistanceKm("19km")).toBe(19);
    expect(parseDistanceKm("147km")).toBe(147);
    expect(parseElevationM("700 D+")).toBe(700);
    expect(parseElevationM("6000 D+")).toBe(6000);
  });

  it("returns null for unrecognized text", () => {
    expect(parseDistanceKm("?")).toBeNull();
    expect(parseElevationM("?")).toBeNull();
  });
});

describe("BeTrail catalog draft import route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a non-betrail.run raceUrl", async () => {
    const response = await POST(
      requestFor({
        raceUrl: "https://example.com/race/1",
        raceName: "Trail exemple",
        formats: [{ distance: "19km", elevation: "700 D+" }],
        action: "import",
      })
    );

    expect(response.status).toBe(400);
  });

  it("previews without writing to Supabase", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } })
    );

    const response = await POST(
      requestFor({
        raceUrl: "https://www.betrail.run/race/example/2026",
        raceName: "Trail Exemple",
        date: "2026-03-14",
        officialWebsite: "https://trail-exemple.fr",
        formats: [{ distance: "19km", elevation: "700 D+" }],
        action: "preview",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.preview.formats[0]).toMatchObject({ distanceKm: 19, elevationGainM: 700 });
    expect(fetchSpy.mock.calls.every(([, init]) => !init || init.method !== "POST")).toBe(true);
  });

  it("creates a draft event and a draft race per format, always forced to data_status=draft and is_live=false", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/rest/v1/race_events") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/race_events") && method === "POST") {
        const created = { id: "22222222-2222-2222-2222-222222222222", name: "Trail Exemple", race_date: "2026-03-14", website_url: "https://trail-exemple.fr" };
        return new Response(JSON.stringify([created]), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/races") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/rest/v1/races") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify([body]), { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    const response = await POST(
      requestFor({
        raceUrl: "https://www.betrail.run/race/example/2026",
        raceName: "Trail Exemple",
        date: "2026-03-14",
        officialWebsite: "https://trail-exemple.fr",
        formats: [
          { distance: "19km", elevation: "700 D+" },
          { distance: "10km", elevation: "?" },
        ],
        action: "import",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.createdRaces).toHaveLength(2);
    for (const race of json.createdRaces) {
      expect(race.data_status).toBe("draft");
      expect(race.is_live).toBe(false);
    }
    expect(json.createdRaces[1].missing_required_fields).toContain("elevation_gain_m");
    expect(fetchSpy).toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { POST } from "./route";

const organizerMocks = vi.hoisted(() => ({
  requireEventOrganizer: vi.fn(),
}));

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/organizer/races", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("/api/organizer/races POST", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.requireEventOrganizer.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects race creation when raceDate is missing", async () => {
    const response = await POST(
      createRequest({
        eventId: "22222222-2222-2222-2222-222222222222",
        name: "Trail 42",
        distanceKm: 42,
        elevationGainM: 1800,
        elevationLossM: 1700,
        raceDate: "",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ message: "Invalid race fields." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates a race format when required fields are present", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Trail 42",
            slug: "trail-42",
            event_id: "22222222-2222-2222-2222-222222222222",
            distance_km: 42,
            elevation_gain_m: 1800,
            elevation_loss_m: 1700,
            location_text: "Chamonix",
            race_date: "2026-09-12",
            thumbnail_url: null,
            gpx_storage_path: null,
            is_live: false,
            organizer_details: null,
          },
        ]),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const response = await POST(
      createRequest({
        eventId: "22222222-2222-2222-2222-222222222222",
        name: "Trail 42",
        distanceKm: 42,
        elevationGainM: 1800,
        elevationLossM: 1700,
        locationText: "Chamonix",
        raceDate: "2026-09-12",
        thumbnailUrl: "",
        isLive: false,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.race?.race_date).toBe("2026-09-12");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

vi.mock("../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../lib/organizer-dashboard-details", () => ({
  organizerRaceDetailsSchema: z.object({}).passthrough().optional(),
  parseOrganizerRaceDetails: (value: unknown) => value ?? null,
}));

vi.mock("../../../../lib/organizer", () => ({
  buildSlug: (value: string) => value.toLowerCase().replace(/\s+/g, "-"),
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  optionalTextOrNull: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
  requireEventOrganizer: organizerMocks.requireEventOrganizer,
  requireOrganizerAuth: () =>
    Promise.resolve({
      user: { id: "00000000-0000-0000-0000-000000000001" },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    }),
  serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
    apikey: "service-key",
    Authorization: "Bearer service-key",
    ...(contentType ? { "Content-Type": contentType } : {}),
  }),
}));

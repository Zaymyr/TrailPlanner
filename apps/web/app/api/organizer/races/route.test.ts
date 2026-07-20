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
            edition_group_id: "11111111-1111-1111-1111-111111111111",
            series_name: "Trail 42",
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
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "11111111-1111-1111-1111-111111111111",
            edition_group_id: "11111111-1111-1111-1111-111111111111",
            series_name: "Trail 42",
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
          status: 200,
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
    expect(payload.race?.series_name).toBe("Trail 42");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("creates a draft edition in the same group when cloneFromRaceId is provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "33333333-3333-3333-3333-333333333333", event_id: "22222222-2222-2222-2222-222222222222" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "33333333-3333-3333-3333-333333333333",
              event_id: "22222222-2222-2222-2222-222222222222",
              edition_group_id: "44444444-4444-4444-4444-444444444444",
              series_name: "Trail 42",
              name: "Trail 42",
              slug: "trail-42",
              distance_km: 42,
              elevation_gain_m: 1800,
              elevation_loss_m: 1700,
              location_text: "Chamonix",
              race_date: "2026-09-12",
              thumbnail_url: null,
              gpx_path: null,
              gpx_hash: null,
              gpx_storage_path: null,
              gpx_sha256: null,
              min_alt_m: null,
              max_alt_m: null,
              start_lat: null,
              start_lng: null,
              bounds_min_lat: null,
              bounds_min_lng: null,
              bounds_max_lat: null,
              bounds_max_lng: null,
              organizer_details: null,
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "55555555-5555-5555-5555-555555555555",
              edition_group_id: "44444444-4444-4444-4444-444444444444",
              series_name: "Trail 42",
              name: "Trail 42",
              slug: "trail-42-2027",
              event_id: "22222222-2222-2222-2222-222222222222",
              distance_km: 42,
              elevation_gain_m: 1800,
              elevation_loss_m: 1700,
              location_text: "Chamonix",
              race_date: "2027-09-12",
              thumbnail_url: null,
              gpx_storage_path: null,
              is_live: false,
              organizer_details: null,
            },
          ]),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "55555555-5555-5555-5555-555555555555",
              edition_group_id: "44444444-4444-4444-4444-444444444444",
              series_name: "Trail 42",
              name: "Trail 42",
              slug: "trail-42-2027",
              event_id: "22222222-2222-2222-2222-222222222222",
              distance_km: 42,
              elevation_gain_m: 1800,
              elevation_loss_m: 1700,
              location_text: "Chamonix",
              race_date: "2027-09-12",
              thumbnail_url: null,
              gpx_storage_path: null,
              is_live: false,
              organizer_details: null,
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    const response = await POST(
      createRequest({
        eventId: "22222222-2222-2222-2222-222222222222",
        cloneFromRaceId: "33333333-3333-3333-3333-333333333333",
        seriesName: "Trail 42",
        name: "Trail 42",
        raceDate: "2027-09-12",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.race?.edition_group_id).toBe("44444444-4444-4444-4444-444444444444");
    expect(payload.race?.is_live).toBe(false);
    const createCall = mockFetch.mock.calls.find(([url, init]) => String(url).includes("/rest/v1/races") && init?.method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      edition_group_id: "44444444-4444-4444-4444-444444444444",
      series_name: "Trail 42",
      race_date: "2027-09-12",
      is_live: false,
    });
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

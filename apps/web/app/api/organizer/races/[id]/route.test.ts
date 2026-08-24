import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DELETE, PATCH } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const eventId = "22222222-2222-2222-2222-222222222222";

const organizerMocks = vi.hoisted(() => ({
  loadRaceForOrganizer: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const deleteRequest = () =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}`, {
    method: "DELETE",
    headers: { authorization: "Bearer user-token" },
  });

const patchRequest = (body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("/api/organizer/races/[id] PATCH", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.loadRaceForOrganizer.mockResolvedValue({ id: raceId, event_id: eventId, race_date: "2027-09-12" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists series_name updates", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: raceId,
          edition_group_id: "33333333-3333-3333-3333-333333333333",
          series_name: "Trail 42",
          name: "Trail 42 2027",
          slug: "trail-42-2027",
          event_id: eventId,
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
      ])
    );

    const response = await PATCH(
      patchRequest({
        seriesName: "Trail 42",
        name: "Trail 42 2027",
        externalSiteUrl: "https://grand-trail.example/42k",
      }),
      { params: { id: raceId } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.race.series_name).toBe("Trail 42");
    expect(JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      series_name: "Trail 42",
      name: "Trail 42 2027",
      external_site_url: "https://grand-trail.example/42k",
    });
  });

  it("rejects Racebook publication before admin approval", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      race_date: "2027-09-12",
      racebook_publication_approved_at: null,
    });

    const response = await PATCH(patchRequest({ racebookIsLive: true }), { params: { id: raceId } });

    expect(response.status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps an incomplete imported format hidden until its required fields are completed", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      race_date: "2027-09-12",
      data_status: "draft",
      missing_required_fields: ["distance_km", "elevation_gain_m"],
    });
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse([{
      id: raceId,
      edition_group_id: "33333333-3333-3333-3333-333333333333",
      series_name: "Trail 42",
      name: "Trail 42 2027",
      event_id: eventId,
      race_date: "2027-09-12",
      distance_km: 42,
      elevation_gain_m: 1800,
      is_live: true,
      data_status: "complete",
      missing_required_fields: [],
    }]));

    const response = await PATCH(
      patchRequest({ distanceKm: 42, elevationGainM: 1800 }),
      { params: { id: raceId } }
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      distance_km: 42,
      elevation_gain_m: 1800,
      data_status: "complete",
      missing_required_fields: [],
      is_live: true,
      racebook_is_live: false,
    });
  });

  it("rejects Racebook publication while the imported format is still a draft", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      race_date: "2027-09-12",
      data_status: "draft",
      missing_required_fields: ["distance_km"],
      racebook_publication_approved_at: "2026-08-20T12:00:00.000Z",
    });

    const response = await PATCH(patchRequest({ racebookIsLive: true }), { params: { id: raceId } });

    expect(response.status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets an approved organizer publish the Racebook", async () => {
    organizerMocks.loadRaceForOrganizer.mockResolvedValueOnce({
      id: raceId,
      event_id: eventId,
      race_date: "2027-09-12",
      racebook_publication_approved_at: "2026-08-20T12:00:00.000Z",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: raceId,
          edition_group_id: "33333333-3333-3333-3333-333333333333",
          series_name: "Trail 42",
          name: "Trail 42 2027",
          event_id: eventId,
          distance_km: 42,
          elevation_gain_m: 1800,
          is_live: true,
          racebook_is_live: true,
          racebook_publication_approved_at: "2026-08-20T12:00:00.000Z",
        },
      ])
    );

    const response = await PATCH(patchRequest({ racebookIsLive: true }), { params: { id: raceId } });

    expect(response.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({ racebook_is_live: true });
  });
});

describe("/api/organizer/races/[id] DELETE", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.loadRaceForOrganizer.mockResolvedValue({ id: raceId, event_id: eventId, race_date: "2027-09-12" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes the race and cleans up GPX and race image files", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: raceId,
            gpx_storage_path: "organizer/event/race.gpx",
            thumbnail_url: "https://supabase.example/storage/v1/object/public/race-images/organizer-races/event/race/thumb.png",
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await DELETE(deleteRequest(), { params: { id: raceId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ deleted: true, raceId, eventId });

    expect(mockFetch.mock.calls[1]?.[1]?.method).toBe("DELETE");
    expect(
      mockFetch.mock.calls.some(
        ([url, init]) => String(url).includes("/storage/v1/object/race-gpx/organizer/event/race.gpx") && init?.method === "DELETE"
      )
    ).toBe(true);
    expect(
      mockFetch.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/storage/v1/object/race-images/organizer-races/event/race/thumb.png") && init?.method === "DELETE"
      )
    ).toBe(true);
  });
});

vi.mock("../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: organizerMocks.loadRaceForOrganizer,
  optionalTextOrNull: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
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
  uuidParamSchema: {
    safeParse: (params: { id?: string }) =>
      typeof params.id === "string" ? { success: true, data: { id: params.id } } : { success: false },
  },
}));

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const organizerRequest = (body?: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/events/${eventId}`, {
    method: body ? "PATCH" : "GET",
    headers: {
      authorization: "Bearer user-token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/organizer/events/[id]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns organizerDetails for event and race JSONB", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          thumbnail_url: null,
          is_live: false,
          organizer_details: {
            officialWebsiteUrl: "https://grand-trail.example",
            mandatoryEquipment: {
              weatherPlan: "cold",
              items: [{ id: "item-1", label: "Couverture de survie", required: true, cold: true, heat: false, note: null }],
              note: null,
            },
          },
          races: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              edition_group_id: "33333333-3333-3333-3333-333333333333",
              series_name: "42K",
              name: "42K",
              slug: "42k",
              external_site_url: "https://grand-trail.example/42k",
              location_text: null,
              race_date: "2026-09-12",
              distance_km: 42,
              elevation_gain_m: 2400,
              elevation_loss_m: 2100,
              gpx_storage_path: "race.gpx",
              thumbnail_url: null,
              is_live: true,
              organizer_details: { schedule: { startTime: "07:00" } },
            },
          ],
        },
      ])
    );

    const response = await GET(organizerRequest(), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.event.organizerDetails.mandatoryEquipment.weatherPlan).toBe("cold");
    expect(payload.event.organizerDetails.mandatoryEquipment.items[0]).toMatchObject({
      label: "Couverture de survie",
      cold: true,
      heat: false,
    });
    expect(payload.event.organizerDetails.officialWebsiteUrl).toBe("https://grand-trail.example");
    expect(payload.event.races[0].edition_group_id).toBe("33333333-3333-3333-3333-333333333333");
    expect(payload.event.races[0].external_site_url).toBe("https://grand-trail.example/42k");
    expect(payload.event.races[0].series_name).toBe("42K");
    expect(payload.event.races[0].organizerDetails.schedule.startTime).toBe("07:00");
  });

  it("persists organizerDetails on patch", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          thumbnail_url: null,
          is_live: false,
          organizer_details: {
            mandatoryEquipment: {
              weatherPlan: "heat",
              items: [{ id: "item-1", label: "Casquette", required: false, cold: false, heat: true, note: null }],
            },
          },
        },
      ])
    );

    const response = await PATCH(
      organizerRequest({
        organizerDetails: {
          officialWebsiteUrl: "https://grand-trail.example",
          mandatoryEquipment: {
            weatherPlan: "heat",
            items: [{ id: "item-1", label: "Casquette", required: false, cold: false, heat: true, note: null }],
            note: null,
          },
        },
      }),
      { params: { id: eventId } }
    );

    expect(response.status).toBe(200);
    const patchCall = mockFetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({
      organizer_details: {
        officialWebsiteUrl: "https://grand-trail.example",
        mandatoryEquipment: {
          weatherPlan: "heat",
          items: [{ label: "Casquette", required: false, cold: false, heat: true }],
        },
      },
    });
  });

  it("rejects direct publication changes", async () => {
    const mockFetch = vi.mocked(fetch);

    const response = await PATCH(organizerRequest({ isLive: true }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("No fields to update.");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../lib/organizer", async () => {
  const { z } = await import("zod");

  return {
    jsonError: (message: string, status: number) => Response.json({ message }, { status }),
    optionalTextOrNull: z.string().nullable().optional(),
    optionalUrlOrNull: z.string().nullable().optional(),
    requireEventOrganizer: () => Promise.resolve(true),
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
  };
});

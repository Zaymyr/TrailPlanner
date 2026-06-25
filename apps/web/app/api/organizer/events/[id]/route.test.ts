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
            mandatoryEquipment: {
              items: [{ id: "item-1", label: "Couverture de survie", required: true, note: null }],
              note: null,
            },
          },
          races: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              name: "42K",
              slug: "42k",
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
    expect(payload.event.organizerDetails.mandatoryEquipment.items[0].label).toBe("Couverture de survie");
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
            access: { startAddress: "1 rue du depart" },
          },
        },
      ])
    );

    const response = await PATCH(
      organizerRequest({
        organizerDetails: {
          access: {
            startAddress: "1 rue du depart",
          },
        },
      }),
      { params: { id: eventId } }
    );

    expect(response.status).toBe(200);
    const patchCall = mockFetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({
      organizer_details: {
        access: {
          startAddress: "1 rue du depart",
        },
      },
    });
  });

  it("blocks publishing without a publishable live format", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          organizer_details: { dateRange: { endDate: "2026-09-13" } },
          races: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              name: "42K",
              distance_km: 42,
              elevation_gain_m: 2400,
              is_live: false,
            },
          ],
        },
      ])
    );

    const response = await PATCH(organizerRequest({ isLive: true }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.message).toContain("live format");
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("blocks publishing without an event end date", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          organizer_details: null,
          races: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              name: "42K",
              distance_km: 42,
              elevation_gain_m: 2400,
              is_live: true,
            },
          ],
        },
      ])
    );

    const response = await PATCH(organizerRequest({ isLive: true }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.message).toContain("end date");
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
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

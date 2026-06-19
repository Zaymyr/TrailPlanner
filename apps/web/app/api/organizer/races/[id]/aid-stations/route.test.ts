import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const existingStationId = "22222222-2222-2222-2222-222222222222";
const newStationId = "33333333-3333-3333-3333-333333333333";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const putRequest = (body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}/aid-stations`, {
    method: "PUT",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("/api/organizer/races/[id]/aid-stations", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists water, solid, and assistance service flags", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: existingStationId,
            name: "Refuge",
            km: 12.5,
            water_available: true,
            solid_available: false,
            assistance_allowed: true,
            notes: "Water only",
            order_index: 0,
            organizer_details: {
              stationType: "solid",
              cutoffTime: "12:30",
              dropBagAvailable: true,
            },
          },
          {
            id: newStationId,
            name: "Col",
            km: 24,
            water_available: false,
            solid_available: true,
            assistance_allowed: false,
            notes: null,
            order_index: 1,
            organizer_details: {
              stationType: "assistance",
              altitudeM: 1800,
            },
          },
        ])
      );

    const response = await PUT(
      putRequest({
        aidStations: [
          {
            id: existingStationId,
            name: "Refuge",
            distanceKm: 12.49,
            waterRefill: true,
            solidRefill: false,
            assistanceAllowed: true,
            notes: "Water only",
            organizerDetails: {
              stationType: "solid",
              cumulativeElevationGainM: 900,
              cumulativeElevationLossM: null,
              altitudeM: null,
              cutoffTime: "12:30",
              dropBagAvailable: true,
              organizerNote: "Controle materiel",
            },
          },
          {
            name: "Col",
            distanceKm: 24,
            waterRefill: false,
            solidRefill: true,
            assistanceAllowed: false,
            notes: "",
            organizerDetails: {
              stationType: "assistance",
              cumulativeElevationGainM: null,
              cumulativeElevationLossM: null,
              altitudeM: 1800,
              cutoffTime: null,
              dropBagAvailable: false,
              organizerNote: null,
            },
          },
        ],
      }),
      { params: { id: raceId } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.aidStations[0].solid_available).toBe(false);
    expect(payload.aidStations[1].assistance_allowed).toBe(false);
    expect(payload.aidStations[0].organizerDetails.cutoffTime).toBe("12:30");

    const patchCall = mockFetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({
      water_available: true,
      solid_available: false,
      assistance_allowed: true,
      organizer_details: {
        stationType: "solid",
        cutoffTime: "12:30",
        dropBagAvailable: true,
      },
    });

    const insertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).endsWith("/rest/v1/race_aid_stations") && init?.method === "POST"
    );
    const insertBody = JSON.parse(insertCall?.[1]?.body as string);
    expect(insertBody[0]).toMatchObject({
      water_available: false,
      solid_available: true,
      assistance_allowed: false,
      organizer_details: {
        stationType: "assistance",
        altitudeM: 1800,
      },
    });
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: () => Promise.resolve({ id: raceId, event_id: "44444444-4444-4444-4444-444444444444" }),
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
      typeof params.id === "string"
        ? { success: true, data: { id: params.id } }
        : { success: false },
  },
}));

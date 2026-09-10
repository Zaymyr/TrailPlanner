import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const stationId = "22222222-2222-2222-2222-222222222222";
const relayPointId = "33333333-3333-3333-3333-333333333333";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

const putRequest = (relayPoints: unknown[]) =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}/relay-points`, {
    method: "PUT",
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: JSON.stringify({ relayPoints }),
  });

describe("/api/organizer/races/[id]/relay-points", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists standalone and aid-station-linked relay points in distance order", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ distance_km: 80, participation_mode: "relay" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: stationId }]))
      .mockResolvedValueOnce(jsonResponse([{ id: relayPointId }]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: relayPointId,
          race_aid_station_id: stationId,
          name: "Passage du col",
          km: 20,
          handover_time: "10:30",
          cutoff_time: "11:00",
          notes: "Zone étroite",
          order_index: 0,
        },
      ]));

    const response = await PUT(
      putRequest([
        {
          name: "Village",
          distanceKm: 45,
          handoverTime: "13:00",
          cutoffTime: "13:30",
          notes: "Navette disponible",
        },
        {
          id: relayPointId,
          raceAidStationId: stationId,
          name: "Passage du col",
          distanceKm: 20,
          handoverTime: "10:30",
          cutoffTime: "11:00",
          notes: "Zone étroite",
        },
      ]),
      { params: { id: raceId } },
    );

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(String(mockFetch.mock.calls[3]?.[0])).toContain("/rest/v1/rpc/replace_race_relay_points");
    expect(JSON.parse(String(mockFetch.mock.calls[3]?.[1]?.body))).toMatchObject({
      p_race_id: raceId,
      p_items: [
        {
          id: relayPointId,
          race_aid_station_id: stationId,
          name: "Passage du col",
          km: 20,
          order_index: 0,
        },
        {
          id: null,
          race_aid_station_id: null,
          name: "Village",
          km: 45,
          order_index: 1,
        },
      ],
    });
  });

  it("returns an error without issuing partial follow-up writes when replacement fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([{ distance_km: 80, participation_mode: "relay" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: stationId }]))
      .mockResolvedValueOnce(jsonResponse({ message: "constraint failed" }, 409));

    const response = await PUT(
      putRequest([{ name: "Village", distanceKm: 45 }]),
      { params: { id: raceId } },
    );

    expect(response.status).toBe(502);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain("/rest/v1/rpc/replace_race_relay_points");
  });

  it("rejects a relay point linked to another race's aid station", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([{ distance_km: 80, participation_mode: "relay" }]))
      .mockResolvedValueOnce(jsonResponse([]));

    const response = await PUT(
      putRequest([{
        raceAidStationId: stationId,
        name: "Mauvais ravito",
        distanceKm: 20,
        handoverTime: "",
        cutoffTime: "",
        notes: "",
      }]),
      { params: { id: raceId } },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Un point de relais référence un ravito qui n'appartient pas à ce format.",
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("rejects an existing relay point id owned by another race", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([{ distance_km: 80, participation_mode: "relay" }]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const response = await PUT(
      putRequest([{
        id: relayPointId,
        name: "Point externe",
        distanceKm: 20,
        handoverTime: "",
        cutoffTime: "",
        notes: "",
      }]),
      { params: { id: raceId } },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Un point de relais n'appartient pas à ce format.",
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer-entitlements", () => ({
  requireOrganizerRaceCapability: () => Promise.resolve(true),
}));

vi.mock("../../../../../../lib/organizer-module-settings", () => ({
  isOrganizerRaceModuleSelected: () => Promise.resolve(true),
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: () => Promise.resolve({
    id: raceId,
    event_id: "44444444-4444-4444-4444-444444444444",
    edition_id: "55555555-5555-4555-8555-555555555555",
  }),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
    apikey: "service-key",
    Authorization: "Bearer service-key",
    ...(contentType ? { "Content-Type": contentType } : {}),
  }),
  uuidParamSchema: {
    safeParse: (params: { id?: string }) => typeof params.id === "string"
      ? { success: true, data: { id: params.id } }
      : { success: false },
  },
}));

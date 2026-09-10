import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST, PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const stationId = "22222222-2222-2222-2222-222222222222";
const productId = "33333333-3333-3333-3333-333333333333";
const linkId = "44444444-4444-4444-4444-444444444444";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

const putRequest = (products: unknown[]) =>
  new NextRequest(`http://localhost/api/organizer/races/${raceId}/aid-station-products`, {
    method: "PUT",
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: JSON.stringify({ aidStationId: stationId, products }),
  });

describe("/api/organizer/races/[id]/aid-station-products", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces an ordered station product list with one atomic RPC", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: stationId, race_id: raceId }]))
      .mockResolvedValueOnce(jsonResponse([{
        id: linkId,
        race_aid_station_id: stationId,
        product_id: productId,
        notes: "Citron",
        order_index: 0,
      }]));

    const response = await PUT(
      putRequest([{ productId, notes: "  Citron  " }]),
      { params: { id: raceId } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      products: [{
        id: linkId,
        aidStationId: stationId,
        productId,
        notes: "Citron",
        orderIndex: 0,
      }],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("/rest/v1/rpc/replace_race_aid_station_products");
    expect(JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body))).toEqual({
      p_race_id: raceId,
      p_aid_station_id: stationId,
      p_items: [{ product_id: productId, notes: "Citron", order_index: 0 }],
    });
  });

  it("uses the RPC for an empty replacement instead of a standalone delete", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: stationId, race_id: raceId }]))
      .mockResolvedValueOnce(jsonResponse([]));

    const response = await PUT(putRequest([]), { params: { id: raceId } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ products: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body))).toMatchObject({ p_items: [] });
  });

  it("returns an error without issuing partial follow-up writes when replacement fails", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: stationId, race_id: raceId }]))
      .mockResolvedValueOnce(jsonResponse({ message: "foreign key violation" }, 409));

    const response = await PUT(putRequest([{ productId, notes: null }]), { params: { id: raceId } });

    expect(response.status).toBe(502);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("/rest/v1/rpc/replace_race_aid_station_products");
  });

  it("creates and attaches an organizer product in one atomic RPC", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: stationId, race_id: raceId }]))
      .mockResolvedValueOnce(jsonResponse({
        product: {
          id: productId,
          slug: "gel-maison",
          sku: "ORG-TEST",
          name: "Gel maison",
          brand: null,
          image_url: null,
          fuel_type: "gel",
          product_url: null,
          calories_kcal: 100,
          carbs_g: 25,
          sodium_mg: 50,
          protein_g: 0,
          fat_g: 0,
          created_by: "00000000-0000-0000-0000-000000000001",
          is_official: false,
        },
        stationProduct: {
          id: linkId,
          race_aid_station_id: stationId,
          product_id: productId,
          notes: null,
          order_index: 999,
        },
      }));
    const request = new NextRequest(`http://localhost/api/organizer/races/${raceId}/aid-station-products`, {
      method: "POST",
      headers: { authorization: "Bearer user-token", "content-type": "application/json" },
      body: JSON.stringify({
        aidStationId: stationId,
        product: {
          name: "Gel maison",
          fuelType: "gel",
          caloriesKcal: 100,
          carbsGrams: 25,
          sodiumMg: 50,
          proteinGrams: 0,
          fatGrams: 0,
        },
        notes: null,
      }),
    });

    const response = await POST(request, { params: { id: raceId } });

    expect(response.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("/rest/v1/rpc/create_organizer_aid_station_product");
    expect(JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      p_race_id: raceId,
      p_aid_station_id: stationId,
      p_product: {
        name: "Gel maison",
        fuel_type: "gel",
        created_by: "00000000-0000-0000-0000-000000000001",
      },
      p_notes: null,
    });
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

vi.mock("../../../../../../lib/organizer", async () => ({
  ...(await vi.importActual<typeof import("../../../../../../lib/organizer")>("../../../../../../lib/organizer")),
  buildSlug: () => "unused",
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: () => Promise.resolve({
    id: raceId,
    event_id: "55555555-5555-4555-8555-555555555555",
    edition_id: "66666666-6666-4666-8666-666666666666",
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

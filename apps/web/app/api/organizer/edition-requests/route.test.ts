import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const raceRouteMocks = vi.hoisted(() => ({ createRace: vi.fn(), deleteRace: vi.fn() }));

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/organizer/edition-requests", {
    method: "POST",
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/organizer/edition-requests POST", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    raceRouteMocks.createRace.mockReset();
    raceRouteMocks.deleteRace.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the new yearly edition directly as draft formats", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ id: "44444444-4444-4444-4444-444444444444" }]))
      .mockResolvedValueOnce(Response.json([{ id: "66666666-6666-6666-6666-666666666666" }]))
      .mockResolvedValueOnce(Response.json([{ id: "11111111-1111-1111-1111-111111111111", name: "42K", race_date: "2026-06-20" }]))
      .mockResolvedValueOnce(Response.json([{
        id: "55555555-5555-5555-5555-555555555555",
        event_id: "22222222-2222-2222-2222-222222222222",
        edition_year: 2027,
        start_date: "2027-06-21",
        end_date: "2027-06-22",
        is_current: false,
      }], { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json([{
        id: "55555555-5555-5555-5555-555555555555",
        event_id: "22222222-2222-2222-2222-222222222222",
        edition_year: 2027,
        start_date: "2027-06-21",
        end_date: "2027-06-22",
        is_current: true,
      }]));
    raceRouteMocks.createRace.mockResolvedValueOnce(
      Response.json({
        race: {
          id: "33333333-3333-3333-3333-333333333333",
          edition_group_id: "11111111-1111-1111-1111-111111111111",
          race_date: "2027-06-21",
        },
      }, { status: 201 })
    );

    const response = await POST(createRequest({
      eventId: "22222222-2222-2222-2222-222222222222",
      sourceYear: 2026,
      requestedStartDate: "2027-06-21",
      requestedEndDate: "2027-06-22",
      duplicatePreviousEdition: true,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.races).toHaveLength(1);
    const nestedRequest = raceRouteMocks.createRace.mock.calls[0]?.[0] as NextRequest;
    expect(await nestedRequest.json()).toMatchObject({
      cloneFromRaceId: "11111111-1111-1111-1111-111111111111",
      editionId: "55555555-5555-5555-5555-555555555555",
      raceDate: "2027-06-21",
    });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("race_event_editions");
    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain("edition_id=eq.66666666-6666-6666-6666-666666666666");
  });

  it("creates an empty edition when duplication is disabled", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ id: "44444444-4444-4444-4444-444444444444" }]))
      .mockResolvedValueOnce(Response.json([{
        id: "55555555-5555-5555-5555-555555555555",
        event_id: "22222222-2222-2222-2222-222222222222",
        edition_year: 2027,
        start_date: "2027-06-21",
        end_date: "2027-06-22",
        is_current: false,
      }], { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(createRequest({
      eventId: "22222222-2222-2222-2222-222222222222",
      sourceYear: 2026,
      requestedStartDate: "2027-06-21",
      requestedEndDate: "2027-06-22",
      duplicatePreviousEdition: false,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.edition).toMatchObject({ edition_year: 2027, is_current: true });
    expect(payload.races).toEqual([]);
    expect(raceRouteMocks.createRace).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5);
  });
});

vi.mock("../races/route", () => ({ POST: raceRouteMocks.createRace }));
vi.mock("../races/[id]/route", () => ({ DELETE: raceRouteMocks.deleteRace }));
vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: () => Promise.resolve(true),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));

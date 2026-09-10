import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const authState = vi.hoisted(() => ({ requireOrganizerAuth: vi.fn() }));
const userId = "00000000-0000-0000-0000-000000000001";
const eventId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";

const request = () => new NextRequest(`http://localhost/api/organizer/events/${eventId}/onboarding`, {
  method: "PATCH",
  headers: { authorization: "Bearer user-token" },
});

describe("PATCH /api/organizer/events/[id]/onboarding", () => {
  beforeEach(() => {
    authState.requireOrganizerAuth.mockReset().mockResolvedValue({
      user: { id: userId },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("requires an authenticated session", async () => {
    authState.requireOrganizerAuth.mockResolvedValue({
      error: Response.json({ message: "Missing access token." }, { status: 401 }),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(request(), { params: { id: eventId } });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a user without an active event membership", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));

    const response = await PATCH(request(), { params: { id: eventId } });

    expect(response.status).toBe(403);
  });

  it("records completion for the active organizer membership", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([{
        id: membershipId,
        dashboard_onboarding_completed_at: null,
      }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(request(), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.completedAt).toEqual(expect.any(String));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://supabase.example/rest/v1/race_event_organizers?event_id=eq.${eventId}&user_id=eq.${userId}&revoked_at=is.null&select=id,dashboard_onboarding_completed_at&limit=1`,
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ dashboard_onboarding_completed_at: payload.completedAt }),
    });
  });

  it("keeps the first completion timestamp on repeated calls", async () => {
    const completedAt = "2026-09-10T20:00:00.000Z";
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{
      id: membershipId,
      dashboard_onboarding_completed_at: completedAt,
    }]));
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(request(), { params: { id: eventId } });

    expect(await response.json()).toEqual({ completedAt });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a persistence failure", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{
        id: membershipId,
        dashboard_onboarding_completed_at: null,
      }]))
      .mockResolvedValueOnce(new Response("database unavailable", { status: 503 })));

    const response = await PATCH(request(), { params: { id: eventId } });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "Unable to save onboarding progress." });
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", async () => {
  const { z } = await import("zod");
  return {
    jsonError: (message: string, status: number) => Response.json({ message }, { status }),
    requireOrganizerAuth: authState.requireOrganizerAuth,
    serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
    uuidParamSchema: z.object({ id: z.string().uuid() }),
  };
});

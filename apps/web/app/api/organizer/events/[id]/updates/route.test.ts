import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";
const organizerId = "00000000-0000-0000-0000-000000000001";
const updateId = "22222222-2222-2222-2222-222222222222";

const {
  mockRequireEventOrganizer,
  mockRequireOrganizerAuth,
  mockCheckRateLimitAsync,
  mockSendOrganizerRaceUpdateNotifications,
} = vi.hoisted(() => ({
  mockRequireEventOrganizer: vi.fn(),
  mockRequireOrganizerAuth: vi.fn(),
  mockCheckRateLimitAsync: vi.fn(),
  mockSendOrganizerRaceUpdateNotifications: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number; headers?: HeadersInit } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json", ...options.headers },
  });

const organizerRequest = (body?: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/events/${eventId}/updates`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: "Bearer organizer-token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const organizerDeleteRequest = (id = updateId) =>
  new NextRequest(`http://localhost/api/organizer/events/${eventId}/updates?updateId=${id}`, {
    method: "DELETE",
    headers: { authorization: "Bearer organizer-token" },
  });

describe("/api/organizer/events/[id]/updates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockRequireOrganizerAuth.mockResolvedValue({
      user: { id: organizerId },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    });
    mockRequireEventOrganizer.mockResolvedValue(true);
    mockCheckRateLimitAsync.mockResolvedValue({ allowed: true });
    mockSendOrganizerRaceUpdateNotifications.mockResolvedValue({
      totalCandidateCount: 2,
      skippedDuplicateCount: 0,
      disabledDeviceCount: 0,
      sentCount: 2,
      favoriteUserCount: 2,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns favorite count and recent updates for an organizer", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ user_id: organizerId }], { headers: { "content-range": "0-0/2" } }))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: updateId,
            event_id: eventId,
            race_id: null,
            message: "Retrait des dossards dès 17h.",
            created_at: "2026-06-29T10:00:00.000Z",
            created_by: organizerId,
          },
        ])
      );

    const response = await GET(organizerRequest(), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.favoriteCount).toBe(2);
    expect(payload.updates).toHaveLength(1);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `https://supabase.example/rest/v1/user_favorite_race_events?event_id=eq.${eventId}&select=user_id&limit=1`,
      expect.objectContaining({
        headers: expect.objectContaining({ Prefer: "count=exact", Range: "0-0" }),
      })
    );
  });

  it("returns zero when the exact count reports no favorites", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "*/0" } }))
      .mockResolvedValueOnce(buildJsonResponse([]));

    const response = await GET(organizerRequest(), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.favoriteCount).toBe(0);
  });

  it("fails safely when Supabase omits the exact count", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ user_id: organizerId }]))
      .mockResolvedValueOnce(buildJsonResponse([]));

    const response = await GET(organizerRequest(), { params: { id: eventId } });

    expect(response.status).toBe(502);
  });

  it("allows an organizer to create a published update and trigger push delivery", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ id: eventId, name: "Grand Trail" }]))
      .mockResolvedValueOnce(
        buildJsonResponse(
          [
            {
              id: updateId,
              event_id: eventId,
              race_id: null,
              message: "Retrait des dossards dès 17h.",
              created_at: "2026-06-29T10:00:00.000Z",
              created_by: organizerId,
            },
          ],
          { status: 201 }
        )
      );

    const response = await POST(organizerRequest({ message: "Retrait des dossards dès 17h." }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.update.id).toBe(updateId);
    expect(mockSendOrganizerRaceUpdateNotifications).toHaveBeenCalledWith({
      eventId,
      eventName: "Grand Trail",
      raceId: null,
      raceName: null,
      updateId,
      message: "Retrait des dossards dès 17h.",
    });
  });

  it("targets one format and uses its name for push delivery", async () => {
    const raceId = "33333333-3333-3333-3333-333333333333";
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ id: eventId, name: "Grand Trail" }]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: raceId, event_id: eventId, name: "Le 42 km", is_live: true }]))
      .mockResolvedValueOnce(
        buildJsonResponse(
          [{ id: updateId, event_id: eventId, race_id: raceId, message: "Départ à 7h.", created_at: "2026-08-20T10:00:00.000Z", created_by: organizerId }],
          { status: 201 }
        )
      );

    const response = await POST(organizerRequest({ message: "Départ à 7h.", raceId }), { params: { id: eventId } });

    expect(response.status).toBe(201);
    expect(mockSendOrganizerRaceUpdateNotifications).toHaveBeenCalledWith({
      eventId,
      eventName: "Grand Trail",
      raceId,
      raceName: "Le 42 km",
      updateId,
      message: "Départ à 7h.",
    });
  });

  it("rejects an empty message", async () => {
    const response = await POST(organizerRequest({ message: "   " }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toBe("Invalid update payload.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-organizers", async () => {
    mockRequireEventOrganizer.mockResolvedValueOnce({
      error: Response.json({ message: "Forbidden." }, { status: 403 }),
    });

    const response = await POST(organizerRequest({ message: "Message" }), { params: { id: eventId } });

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows an organizer to delete an update from the managed event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: updateId,
          event_id: eventId,
          race_id: null,
          message: "Information obsolète.",
          created_at: "2026-08-20T10:00:00.000Z",
          created_by: organizerId,
        },
      ])
    );

    const response = await DELETE(organizerDeleteRequest(), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deletedUpdateId).toBe(updateId);
    expect(fetch).toHaveBeenCalledWith(
      `https://supabase.example/rest/v1/race_event_updates?id=eq.${updateId}&event_id=eq.${eventId}`,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("returns not found when the update does not belong to the managed event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse([]));

    const response = await DELETE(organizerDeleteRequest(), { params: { id: eventId } });

    expect(response.status).toBe(404);
  });

  it("rejects update deletion for non-organizers", async () => {
    mockRequireEventOrganizer.mockResolvedValueOnce({
      error: Response.json({ message: "Forbidden." }, { status: 403 }),
    });

    const response = await DELETE(organizerDeleteRequest(), { params: { id: eventId } });

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../../lib/http", () => ({
  checkRateLimitAsync: mockCheckRateLimitAsync,
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/push", () => ({
  sendOrganizerRaceUpdateNotifications: mockSendOrganizerRaceUpdateNotifications,
}));

vi.mock("../../../../../../lib/organizer", async () => {
  const { z } = await import("zod");

  return {
    jsonError: (message: string, status: number) => Response.json({ message }, { status }),
    requireEventOrganizer: mockRequireEventOrganizer,
    requireOrganizerAuth: mockRequireOrganizerAuth,
    serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
      apikey: "service-key",
      Authorization: "Bearer service-key",
      ...(contentType ? { "Content-Type": contentType } : {}),
    }),
    uuidParamSchema: z.object({ id: z.string().uuid() }),
  };
});

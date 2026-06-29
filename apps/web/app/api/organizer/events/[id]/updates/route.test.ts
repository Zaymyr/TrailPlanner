import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

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

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
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
      .mockResolvedValueOnce(buildJsonResponse([{ user_id: organizerId }, { user_id: "other-user" }]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: updateId,
            event_id: eventId,
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
      updateId,
      message: "Retrait des dossards dès 17h.",
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

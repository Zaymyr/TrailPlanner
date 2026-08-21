import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const publicationMocks = vi.hoisted(() => ({ validate: vi.fn() }));
const eventId = "11111111-1111-1111-1111-111111111111";
const raceId = "33333333-3333-3333-3333-333333333333";

const request = () => new NextRequest("http://localhost/api/organizer/publication-requests", {
  method: "POST",
  headers: { authorization: "Bearer user-token", "content-type": "application/json" },
  body: JSON.stringify({ eventId, raceId }),
});

describe("/api/organizer/publication-requests POST", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    publicationMocks.validate.mockResolvedValue({ ok: true, publishableRaceCount: 1, raceId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a pending request without publishing source rows", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{
        id: "22222222-2222-2222-2222-222222222222",
        created_at: "2026-07-29T10:00:00.000Z",
        event_id: eventId,
        race_id: raceId,
        user_id: "00000000-0000-0000-0000-000000000001",
        status: "pending",
        reviewer_notes: null,
      }], { status: 201 }));

    const response = await POST(request());
    expect(response.status).toBe(201);
    expect((await response.json()).publicationRequest.status).toBe("pending");
    expect(publicationMocks.validate).toHaveBeenCalledWith(expect.anything(), eventId, raceId);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(`race_id=eq.${raceId}`);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toMatchObject({ event_id: eventId, race_id: raceId });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("race_events"))).toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/rest/v1/races"))).toBe(false);
  });
});

vi.mock("../../../../lib/http", () => ({
  checkRateLimitAsync: () => Promise.resolve({ allowed: true }),
  withSecurityHeaders: (response: Response) => response,
}));
vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: () => Promise.resolve(true),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
  serviceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));
vi.mock("../../../../lib/organizer-publication", () => ({
  validateOrganizerEventPublication: publicationMocks.validate,
}));

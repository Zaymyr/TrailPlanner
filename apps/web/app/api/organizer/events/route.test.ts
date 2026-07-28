import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const buildJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/organizer/events", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/organizer/events", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a draft event and immediately grants owner access", async () => {
    const eventId = "11111111-1111-1111-1111-111111111111";
    const membershipId = "22222222-2222-2222-2222-222222222222";
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        buildJsonResponse(
          [{ id: eventId, name: "Trail du Fort", location: "Tamié", race_date: "2026-05-17", is_live: false }],
          201
        )
      )
      .mockResolvedValueOnce(
        buildJsonResponse([{ id: membershipId, event_id: eventId, role: "owner" }], 201)
      );

    const response = await POST(
      createRequest({
        name: "Trail du Fort",
        location: "Tamié",
        raceDate: "2026-05-17",
        officialSiteUrl: "https://www.trailfortdetamie.com/",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.event).toMatchObject({ id: eventId, is_live: false });
    expect(payload.membership).toMatchObject({ event_id: eventId, role: "owner" });

    const eventInsert = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(eventInsert[1]?.body))).toMatchObject({
      name: "Trail du Fort",
      race_date: "2026-05-17",
      is_live: false,
      organizer_details: { officialWebsiteUrl: "https://www.trailfortdetamie.com/" },
    });

    const membershipInsert = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse(String(membershipInsert[1]?.body))).toMatchObject({
      event_id: eventId,
      user_id: "00000000-0000-0000-0000-000000000001",
      claim_id: null,
      role: "owner",
      created_by: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("cleans up the draft when owner access cannot be created", async () => {
    const eventId = "11111111-1111-1111-1111-111111111111";
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        buildJsonResponse([{ id: eventId, name: "Trail du Fort", location: null, race_date: null, is_live: false }], 201)
      )
      .mockResolvedValueOnce(buildJsonResponse({ message: "membership failed" }, 500))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(createRequest({ name: "Trail du Fort" }));

    expect(response.status).toBe(502);
    expect(vi.mocked(fetch).mock.calls[2]?.[1]?.method).toBe("DELETE");
  });

  it("rejects an impossible event date before writing", async () => {
    const response = await POST(createRequest({ name: "Trail du Fort", raceDate: "2026-02-31" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../lib/http", async () => {
  const original = await vi.importActual<typeof import("../../../../lib/http")>("../../../../lib/http");
  return {
    ...original,
    checkRateLimitAsync: () => Promise.resolve({ allowed: true, remaining: 5 }),
    withSecurityHeaders: (response: Response) => response,
  };
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
  extractBearerToken: () => "user-token",
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "00000000-0000-0000-0000-000000000001",
      email: "organizer@example.com",
      appMetadata: { role: "user" },
    }),
  isAdminUser: () => false,
}));

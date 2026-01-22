import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { POST } from "./route";

const mockSupabaseConfig = {
  supabaseUrl: "https://supabase.example",
  supabaseAnonKey: "anon-key",
};

const mockServiceConfig = {
  supabaseUrl: "https://supabase.example",
  supabaseServiceRoleKey: "service-key",
};

const buildJsonResponse = (payload: unknown, options: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(payload), { status: options.status ?? 200, headers: options.headers });

describe("POST /api/coach/invite", () => {
  const inviteRequest = (email: string) =>
    new NextRequest("http://localhost/api/coach/invite", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enforces the invite limit", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: "tier-id",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/2" } }));

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ message: "Invite limit reached." });
  });

  it("creates an active invite for existing users", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: "tier-id",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/0" } }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse({ users: [{ id: "coachee-id", email: "invitee@example.com" }] }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "invite-id" }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse(null, { status: 201 }));

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "active" });

    const inviteCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/coach_invites")
    );
    expect(inviteCall).toBeDefined();
    const inviteBody = JSON.parse(inviteCall?.[1]?.body as string);
    expect(inviteBody.status).toBe("accepted");
    expect(inviteBody.invitee_user_id).toBe("coachee-id");

    const coacheeCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/coach_coachees")
    );
    expect(coacheeCall).toBeDefined();
    const coacheeBody = JSON.parse(coacheeCall?.[1]?.body as string);
    expect(coacheeBody.status).toBe("active");
    expect(coacheeBody.coachee_id).toBe("coachee-id");
  });

  it("creates a pending invite for new users", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: "tier-id",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/0" } }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse({ users: [] }))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "invite-id" }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse(null, { status: 204 }));

    const response = await POST(inviteRequest("newuser@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "pending" });

    const inviteCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/coach_invites")
    );
    expect(inviteCall).toBeDefined();
    const inviteBody = JSON.parse(inviteCall?.[1]?.body as string);
    expect(inviteBody.status).toBe("pending");
    expect(inviteBody.invitee_user_id).toBeNull();

    const updateInviteCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/coach_invites") && init?.method === "PATCH"
    );
    expect(updateInviteCall).toBeDefined();
    const updateBody = JSON.parse(updateInviteCall?.[1]?.body as string);
    expect(updateBody.invitee_user_id).toBe("invited-user-id");
  });

  it("rejects coaches without an active subscription", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          coach_tier_id: "tier-id",
          subscription_status: "canceled",
        },
      ])
    );

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ message: "Coach subscription required." });
  });
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => mockSupabaseConfig,
  getSupabaseServiceConfig: () => mockServiceConfig,
  extractBearerToken: () => "test-token",
  fetchSupabaseUser: () => Promise.resolve({ id: "coach-id", email: "coach@example.com" }),
}));

vi.mock("../../../../lib/coach-tiers", () => ({
  fetchCoachTierById: () => Promise.resolve({ invite_limit: 1 }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: () => Promise.resolve({
          data: { user: { id: "invited-user-id" } },
          error: null,
        }),
      },
    },
  }),
}));

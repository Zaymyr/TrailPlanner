import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { fetchCoachTierByName } from "../../../../lib/coach-tiers";
import { POST } from "./route";

const inviteUserByEmailMock = vi.fn(() =>
  Promise.resolve({
    data: { user: { id: "33333333-3333-3333-3333-333333333333" } },
    error: null,
  })
);

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
    inviteUserByEmailMock.mockClear();
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
            coach_tier_id: "11111111-1111-1111-1111-111111111111",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            is_coach: false,
            coach_plan_name: null,
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/2" } }));

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ message: "Invite limit reached." });
  });

  it("creates a pending invite for existing users", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: "11111111-1111-1111-1111-111111111111",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            is_coach: false,
            coach_plan_name: null,
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/0" } }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse({ users: [{ id: "22222222-2222-2222-2222-222222222222", email: "invitee@example.com" }] })
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "invite-id" }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse(null, { status: 200 }));

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "pending" });

    const inviteCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/coach_invites") && init?.method === "POST"
    );
    expect(inviteCall).toBeDefined();
    const inviteBody = JSON.parse(inviteCall?.[1]?.body as string);
    expect(inviteBody.status).toBe("pending");
    expect(inviteBody.invitee_user_id).toBe("22222222-2222-2222-2222-222222222222");

    const recoverCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/auth/v1/recover") && init?.method === "POST"
    );
    expect(recoverCall).toBeDefined();
    const recoverBody = JSON.parse(recoverCall?.[1]?.body as string);
    expect(recoverBody).toEqual({ email: "invitee@example.com", redirect_to: "http://localhost/reset-password" });
  });

  it("creates a pending invite for new users", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: "11111111-1111-1111-1111-111111111111",
            subscription_status: "active",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            is_coach: false,
            coach_plan_name: null,
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/0" } }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse({ users: [] }))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "invite-id" }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse({}, { status: 200 }));

    const response = await POST(inviteRequest("newuser@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "pending" });

    const inviteCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/coach_invites") && init?.method === "POST"
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
    expect(updateBody.invitee_user_id).toBe("33333333-3333-3333-3333-333333333333");
    expect(inviteUserByEmailMock).toHaveBeenCalledWith("newuser@example.com", {
      redirectTo: "http://localhost/reset-password",
    });
  });

  it("rejects coaches without an active subscription", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          coach_tier_id: "11111111-1111-1111-1111-111111111111",
          subscription_status: "canceled",
        },
      ])
    );
    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          is_coach: false,
          coach_plan_name: null,
        },
      ])
    );

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ message: "Coach subscription required." });
  });

  it("allows coaches flagged on their profile even without an active subscription", async () => {
    const mockFetch = vi.mocked(fetch);
    const mockFetchCoachTierByName = vi.mocked(fetchCoachTierByName);

    mockFetchCoachTierByName.mockResolvedValueOnce({ name: "starter", invite_limit: 1 });

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            coach_tier_id: null,
            subscription_status: "canceled",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            is_coach: true,
            coach_plan_name: "starter",
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([], { headers: { "content-range": "0-0/1" } }));

    const response = await POST(inviteRequest("invitee@example.com"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ message: "Invite limit reached." });
    expect(mockFetchCoachTierByName).toHaveBeenCalledWith("starter");
  });
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => mockSupabaseConfig,
  getSupabaseServiceConfig: () => mockServiceConfig,
  extractBearerToken: () => "test-token",
  fetchSupabaseUser: () => Promise.resolve({ id: "coach-id", email: "coach@example.com" }),
}));

vi.mock("../../../../lib/coach-tiers", () => ({
  fetchCoachTierById: vi.fn(() => Promise.resolve({ name: "starter", invite_limit: 1 })),
  fetchCoachTierByName: vi.fn(() => Promise.resolve({ name: "starter", invite_limit: 1 })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: inviteUserByEmailMock,
      },
    },
  }),
}));

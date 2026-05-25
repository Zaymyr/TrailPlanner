import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const usersRequest = () =>
  new NextRequest("http://localhost/api/admin/users", {
    method: "GET",
    headers: {
      authorization: "Bearer admin-token",
    },
  });

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns users even when Supabase auth users do not have an email", async () => {
    const mockFetch = vi.mocked(fetch);
    const anonymousUserId = "11111111-1111-1111-1111-111111111111";

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [
            {
              id: anonymousUserId,
              email: null,
              created_at: "2026-05-01T10:00:00.000Z",
              app_metadata: { role: "user" },
            },
          ],
        })
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]));

    const response = await GET(usersRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.users).toHaveLength(1);
    expect(payload.users[0]).toMatchObject({
      id: anonymousUserId,
      createdAt: "2026-05-01T10:00:00.000Z",
      role: "user",
      roles: ["user"],
      premiumGrant: null,
      trial: null,
      subscription: null,
      insights: {
        signInCount: null,
        activityWindowDays: null,
        planCount: 0,
        latestPlanName: null,
        favoriteProducts: [],
        onboardingCompleted: false,
      },
    });
    expect(payload.users[0]).not.toHaveProperty("email");
    expect(mockFetch).toHaveBeenCalledTimes(9);
  });

  it("returns explicit Supabase Auth error details when the user list request fails", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch.mockResolvedValueOnce(
      buildJsonResponse(
        {
          message: 'column "sign_in_count" does not exist',
          details: "Failed while reading admin users",
          code: "42703",
        },
        { status: 500 }
      )
    );

    const response = await GET(usersRequest());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      message: "Failed to load admin users from Supabase Auth.",
      source: "supabase-auth-admin-users",
    });
    expect(payload.details).toContain('column "sign_in_count" does not exist');
    expect(payload.details).toContain("Failed while reading admin users");
    expect(payload.details).toContain("Code: 42703");
  });
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
  }),
}));

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseAnonKey: "anon-key",
  }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "99999999-9999-9999-9999-999999999999",
      email: "admin@example.com",
      appMetadata: { role: "admin" },
    }),
  isAdminUser: () => true,
}));

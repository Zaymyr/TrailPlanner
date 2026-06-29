import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "./route";

const userId = "00000000-0000-0000-0000-000000000001";
const firstEventId = "11111111-1111-1111-1111-111111111111";
const secondEventId = "22222222-2222-2222-2222-222222222222";
const thirdEventId = "33333333-3333-3333-3333-333333333333";

const { mockFetchSupabaseUser, mockGetSupabaseAnonConfig, mockIsAnonymousUser } = vi.hoisted(() => ({
  mockFetchSupabaseUser: vi.fn(),
  mockGetSupabaseAnonConfig: vi.fn(),
  mockIsAnonymousUser: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const authorizedRequest = (method: "GET" | "PUT", body?: Record<string, unknown>) =>
  new Request("http://localhost/api/race-favorites", {
    method,
    headers: {
      authorization: "Bearer runner-token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/race-favorites", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockGetSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
    mockFetchSupabaseUser.mockResolvedValue({ id: userId });
    mockIsAnonymousUser.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the caller favorite event ids", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse([{ event_id: firstEventId }, { event_id: secondEventId }]));

    const response = await GET(authorizedRequest("GET"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.eventIds).toEqual([firstEventId, secondEventId]);
  });

  it("synchronizes favorites by inserting and deleting the diff", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ event_id: firstEventId }, { event_id: secondEventId }]))
      .mockResolvedValueOnce(buildJsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(buildJsonResponse(null, { status: 201 }));

    const response = await PUT(
      authorizedRequest("PUT", {
        eventIds: [secondEventId, thirdEventId],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.eventIds).toEqual([secondEventId, thirdEventId]);

    const deleteCall = vi.mocked(fetch).mock.calls[1];
    const insertCall = vi.mocked(fetch).mock.calls[2];

    expect(deleteCall?.[0]).toContain(`user_id=eq.${encodeURIComponent(userId)}`);
    expect(deleteCall?.[0]).toContain(firstEventId);
    expect(insertCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(insertCall?.[1]?.body as string)).toEqual([{ user_id: userId, event_id: thirdEventId }]);
  });

  it("blocks anonymous users", async () => {
    mockIsAnonymousUser.mockReturnValueOnce(true);

    const response = await GET(authorizedRequest("GET"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("Anonymous users");
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../lib/supabase", () => ({
  extractBearerToken: () => "runner-token",
  fetchSupabaseUser: mockFetchSupabaseUser,
  getSupabaseAnonConfig: mockGetSupabaseAnonConfig,
  isAnonymousUser: mockIsAnonymousUser,
}));

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const syncRequest = (body: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/admin/resend/sync", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/admin/resend/sync", () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
    vi.restoreAllMocks();
  });

  it("previews Supabase contacts without calling Resend in dry-run mode", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              email: "Ada@Example.com",
              created_at: "2026-05-01T10:00:00.000Z",
              app_metadata: { roles: ["coach"] },
              user_metadata: { full_name: "Ada Lovelace" },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse([{ user_id: "11111111-1111-1111-1111-111111111111", full_name: "Ada Byron" }])
      );

    const response = await POST(syncRequest({ dryRun: true, pageSize: 2 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({
      dryRun: true,
      usersRead: 1,
      contactsPrepared: 1,
      contactsWouldSync: 1,
      contactsSynced: 0,
      skipped: 0,
      failed: 0,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("creates Resend contacts from Supabase users", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              email: "Ada@Example.com",
              created_at: "2026-05-01T10:00:00.000Z",
              last_sign_in_at: "2026-05-03T10:00:00.000Z",
              app_metadata: { roles: ["coach"] },
              user_metadata: { full_name: "Ada Lovelace" },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse([{ user_id: "11111111-1111-1111-1111-111111111111", full_name: "Ada Byron" }])
      )
      .mockResolvedValueOnce(buildJsonResponse({ object: "contact", id: "contact-id" }));

    const response = await POST(syncRequest({ pageSize: 2, defaultUnsubscribed: false }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({
      usersRead: 1,
      contactsSynced: 1,
      created: 1,
      updated: 0,
      failed: 0,
    });

    const resendCall = mockFetch.mock.calls.find(([url]) => String(url) === "https://api.resend.com/contacts");
    expect(resendCall).toBeDefined();
    const [, resendInit] = resendCall!;
    expect(JSON.parse(resendInit?.body as string)).toEqual({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Byron",
      unsubscribed: false,
      properties: {
        source: "supabase",
        supabase_user_id: "11111111-1111-1111-1111-111111111111",
        supabase_created_at: "2026-05-01T10:00:00.000Z",
        supabase_last_sign_in_at: "2026-05-03T10:00:00.000Z",
        app_roles: "coach",
      },
    });
  });

  it("updates existing Resend contacts when create reports a duplicate", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              email: "ada@example.com",
              created_at: "2026-05-01T10:00:00.000Z",
              app_metadata: { role: "user" },
              user_metadata: {},
            },
          ],
        })
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse({ message: "Contact already exists" }, { status: 409 }))
      .mockResolvedValueOnce(buildJsonResponse({ object: "contact", id: "contact-id" }));

    const response = await POST(syncRequest({ pageSize: 2 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({
      contactsSynced: 1,
      created: 0,
      updated: 1,
      failed: 0,
    });

    const updateCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === "https://api.resend.com/contacts/ada%40example.com" && init?.method === "PATCH"
    );
    expect(updateCall).toBeDefined();
  });
});

vi.mock("../../../../../lib/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../../lib/http")>();
  return {
    ...original,
    checkRateLimitAsync: () => Promise.resolve({ allowed: true, remaining: 3 }),
  };
});

vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
  extractBearerToken: () => "admin-token",
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "99999999-9999-9999-9999-999999999999",
      email: "admin@example.com",
      appMetadata: { role: "admin" },
    }),
  isAdminUser: () => true,
}));

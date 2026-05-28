import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const adminRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/organizer-claims", {
    method: "PATCH",
    headers: {
      authorization: "Bearer admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/organizer-claims", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("approves a claim by creating organizer membership and marking the claim approved", async () => {
    const mockFetch = vi.mocked(fetch);
    const eventId = "11111111-1111-1111-1111-111111111111";
    const claimId = "22222222-2222-2222-2222-222222222222";
    const userId = "33333333-3333-3333-3333-333333333333";

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([{ id: claimId, user_id: userId, event_id: eventId, status: "pending", role_title: "RD" }])
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "44444444-4444-4444-4444-444444444444",
            created_at: "2026-05-28T10:00:00.000Z",
            event_id: eventId,
            user_id: userId,
            claim_id: claimId,
            role: "owner",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: claimId,
            created_at: "2026-05-28T09:00:00.000Z",
            updated_at: "2026-05-28T10:00:00.000Z",
            user_id: userId,
            event_id: eventId,
            organization_name: "Trail Org",
            role_title: "RD",
            contact_email: "orga@example.com",
            status: "approved",
          },
        ])
      );

    const response = await PATCH(adminRequest({ action: "approve", claimId, reviewerNotes: "Verified" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claim.status).toBe("approved");
    expect(payload.membership.event_id).toBe(eventId);

    const membershipCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_organizers") && init?.method === "POST"
    );
    expect(membershipCall).toBeDefined();
    expect(JSON.parse(membershipCall?.[1]?.body as string)).toMatchObject({
      event_id: eventId,
      user_id: userId,
      claim_id: claimId,
      role: "owner",
      created_by: "99999999-9999-9999-9999-999999999999",
    });

    const claimPatchCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_claims") && init?.method === "PATCH"
    );
    expect(claimPatchCall).toBeDefined();
    expect(JSON.parse(claimPatchCall?.[1]?.body as string)).toMatchObject({
      status: "approved",
      reviewer_notes: "Verified",
    });
  });

  it("rejects a claim without creating membership", async () => {
    const mockFetch = vi.mocked(fetch);
    const eventId = "11111111-1111-1111-1111-111111111111";
    const claimId = "22222222-2222-2222-2222-222222222222";

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: claimId,
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: eventId,
            status: "pending",
            role_title: "RD",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: claimId,
            created_at: "2026-05-28T09:00:00.000Z",
            updated_at: "2026-05-28T10:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: eventId,
            organization_name: "Trail Org",
            role_title: "RD",
            contact_email: "orga@example.com",
            status: "rejected",
          },
        ])
      );

    const response = await PATCH(adminRequest({ action: "reject", claimId, reviewerNotes: "Not official" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claim.status).toBe("rejected");
    expect(
      mockFetch.mock.calls.some(
        ([url, init]) => String(url).includes("/rest/v1/race_event_organizers") && init?.method === "POST"
      )
    ).toBe(false);
  });

  it("revokes an active organizer membership", async () => {
    const mockFetch = vi.mocked(fetch);
    const membershipId = "44444444-4444-4444-4444-444444444444";

    mockFetch.mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: membershipId,
          created_at: "2026-05-28T10:00:00.000Z",
          event_id: "11111111-1111-1111-1111-111111111111",
          user_id: "33333333-3333-3333-3333-333333333333",
          role: "owner",
          revoked_at: "2026-05-28T11:00:00.000Z",
          revoke_reason: "Changed organizer",
        },
      ])
    );

    const response = await PATCH(
      adminRequest({ action: "revoke", membershipId, revokeReason: "Changed organizer" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.membership.revoked_at).toBeTruthy();

    const revokeBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(revokeBody).toMatchObject({
      revoked_by: "99999999-9999-9999-9999-999999999999",
      revoke_reason: "Changed organizer",
    });
  });
});

vi.mock("../../../../lib/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../lib/http")>();
  return {
    ...original,
    withSecurityHeaders: (response: Response) => response,
  };
});

vi.mock("../../../../lib/supabase", () => ({
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

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

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

  it("approves an edition request by cloning source-year formats into the requested year", async () => {
    const mockFetch = vi.mocked(fetch);
    const editionRequestId = "55555555-5555-5555-5555-555555555555";
    const eventId = "11111111-1111-1111-1111-111111111111";

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: editionRequestId,
            event_id: eventId,
            source_year: 2026,
            requested_start_date: "2027-06-20",
            status: "pending",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "66666666-6666-6666-6666-666666666666",
            event_id: eventId,
            edition_group_id: "77777777-7777-7777-7777-777777777777",
            series_name: "42K",
            name: "42K",
            distance_km: 42,
            elevation_gain_m: 2100,
            elevation_loss_m: 2100,
            location_text: "Annecy",
            race_date: "2026-06-20",
            thumbnail_url: null,
            gpx_path: null,
            gpx_hash: null,
            gpx_storage_path: null,
            gpx_sha256: null,
            organizer_details: null,
          },
          {
            id: "88888888-8888-8888-8888-888888888888",
            event_id: eventId,
            edition_group_id: "99999999-9999-9999-9999-999999999999",
            series_name: "80K",
            name: "80K",
            distance_km: 80,
            elevation_gain_m: 4200,
            elevation_loss_m: 4200,
            location_text: "Annecy",
            race_date: "2026-06-21",
            thumbnail_url: null,
            gpx_path: null,
            gpx_hash: null,
            gpx_storage_path: null,
            gpx_sha256: null,
            organizer_details: null,
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "new-race-1" }]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "new-race-2" }]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: editionRequestId,
            created_at: "2026-07-21T09:00:00.000Z",
            updated_at: "2026-07-21T10:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: eventId,
            source_year: 2026,
            requested_start_date: "2027-06-20",
            status: "approved",
          },
        ])
      );

    const response = await PATCH(
      adminRequest({ action: "approveEditionRequest", editionRequestId, reviewerNotes: "Billing approved" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.editionRequest.status).toBe("approved");
    expect(
      mockFetch.mock.calls.filter(
        ([url, init]) => String(url).includes("/rest/v1/races") && init?.method === "POST"
      )
    ).toHaveLength(2);
    const patchCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_edition_requests") && init?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({
      status: "approved",
      reviewer_notes: "Billing approved",
    });
  });
});

describe("GET /api/admin/organizer-claims", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads only pending claims and active memberships for the admin organizer tab", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "22222222-2222-2222-2222-222222222222",
            created_at: "2026-05-28T09:00:00.000Z",
            updated_at: "2026-05-28T09:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: "11111111-1111-1111-1111-111111111111",
            organization_name: "Trail Org",
            role_title: "RD",
            contact_email: "orga@example.com",
            status: "pending",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "44444444-4444-4444-4444-444444444444",
            created_at: "2026-05-28T10:00:00.000Z",
            event_id: "11111111-1111-1111-1111-111111111111",
            user_id: "33333333-3333-3333-3333-333333333333",
            claim_id: "22222222-2222-2222-2222-222222222222",
            role: "owner",
            revoked_at: null,
            revoke_reason: null,
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "55555555-5555-5555-5555-555555555555",
            created_at: "2026-07-21T09:00:00.000Z",
            updated_at: "2026-07-21T09:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: "11111111-1111-1111-1111-111111111111",
            source_year: 2026,
            requested_start_date: "2027-06-20",
            status: "pending",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([{ user_id: "33333333-3333-3333-3333-333333333333", full_name: "Camille Martin" }])
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [{ id: "33333333-3333-3333-3333-333333333333", email: "camille@example.com" }],
        })
      );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/organizer-claims", {
        headers: { authorization: "Bearer admin-token" },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claims).toHaveLength(1);
    expect(payload.memberships).toHaveLength(1);
    expect(payload.editionRequests).toHaveLength(1);
    expect(payload.claims[0].user.label).toBe("Camille Martin");
    expect(payload.memberships[0].user.email).toBe("camille@example.com");
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain("status=eq.pending");
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("revoked_at=is.null");
  });

  it("keeps the admin organizer tab usable when edition requests or identity enrichment fail", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "22222222-2222-2222-2222-222222222222",
            created_at: "2026-05-28T09:00:00.000Z",
            updated_at: "2026-05-28T09:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: "11111111-1111-1111-1111-111111111111",
            organization_name: "Trail Org",
            role_title: "RD",
            contact_email: "orga@example.com",
            status: "pending",
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "44444444-4444-4444-4444-444444444444",
            created_at: "2026-05-28T10:00:00.000Z",
            event_id: "11111111-1111-1111-1111-111111111111",
            user_id: "33333333-3333-3333-3333-333333333333",
            claim_id: "22222222-2222-2222-2222-222222222222",
            role: "owner",
            revoked_at: null,
            revoke_reason: null,
          },
        ])
      )
      .mockResolvedValueOnce(new Response('{"code":"42P01","message":"relation missing"}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{"message":"profiles unavailable"}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"message":"auth admin unavailable"}', { status: 500 }));

    const response = await GET(
      new NextRequest("http://localhost/api/admin/organizer-claims", {
        headers: { authorization: "Bearer admin-token" },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claims).toHaveLength(1);
    expect(payload.memberships).toHaveLength(1);
    expect(payload.editionRequests).toEqual([]);
    expect(payload.claims[0].user.label).toBe("orga@example.com");
    expect(payload.memberships[0].user.label).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("ignores invalid auth emails instead of failing the whole response", async () => {
    const mockFetch = vi.mocked(fetch);

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "22222222-2222-2222-2222-222222222222",
            created_at: "2026-05-28T09:00:00.000Z",
            updated_at: "2026-05-28T09:00:00.000Z",
            user_id: "33333333-3333-3333-3333-333333333333",
            event_id: "11111111-1111-1111-1111-111111111111",
            organization_name: "Trail Org",
            role_title: "RD",
            contact_email: "orga@example.com",
            status: "pending",
          },
        ])
      )
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse({
          users: [{ id: "33333333-3333-3333-3333-333333333333", email: "" }],
        })
      );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/organizer-claims", {
        headers: { authorization: "Bearer admin-token" },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claims).toHaveLength(1);
    expect(payload.claims[0].user.email).toBe("orga@example.com");
    expect(payload.claims[0].user.label).toBe("orga@example.com");
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
